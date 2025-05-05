using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUitReact.Server.Models
{
    // Clean in-memory model for chat
    public class AiChat
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public AiAssistant Assistant { get; set; } = new AiAssistant();
        public AiModelSettings CurrentSettings { get; set; } = new AiModelSettings();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { 
            get {
                if (Messages.Count == 0)
                    return CreatedAt;
                return Messages.Max(m => m.Timestamp); 
            } 
        }
        public List<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
        public List<AiChatFile> Files { get; set; } = new List<AiChatFile>();
    }

    // Clean in-memory model for chat message
    public class AiChatMessage
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public AiChatRole Role { get; set; } = AiChatRole.User;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Content { get; set; } = string.Empty;
        public List<string> FileIds { get; set; } = new List<string>();
    }

    // Clean in-memory model for chat file
    public class AiChatFile
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; } = 0;
        
        // The extracted content chunks (text paragraphs, images, etc.)
        public List<FileContentChunk> ContentChunks { get; set; } = new List<FileContentChunk>();
        
        // For internal use by DatabaseService only - not exposed to application code
        internal string StorageFileId { get; set; } = string.Empty;
    }

    public enum AiChatRole
    {
        User,
        Assistant,
        System
    }
}
