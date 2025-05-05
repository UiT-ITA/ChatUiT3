using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models.DTOs
{
    // DTO for returning assistant information
    public class AssistantDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string SystemPrompt { get; set; } = string.Empty;
        public string OwnerId { get; set; } = string.Empty;
        public List<string> SharedWithUserIds { get; set; } = new List<string>();
        public ModelDto Model { get; set; } = new ModelDto();
        public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
        public List<string> ToolIds { get; set; } = new List<string>();
        public List<string> PreloadedDocumentIds { get; set; } = new List<string>();
    }

    // DTO for creating a new assistant
    public class CreateAssistantDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        public string SystemPrompt { get; set; } = string.Empty;
        
        public List<string> SharedWithUserIds { get; set; } = new List<string>();
        
        [Required]
        public string ModelId { get; set; } = string.Empty;
        
        public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
        
        public List<string> ToolIds { get; set; } = new List<string>();
        
        public List<string> PreloadedDocumentIds { get; set; } = new List<string>();
    }

    // DTO for updating an existing assistant
    public class UpdateAssistantDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
        
        [Required]
        public string Name { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        public string SystemPrompt { get; set; } = string.Empty;
        
        public List<string> SharedWithUserIds { get; set; } = new List<string>();
        
        [Required]
        public string ModelId { get; set; } = string.Empty;
        
        public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
        
        public List<string> ToolIds { get; set; } = new List<string>();
        
        public List<string> PreloadedDocumentIds { get; set; } = new List<string>();
    }
}
