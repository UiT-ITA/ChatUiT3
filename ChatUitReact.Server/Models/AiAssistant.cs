using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models
{
    // Clean in-memory model for assistant
    public class AiAssistant
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public AiModel Model { get; set; } = new AiModel();
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
        public List<AiChatTool> Tools { get; set; } = new List<AiChatTool>();
        public bool IsSystemCreated { get; set; } = false;
        
        // For internal use by DatabaseService only
        internal string OwnerId { get; set; } = string.Empty;
        internal List<string> SharedWithUserIds { get; set; } = new List<string>();
        internal List<string> PreloadedDocumentIds { get; set; } = new List<string>();
    }
}
