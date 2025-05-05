using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models.DTOs
{
    // DTO for model capabilities
    public class ModelCapabilitiesDto
    {
        public bool SupportsVision { get; set; } = false;
        public bool SupportsReasoning { get; set; } = false;
        public bool SupportsFunctionCalling { get; set; } = false;
        public bool SupportsCodeInterpreter { get; set; } = false;
        public int MaxContextLength { get; set; } = 16000;
        public int MaxOutputLength { get; set; } = 4000;
    }

    // DTO for returning model information
    public class ModelDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ModelId { get; set; } = string.Empty;
        public string ModelType { get; set; } = string.Empty;
        public EndpointDto Endpoint { get; set; } = new EndpointDto();
        public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
    }

    // DTO for creating a new model
    public class CreateModelDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        [Required]
        public string ModelId { get; set; } = string.Empty;
        
        [Required]
        public string ModelType { get; set; } = string.Empty;
        
        [Required]
        public string EndpointId { get; set; } = string.Empty;
        
        public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
    }

    // DTO for updating an existing model
    public class UpdateModelDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
        
        [Required]
        public string Name { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        [Required]
        public string ModelId { get; set; } = string.Empty;
        
        [Required]
        public string ModelType { get; set; } = string.Empty;
        
        [Required]
        public string EndpointId { get; set; } = string.Empty;
        
        public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
    }
}
