namespace ChatUitReact.Server.Models.DTOs;

public class ModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public class CreateModelDto
{
    public string ModelName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public class UpdateModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}
