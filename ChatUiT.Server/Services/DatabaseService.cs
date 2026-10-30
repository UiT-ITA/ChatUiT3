using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Buffers.Text;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

public partial class DatabaseService : IDatabaseService
{
    private const string ConfigurationSectionName = "CosmosNoSql";
    private const string ConfigurationPartitionKeyValue = "configuration";
    private const string CosmosBuiltInDataContributorRoleId = "00000000-0000-0000-0000-000000000002";

    private readonly CosmosChatStorageOptions _options;
    private readonly CosmosClient? _client;
    private readonly Database? _userDataDatabase;
    private readonly Database? _configurationDatabase;
    private readonly Container? _userContainer;
    private readonly Container? _chatContainer;
    private readonly Container? _chatMessageContainer;
    private readonly Container? _contentContainer;
    private readonly Container? _modelContainer;
    private readonly Container? _modelEndpointContainer;
    private readonly Container? _assistantContainer;
    private readonly Container? _assistantContentContainer;
    private readonly Container? _appSettingsContainer;
    private readonly Container? _toolPolicyContainer;
    private readonly Container? _internalAgentsContainer;
    private readonly object _initializationLock = new();
    private Task _initializationTask;
    private readonly IChatKeyService _chatKeys;
    private readonly ILogger<DatabaseService> _logger;
    private readonly TokenCredential _credential;
    private readonly bool _usesManagedIdentity;

    public DatabaseService(IConfiguration configuration, IChatKeyService chatKeys, TokenCredential credential, ILogger<DatabaseService> logger)
    {
        _chatKeys = chatKeys;
        _logger = logger;
        _credential = credential;
        _options = configuration.GetSection(ConfigurationSectionName).Get<CosmosChatStorageOptions>() ?? new CosmosChatStorageOptions();
        _options.ConnectionString ??= configuration.GetConnectionString("CosmosDBConnection");
        _options.ConnectionString ??= configuration.GetConnectionString("CosmosNoSql");

        if (!string.IsNullOrWhiteSpace(_options.AccountEndpoint))
        {
            _client = new CosmosClient(_options.AccountEndpoint, credential);
            _usesManagedIdentity = true;
        }
        else if (!string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            _client = new CosmosClient(_options.ConnectionString);
        }
        else
        {
            _initializationTask = Task.CompletedTask;
            return;
        }

        _userDataDatabase = _client.GetDatabase(_options.DatabaseName);
        _configurationDatabase = _client.GetDatabase(_options.ConfigurationDatabaseName);
        _userContainer = _userDataDatabase.GetContainer(_options.Users.Name);
        _chatContainer = _userDataDatabase.GetContainer(_options.Chats.Name);
        _chatMessageContainer = _userDataDatabase.GetContainer(_options.ChatMessages.Name);
        _contentContainer = _userDataDatabase.GetContainer(_options.Content.Name);
        _modelContainer = _configurationDatabase.GetContainer(_options.Models.Name);
        _modelEndpointContainer = _configurationDatabase.GetContainer(_options.ModelEndpoints.Name);
        _assistantContainer = _configurationDatabase.GetContainer(_options.Assistants.Name);
        _assistantContentContainer = _configurationDatabase.GetContainer(_options.AssistantContent.Name);
        _appSettingsContainer = _configurationDatabase.GetContainer(_options.AppSettings.Name);
        _toolPolicyContainer = _configurationDatabase.GetContainer(_options.ToolPolicies.Name);
        _internalAgentsContainer = _configurationDatabase.GetContainer(_options.InternalAgents.Name);
        _initializationTask = InitializeAsync();
    }

    private async Task EnsureInitializedAsync()
    {
        if (_userDataDatabase == null || _configurationDatabase == null ||
            _userContainer == null || _chatContainer == null || _chatMessageContainer == null || _contentContainer == null ||
            _modelContainer == null || _modelEndpointContainer == null || _assistantContainer == null || _assistantContentContainer == null ||
            _appSettingsContainer == null || _toolPolicyContainer == null || _internalAgentsContainer == null)
        {
            throw new InvalidOperationException("DatabaseService is not configured. Set CosmosNoSql:AccountEndpoint (managed identity), or a Cosmos NoSQL connection string under ConnectionStrings:CosmosDBConnection or CosmosNoSql:ConnectionString.");
        }

        Task initialization;
        lock (_initializationLock)
        {
            if (_initializationTask.IsFaulted && _initializationTask.Exception?.InnerException is not CosmosSetupException)
            {
                _initializationTask = InitializeAsync();
            }
            initialization = _initializationTask;
        }

        await initialization;
    }

    /// <summary>Missing databases or containers, or no data access: fails every database call until the app restarts.</summary>
    private sealed class CosmosSetupException(string message, Exception? innerException = null) : InvalidOperationException(message, innerException);

    /// <summary>
    /// Checks that every database and container exists, and creates nothing. When something is
    /// missing or access is denied, logs what an admin must create or assign, with the az
    /// commands, and throws <see cref="CosmosSetupException"/>. Any other failure is logged and
    /// the check runs again on the next database call.
    /// </summary>
    private async Task InitializeAsync()
    {
        if (_client == null || _userDataDatabase == null || _configurationDatabase == null)
        {
            return;
        }

        var expected = new List<(Database Database, CosmosContainerOptions Container, bool ExcludePayload)>
        {
            (_userDataDatabase, _options.Users, false),
            (_userDataDatabase, _options.Chats, false),
            (_userDataDatabase, _options.ChatMessages, false),
            (_userDataDatabase, _options.Content, true),
            (_configurationDatabase, _options.Models, false),
            (_configurationDatabase, _options.ModelEndpoints, false),
            (_configurationDatabase, _options.Assistants, false),
            (_configurationDatabase, _options.AssistantContent, true),
            (_configurationDatabase, _options.AppSettings, false),
            (_configurationDatabase, _options.ToolPolicies, false),
            (_configurationDatabase, _options.InternalAgents, false)
        };

        List<string> missingDatabases;
        List<(string DatabaseName, CosmosContainerOptions Container, bool ExcludePayload)> missingContainers;
        try
        {
            var databases = new[] { _userDataDatabase, _configurationDatabase };
            var databaseExists = await Task.WhenAll(databases.Select(database => ExistsAsync(() => database.ReadAsync())));
            missingDatabases = databases.Where((_, i) => !databaseExists[i]).Select(database => database.Id).ToList();

            var containerExists = await Task.WhenAll(expected.Select(item =>
                missingDatabases.Contains(item.Database.Id)
                    ? Task.FromResult(false)
                    : ExistsAsync(() => item.Database.GetContainer(item.Container.Name).ReadContainerAsync())));
            missingContainers = expected
                .Where((_, i) => !containerExists[i])
                .Select(item => (item.Database.Id, item.Container, item.ExcludePayload))
                .ToList();
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.Forbidden)
        {
            _logger.LogCritical("{Message}", await BuildAccessDeniedMessageAsync(ex));
            throw new CosmosSetupException("Cosmos DB denied access to the app identity. See the startup log for the role assignment.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "The Cosmos DB check at {Endpoint} failed. It runs again on the next database call.", _client.Endpoint);
            throw;
        }

        if (missingDatabases.Count == 0 && missingContainers.Count == 0)
        {
            _logger.LogInformation("Cosmos DB {Endpoint}: all databases and containers exist.", _client.Endpoint);
            return;
        }

        _logger.LogCritical("{Message}", await BuildMissingMessageAsync(missingDatabases, missingContainers));
        throw new CosmosSetupException("Cosmos DB is missing databases or containers. See the startup log for what to create.");
    }

    private static string ConfigurationPartitionKey => ConfigurationPartitionKeyValue;

    private static async Task<bool> ExistsAsync(Func<Task> read)
    {
        try
        {
            await read();
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private string AccountName => _client!.Endpoint.Host.Split('.')[0];

    private async Task<string> BuildMissingMessageAsync(
        List<string> missingDatabases,
        List<(string DatabaseName, CosmosContainerOptions Container, bool ExcludePayload)> missingContainers)
    {
        var message = new StringBuilder();
        message.AppendLine();
        message.AppendLine("==================== COSMOS DB SETUP REQUIRED ====================");
        message.AppendLine($"Account: {AccountName} ({_client!.Endpoint})");
        message.AppendLine("The app does not create databases or containers. An admin must create the ones below, then restart the app.");
        message.AppendLine();
        message.AppendLine("Missing:");
        foreach (var databaseName in missingDatabases)
        {
            message.AppendLine($"  - database {databaseName}");
        }
        foreach (var (databaseName, container, excludePayload) in missingContainers)
        {
            var indexing = excludePayload ? "all paths except /payload/?" : "default (all paths)";
            message.AppendLine($"  - container {databaseName}/{container.Name}   partition key: {container.PartitionKeyPath}   indexing: {indexing}");
        }
        message.AppendLine();
        message.AppendLine("Create them with az (replace <resource-group> with the account's resource group):");
        foreach (var databaseName in missingDatabases)
        {
            message.AppendLine($"  az cosmosdb sql database create --account-name {AccountName} --resource-group <resource-group> --name {databaseName}");
        }
        foreach (var (databaseName, container, excludePayload) in missingContainers)
        {
            var command = $"  az cosmosdb sql container create --account-name {AccountName} --resource-group <resource-group> " +
                          $"--database-name {databaseName} --name {container.Name} --partition-key-path {container.PartitionKeyPath}";
            if (excludePayload)
            {
                command += " --idx '{\"indexingMode\":\"consistent\",\"automatic\":true,\"includedPaths\":[{\"path\":\"/*\"}],\"excludedPaths\":[{\"path\":\"/payload/?\"}]}'";
            }
            message.AppendLine(command);
        }
        if (_usesManagedIdentity)
        {
            message.AppendLine();
            await AppendRoleAssignmentAsync(message);
        }
        message.AppendLine("==================================================================");
        return message.ToString();
    }

    private async Task<string> BuildAccessDeniedMessageAsync(CosmosException ex)
    {
        var message = new StringBuilder();
        message.AppendLine();
        message.AppendLine("==================== COSMOS DB ACCESS DENIED ====================");
        message.AppendLine($"Account: {AccountName} ({_client!.Endpoint})");
        message.AppendLine($"Cosmos DB returned 403 (substatus {ex.SubStatusCode}) when the app read its databases.");
        message.AppendLine();
        await AppendRoleAssignmentAsync(message);
        if (!string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            message.AppendLine();
            message.AppendLine("A connection string is also configured but not used while CosmosNoSql:AccountEndpoint is set.");
            message.AppendLine("To connect with the connection string instead, set CosmosNoSql:AccountEndpoint to an empty value.");
        }
        message.AppendLine("=================================================================");
        return message.ToString();
    }

    private async Task AppendRoleAssignmentAsync(StringBuilder message)
    {
        var principalId = await GetPrincipalIdAsync();
        message.AppendLine($"The identity the app runs as ({principalId ?? "object ID unknown"}) needs the \"Cosmos DB Built-in Data Contributor\" role on the account.");
        message.AppendLine("Assign it, then restart the app (replace <resource-group> with the account's resource group):");
        message.AppendLine($"  az cosmosdb sql role assignment create --account-name {AccountName} --resource-group <resource-group> " +
                           $"--scope \"/\" --principal-id {principalId ?? "<principal-id>"} --role-definition-id {CosmosBuiltInDataContributorRoleId}");
    }

    /// <summary>The object ID (oid claim) in the token the credential gets for this account, or null when it cannot be read.</summary>
    private async Task<string?> GetPrincipalIdAsync()
    {
        try
        {
            var scope = $"{_client!.Endpoint.GetLeftPart(UriPartial.Authority)}/.default";
            var token = await _credential.GetTokenAsync(new TokenRequestContext([scope]), CancellationToken.None);
            using var json = JsonDocument.Parse(Base64Url.DecodeFromChars(token.Token.Split('.')[1]));
            return json.RootElement.TryGetProperty("oid", out var oid) ? oid.GetString() : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read the object ID from the Cosmos DB token.");
            return null;
        }
    }

    private async Task<List<T>> QueryItemsAsync<T>(Container container, QueryDefinition query, string userId)
    {
        var items = new List<T>();
        using var iterator = container.GetItemQueryIterator<T>(
            queryDefinition: query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync();
            items.AddRange(response);
        }

        return items;
    }

    private async Task DeleteItemsByQueryAsync(Container container, QueryDefinition query, string userId)
    {
        var items = await QueryItemsAsync<IdOnlyDocument>(container, query, userId);
        foreach (var item in items)
        {
            await container.DeleteItemAsync<IdOnlyDocument>(item.Id, new PartitionKey(userId));
        }
    }

    private async Task<T?> ReadItemOrDefaultAsync<T>(Container container, string id, string userId) where T : class
    {
        try
        {
            var response = await container.ReadItemAsync<T>(id, new PartitionKey(userId));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
