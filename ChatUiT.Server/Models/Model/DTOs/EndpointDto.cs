using System.ComponentModel.DataAnnotations;

namespace ChatUiT.Server.Models;

public class EndpointDto
{
    public string Id { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string EndpointType { get; set; } = string.Empty;
    public string AuthMethod { get; set; } = string.Empty;
}

/// <summary>A deployment on an endpoint: the name requests use and the model it runs.</summary>
public class EndpointDeploymentDto
{
    public string Name { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
}

public class CreateEndpointDto
{
    [Required]
    public string Url { get; set; } = string.Empty;
    
    /// <summary>Required when <see cref="AuthMethod"/> is ApiKey; ignored for ManagedIdentity.</summary>
    public string ApiKey { get; set; } = string.Empty;
    
    [Required]
    public string EndpointType { get; set; } = string.Empty;

    /// <summary>ApiKey or ManagedIdentity. Blank means ApiKey.</summary>
    public string AuthMethod { get; set; } = string.Empty;
}

public class UpdateEndpointDto
{
    [Required]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string Url { get; set; } = string.Empty;
    
    /// <summary>Blank means "keep the stored key"; the key is never returned, so an edit that
    /// does not touch it sends nothing here.</summary>
    public string ApiKey { get; set; } = string.Empty;
    
    [Required]
    public string EndpointType { get; set; } = string.Empty;

    /// <summary>ApiKey or ManagedIdentity. Blank keeps the stored method.</summary>
    public string AuthMethod { get; set; } = string.Empty;
}
