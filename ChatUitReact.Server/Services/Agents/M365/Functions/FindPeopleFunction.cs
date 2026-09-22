using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record FindPeopleArgs(
    [property: Description("A name, part of a name, or an email address to search for.")]
    string Query);

/// <summary>Resolves a name to directory users: the user's own frequent contacts first, then the whole directory.</summary>
public sealed class FindPeopleFunction : Tool<FindPeopleArgs>
{
    private static readonly string[] Scopes = [M365Scopes.PeopleRead, M365Scopes.UserReadBasicAll];
    private readonly GraphClient _graph;

    public FindPeopleFunction(GraphClient graph) => _graph = graph;

    public override string Id => "find_people";
    public override string DisplayName => "Find people";
    public override string Description => "Find people in the organisation by name or email. Returns id, display name, email (userPrincipalName), job title and department. Call this before any function that needs a user id or email. For the signed-in user call get_user with \"me\" instead.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(FindPeopleArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var query = args.Query.Trim().Replace("\"", string.Empty);
        if (query.Length == 0)
        {
            return ToolResult.Error("query must not be empty.");
        }

        var results = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

        var people = await _graph.GetAsync(invocation.Context,
            $"me/people?$search=\"{Uri.EscapeDataString(query)}\"&$top=10&$select=id,displayName,userPrincipalName,jobTitle,department,scoredEmailAddresses,personType",
            Scopes, ct);
        foreach (var p in people.Items())
        {
            if (p.Str("personType", "subclass") is { } subclass && !subclass.Equals("OrganizationUser", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var email = p.Str("userPrincipalName") ?? p.Items("scoredEmailAddresses").Select(e => e.Str("address")).FirstOrDefault();
            var key = p.Str("id") ?? email ?? Guid.NewGuid().ToString();
            results[key] = new
            {
                id = p.Str("id"),
                displayName = p.Str("displayName"),
                email,
                jobTitle = p.Str("jobTitle"),
                department = p.Str("department"),
                source = "contacts"
            };
        }

        var escaped = Uri.EscapeDataString(query);
        var users = await _graph.GetAsync(invocation.Context,
            $"users?$search=\"displayName:{escaped}\" OR \"mail:{escaped}\" OR \"userPrincipalName:{escaped}\"&$top=10&$select=id,displayName,userPrincipalName,mail,jobTitle,department&$count=true",
            Scopes, ct, eventual: true);
        foreach (var u in users.Items())
        {
            AddDirectoryUser(results, u);
        }

        // An address is also a key: /users/{upn} answers even when search indexing lags or the address is the UPN only.
        if (query.Contains('@') && !results.Values.Any())
        {
            try
            {
                var direct = await _graph.GetAsync(invocation.Context, $"users/{escaped}?$select=id,displayName,userPrincipalName,mail,jobTitle,department", Scopes, ct);
                AddDirectoryUser(results, direct);
            }
            catch (GraphRequestException ex) when (ex.Status == System.Net.HttpStatusCode.NotFound)
            {
            }
        }

        return results.Count == 0
            ? ToolResult.Text($"No people found for \"{query}\".")
            : ToolResult.Ok(new { query, people = results.Values });
    }

    private static void AddDirectoryUser(Dictionary<string, object> results, System.Text.Json.JsonElement u)
    {
        var key = u.Str("id");
        if (key == null || results.ContainsKey(key))
        {
            return;
        }

        results[key] = new
        {
            id = key,
            displayName = u.Str("displayName"),
            email = u.Str("mail") ?? u.Str("userPrincipalName"),
            userPrincipalName = u.Str("userPrincipalName"),
            jobTitle = u.Str("jobTitle"),
            department = u.Str("department"),
            source = "directory"
        };
    }
}
