using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models.DTOs
{
    public class AssistantListDto
    {
        public List<PrivateAssistantDto> Owned { get; set; } = new List<PrivateAssistantDto>();
        public List<SystemAssistantDto> System { get; set; } = new List<SystemAssistantDto>();
        public List<SharedAssistantDto> Shared { get; set; } = new List<SharedAssistantDto>();
    }

    public class PrivateAssistantDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public AiModel Model { get; set; } = new AiModel();
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
        public bool IsVisible { get; set; }
    }

    public class SystemAssistantDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public string ModelName { get; set; } = string.Empty;
        public bool IsVisible { get; set; }
    }

    public class SharedAssistantDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public string ModelName { get; set; } = string.Empty;
        public bool IsVisible { get; set; }
    }

    public class CreateAssistantDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        [Required]
        public string ModelId { get; set; } = string.Empty;
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
    }

    public class UpdateAssistantDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
        [Required]
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        [Required]
        public string ModelId { get; set; } = string.Empty;
        public AiChatSettings ChatSettings { get; set; } = new AiChatSettings();
    }
}
