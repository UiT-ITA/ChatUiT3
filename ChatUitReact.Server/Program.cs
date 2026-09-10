using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.AiProviders.Protocols;
using ChatUitReact.Server.Services.TokenCounting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Logging;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    IdentityModelEventSource.ShowPII = false;
}

// Messages are posted as a single JSON body including file content (base64-inflated),
// so the default 30 MB body limit is too small.
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024;
});


// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            string[] allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                ?? new[] { "https://localhost:54979" };

            policy.WithOrigins(allowedOrigins);
        }
        else
        {
            policy.SetIsOriginAllowed(origin => true);
        }
        policy.AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Authentication and Authorization
builder.Services.AddAuthorization();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    // Store the token for WebSockets to use after the initial HTTP handshake
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // Extract token from the query string for SignalR and EventSource
            var accessToken = context.Request.Query["access_token"];

            if (!string.IsNullOrEmpty(accessToken))
            {
                var path = context.HttpContext.Request.Path;

                if (path.StartsWithSegments("/testHub") ||
                    path.StartsWithSegments("/testAuthHub") ||
                    path.StartsWithSegments("/chatHub"))
                {
                    context.Token = accessToken;
                }

            }

            return Task.CompletedTask;
        }
    };
});


builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

// Register services
builder.Services.AddScoped<UserService>();
builder.Services.AddSingleton<StreamingService>();
//builder.Services.AddSingleton<IDatabaseService, MockDatabaseService>();
builder.Services.AddSingleton<IDatabaseService, DatabaseService>();
builder.Services.AddSingleton<IModelService, ModelService>();
builder.Services.AddSingleton<ISettingsService, SettingsService>();
builder.Services.AddSingleton<IChatService, ChatService>();
builder.Services.AddSingleton<IAssistantService, AssistantService>();
// One IApiProtocol per wire protocol and one IAiProvider (host) per EndpointType. A host
// composes the URL for the model's protocol and hands off to that protocol's adapter; the
// two registries resolve by type, so adding either is a single registration here.
builder.Services.AddSingleton<IApiProtocol, OpenAiResponsesProtocol>();
builder.Services.AddSingleton<IApiProtocol, OpenAiChatCompletionsProtocol>();
builder.Services.AddSingleton<IApiProtocol, AnthropicMessagesProtocol>();
builder.Services.AddSingleton<IApiProtocolRegistry, ApiProtocolRegistry>();
builder.Services.AddSingleton<IAiProvider, AzureOpenAiProvider>();
builder.Services.AddSingleton<IAiProvider, MicrosoftFoundryProvider>();
builder.Services.AddSingleton<IAiProvider, AnthropicProvider>();
builder.Services.AddSingleton<IAiProviderRegistry, AiProviderRegistry>();
builder.Services.AddSingleton<AiConversationRunner>();
builder.Services.AddSingleton<IToolService, ToolService>();
builder.Services.AddSingleton<ITokenCountingService, TokenCountingService>();

var app = builder.Build();

// The AzureOpenAI configuration is only used to seed an endpoint into the database on first
// run. Everything at request time reads endpoints from the database instead.
var seedEndpointUrl = app.Configuration["AzureOpenAI:Endpoint"];
var seedEndpointKey = app.Configuration["AzureOpenAI:ApiKey"];

if (!string.IsNullOrWhiteSpace(seedEndpointUrl) && !string.IsNullOrWhiteSpace(seedEndpointKey))
{
    var seedLogger = app.Services.GetRequiredService<ILogger<Program>>();
    try
    {
        var modelService = app.Services.GetRequiredService<IModelService>();
        var existingEndpoints = await modelService.GetAllEndpointsAsync();
        var alreadySeeded = existingEndpoints.Any(e =>
            string.Equals(e.Url.TrimEnd('/'), seedEndpointUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase));

        if (!alreadySeeded)
        {
            await modelService.CreateEndpointAsync(new ModelEndpoint
            {
                Url = seedEndpointUrl,
                ApiKey = seedEndpointKey,
                EndpointType = EndpointType.AzureOpenAI
            });
            seedLogger.LogInformation("Seeded Azure OpenAI endpoint {Url} from configuration.", seedEndpointUrl);
        }
    }
    catch (Exception ex)
    {
        seedLogger.LogError(ex, "Failed to seed the Azure OpenAI endpoint from configuration.");
    }
}

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
// Always apply CORS for SignalR to work properly
app.UseCors("AllowReactApp");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "OpenAPI V1");
    });
}

//app.UseRouting();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chatHub");
app.MapFallbackToFile("/index.html", new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        // index.html references hashed asset filenames that change on every deploy,
        // so it must be revalidated instead of cached
        context.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.Run();
