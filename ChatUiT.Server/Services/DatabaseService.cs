using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

public partial class DatabaseService : IDatabaseService
{
    private const string ConfigurationSectionName = "CosmosNoSql";
    private const string ConfigurationPartitionKeyValue = "configuration";

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
    private readonly Task _initializationTask;
    private readonly IChatKeyService _chatKeys;
    private readonly ILogger<DatabaseService> _logger;

    public DatabaseService(IConfiguration configuration, IChatKeyService chatKeys, ILogger<DatabaseService> logger)
    {
        _chatKeys = chatKeys;
        _logger = logger;
        _options = configuration.GetSection(ConfigurationSectionName).Get<CosmosChatStorageOptions>() ?? new CosmosChatStorageOptions();
        _options.ConnectionString ??= configuration.GetConnectionString("CosmosDBConnection");
        _options.ConnectionString ??= configuration.GetConnectionString("CosmosNoSql");

        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            _initializationTask = Task.CompletedTask;
            return;
        }

        _client = new CosmosClient(_options.ConnectionString);
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
            throw new InvalidOperationException("DatabaseService is not configured. Add a valid Cosmos NoSQL connection string under ConnectionStrings:CosmosDBConnection or CosmosNoSql:ConnectionString.");
        }

        await _initializationTask;
    }

    private async Task InitializeAsync()
    {
        if (_client == null || _userDataDatabase == null || _configurationDatabase == null)
        {
            return;
        }

        await _client.CreateDatabaseIfNotExistsAsync(_options.DatabaseName);
        await _client.CreateDatabaseIfNotExistsAsync(_options.ConfigurationDatabaseName);

        await EnsureContainerExistsAsync(_userDataDatabase, CreateContainerProperties(_options.Users));
        await EnsureContainerExistsAsync(_userDataDatabase, CreateContainerProperties(_options.Chats));
        await EnsureContainerExistsAsync(_userDataDatabase, CreateContainerProperties(_options.ChatMessages));
        await EnsureContainerExistsAsync(_userDataDatabase, CreateContentContainerProperties(_options.Content));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.Models));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.ModelEndpoints));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.Assistants));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContentContainerProperties(_options.AssistantContent));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.AppSettings));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.ToolPolicies));
        await EnsureContainerExistsAsync(_configurationDatabase, CreateContainerProperties(_options.InternalAgents));
    }

    private static string ConfigurationPartitionKey => ConfigurationPartitionKeyValue;

    private async Task EnsureContainerExistsAsync(Database database, ContainerProperties properties)
    {
        await database.CreateContainerIfNotExistsAsync(properties);
    }

    private static ContainerProperties CreateContainerProperties(CosmosContainerOptions containerOptions)
    {
        return new ContainerProperties(containerOptions.Name, containerOptions.PartitionKeyPath);
    }

    private static ContainerProperties CreateContentContainerProperties(CosmosContainerOptions containerOptions)
    {
        var properties = new ContainerProperties(containerOptions.Name, containerOptions.PartitionKeyPath);
        properties.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = "/*" });
        properties.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/payload/?" });
        return properties;
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
