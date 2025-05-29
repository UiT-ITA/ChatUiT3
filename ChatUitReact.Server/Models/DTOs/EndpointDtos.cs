using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models.DTOs
{
    // DTO for returning endpoint information
    public class EndpointDto
    {
        public string Id { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string EndpointType { get; set; } = string.Empty;
    }

    // DTO for creating a new endpoint
    public class CreateEndpointDto
    {
        [Required]
        public string Url { get; set; } = string.Empty;
        
        [Required]
        public string ApiKey { get; set; } = string.Empty;
        
        [Required]
        public string EndpointType { get; set; } = string.Empty;
    }

    // DTO for updating an existing endpoint
    public class UpdateEndpointDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
        
        [Required]
        public string Url { get; set; } = string.Empty;
        
        [Required]
        public string ApiKey { get; set; } = string.Empty;
        
        [Required]
        public string EndpointType { get; set; } = string.Empty;
    }
}
