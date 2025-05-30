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
        public List<string> Tags { get; set; } = new List<string>();
        public AiModel Model { get; set; } = new AiModel(); // maybe use model id instead?
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
        // public List<AiChatTool> Tools { get; set; } = new List<AiChatTool>(); // Tools will be implemented later
        // public List<AiChatFile> Files { get; set; } = new List<AiChatFile>(); // Files will be implemented later
        internal string OwnerId { get; set; } = string.Empty;
    }
}
