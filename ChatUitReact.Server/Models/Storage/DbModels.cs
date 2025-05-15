using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models.Storage
{
    // Database model for chat - stores only references
    public class DbChat
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Username { get; set; } = string.Empty;  // For sharding
        public string Name { get; set; } = string.Empty;
        public string AssistantId { get; set; } = string.Empty;  // Just the ID, not the full object
        public string SettingsJson { get; set; } = string.Empty;  // Serialized settings
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // Database model for messages
    public class DbChatMessage
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ChatId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;  // For sharding
        public string Role { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Content { get; set; } = string.Empty;
        public List<string> FileIds { get; set; } = new List<string>();
    }

    // Database model for file metadata
    public class DbFileMetadata
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Username { get; set; } = string.Empty;  // For sharding
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string ProcessedText { get; set; } = string.Empty;  // For searchable files
    }

    // Database model for file chunks (text/images)
    public class DbFileChunk
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string FileId { get; set; } = string.Empty;  // Reference to the parent file
        public string Username { get; set; } = string.Empty;  // For sharding
        //public ChunkType Type { get; set; } = ChunkType.Text;
        public string Content { get; set; } = string.Empty;  // Text or base64 for images
        public int ParentChunkIndex { get; set; }  // Index of the original logical chunk
        public int Order { get; set; }  // Order within split chunks
    }

    // Database model for assistants
    public class DbAssistant
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ModelId { get; set; } = string.Empty;  // Reference only
        public string SystemPrompt { get; set; } = string.Empty;
        public string SettingsJson { get; set; } = string.Empty;  // Serialized
        public List<string> ToolIds { get; set; } = new List<string>();  // References only
        public string OwnerId { get; set; } = string.Empty;  // "System" for system-created assistants
        public List<string> SharedWithUserIds { get; set; } = new List<string>();
        public List<string> PreloadedDocumentIds { get; set; } = new List<string>();
    }

    // Database model for models
    public class DbModel
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ModelId { get; set; } = string.Empty;
        public string ModelType { get; set; } = string.Empty;
        public string EndpointId { get; set; } = string.Empty;  // Reference only
        public string CapabilitiesJson { get; set; } = string.Empty;  // Serialized
    }

    // Database model for endpoints
    public class DbModelEndpoint
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Url { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;  // Should be encrypted in a real app
    }

    // Database model for tools
    public class DbChatTool
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Schema { get; set; } = string.Empty;
        public bool IsRequired { get; set; } = false;
    }
}
