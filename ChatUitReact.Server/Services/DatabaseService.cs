using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public class DatabaseService
{
    /*
    private readonly IMongoClient _mongoClient;
    private readonly IMongoDatabase _userDatabase;
    private readonly IMongoDatabase _configDatabase;

    // User Database Collections
    private readonly IMongoCollection<UserInfo> _userCollection;
    private readonly IMongoCollection<DbChat> _chatCollection;
    private readonly IMongoCollection<DbChatMessage> _messageCollection;
    private readonly IMongoCollection<DbFileMetadata> _fileMetadataCollection;
    private readonly IMongoCollection<DbFileChunk> _fileChunkCollection;

    // Config Database Collections
    private readonly IMongoCollection<DbModel> _modelCollection;
    private readonly IMongoCollection<DbAssistant> _assistantCollection;
    private readonly IMongoCollection<DbModelEndpoint> _endpointCollection;
    private readonly IMongoCollection<DbChatTool> _toolCollection;
    */
    public DatabaseService(IConfiguration configuration)
    {
        /*
        // Retrieve the connection string from configuration
        var connectionString = configuration["ConnectionStrings:CosmosDBConnection"];

        // Database names
        const string userDatabase = "Users";
        const string configDatabase = "Config";

        _mongoClient = new MongoClient(connectionString);
        _userDatabase = _mongoClient.GetDatabase(userDatabase);
        _configDatabase = _mongoClient.GetDatabase(configDatabase);

        // Initialize user database collections
        _userCollection = _userDatabase.GetCollection<UserInfo>("Users");
        _chatCollection = _userDatabase.GetCollection<DbChat>("Chats");
        _messageCollection = _userDatabase.GetCollection<DbChatMessage>("Messages");
        _fileMetadataCollection = _userDatabase.GetCollection<DbFileMetadata>("Files");
        _fileChunkCollection = _userDatabase.GetCollection<DbFileChunk>("FileChunks");

        // Initialize config database collections
        _modelCollection = _configDatabase.GetCollection<DbModel>("Models");
        _assistantCollection = _configDatabase.GetCollection<DbAssistant>("Assistants");
        _endpointCollection = _configDatabase.GetCollection<DbModelEndpoint>("Endpoints");
        _toolCollection = _configDatabase.GetCollection<DbChatTool>("Tools");
        */
    }
}
