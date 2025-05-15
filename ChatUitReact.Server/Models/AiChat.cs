using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUitReact.Server.Models
{
    public class AiChat
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public AiAssistant Assistant { get; set; } = new AiAssistant();
        public AiModelSettings CurrentSettings { get; set; } = new AiModelSettings();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt
        {
            get
            {
                if (Messages.Count == 0)
                    return CreatedAt;
                return Messages.Max(m => m.Timestamp);
            }
        }
        public List<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
        // public List<AiChatFile> Files { get; set; } = new List<AiChatFile>();
    }

    public class AiChatMessage
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public AiChatRole Role { get; set; } = AiChatRole.User;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public List<MessageChunk> Content { get; set; } = new List<MessageChunk>();

        public string Filename { get; set; } = string.Empty;

        public ContentType ContentType {
            get {
                if (Content.Count == 0)
                    return ContentType.Text;
                if (Content.All(c => c.Type == AiMessageChunkType.Text))
                    return ContentType.Text;
                if (Content.All(c => c.Type == AiMessageChunkType.Image))
                    return ContentType.Image;
                return ContentType.Mixed;
            }
        }
    }

    public class MessageChunk
    {
        public AiMessageChunkType Type { get; set; } = AiMessageChunkType.Text;
        public string Content { get; set; } = string.Empty;
    }

    public class FileMetadata
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; } = 0;
    }

    public enum AiChatRole
    {
        User,
        Assistant,
        System,
        Tool,
        File
    }

    public enum AiMessageChunkType
    {
        Text,
        Image,
    }
    
    public enum ContentType
    {
        Text,
        Image,
        Mixed,
    }
}
