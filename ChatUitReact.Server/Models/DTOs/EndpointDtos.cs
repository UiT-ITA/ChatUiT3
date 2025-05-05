using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models.DTOs
{
    // DTO for returning endpoint information
    public class EndpointDto
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Url { get; set; } = string.Empty;
        // We don't include the API key in responses for security reasons
    }

    // DTO for creating a new endpoint
    public class CreateEndpointDto
    {
        [Required]
        public string Url { get; set; } = string.Empty;
        
        [Required]
        public string ApiKey { get; set; } = string.Empty;
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
    }
}
