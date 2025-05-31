using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models
{
    public class AiAssistant
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public AiModel Model { get; set; } = new AiModel();
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
        internal string OwnerId { get; set; } = string.Empty;
    }

    public class UserAssistantsResult
    {
        public List<AiAssistant> Owned { get; set; } = new();
        public List<AiAssistant> System { get; set; } = new();
        public List<AiAssistant> Shared { get; set; } = new();
    }
}
