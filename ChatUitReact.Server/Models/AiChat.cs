using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUitReact.Server.Models
{
    public class AiChat
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public AiChatSettings Settings { get; set; } = new AiChatSettings();
        //public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt
        {
            get
            {
                if (Messages.Count == 0)
                    return DateTime.UtcNow;
                return Messages.Min(m => m.Timestamp);
            }
        }
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
    }

    public class AiChatMessage
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public AiChatRole Role { get; set; } = AiChatRole.User;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public List<MessageChunk> Content { get; set; } = new List<MessageChunk>();

        public AiMessageStatus Status { get; set; } = AiMessageStatus.Sent;

        public string Filename { get; set; } = string.Empty;
    }

    public class MessageChunk
    {
        public AiMessageChunkType Type { get; set; } = AiMessageChunkType.Text;
        public string Content { get; set; } = string.Empty;
    }


    public class AiChatSettings
    {
        public string AssistantName { get; set; } = string.Empty;
        public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
        public bool SaveToDB { get; set; } = true;
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
    
    public enum AiMessageStatus
    {
        Streaming,
        Sent,
        Error,
        Cancelled,
    }
}
