using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    // Endpoint management
    public async Task<List<ModelEndpoint>> GetEndpointsAsync()
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey")
                .WithParameter("@partitionKey", ConfigurationPartitionKey),
            ConfigurationPartitionKey);

        return documents.Select(MapModelEndpoint).ToList();
    }

    public async Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpointId,
            ConfigurationPartitionKey);

        return document == null ? null : MapModelEndpoint(document);
    }

    public async Task<string> CreateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();

        var endpointId = string.IsNullOrWhiteSpace(endpoint.Id) ? Guid.NewGuid().ToString() : endpoint.Id;
        var document = MapModelEndpointDocument(endpoint, endpointId);

        await _modelEndpointContainer!.CreateItemAsync(document, new PartitionKey(ConfigurationPartitionKey));

        endpoint.Id = endpointId;
        return endpointId;
    }

    public async Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(endpoint.Id))
        {
            return false;
        }

        var existingDocument = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpoint.Id,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        var document = MapModelEndpointDocument(endpoint, endpoint.Id);
        await _modelEndpointContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    public async Task<bool> DeleteEndpointAsync(string endpointId)
    {
        await EnsureInitializedAsync();

        var existingDocument = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpointId,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        await _modelEndpointContainer!.DeleteItemAsync<ModelEndpointDocument>(endpointId, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    // Model management
    public async Task<List<Model>> GetModelsAsync()
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<JObject>(
            _modelContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey")
                .WithParameter("@partitionKey", ConfigurationPartitionKey),
            ConfigurationPartitionKey);

        return documents.Select(MapModel).ToList();
    }

    public async Task<Model?> GetModelByIdAsync(string modelId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<JObject>(
            _modelContainer!,
            modelId,
            ConfigurationPartitionKey);

        return document == null ? null : MapModel(document);
    }

    public async Task<string> CreateModelAsync(Model model)
    {
        await EnsureInitializedAsync();

        var modelId = string.IsNullOrWhiteSpace(model.Id) ? Guid.NewGuid().ToString() : model.Id;
        var document = MapModelDocument(model, modelId);

        await _modelContainer!.CreateItemAsync(JObject.FromObject(document), new PartitionKey(ConfigurationPartitionKey));

        model.Id = modelId;
        return modelId;
    }

    /// <summary>False when no model has the id. Throws when the stored model is of another type.</summary>
    public async Task<bool> UpdateModelAsync(Model model)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(model.Id))
        {
            return false;
        }

        var existing = await GetModelByIdAsync(model.Id);
        if (existing == null)
        {
            return false;
        }

        if (existing.Type != model.Type)
        {
            throw new InvalidOperationException($"Model {model.Id} is a {existing.Type} model and cannot be saved as a {model.Type} model.");
        }

        var document = MapModelDocument(model, model.Id);
        await _modelContainer!.ReplaceItemAsync(JObject.FromObject(document), document.Id, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    public async Task<bool> DeleteModelAsync(string modelId)
    {
        await EnsureInitializedAsync();

        var existingDocument = await ReadItemOrDefaultAsync<IdOnlyDocument>(
            _modelContainer!,
            modelId,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        await _modelContainer!.DeleteItemAsync<IdOnlyDocument>(modelId, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    private static ModelEndpoint MapModelEndpoint(ModelEndpointDocument document)
    {
        return new ModelEndpoint
        {
            Id = document.Id,
            Url = document.Url,
            ApiKey = document.ApiKey,
            EndpointType = document.EndpointType,
            AuthMethod = document.AuthMethod
        };
    }

    private static ModelEndpointDocument MapModelEndpointDocument(ModelEndpoint endpoint, string endpointId)
    {
        return new ModelEndpointDocument
        {
            Id = endpointId,
            PartitionKey = ConfigurationPartitionKeyValue,
            Url = endpoint.Url,
            ApiKey = endpoint.ApiKey,
            EndpointType = endpoint.EndpointType,
            AuthMethod = endpoint.AuthMethod
        };
    }

    /// <summary>Reads a stored model row as the document class for its <c>type</c>.</summary>
    private static Model MapModel(JObject row)
    {
        var id = row.Value<string>("id");
        var type = row.Value<string>("type");
        if (string.IsNullOrEmpty(type))
        {
            throw new InvalidOperationException($"Model row {id} has no type.");
        }

        if (!Enum.TryParse<ModelType>(type, out var modelType))
        {
            throw new InvalidOperationException($"Model row {id} has the unknown type '{type}'.");
        }

        return modelType switch
        {
            ModelType.Language => MapLanguageModel(row.ToObject<LanguageModelDocument>()!),
            ModelType.Image => MapImageModel(row.ToObject<ImageModelDocument>()!),
            _ => throw new NotSupportedException($"Model row {id} is a {modelType} model, which cannot be stored yet.")
        };
    }

    private static ModelDocument MapModelDocument(Model model, string modelId)
    {
        ModelDocument document = model switch
        {
            LanguageModel language => MapLanguageModelDocument(language),
            ImageModel image => MapImageModelDocument(image),
            _ => throw new NotSupportedException($"{model.Type} models cannot be stored yet.")
        };

        document.Id = modelId;
        document.PartitionKey = ConfigurationPartitionKeyValue;
        document.Type = model.Type;
        document.ModelId = model.ModelId;
        document.ModelName = model.ModelName;
        document.Description = model.Description;
        document.EndpointId = model.EndpointId;
        document.AllowedRoles = model.AllowedRoles;
        return document;
    }

    private static void MapCommonFields(ModelDocument document, Model model)
    {
        model.Id = document.Id;
        model.ModelId = document.ModelId;
        model.ModelName = document.ModelName;
        model.Description = document.Description;
        model.EndpointId = document.EndpointId;
        model.AllowedRoles = document.AllowedRoles;
    }

    private static LanguageModel MapLanguageModel(LanguageModelDocument document)
    {
        var model = new LanguageModel
        {
            AllowedAsDefault = document.AllowedAsDefault,
            ExposedInApi = document.ExposedInApi,
            Capabilities = MapLanguageModelCapabilities(document.Capabilities),
            ApiProtocol = document.ApiProtocol,
            Classification = document.Classification
        };
        MapCommonFields(document, model);
        return model;
    }

    private static LanguageModelDocument MapLanguageModelDocument(LanguageModel model)
    {
        return new LanguageModelDocument
        {
            AllowedAsDefault = model.AllowedAsDefault,
            ExposedInApi = model.ExposedInApi,
            Capabilities = MapLanguageModelCapabilitiesDocument(model.Capabilities),
            ApiProtocol = model.ApiProtocol,
            Classification = model.Classification
        };
    }

    private static LanguageModelCapabilities MapLanguageModelCapabilities(LanguageModelCapabilitiesDocument document)
    {
        return new LanguageModelCapabilities
        {
            SupportsVision = document.SupportsVision,
            SupportsFunctionCalling = document.SupportsFunctionCalling,
            Temperature = document.Temperature,
            SupportedEfforts = document.SupportedEfforts,
            MaxContextTokens = document.MaxContextTokens,
            MaxOutputTokens = document.MaxOutputTokens,
            DefaultMaxOutputTokens = document.DefaultMaxOutputTokens,
            KnowledgeCutoff = document.KnowledgeCutoff,
            TokenCountingScheme = document.TokenCountingScheme
        };
    }

    private static LanguageModelCapabilitiesDocument MapLanguageModelCapabilitiesDocument(LanguageModelCapabilities capabilities)
    {
        return new LanguageModelCapabilitiesDocument
        {
            SupportsVision = capabilities.SupportsVision,
            SupportsFunctionCalling = capabilities.SupportsFunctionCalling,
            Temperature = capabilities.Temperature,
            SupportedEfforts = capabilities.SupportedEfforts,
            MaxContextTokens = capabilities.MaxContextTokens,
            MaxOutputTokens = capabilities.MaxOutputTokens,
            DefaultMaxOutputTokens = capabilities.DefaultMaxOutputTokens,
            KnowledgeCutoff = capabilities.KnowledgeCutoff,
            TokenCountingScheme = capabilities.TokenCountingScheme
        };
    }

    private static ImageModel MapImageModel(ImageModelDocument document)
    {
        var model = new ImageModel
        {
            ImageApi = document.ImageApi,
            Capabilities = MapImageModelCapabilities(document.Capabilities)
        };
        MapCommonFields(document, model);
        return model;
    }

    private static ImageModelDocument MapImageModelDocument(ImageModel model)
    {
        return new ImageModelDocument
        {
            ImageApi = model.ImageApi,
            Capabilities = MapImageModelCapabilitiesDocument(model.Capabilities)
        };
    }

    private static ImageModelCapabilities MapImageModelCapabilities(ImageModelCapabilitiesDocument document)
    {
        return new ImageModelCapabilities
        {
            SizePresets = document.SizePresets.Select(s => new ImageSize(s.Width, s.Height)).ToList(),
            SupportsAutoSize = document.SupportsAutoSize,
            SupportsCustomSize = document.SupportsCustomSize,
            SizeMultiple = document.SizeMultiple,
            MinSide = document.MinSide,
            MaxSide = document.MaxSide,
            MinPixels = document.MinPixels,
            MaxPixels = document.MaxPixels,
            MaxAspectRatio = document.MaxAspectRatio,
            SupportsAutoAspectRatio = document.SupportsAutoAspectRatio,
            Qualities = document.Qualities,
            MaxImagesPerRequest = document.MaxImagesPerRequest,
            OutputFormats = document.OutputFormats,
            SupportsCompression = document.SupportsCompression,
            Backgrounds = document.Backgrounds,
            ModerationLevels = document.ModerationLevels,
            MaxPartialImages = document.MaxPartialImages,
            SupportsWebGrounding = document.SupportsWebGrounding,
            MaxPromptCharacters = document.MaxPromptCharacters,
            Editing = document.Editing == null ? null : new ImageEditCapabilities
            {
                MaxInputImages = document.Editing.MaxInputImages,
                InputFormats = document.Editing.InputFormats,
                MaxInputImageBytes = document.Editing.MaxInputImageBytes,
                SupportsMask = document.Editing.SupportsMask,
                SupportsMarkup = document.Editing.SupportsMarkup,
                AcceptsGenerationSettings = document.Editing.AcceptsGenerationSettings
            }
        };
    }

    private static ImageModelCapabilitiesDocument MapImageModelCapabilitiesDocument(ImageModelCapabilities capabilities)
    {
        return new ImageModelCapabilitiesDocument
        {
            SizePresets = capabilities.SizePresets.Select(s => new ImageSizeDocument { Width = s.Width, Height = s.Height }).ToList(),
            SupportsAutoSize = capabilities.SupportsAutoSize,
            SupportsCustomSize = capabilities.SupportsCustomSize,
            SizeMultiple = capabilities.SizeMultiple,
            MinSide = capabilities.MinSide,
            MaxSide = capabilities.MaxSide,
            MinPixels = capabilities.MinPixels,
            MaxPixels = capabilities.MaxPixels,
            MaxAspectRatio = capabilities.MaxAspectRatio,
            SupportsAutoAspectRatio = capabilities.SupportsAutoAspectRatio,
            Qualities = capabilities.Qualities,
            MaxImagesPerRequest = capabilities.MaxImagesPerRequest,
            OutputFormats = capabilities.OutputFormats,
            SupportsCompression = capabilities.SupportsCompression,
            Backgrounds = capabilities.Backgrounds,
            ModerationLevels = capabilities.ModerationLevels,
            MaxPartialImages = capabilities.MaxPartialImages,
            SupportsWebGrounding = capabilities.SupportsWebGrounding,
            MaxPromptCharacters = capabilities.MaxPromptCharacters,
            Editing = capabilities.Editing == null ? null : new ImageEditCapabilitiesDocument
            {
                MaxInputImages = capabilities.Editing.MaxInputImages,
                InputFormats = capabilities.Editing.InputFormats,
                MaxInputImageBytes = capabilities.Editing.MaxInputImageBytes,
                SupportsMask = capabilities.Editing.SupportsMask,
                SupportsMarkup = capabilities.Editing.SupportsMarkup,
                AcceptsGenerationSettings = capabilities.Editing.AcceptsGenerationSettings
            }
        };
    }
}
