using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService : IDatabaseService
{
    CosmosClient _cosmosClient;

    // Databases
    private readonly Database _userDatabase;
    private readonly Database _configDatabase;
    private readonly Database _knowledgeDatabase;

    // Containers
    // User data
    private readonly Container _userContainer;
    private readonly Container _chatContainer;
    private readonly Container _messageContainer;
    private readonly Container _fileContainer;

    // Configuration
    private readonly Container _endpointContainer;
    private readonly Container _modelContainer;
    private readonly Container _settingsContainer;



    public DatabaseService(IConfiguration configuration)
    {
        //var container = new CosmosClient(configuration["CosmosDb:ConnectionString"]!)
        //     .CreateDatabaseIfNotExistsAsync(configuration["CosmosDb:DatabaseName"]!)
        //     .GetAwaiter().GetResult()
        //     .Database
        //     .CreateContainerIfNotExistsAsync(configuration["CosmosDb:ContainerName"] ?? "test", "/id")
        //     .GetAwaiter().GetResult()
        //     .Container;

        //container.UpsertItemAsync(
        //    new { id = "smoke-test", value = "hello" },
        //    new PartitionKey("smoke-test"))
        //    .GetAwaiter().GetResult();

        //var result = container.ReadItemAsync<dynamic>(
        //    "smoke-test",
        //    new PartitionKey("smoke-test"))
        //    .GetAwaiter().GetResult();

        //Console.WriteLine(result.Resource.value);
    }
}
