using System.ComponentModel.DataAnnotations;

namespace ChatUiT.Server.Models;

public class AppSettingsDto
{
    // Empty means "not selected", so empty strings must stay valid
    [Required(AllowEmptyStrings = true)]
    public string DefaultModelId { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = true)]
    public string ChatNamingModelId { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = true)]
    public string DefaultAssistantId { get; set; } = string.Empty;
}

public class UpdateAppSettingsDto
{
    [Required(AllowEmptyStrings = true)]
    public string DefaultModelId { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = true)]
    public string ChatNamingModelId { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = true)]
    public string DefaultAssistantId { get; set; } = string.Empty;
}

// Non-admin view: only the parts every signed-in user needs
public class PublicAppSettingsDto
{
    [Required(AllowEmptyStrings = true)]
    public string DefaultModelId { get; set; } = string.Empty;

    // Where a new chat starts when the user has no pin of their own
    [Required(AllowEmptyStrings = true)]
    public string DefaultAssistantId { get; set; } = string.Empty;
}
