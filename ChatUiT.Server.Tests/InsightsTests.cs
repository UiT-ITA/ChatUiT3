using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using ChatUiT.Server.Controllers;
using ChatUiT.Server.Models.Insights;
using ChatUiT.Server.Services.Insights;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChatUiT.Server.Tests;

/// <summary>Access to the Insights API and the caching of its query results.</summary>
public class InsightsTests
{
    [Fact]
    public async Task Anonymous_request_is_refused()
    {
        await using var app = await StartAsync();

        var response = await app.GetTestClient().GetAsync("/api/insights/usage");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(TestAuthHandler.NoRole)]
    [InlineData("User")]
    [InlineData("Administrator")]
    public async Task Non_admin_is_refused(string role)
    {
        await using var app = await StartAsync();

        var response = await Client(app, role).GetAsync("/api/insights/usage");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("usage")]
    [InlineData("models")]
    [InlineData("diagnostics")]
    [InlineData("logging")]
    public async Task Admin_gets_every_query_of_a_page(string page)
    {
        await using var app = await StartAsync();

        var response = await Client(app, "Admin").GetAsync($"/api/insights/{page}?range=7d");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        foreach (var query in InsightsQueries.Pages[page].Keys)
        {
            Assert.Contains($"\"{query}\":", body);
        }
    }

    [Fact]
    public async Task Unknown_page_is_not_found()
    {
        await using var app = await StartAsync();

        var response = await Client(app, "Admin").GetAsync("/api/insights/secrets");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_range_is_a_bad_request()
    {
        await using var app = await StartAsync();

        var response = await Client(app, "Admin").GetAsync("/api/insights/usage?range=1y");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Page_is_cached_per_range()
    {
        var runner = new CountingRunner();
        var service = new InsightsService(runner, new MemoryCache(new MemoryCacheOptions()), TimeProvider.System);
        var day = InsightsRange.Find("24h")!;
        var week = InsightsRange.Find("7d")!;
        var queryCount = InsightsQueries.Pages["usage"].Count;

        await service.GetPageAsync("usage", day, CancellationToken.None);
        await service.GetPageAsync("usage", day, CancellationToken.None);
        Assert.Equal(queryCount, runner.Calls);

        await service.GetPageAsync("usage", week, CancellationToken.None);
        Assert.Equal(queryCount * 2, runner.Calls);
    }

    [Fact]
    public async Task Page_with_a_failed_query_is_cached_briefly()
    {
        var runner = new CountingRunner { Result = InsightsTableDto.Failed(InsightsErrors.NoAccess) };
        var clock = new TestClock();
        var service = new InsightsService(runner, new MemoryCache(new MemoryCacheOptions { Clock = clock }), TimeProvider.System);
        var range = InsightsRange.Find("24h")!;
        var queryCount = InsightsQueries.Pages["models"].Count;

        var page = await service.GetPageAsync("models", range, CancellationToken.None);
        await service.GetPageAsync("models", range, CancellationToken.None);
        Assert.All(page.Tables.Values, table => Assert.Equal(InsightsErrors.NoAccess, table.Error));
        Assert.Equal(queryCount, runner.Calls);

        clock.UtcNow += InsightsService.FailureCacheDuration + TimeSpan.FromSeconds(1);
        await service.GetPageAsync("models", range, CancellationToken.None);
        Assert.Equal(queryCount * 2, runner.Calls);
    }

    [Fact]
    public async Task Concurrent_requests_share_one_run()
    {
        var release = new TaskCompletionSource();
        var runner = new CountingRunner { Gate = release.Task };
        var service = new InsightsService(runner, new MemoryCache(new MemoryCacheOptions()), TimeProvider.System);
        var range = InsightsRange.Find("24h")!;

        var first = service.GetPageAsync("usage", range, CancellationToken.None);
        var second = service.GetPageAsync("usage", range, CancellationToken.None);
        release.SetResult();
        await Task.WhenAll(first, second);

        Assert.Equal(InsightsQueries.Pages["usage"].Count, runner.Calls);
        Assert.Same(await first, await second);
    }

    [Fact]
    public async Task Runner_without_a_resource_reports_not_configured()
    {
        var runner = new LogsQueryRunner(new Azure.Identity.DefaultAzureCredential(), Options.Create(new InsightsOptions()), new LoggerFactory().CreateLogger<LogsQueryRunner>());

        var table = await runner.RunAsync("customEvents | take 1", TimeSpan.FromHours(1), CancellationToken.None);

        Assert.Equal(InsightsErrors.NotConfigured, table.Error);
    }

    [Fact]
    public async Task Runner_reports_no_access_when_the_credential_fails()
    {
        var options = Options.Create(new InsightsOptions { ApplicationInsightsResourceId = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg/providers/microsoft.insights/components/app" });
        var runner = new LogsQueryRunner(new FailingCredential(), options, new LoggerFactory().CreateLogger<LogsQueryRunner>());

        var table = await runner.RunAsync("customEvents | take 1", TimeSpan.FromHours(1), CancellationToken.None);

        Assert.Equal(InsightsErrors.NoAccess, table.Error);
    }

    /// <summary>A credential that cannot get a token, as when no managed identity or sign-in is available.</summary>
    private sealed class FailingCredential : Azure.Core.TokenCredential
    {
        public override Azure.Core.AccessToken GetToken(Azure.Core.TokenRequestContext requestContext, CancellationToken cancellationToken) =>
            throw new Azure.Identity.CredentialUnavailableException("No credential available.");

        public override ValueTask<Azure.Core.AccessToken> GetTokenAsync(Azure.Core.TokenRequestContext requestContext, CancellationToken cancellationToken) =>
            throw new Azure.Identity.CredentialUnavailableException("No credential available.");
    }

    private static HttpClient Client(WebApplication app, string role)
    {
        var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        return client;
    }

    private static async Task<WebApplication> StartAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddControllers().AddApplicationPart(typeof(InsightsController).Assembly);
        builder.Services.AddAuthentication(TestAuthHandler.Scheme)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.Scheme, null);
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IInsightsService>(new InsightsService(new CountingRunner(), new MemoryCache(new MemoryCacheOptions()), TimeProvider.System));

        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }

    /// <summary>Returns the same table for every query and counts the calls.</summary>
    private sealed class CountingRunner : IInsightsQueryRunner
    {
        private int _calls;

        public int Calls => _calls;

        public InsightsTableDto Result { get; init; } = new()
        {
            Columns = [new InsightsColumnDto("n", "long")],
            Rows = [[1L]]
        };

        // A task each run waits for before it returns
        public Task Gate { get; init; } = Task.CompletedTask;

        public async Task<InsightsTableDto> RunAsync(string query, TimeSpan duration, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            await Gate;
            return Result;
        }
    }

    /// <summary>A cache clock the test moves forward.</summary>
    private sealed class TestClock : Microsoft.Extensions.Internal.ISystemClock
    {
        public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.UtcNow;
    }

    /// <summary>Signs in a user with the role in the X-Test-Role header, or with no role for "none", and nobody without the header.</summary>
    private sealed class TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string Scheme = "Test";
        public const string RoleHeader = "X-Test-Role";
        public const string NoRole = "none";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(RoleHeader, out var role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var claims = new List<Claim> { new(ClaimTypes.Name, "test-user") };
            if (role != NoRole)
            {
                claims.Add(new Claim(ClaimTypes.Role, role!));
            }

            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme));
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme)));
        }
    }
}
