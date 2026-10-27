namespace ChatUiT.Server.Models;

/// <summary>An Entra group as the admin group picker sees it. <see cref="DisplayName"/> is null when a stored id no longer resolves.</summary>
public class DirectoryGroupDto
{
    public string Id { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public string? Mail { get; set; }
}
