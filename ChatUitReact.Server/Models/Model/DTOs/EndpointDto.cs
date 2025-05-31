using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models;

public class EndpointDto
{
    public string Id { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string EndpointType { get; set; } = string.Empty;
}

public class CreateEndpointDto
{
    [Required]
    public string Url { get; set; } = string.Empty;
    
    [Required]
    public string ApiKey { get; set; } = string.Empty;
    
    [Required]
    public string EndpointType { get; set; } = string.Empty;
}

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
