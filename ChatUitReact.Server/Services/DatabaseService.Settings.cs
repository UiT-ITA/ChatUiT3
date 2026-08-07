using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    private const string AppSettingsDocumentId = "app-settings";

    public async Task<AppSettings> GetAppSettingsAsync()
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<AppSettingsDocument>(
            _appSettingsContainer!,
            AppSettingsDocumentId,
            ConfigurationPartitionKey);

        return document == null ? new AppSettings() : MapAppSettings(document);
    }

    public async Task UpdateAppSettingsAsync(AppSettings settings)
    {
        await EnsureInitializedAsync();

        var document = MapAppSettingsDocument(settings);
        await _appSettingsContainer!.UpsertItemAsync(document, new PartitionKey(ConfigurationPartitionKey));
    }

    private static AppSettings MapAppSettings(AppSettingsDocument document)
    {
        return new AppSettings
        {
            DefaultModelId = document.DefaultModelId,
            ChatNamingModelId = document.ChatNamingModelId
        };
    }

    private static AppSettingsDocument MapAppSettingsDocument(AppSettings settings)
    {
        return new AppSettingsDocument
        {
            Id = AppSettingsDocumentId,
            PartitionKey = ConfigurationPartitionKeyValue,
            DefaultModelId = settings.DefaultModelId,
            ChatNamingModelId = settings.ChatNamingModelId
        };
    }
}
