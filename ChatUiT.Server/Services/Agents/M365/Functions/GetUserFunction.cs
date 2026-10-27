using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetUserArgs(
    [property: Description("The user's id or email (userPrincipalName). Use \"me\" for the signed-in user.")]
    string UserIdOrEmail);

public sealed class GetUserFunction : Tool<GetUserArgs>
{
    private static readonly string[] Scopes = [M365Scopes.UserRead, M365Scopes.UserReadBasicAll];
    private readonly GraphClient _graph;

    public GetUserFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_user";
    public override string DisplayName => "Get user";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Get one user's profile: display name, email, job title, department, office, phones and manager. Pass \"me\" for the signed-in user.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetUserArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var target = args.UserIdOrEmail.Trim();
        var basePath = target.Equals("me", StringComparison.OrdinalIgnoreCase) ? "me" : $"users/{Uri.EscapeDataString(target)}";

        var user = await _graph.GetAsync(invocation.Context,
            $"{basePath}?$select=id,displayName,userPrincipalName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones,preferredLanguage",
            Scopes, ct);

        object? manager = null;
        try
        {
            var m = await _graph.GetAsync(invocation.Context, $"{basePath}/manager?$select=id,displayName,userPrincipalName,mail,jobTitle", Scopes, ct);
            manager = new { id = m.Str("id"), displayName = m.Str("displayName"), email = m.Str("mail") ?? m.Str("userPrincipalName"), jobTitle = m.Str("jobTitle") };
        }
        catch (GraphRequestException ex) when (ex.Status == HttpStatusCode.NotFound)
        {
        }

        return ToolResult.Ok(new
        {
            id = user.Str("id"),
            displayName = user.Str("displayName"),
            email = user.Str("mail") ?? user.Str("userPrincipalName"),
            userPrincipalName = user.Str("userPrincipalName"),
            jobTitle = user.Str("jobTitle"),
            department = user.Str("department"),
            officeLocation = user.Str("officeLocation"),
            mobilePhone = user.Str("mobilePhone"),
            preferredLanguage = user.Str("preferredLanguage"),
            manager
        });
    }
}
