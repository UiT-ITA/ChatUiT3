namespace ChatUitReact.Server.Models.DTOs;

public class AiAssistantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public Dictionary<string, object> Configuration { get; set; } = new();
}