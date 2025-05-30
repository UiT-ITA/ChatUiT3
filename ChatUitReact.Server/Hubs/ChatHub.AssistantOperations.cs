using ChatUitReact.Server.Models.DTOs;

namespace ChatUitReact.Server.Hubs;

public partial class ChatHub
{
    public async Task GetUserAssistants()
    {
        try
        {
            var userId = GetCurrentUserId();
            var assistants = await _assistantService.GetUserAssistantsAsync(userId);
            await Clients.Caller.UserAssistants(assistants);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assistants");
            await Clients.Caller.Error("Failed to load assistants");
        }
    }

    public async Task CreateAssistant(CreateAssistantDto createDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.CreateAssistantAsync(createDto, userId);
            if (!success)
            {
                await Clients.Caller.Error("Failed to create assistant");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating assistant");
            await Clients.Caller.Error("Failed to create assistant");
        }
    }

    public async Task UpdateAssistant(UpdateAssistantDto updateDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.UpdateAssistantAsync(updateDto, userId);
            if (!success)
            {
                await Clients.Caller.Error("Failed to update assistant");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating assistant");
            await Clients.Caller.Error("Failed to update assistant");
        }
    }

    public async Task DeleteAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.DeleteAssistantAsync(assistantId, userId);
            if (!success)
            {
                await Clients.Caller.Error("Failed to delete assistant");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting assistant");
            await Clients.Caller.Error("Failed to delete assistant");
        }
    }

    public async Task ToggleAssistantVisibility(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.ToggleAssistantVisibilityAsync(assistantId, userId);
            if (!success)
            {
                await Clients.Caller.Error("Failed to toggle visibility");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling visibility");
            await Clients.Caller.Error("Failed to toggle visibility");
        }
    }

    public async Task AddSharedAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.AddSharedAssistantAsync(assistantId, userId);
            if (!success)
            {
                await Clients.Caller.Error("Assistant not found");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding shared assistant");
            await Clients.Caller.Error("Failed to add shared assistant");
        }
    }
}
