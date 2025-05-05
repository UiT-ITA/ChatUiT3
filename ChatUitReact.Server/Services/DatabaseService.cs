using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.Storage;

namespace ChatUitReact.Server.Services
{
    public class DatabaseService
    {
        private readonly IMongoClient _mongoClient;
        private readonly IMongoDatabase _userDatabase;
        private readonly IMongoDatabase _configDatabase;

        // User Database Collections
        private readonly IMongoCollection<UserPreferences> _userCollection;
        private readonly IMongoCollection<DbChat> _chatCollection;
        private readonly IMongoCollection<DbChatMessage> _messageCollection;
        private readonly IMongoCollection<DbFileMetadata> _fileMetadataCollection;
        private readonly IMongoCollection<DbFileChunk> _fileChunkCollection;
        private readonly IMongoCollection<DbFileBinaryChunk> _fileBinaryChunkCollection;

        // Config Database Collections
        private readonly IMongoCollection<DbModel> _modelCollection;
        private readonly IMongoCollection<DbAssistant> _assistantCollection;
        private readonly IMongoCollection<DbModelEndpoint> _endpointCollection;
        private readonly IMongoCollection<DbChatTool> _toolCollection;

        public DatabaseService(IConfiguration configuration)
        {
            // Retrieve the connection string from configuration
            var connectionString = configuration["ConnectionStrings:CosmosDBConnection"];

            // Database names
            const string userDatabase = "Users";
            const string configDatabase = "Config";

            _mongoClient = new MongoClient(connectionString);
            _userDatabase = _mongoClient.GetDatabase(userDatabase);
            _configDatabase = _mongoClient.GetDatabase(configDatabase);

            // Initialize user database collections
            _userCollection = _userDatabase.GetCollection<UserPreferences>("Users");
            _chatCollection = _userDatabase.GetCollection<DbChat>("Chats");
            _messageCollection = _userDatabase.GetCollection<DbChatMessage>("Messages");
            _fileMetadataCollection = _userDatabase.GetCollection<DbFileMetadata>("Files");
            _fileChunkCollection = _userDatabase.GetCollection<DbFileChunk>("FileChunks");
            _fileBinaryChunkCollection = _userDatabase.GetCollection<DbFileBinaryChunk>("FileBinaryChunks");

            // Initialize config database collections
            _modelCollection = _configDatabase.GetCollection<DbModel>("Models");
            _assistantCollection = _configDatabase.GetCollection<DbAssistant>("Assistants");
            _endpointCollection = _configDatabase.GetCollection<DbModelEndpoint>("Endpoints");
            _toolCollection = _configDatabase.GetCollection<DbChatTool>("Tools");
            
            // Create indexes for better performance
            CreateIndexesAsync().GetAwaiter().GetResult();
        }
        
        private async Task CreateIndexesAsync()
        {
            try
            {
                // Index for User collection
                var userIndexes = await _userCollection.Indexes.ListAsync();
                var userIndexNames = await userIndexes.ToListAsync();
                if (!userIndexNames.Any(i => i["name"] == "UserId_1"))
                {
                    var userIndexModel = new CreateIndexModel<UserPreferences>(
                        Builders<UserPreferences>.IndexKeys.Ascending(u => u.UserId),
                        new CreateIndexOptions { Name = "UserId_1", Unique = true });
                    await _userCollection.Indexes.CreateOneAsync(userIndexModel);
                }
                
                // Indexes for Chat collection (sharded by Username)
                var chatIndexes = await _chatCollection.Indexes.ListAsync();
                var chatIndexNames = await chatIndexes.ToListAsync();
                if (!chatIndexNames.Any(i => i["name"] == "Username_1"))
                {
                    var chatIndexModel = new CreateIndexModel<DbChat>(
                        Builders<DbChat>.IndexKeys.Ascending(c => c.Username),
                        new CreateIndexOptions { Name = "Username_1" });
                    await _chatCollection.Indexes.CreateOneAsync(chatIndexModel);
                }
                
                // Indexes for Message collection
                var messageIndexes = await _messageCollection.Indexes.ListAsync();
                var messageIndexNames = await messageIndexes.ToListAsync();
                if (!messageIndexNames.Any(i => i["name"] == "ChatId_1"))
                {
                    var messageIndexModel = new CreateIndexModel<DbChatMessage>(
                        Builders<DbChatMessage>.IndexKeys.Ascending(m => m.ChatId),
                        new CreateIndexOptions { Name = "ChatId_1" });
                    await _messageCollection.Indexes.CreateOneAsync(messageIndexModel);
                }
                
                if (!messageIndexNames.Any(i => i["name"] == "Username_1"))
                {
                    var usernameIndexModel = new CreateIndexModel<DbChatMessage>(
                        Builders<DbChatMessage>.IndexKeys.Ascending(m => m.Username),
                        new CreateIndexOptions { Name = "Username_1" });
                    await _messageCollection.Indexes.CreateOneAsync(usernameIndexModel);
                }
                
                // Indexes for FileMetadata collection
                var fileIndexes = await _fileMetadataCollection.Indexes.ListAsync();
                var fileIndexNames = await fileIndexes.ToListAsync();
                if (!fileIndexNames.Any(i => i["name"] == "Username_1"))
                {
                    var fileIndexModel = new CreateIndexModel<DbFileMetadata>(
                        Builders<DbFileMetadata>.IndexKeys.Ascending(f => f.Username),
                        new CreateIndexOptions { Name = "Username_1" });
                    await _fileMetadataCollection.Indexes.CreateOneAsync(fileIndexModel);
                }
                
                // Indexes for FileChunks collection
                var fileChunkIndexes = await _fileChunkCollection.Indexes.ListAsync();
                var fileChunkNames = await fileChunkIndexes.ToListAsync();
                if (!fileChunkNames.Any(i => i["name"] == "FileId_1_Order_1"))
                {
                    var fileChunkModel = new CreateIndexModel<DbFileChunk>(
                        Builders<DbFileChunk>.IndexKeys
                            .Ascending(f => f.FileId)
                            .Ascending(f => f.Order),
                        new CreateIndexOptions { Name = "FileId_1_Order_1" });
                    await _fileChunkCollection.Indexes.CreateOneAsync(fileChunkModel);
                }
                
                if (!fileChunkNames.Any(i => i["name"] == "Username_1"))
                {
                    var usernameIndexModel = new CreateIndexModel<DbFileChunk>(
                        Builders<DbFileChunk>.IndexKeys.Ascending(f => f.Username),
                        new CreateIndexOptions { Name = "Username_1" });
                    await _fileChunkCollection.Indexes.CreateOneAsync(usernameIndexModel);
                }
                
                // Indexes for FileBinaryChunks collection
                var fileBinaryChunkIndexes = await _fileBinaryChunkCollection.Indexes.ListAsync();
                var fileBinaryChunkNames = await fileBinaryChunkIndexes.ToListAsync();
                if (!fileBinaryChunkNames.Any(i => i["name"] == "FileId_1_ChunkNumber_1"))
                {
                    var fileBinaryChunkModel = new CreateIndexModel<DbFileBinaryChunk>(
                        Builders<DbFileBinaryChunk>.IndexKeys
                            .Ascending(f => f.FileId)
                            .Ascending(f => f.ChunkNumber),
                        new CreateIndexOptions { Name = "FileId_1_ChunkNumber_1" });
                    await _fileBinaryChunkCollection.Indexes.CreateOneAsync(fileBinaryChunkModel);
                }
                
                if (!fileBinaryChunkNames.Any(i => i["name"] == "Username_1"))
                {
                    var usernameIndexModel = new CreateIndexModel<DbFileBinaryChunk>(
                        Builders<DbFileBinaryChunk>.IndexKeys.Ascending(f => f.Username),
                        new CreateIndexOptions { Name = "Username_1" });
                    await _fileBinaryChunkCollection.Indexes.CreateOneAsync(usernameIndexModel);
                }
                
                Console.WriteLine("Database indexes created successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating indexes: {ex.Message}");
            }
        }

        #region Connection Testing

        public async Task<bool> TestConnectionAsync()
        {
            try
            {
                // Attempt to list collections to verify the connection
                var collections = await _userDatabase.ListCollectionNamesAsync();
                var col = await collections.ToListAsync();
                Console.WriteLine("Successfully connected to the database!");
                Console.WriteLine($"Collections: {string.Join(", ", col)}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Connection failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region User Preferences

        public async Task<UserPreferences> GetUserPreferencesAsync(string userId)
        {
            var filter = Builders<UserPreferences>.Filter.Eq(u => u.UserId, userId);
            var userPrefs = await _userCollection.Find(filter).FirstOrDefaultAsync();
            
            if (userPrefs == null)
            {
                // Create default preferences if not found
                userPrefs = new UserPreferences { UserId = userId };
                await _userCollection.InsertOneAsync(userPrefs);
            }
            
            return userPrefs;
        }

        public async Task UpdateUserPreferencesAsync(UserPreferences preferences)
        {
            var filter = Builders<UserPreferences>.Filter.Eq(u => u.UserId, preferences.UserId);
            await _userCollection.ReplaceOneAsync(filter, preferences, new ReplaceOptions { IsUpsert = true });
        }

        #endregion

        #region Chats

        // Get list of chats for a user (without messages)
        public async Task<List<AiChat>> GetUserChatsAsync(string userId, string username)
        {
            // In database operations we need username for sharding
            var filter = Builders<DbChat>.Filter.Eq(c => c.Username, username);
            
            var dbChats = await _chatCollection.Find(filter)
                .SortByDescending(c => c.UpdatedAt)
                .ToListAsync();
                
            // Convert to in-memory models
            var chats = new List<AiChat>();
            foreach (var dbChat in dbChats)
            {
                // Create the in-memory chat without loading messages
                var chat = new AiChat
                {
                    Id = dbChat.Id,
                    Name = dbChat.Name,
                    CreatedAt = dbChat.CreatedAt,
                    // We'll set UpdatedAt from the database value since we don't have messages loaded yet
                    // This will override the computed property
                    // UpdatedAt = dbChat.UpdatedAt,
                    
                    // Load the assistant by ID
                    Assistant = await GetAssistantAsync(dbChat.AssistantId),
                    
                    // Deserialize settings from JSON
                    CurrentSettings = JsonSerializer.Deserialize<AiModelSettings>(dbChat.SettingsJson) ?? new AiModelSettings()
                };
                
                chats.Add(chat);
            }
            
            return chats;
        }

        // Get a complete chat with messages when opened
        public async Task<AiChat> GetChatAsync(string chatId, string userId, string username)
        {
            // Get the chat from database
            var chatFilter = Builders<DbChat>.Filter.And(
                Builders<DbChat>.Filter.Eq(c => c.Id, chatId),
                Builders<DbChat>.Filter.Eq(c => c.Username, username)
            );
            
            var dbChat = await _chatCollection.Find(chatFilter).FirstOrDefaultAsync();
            if (dbChat == null) return null;
            
            // Create in-memory chat object
            var chat = new AiChat
            {
                Id = dbChat.Id,
                Name = dbChat.Name,
                CreatedAt = dbChat.CreatedAt,
                CurrentSettings = JsonSerializer.Deserialize<AiModelSettings>(dbChat.SettingsJson) ?? new AiModelSettings(),
                Assistant = await GetAssistantAsync(dbChat.AssistantId)
            };
            
            // Get messages for this chat
            var messageFilter = Builders<DbChatMessage>.Filter.Eq(m => m.ChatId, chatId);
            var dbMessages = await _messageCollection.Find(messageFilter)
                .SortBy(m => m.Timestamp)
                .ToListAsync();
                
            // Convert to in-memory message models
            foreach (var dbMessage in dbMessages)
            {
                var message = new AiChatMessage
                {
                    Id = dbMessage.Id,
                    Role = (AiChatRole)Enum.Parse(typeof(AiChatRole), dbMessage.Role),
                    Timestamp = dbMessage.Timestamp,
                    Content = dbMessage.Content,
                    FileIds = dbMessage.FileIds
                };
                
                chat.Messages.Add(message);
            }
            
            // Get files for this chat
            var fileIds = chat.Messages.SelectMany(m => m.FileIds).Distinct().ToList();
            if (fileIds.Any())
            {
                foreach (var fileId in fileIds)
                {
                    var file = await GetFileAsync(fileId, username, false);
                    if (file != null)
                    {
                        chat.Files.Add(new AiChatFile
                        {
                            Id = file.Id,
                            FileName = file.FileName,
                            ContentType = file.ContentType,
                            Size = file.Size,
                            ContentChunks = file.ContentChunks,
                            StorageFileId = file.Id
                        });
                    }
                }
            }
            
            return chat;
        }

        public async Task<AiChat> CreateChatAsync(AiChat chat, string username)
        {
            // Create database model from in-memory model
            var dbChat = new DbChat
            {
                Id = chat.Id,
                Username = username,
                Name = chat.Name,
                AssistantId = chat.Assistant.Id,
                SettingsJson = JsonSerializer.Serialize(chat.CurrentSettings),
                CreatedAt = chat.CreatedAt,
                UpdatedAt = chat.UpdatedAt
            };
            
            // Save chat to database
            await _chatCollection.InsertOneAsync(dbChat);
            
            // If the chat has initial messages (like system prompt), save them
            if (chat.Messages.Any())
            {
                foreach (var message in chat.Messages)
                {
                    await AddMessageAsync(message, chat.Id, username);
                }
            }
            
            return chat;
        }

        public async Task UpdateChatAsync(AiChat chat, string username)
        {
            var filter = Builders<DbChat>.Filter.Eq(c => c.Id, chat.Id);
            
            var dbChat = new DbChat
            {
                Id = chat.Id,
                Username = username,
                Name = chat.Name,
                AssistantId = chat.Assistant.Id,
                SettingsJson = JsonSerializer.Serialize(chat.CurrentSettings),
                CreatedAt = chat.CreatedAt,
                UpdatedAt = chat.UpdatedAt
            };
            
            await _chatCollection.ReplaceOneAsync(filter, dbChat);
        }

        public async Task DeleteChatAsync(string chatId, string username)
        {
            var chatFilter = Builders<DbChat>.Filter.And(
                Builders<DbChat>.Filter.Eq(c => c.Id, chatId),
                Builders<DbChat>.Filter.Eq(c => c.Username, username)
            );
            
            var messageFilter = Builders<DbChatMessage>.Filter.And(
                Builders<DbChatMessage>.Filter.Eq(m => m.ChatId, chatId),
                Builders<DbChatMessage>.Filter.Eq(m => m.Username, username)
            );
            
            // Delete messages first, then chat
            await _messageCollection.DeleteManyAsync(messageFilter);
            await _chatCollection.DeleteOneAsync(chatFilter);
        }

        #endregion

        #region Messages

        public async Task<AiChatMessage> AddMessageAsync(AiChatMessage message, string chatId, string username)
        {
            // Convert to database model
            var dbMessage = new DbChatMessage
            {
                Id = message.Id,
                ChatId = chatId,
                Username = username,
                Role = message.Role.ToString(),
                Timestamp = message.Timestamp,
                Content = message.Content,
                FileIds = message.FileIds
            };
            
            // Insert into database
            await _messageCollection.InsertOneAsync(dbMessage);
            
            // Update chat's UpdatedAt time
            var chatFilter = Builders<DbChat>.Filter.Eq(c => c.Id, chatId);
            var update = Builders<DbChat>.Update.Set(c => c.UpdatedAt, DateTime.UtcNow);
            await _chatCollection.UpdateOneAsync(chatFilter, update);
            
            return message;
        }

        public async Task<List<AiChatMessage>> GetMessagesAsync(string chatId, string username)
        {
            var filter = Builders<DbChatMessage>.Filter.And(
                Builders<DbChatMessage>.Filter.Eq(m => m.ChatId, chatId),
                Builders<DbChatMessage>.Filter.Eq(m => m.Username, username)
            );
            
            var dbMessages = await _messageCollection.Find(filter)
                .SortBy(m => m.Timestamp)
                .ToListAsync();
                
            // Convert to in-memory models
            var messages = new List<AiChatMessage>();
            foreach (var dbMessage in dbMessages)
            {
                var message = new AiChatMessage
                {
                    Id = dbMessage.Id,
                    Role = (AiChatRole)Enum.Parse(typeof(AiChatRole), dbMessage.Role),
                    Timestamp = dbMessage.Timestamp,
                    Content = dbMessage.Content,
                    FileIds = dbMessage.FileIds
                };
                
                messages.Add(message);
            }
            
            return messages;
        }

        #endregion

        #region Files
        
        // Convert between in-memory and database models
        private AiFile ConvertToAiFile(DbFileMetadata dbFile, List<FileContentChunk> contentChunks = null)
        {
            var aiFile = new AiFile
            {
                Id = dbFile.Id,
                FileName = dbFile.FileName,
                ContentType = dbFile.ContentType,
                Size = dbFile.Size,
                CreatedAt = dbFile.CreatedAt,
                ContentChunks = contentChunks ?? new List<FileContentChunk>()
            };
            
            return aiFile;
        }
        
        private DbFileMetadata ConvertToDbFileMetadata(AiFile file, string username)
        {
            var dbFile = new DbFileMetadata
            {
                Id = file.Id,
                Username = username,
                FileName = file.FileName,
                ContentType = file.ContentType,
                Size = file.Size,
                CreatedAt = file.CreatedAt,
                ProcessedText = string.Empty,
                BinaryChunkCount = 0
            };
            
            return dbFile;
        }
        
        // Get file content chunks
        private async Task<List<FileContentChunk>> GetFileContentChunksAsync(string fileId, string username)
        {
            var filter = Builders<DbFileChunk>.Filter.And(
                Builders<DbFileChunk>.Filter.Eq(c => c.FileId, fileId),
                Builders<DbFileChunk>.Filter.Eq(c => c.Username, username)
            );
            
            var dbChunks = await _fileChunkCollection
                .Find(filter)
                .SortBy(c => c.Order)
                .ToListAsync();
            
            var contentChunks = dbChunks.Select(c => new FileContentChunk
            {
                Id = c.Id,
                Type = c.Type,
                Content = c.Content,
                Order = c.Order
            }).ToList();
            
            return contentChunks;
        }

        // Upload a file
        public async Task<AiFile> UploadFileAsync(Stream fileStream, string fileName, string contentType, string username)
        {
            // Create a new AiFile object
            var aiFile = new AiFile
            {
                FileName = fileName,
                ContentType = contentType,
                Size = fileStream.Length,
                CreatedAt = DateTime.UtcNow
            };
            
            // Convert to database model
            var dbFileMetadata = ConvertToDbFileMetadata(aiFile, username);
            
            // Save file metadata
            await _fileMetadataCollection.InsertOneAsync(dbFileMetadata);
            
            // Read the full content into memory
            using var memoryStream = new MemoryStream();
            await fileStream.CopyToAsync(memoryStream);
            aiFile.RawContent = memoryStream.ToArray();
            
            // Process file in binary chunks for database storage
            const int chunkSize = 1024 * 1024; // 1MB
            int totalChunks = (int)Math.Ceiling((double)fileStream.Length / chunkSize);
            dbFileMetadata.BinaryChunkCount = totalChunks;
            
            // Save binary chunks
            memoryStream.Position = 0;
            byte[] buffer = new byte[chunkSize];
            
            for (int chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++)
            {
                int bytesRead = await memoryStream.ReadAsync(buffer, 0, chunkSize);
                byte[] chunkData = buffer;
                
                if (bytesRead < chunkSize)
                {
                    // Trim buffer for last chunk if needed
                    chunkData = new byte[bytesRead];
                    Array.Copy(buffer, chunkData, bytesRead);
                }
                
                // Create binary chunk
                var binaryChunk = new DbFileBinaryChunk
                {
                    FileId = dbFileMetadata.Id,
                    Username = username,
                    ChunkNumber = chunkNumber,
                    TotalChunks = totalChunks,
                    Content = Convert.ToBase64String(chunkData),
                    ChunkSize = bytesRead
                };
                
                // Save binary chunk
                await _fileBinaryChunkCollection.InsertOneAsync(binaryChunk);
            }
            
            // Update metadata with chunk count
            var updateFilter = Builders<DbFileMetadata>.Filter.Eq(f => f.Id, dbFileMetadata.Id);
            var update = Builders<DbFileMetadata>.Update.Set(f => f.BinaryChunkCount, totalChunks);
            await _fileMetadataCollection.UpdateOneAsync(updateFilter, update);
            
            return aiFile;
        }
        
        // Get file metadata
        public async Task<AiFile> GetFileAsync(string fileId, string username, bool includeContent = false)
        {
            // Get file metadata
            var filter = Builders<DbFileMetadata>.Filter.And(
                Builders<DbFileMetadata>.Filter.Eq(f => f.Id, fileId),
                Builders<DbFileMetadata>.Filter.Eq(f => f.Username, username)
            );
            
            var dbFile = await _fileMetadataCollection.Find(filter).FirstOrDefaultAsync();
            if (dbFile == null) return null;
            
            // Get content chunks
            var contentChunks = await GetFileContentChunksAsync(fileId, username);
            var aiFile = ConvertToAiFile(dbFile, contentChunks);
            
            // Load binary content if requested
            if (includeContent)
            {
                aiFile.RawContent = await GetFileBinaryContentAsync(fileId, username);
            }
            
            return aiFile;
        }

        // Get file binary content
        private async Task<byte[]> GetFileBinaryContentAsync(string fileId, string username)
        {
            // Get file metadata
            var metadataFilter = Builders<DbFileMetadata>.Filter.And(
                Builders<DbFileMetadata>.Filter.Eq(f => f.Id, fileId),
                Builders<DbFileMetadata>.Filter.Eq(f => f.Username, username)
            );
            
            var dbFile = await _fileMetadataCollection.Find(metadataFilter).FirstOrDefaultAsync();
            if (dbFile == null) return null;
            
            // Get all binary chunks
            var chunksFilter = Builders<DbFileBinaryChunk>.Filter.And(
                Builders<DbFileBinaryChunk>.Filter.Eq(c => c.FileId, fileId),
                Builders<DbFileBinaryChunk>.Filter.Eq(c => c.Username, username)
            );
            
            var binaryChunks = await _fileBinaryChunkCollection
                .Find(chunksFilter)
                .SortBy(c => c.ChunkNumber)
                .ToListAsync();
            
            // Combine chunks
            using var memoryStream = new MemoryStream((int)dbFile.Size);
            foreach (var chunk in binaryChunks)
            {
                byte[] chunkData = Convert.FromBase64String(chunk.Content);
                await memoryStream.WriteAsync(chunkData, 0, chunkData.Length);
            }
            
            return memoryStream.ToArray();
        }

        // Save file content chunks
        public async Task SaveFileContentChunksAsync(string fileId, string username, List<FileContentChunk> contentChunks)
        {
            // Delete existing chunks first
            var deleteFilter = Builders<DbFileChunk>.Filter.And(
                Builders<DbFileChunk>.Filter.Eq(c => c.FileId, fileId),
                Builders<DbFileChunk>.Filter.Eq(c => c.Username, username)
            );
            
            await _fileChunkCollection.DeleteManyAsync(deleteFilter);
            
            // Save new chunks
            foreach (var chunk in contentChunks)
            {
                var dbChunk = new DbFileChunk
                {
                    FileId = fileId,
                    Username = username,
                    Type = chunk.Type,
                    Content = chunk.Content,
                    Order = chunk.Order
                };
                
                await _fileChunkCollection.InsertOneAsync(dbChunk);
            }
        }

        // Delete a file and all associated data
        public async Task DeleteFileAsync(string fileId, string username)
        {
            // Delete binary chunks
            var binaryChunksFilter = Builders<DbFileBinaryChunk>.Filter.And(
                Builders<DbFileBinaryChunk>.Filter.Eq(c => c.FileId, fileId),
                Builders<DbFileBinaryChunk>.Filter.Eq(c => c.Username, username)
            );
            
            await _fileBinaryChunkCollection.DeleteManyAsync(binaryChunksFilter);
            
            // Delete content chunks
            var contentChunksFilter = Builders<DbFileChunk>.Filter.And(
                Builders<DbFileChunk>.Filter.Eq(c => c.FileId, fileId),
                Builders<DbFileChunk>.Filter.Eq(c => c.Username, username)
            );
            
            await _fileChunkCollection.DeleteManyAsync(contentChunksFilter);
            
            // Delete file metadata
            var fileFilter = Builders<DbFileMetadata>.Filter.And(
                Builders<DbFileMetadata>.Filter.Eq(f => f.Id, fileId),
                Builders<DbFileMetadata>.Filter.Eq(f => f.Username, username)
            );
            
            await _fileMetadataCollection.DeleteOneAsync(fileFilter);
        }
        
        // Attach a file to a chat
        public async Task<AiChatFile> AttachFileToChatAsync(string chatId, string username, string fileId)
        {
            // Get file metadata
            var file = await GetFileAsync(fileId, username);
            if (file == null) return null;
            
            // Create a chat file reference
            var chatFile = new AiChatFile
            {
                FileName = file.FileName,
                ContentType = file.ContentType,
                Size = file.Size,
                ContentChunks = file.ContentChunks,
                StorageFileId = file.Id
            };
            
            // Get the chat
            var filter = Builders<DbChat>.Filter.And(
                Builders<DbChat>.Filter.Eq(c => c.Id, chatId),
                Builders<DbChat>.Filter.Eq(c => c.Username, username)
            );
            
            var dbChat = await _chatCollection.Find(filter).FirstOrDefaultAsync();
            if (dbChat == null) return null;
            
            // Since we don't have direct access to add files in the database,
            // we'll need to get the full chat, add the file, and update it
            var chat = await GetChatAsync(chatId, username, username);
            chat.Files.Add(chatFile);
            
            return chatFile;
        }

        #endregion

        #region Config Database

        // Assistants
        
        // Convert between in-memory and database models
        private async Task<AiAssistant> ConvertToAiAssistant(DbAssistant dbAssistant)
        {
            // Get the AI model
            var model = await GetModelAsync(dbAssistant.ModelId);
            
            // Get tools
            var tools = new List<AiChatTool>();
            foreach (var toolId in dbAssistant.ToolIds)
            {
                var tool = await GetToolAsync(toolId);
                if (tool != null)
                {
                    tools.Add(tool);
                }
            }
            
            // Create the in-memory assistant
            var assistant = new AiAssistant
            {
                Id = dbAssistant.Id,
                Name = dbAssistant.Name,
                Description = dbAssistant.Description,
                SystemPrompt = dbAssistant.SystemPrompt,
                ModelSettings = JsonSerializer.Deserialize<AiModelSettings>(dbAssistant.SettingsJson) ?? new AiModelSettings(),
                Tools = tools,
                IsSystemCreated = dbAssistant.OwnerId == "System",
                
                // Internal properties
                OwnerId = dbAssistant.OwnerId,
                SharedWithUserIds = dbAssistant.SharedWithUserIds,
                PreloadedDocumentIds = dbAssistant.PreloadedDocumentIds
            };
            
            // Set the model if we found one
            if (model != null)
            {
                assistant.Model = model;
            }
            
            return assistant;
        }
        
        private async Task<DbAssistant> ConvertToDbAssistant(AiAssistant assistant)
        {
            var dbAssistant = new DbAssistant
            {
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                ModelId = assistant.Model.Id,
                SystemPrompt = assistant.SystemPrompt,
                SettingsJson = JsonSerializer.Serialize(assistant.ModelSettings),
                ToolIds = assistant.Tools.Select(t => t.Id).ToList(),
                OwnerId = assistant.IsSystemCreated ? "System" : assistant.OwnerId,
                SharedWithUserIds = assistant.SharedWithUserIds,
                PreloadedDocumentIds = assistant.PreloadedDocumentIds
            };
            
            return dbAssistant;
        }
        
        // Get a specific assistant
        public async Task<AiAssistant> GetAssistantAsync(string assistantId)
        {
            if (string.IsNullOrEmpty(assistantId))
                return new AiAssistant();
                
            var filter = Builders<DbAssistant>.Filter.Eq(a => a.Id, assistantId);
            var dbAssistant = await _assistantCollection.Find(filter).FirstOrDefaultAsync();
            
            if (dbAssistant == null)
                return new AiAssistant();
                
            return await ConvertToAiAssistant(dbAssistant);
        }
        
        // Get assistants for a user
        public async Task<List<AiAssistant>> GetUserAssistantsAsync(string userId)
        {
            var filter = Builders<DbAssistant>.Filter.Or(
                Builders<DbAssistant>.Filter.Eq(a => a.OwnerId, userId),
                Builders<DbAssistant>.Filter.Eq(a => a.OwnerId, "System"),
                Builders<DbAssistant>.Filter.AnyEq(a => a.SharedWithUserIds, userId)
            );
            
            var dbAssistants = await _assistantCollection.Find(filter).ToListAsync();
            
            var assistants = new List<AiAssistant>();
            foreach (var dbAssistant in dbAssistants)
            {
                assistants.Add(await ConvertToAiAssistant(dbAssistant));
            }
            
            return assistants;
        }
        
        // Create a new assistant
        public async Task<AiAssistant> CreateAssistantAsync(AiAssistant assistant, string userId)
        {
            // Set owner if not already set (and not system created)
            if (!assistant.IsSystemCreated && string.IsNullOrEmpty(assistant.OwnerId))
            {
                assistant.OwnerId = userId;
            }
            
            var dbAssistant = await ConvertToDbAssistant(assistant);
            await _assistantCollection.InsertOneAsync(dbAssistant);
            
            return assistant;
        }
        
        // Update an existing assistant
        public async Task UpdateAssistantAsync(AiAssistant assistant)
        {
            var filter = Builders<DbAssistant>.Filter.Eq(a => a.Id, assistant.Id);
            var dbAssistant = await ConvertToDbAssistant(assistant);
            
            await _assistantCollection.ReplaceOneAsync(filter, dbAssistant);
        }
        
        // Delete an assistant
        public async Task DeleteAssistantAsync(string assistantId, string userId)
        {
            var filter = Builders<DbAssistant>.Filter.And(
                Builders<DbAssistant>.Filter.Eq(a => a.Id, assistantId),
                Builders<DbAssistant>.Filter.Eq(a => a.OwnerId, userId)
            );
            
            await _assistantCollection.DeleteOneAsync(filter);
        }
        
        // Models
        
        // Convert between in-memory and database models
        private async Task<AiModel> ConvertToAiModel(DbModel dbModel)
        {
            // Get the endpoint
            var endpoint = await GetEndpointAsync(dbModel.EndpointId);
            
            var model = new AiModel
            {
                Id = dbModel.Id,
                Name = dbModel.Name,
                Description = dbModel.Description,
                ModelId = dbModel.ModelId,
                ModelType = (AiModelType)Enum.Parse(typeof(AiModelType), dbModel.ModelType),
                Capabilities = JsonSerializer.Deserialize<AiModelCapabilities>(dbModel.CapabilitiesJson) ?? new AiModelCapabilities()
            };
            
            if (endpoint != null)
            {
                model.Endpoint = endpoint;
            }
            
            return model;
        }
        
        private DbModel ConvertToDbModel(AiModel model)
        {
            return new DbModel
            {
                Id = model.Id,
                Name = model.Name,
                Description = model.Description,
                ModelId = model.ModelId,
                ModelType = model.ModelType.ToString(),
                EndpointId = model.Endpoint.Id,
                CapabilitiesJson = JsonSerializer.Serialize(model.Capabilities)
            };
        }
        
        // Get a specific model
        public async Task<AiModel> GetModelAsync(string modelId)
        {
            if (string.IsNullOrEmpty(modelId))
                return new AiModel();
                
            var filter = Builders<DbModel>.Filter.Eq(m => m.Id, modelId);
            var dbModel = await _modelCollection.Find(filter).FirstOrDefaultAsync();
            
            if (dbModel == null)
                return new AiModel();
                
            return await ConvertToAiModel(dbModel);
        }
        
        // Get all models
        public async Task<List<AiModel>> GetModelsAsync()
        {
            var dbModels = await _modelCollection.Find(_ => true).ToListAsync();
            
            var models = new List<AiModel>();
            foreach (var dbModel in dbModels)
            {
                models.Add(await ConvertToAiModel(dbModel));
            }
            
            return models;
        }
        
        // Create a new model
        public async Task<AiModel> CreateModelAsync(AiModel model)
        {
            // If the model has an endpoint that doesn't exist, create it
            if (model.Endpoint != null && !string.IsNullOrEmpty(model.Endpoint.Url))
            {
                var endpoint = await GetEndpointAsync(model.Endpoint.Id);
                if (endpoint == null)
                {
                    await CreateEndpointAsync(model.Endpoint);
                }
            }
            
            var dbModel = ConvertToDbModel(model);
            await _modelCollection.InsertOneAsync(dbModel);
            
            return model;
        }
        
        // Update an existing model
        public async Task UpdateModelAsync(AiModel model)
        {
            // If the model has an endpoint that doesn't exist, create it
            if (model.Endpoint != null && !string.IsNullOrEmpty(model.Endpoint.Url))
            {
                var endpoint = await GetEndpointAsync(model.Endpoint.Id);
                if (endpoint == null)
                {
                    await CreateEndpointAsync(model.Endpoint);
                }
                else
                {
                    await UpdateEndpointAsync(model.Endpoint);
                }
            }
            
            var filter = Builders<DbModel>.Filter.Eq(m => m.Id, model.Id);
            var dbModel = ConvertToDbModel(model);
            
            await _modelCollection.ReplaceOneAsync(filter, dbModel);
        }
        
        // Delete a model
        public async Task DeleteModelAsync(string modelId)
        {
            var filter = Builders<DbModel>.Filter.Eq(m => m.Id, modelId);
            await _modelCollection.DeleteOneAsync(filter);
        }
        
        // Endpoints
        
        // Convert between in-memory and database models
        private AiModelEndpoint ConvertToAiModelEndpoint(DbModelEndpoint dbEndpoint)
        {
            return new AiModelEndpoint
            {
                Id = dbEndpoint.Id,
                Url = dbEndpoint.Url,
                ApiKey = dbEndpoint.ApiKey
            };
        }
        
        private DbModelEndpoint ConvertToDbModelEndpoint(AiModelEndpoint endpoint)
        {
            return new DbModelEndpoint
            {
                Id = endpoint.Id,
                Url = endpoint.Url,
                ApiKey = endpoint.ApiKey  // In a real app, this should be encrypted
            };
        }
        
        // Get a specific endpoint
        public async Task<AiModelEndpoint> GetEndpointAsync(string endpointId)
        {
            if (string.IsNullOrEmpty(endpointId))
                return new AiModelEndpoint();
                
            var filter = Builders<DbModelEndpoint>.Filter.Eq(e => e.Id, endpointId);
            var dbEndpoint = await _endpointCollection.Find(filter).FirstOrDefaultAsync();
            
            if (dbEndpoint == null)
                return new AiModelEndpoint();
                
            return ConvertToAiModelEndpoint(dbEndpoint);
        }
        
        // Create a new endpoint
        public async Task CreateEndpointAsync(AiModelEndpoint endpoint)
        {
            var dbEndpoint = ConvertToDbModelEndpoint(endpoint);
            await _endpointCollection.InsertOneAsync(dbEndpoint);
        }
        
        // Update an existing endpoint
        public async Task UpdateEndpointAsync(AiModelEndpoint endpoint)
        {
            var filter = Builders<DbModelEndpoint>.Filter.Eq(e => e.Id, endpoint.Id);
            var dbEndpoint = ConvertToDbModelEndpoint(endpoint);
            
            await _endpointCollection.ReplaceOneAsync(filter, dbEndpoint);
        }
        
        // Delete an endpoint
        public async Task DeleteEndpointAsync(string endpointId)
        {
            var filter = Builders<DbModelEndpoint>.Filter.Eq(e => e.Id, endpointId);
            await _endpointCollection.DeleteOneAsync(filter);
        }
        
        // Tools
        
        // Convert between in-memory and database models
        private AiChatTool ConvertToAiChatTool(DbChatTool dbTool)
        {
            return new AiChatTool
            {
                Id = dbTool.Id,
                Name = dbTool.Name,
                Description = dbTool.Description,
                Type = (ToolType)Enum.Parse(typeof(ToolType), dbTool.Type),
                Schema = dbTool.Schema,
                IsRequired = dbTool.IsRequired
            };
        }
        
        private DbChatTool ConvertToDbChatTool(AiChatTool tool)
        {
            return new DbChatTool
            {
                Id = tool.Id,
                Name = tool.Name,
                Description = tool.Description,
                Type = tool.Type.ToString(),
                Schema = tool.Schema,
                IsRequired = tool.IsRequired
            };
        }
        
        // Get a specific tool
        public async Task<AiChatTool> GetToolAsync(string toolId)
        {
            if (string.IsNullOrEmpty(toolId))
                return new AiChatTool();
                
            var filter = Builders<DbChatTool>.Filter.Eq(t => t.Id, toolId);
            var dbTool = await _toolCollection.Find(filter).FirstOrDefaultAsync();
            
            if (dbTool == null)
                return new AiChatTool();
                
            return ConvertToAiChatTool(dbTool);
        }
        
        // Get all tools
        public async Task<List<AiChatTool>> GetToolsAsync()
        {
            var dbTools = await _toolCollection.Find(_ => true).ToListAsync();
            
            return dbTools.Select(t => ConvertToAiChatTool(t)).ToList();
        }
        
        // Create a new tool
        public async Task CreateToolAsync(AiChatTool tool)
        {
            var dbTool = ConvertToDbChatTool(tool);
            await _toolCollection.InsertOneAsync(dbTool);
        }
        
        // Update an existing tool
        public async Task UpdateToolAsync(AiChatTool tool)
        {
            var filter = Builders<DbChatTool>.Filter.Eq(t => t.Id, tool.Id);
            var dbTool = ConvertToDbChatTool(tool);
            
            await _toolCollection.ReplaceOneAsync(filter, dbTool);
        }
        
        // Delete a tool
        public async Task DeleteToolAsync(string toolId)
        {
            var filter = Builders<DbChatTool>.Filter.Eq(t => t.Id, toolId);
            await _toolCollection.DeleteOneAsync(filter);
        }
        
        #endregion

        #region Generic Methods

        public IMongoCollection<T> GetCollection<T>(string collectionName)
        {
            return _userDatabase.GetCollection<T>(collectionName);
        }

        public IMongoCollection<T> GetConfigCollection<T>(string collectionName)
        {
            return _configDatabase.GetCollection<T>(collectionName);
        }

        #endregion
    }
}
