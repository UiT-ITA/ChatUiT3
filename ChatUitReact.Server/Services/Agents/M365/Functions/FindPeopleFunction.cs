using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record FindPeopleArgs(
    [property: Description("A name or part of a name to search for.")]
    string Query);

/// <summary>
/// Resolves a name to people: the user's frequent colleagues first, then the whole directory,
/// then the user's Outlook contacts for people outside the organisation.
/// </summary>
public sealed class FindPeopleFunction : Tool<FindPeopleArgs>
{
    private static readonly string[] Scopes = [M365Scopes.PeopleRead, M365Scopes.UserReadBasicAll, M365Scopes.ContactsRead];
    private readonly GraphClient _graph;

    public FindPeopleFunction(GraphClient graph) => _graph = graph;

    public override string Id => "find_people";
    public override string DisplayName => "Find people";
    public override string Description => "Find people by name in the organisation and in the user's Outlook contacts. Organisation people (inOrganization: true) have an id; frequent: true marks people the user works with. Contacts have no id and can only be emailed or invited. Email addresses given in the task need no lookup. For the signed-in user call get_user with \"me\" instead.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(FindPeopleArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var query = args.Query.Trim().Replace("\"", string.Empty);
        if (query.Length == 0)
        {
            return ToolResult.Error("query must not be empty.");
        }

        var results = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

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
            Remember(emails, email);
            foreach (var scored in p.Items("scoredEmailAddresses"))
            {
                Remember(emails, scored.Str("address"));
            }

            results[key] = new
            {
                id = p.Str("id"),
                displayName = p.Str("displayName"),
                email,
                jobTitle = p.Str("jobTitle"),
                department = p.Str("department"),
                inOrganization = true,
                frequent = true
            };
        }

        var escaped = Uri.EscapeDataString(query);
        var users = await _graph.GetAsync(invocation.Context,
            $"users?$search=\"displayName:{escaped}\" OR \"mail:{escaped}\" OR \"userPrincipalName:{escaped}\"&$top=10&$select=id,displayName,userPrincipalName,mail,jobTitle,department&$count=true",
            Scopes, ct, eventual: true);
        foreach (var u in users.Items())
        {
            AddDirectoryUser(results, emails, u);
        }

        // An address is also a key: /users/{upn} answers even when search indexing lags or the address is the UPN only.
        if (query.Contains('@') && !results.Values.Any())
        {
            try
            {
                var direct = await _graph.GetAsync(invocation.Context, $"users/{escaped}?$select=id,displayName,userPrincipalName,mail,jobTitle,department", Scopes, ct);
                AddDirectoryUser(results, emails, direct);
            }
            catch (GraphRequestException ex) when (ex.Status == System.Net.HttpStatusCode.NotFound)
            {
            }
        }

        var contacts = await _graph.GetAsync(invocation.Context,
            $"me/contacts?$top=10&$filter={Uri.EscapeDataString(ContactFilter(query))}&$select=id,displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle",
            Scopes, ct);
        foreach (var c in contacts.Items())
        {
            var addresses = c.Items("emailAddresses").Select(e => e.Str("address")).OfType<string>().ToList();
            if (addresses.Any(emails.Contains))
            {
                // Already found in the organisation; that entry has the id.
                continue;
            }

            results[$"contact:{c.Str("id")}"] = new
            {
                displayName = c.Str("displayName"),
                email = addresses.FirstOrDefault(),
                otherEmails = addresses.Skip(1).ToList(),
                phones = c.Items("businessPhones").Select(p => p.GetString()).Append(c.Str("mobilePhone")).OfType<string>().ToList(),
                company = c.Str("companyName"),
                jobTitle = c.Str("jobTitle"),
                inOrganization = false
            };
        }

        return results.Count == 0
            ? ToolResult.Text($"No people found for \"{query}\".")
            : ToolResult.Ok(new { query, people = results.Values });
    }

    /// <summary>Contacts do not support $search; match the start of the name parts, or the exact address.</summary>
    private static string ContactFilter(string query)
    {
        var q = query.Replace("'", "''");
        return query.Contains('@')
            ? $"emailAddresses/any(a:a/address eq '{q}')"
            : $"startswith(displayName,'{q}') or startswith(givenName,'{q}') or startswith(surname,'{q}')";
    }

    private static void Remember(HashSet<string> emails, string? email)
    {
        if (email != null)
        {
            emails.Add(email);
        }
    }

    private static void AddDirectoryUser(Dictionary<string, object> results, HashSet<string> emails, JsonElement u)
    {
        Remember(emails, u.Str("mail"));
        Remember(emails, u.Str("userPrincipalName"));

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
            inOrganization = true,
            frequent = false
        };
    }
}
