using ChatUitReact.Server.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    private sealed class IdOnlyDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;
    }

    [JsonConverter(typeof(StringEnumConverter))]
    private enum StoredContentType
    {
        Text,
        Binary
    }

    private sealed class CosmosChatStorageOptions
    {
        public string? ConnectionString { get; set; }
        public string DatabaseName { get; set; } = "UserData";
        public string ConfigurationDatabaseName { get; set; } = "Configuration";
        public int MaxTextChunkUtf8Bytes { get; set; } = 500_000;
        public int MaxBinaryPayloadCharacters { get; set; } = 900_000;
        public CosmosContainerOptions Users { get; set; } = new CosmosContainerOptions { Name = "Users", PartitionKeyPath = "/userId" };
        public CosmosContainerOptions Chats { get; set; } = new CosmosContainerOptions { Name = "Chats", PartitionKeyPath = "/userId" };
        public CosmosContainerOptions ChatMessages { get; set; } = new CosmosContainerOptions { Name = "ChatMessages", PartitionKeyPath = "/userId" };
        public CosmosContainerOptions Content { get; set; } = new CosmosContainerOptions { Name = "Content", PartitionKeyPath = "/userId" };
        public CosmosContainerOptions Models { get; set; } = new CosmosContainerOptions { Name = "Models", PartitionKeyPath = "/partitionKey" };
        public CosmosContainerOptions ModelEndpoints { get; set; } = new CosmosContainerOptions { Name = "ModelEndpoints", PartitionKeyPath = "/partitionKey" };
        public CosmosContainerOptions Assistants { get; set; } = new CosmosContainerOptions { Name = "Assistants", PartitionKeyPath = "/partitionKey" };
        public CosmosContainerOptions AssistantContent { get; set; } = new CosmosContainerOptions { Name = "AssistantContent", PartitionKeyPath = "/assistantId" };
        public CosmosContainerOptions AppSettings { get; set; } = new CosmosContainerOptions { Name = "AppSettings", PartitionKeyPath = "/partitionKey" };
        public CosmosContainerOptions ToolPolicies { get; set; } = new CosmosContainerOptions { Name = "ToolPolicies", PartitionKeyPath = "/partitionKey" };
        public CosmosContainerOptions InternalAgents { get; set; } = new CosmosContainerOptions { Name = "InternalAgents", PartitionKeyPath = "/partitionKey" };
    }

    /// <summary>An admin override of a tool's access policy. Id is the tool id.</summary>
    private sealed class ToolPolicyDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = ConfigurationPartitionKeyValue;

        [JsonProperty("enabled")]
        public bool Enabled { get; set; } = true;

        [JsonProperty("allowedRoles", ItemConverterType = typeof(StringEnumConverter))]
        public List<UserRole> AllowedRoles { get; set; } = new();

        [JsonProperty("allowedGroupIds")]
        public List<string> AllowedGroupIds { get; set; } = new();

        [JsonProperty("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>An admin's model and reasoning level for one internal agent, and whether the Responses API serves it. Id is the agent id.</summary>
    private sealed class InternalAgentSettingDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = ConfigurationPartitionKeyValue;

        [JsonProperty("modelId")]
        public string ModelId { get; set; } = string.Empty;

        [JsonProperty("reasoningEffort")]
        [JsonConverter(typeof(StringEnumConverter))]
        public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;

        [JsonProperty("exposedInApi")]
        public bool ExposedInApi { get; set; }

        [JsonProperty("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    private sealed class CosmosContainerOptions
    {
        public string Name { get; set; } = string.Empty;
        public string PartitionKeyPath { get; set; } = "/userId";
    }

    private sealed class ChatDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("userId")]
        public string UserId { get; set; } = string.Empty;

        [JsonProperty("assistantId")]
        public string AssistantId { get; set; } = string.Empty;

        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("createdAt")]
        public DateTime CreatedAt { get; set; }

        [JsonProperty("updatedAt")]
        public DateTime UpdatedAt { get; set; }

        [JsonProperty("status")]
        public AiChatStatus Status { get; set; }

        [JsonProperty("isFavorite")]
        public bool IsFavorite { get; set; }

        // Absent on rows written before on-demand files existed.
        [JsonProperty("loadedFiles")]
        public List<ChatLoadedFileDocument> LoadedFiles { get; set; } = new();
    }

    private sealed class ChatLoadedFileDocument
    {
        [JsonProperty("fileId")]
        public string FileId { get; set; } = string.Empty;

        [JsonProperty("sourceFilename")]
        public string SourceFilename { get; set; } = string.Empty;

        [JsonProperty("tokenCounts")]
        public Dictionary<string, int> TokenCounts { get; set; } = new();
    }

    private sealed class ChatMessageDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("userId")]
        public string UserId { get; set; } = string.Empty;

        [JsonProperty("chatId")]
        public string ChatId { get; set; } = string.Empty;

        [JsonProperty("role")]
        public AiChatRole Role { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; }

        [JsonProperty("status")]
        public AiChatStatus Status { get; set; }

        [JsonProperty("contentBlockIds")]
        public List<string> ContentBlockIds { get; set; } = new();

        // The generation activity (thinking, tool calls, timings) as JSON, stored like message
        // text. Empty when a message has no recorded activity, such as user messages.
        [JsonProperty("activityBlockIds")]
        public List<string> ActivityBlockIds { get; set; } = new();

        [JsonProperty("files")]
        public List<StoredFileDocument> Files { get; set; } = new();

        // May be absent in stored documents; an empty value means "fall back to the chat's
        // assistant" rather than "no assistant".
        [JsonProperty("assistantId")]
        public string AssistantId { get; set; } = string.Empty;

        [JsonProperty("assistantName")]
        public string AssistantName { get; set; } = string.Empty;

        // Scheme id → tokens this message costs on the wire. Missing keys are counted and
        // written back when the chat is next read.
        [JsonProperty("tokenCounts")]
        public Dictionary<string, int> TokenCounts { get; set; } = new();

        // The attachment share of tokenCounts; empty for messages without files.
        [JsonProperty("fileTokenCounts")]
        public Dictionary<string, int> FileTokenCounts { get; set; } = new();
    }

    private sealed class StoredFileDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("sourceFilename")]
        public string SourceFilename { get; set; } = string.Empty;

        [JsonProperty("chunks")]
        public List<StoredFileChunkDocument> Chunks { get; set; } = new();
    }

    private sealed class StoredFileChunkDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("type")]
        public string Type { get; set; } = string.Empty;

        [JsonProperty("format")]
        public string? Format { get; set; }

        [JsonProperty("contentBlockIds")]
        public List<string> ContentBlockIds { get; set; } = new();
    }

    private sealed class ContentBlockDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("userId")]
        public string UserId { get; set; } = string.Empty;

        [JsonProperty("chatId")]
        public string ChatId { get; set; } = string.Empty;

        [JsonProperty("ownerId")]
        public string OwnerId { get; set; } = string.Empty;

        [JsonProperty("contentType")]
        public StoredContentType ContentType { get; set; }

        [JsonProperty("chunkIndex")]
        public int ChunkIndex { get; set; }

        [JsonProperty("isEncrypted")]
        public bool IsEncrypted { get; set; }

        [JsonProperty("payload")]
        public string Payload { get; set; } = string.Empty;
    }

    private sealed class ModelDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonProperty("modelId")]
        public string ModelId { get; set; } = string.Empty;

        [JsonProperty("modelName")]
        public string ModelName { get; set; } = string.Empty;

        [JsonProperty("description")]
        public string Description { get; set; } = string.Empty;

        [JsonProperty("endpointId")]
        public string EndpointId { get; set; } = string.Empty;

        [JsonProperty("allowedRoles", ItemConverterType = typeof(StringEnumConverter))]
        public List<UserRole> AllowedRoles { get; set; } = new();

        [JsonProperty("allowedAsDefault")]
        public bool AllowedAsDefault { get; set; }

        [JsonProperty("exposedInApi")]
        public bool ExposedInApi { get; set; }

        [JsonProperty("capabilities")]
        public ModelCapabilitiesDocument Capabilities { get; set; } = new();

        // Absent in rows saved before protocols were per model; null is surfaced, not defaulted.
        [JsonProperty("apiProtocol")]
        [JsonConverter(typeof(StringEnumConverter))]
        public ApiProtocol? ApiProtocol { get; set; }
    }

    /// <summary>
    /// The persisted shape of <see cref="ModelCapabilities"/>. Kept separate from the domain
    /// type on purpose, so that changing the domain model does not silently change the
    /// database schema.
    /// </summary>
    private sealed class ModelCapabilitiesDocument
    {
        [JsonProperty("supportsVision")]
        public bool SupportsVision { get; set; }

        [JsonProperty("supportsFunctionCalling")]
        public bool SupportsFunctionCalling { get; set; }

        [JsonProperty("temperature")]
        [JsonConverter(typeof(StringEnumConverter))]
        public TemperatureSupport Temperature { get; set; }

        [JsonProperty("supportedEfforts", ItemConverterType = typeof(StringEnumConverter))]
        public List<ReasoningEffort> SupportedEfforts { get; set; } = new();

        [JsonProperty("maxContextTokens")]
        public int MaxContextTokens { get; set; }

        [JsonProperty("maxOutputTokens")]
        public int MaxOutputTokens { get; set; }

        [JsonProperty("defaultMaxOutputTokens")]
        public int DefaultMaxOutputTokens { get; set; }

        [JsonProperty("knowledgeCutoff")]
        public DateTime? KnowledgeCutoff { get; set; }

        // May be absent in stored rows; null means "no token counter for this model".
        [JsonProperty("tokenCountingScheme")]
        public string? TokenCountingScheme { get; set; }
    }

    private sealed class AppSettingsDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonProperty("defaultModelId")]
        public string DefaultModelId { get; set; } = string.Empty;

        [JsonProperty("chatNamingModelId")]
        public string ChatNamingModelId { get; set; } = string.Empty;

        [JsonProperty("defaultAssistantId")]
        public string DefaultAssistantId { get; set; } = string.Empty;
    }

    private sealed class ModelEndpointDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonProperty("url")]
        public string Url { get; set; } = string.Empty;

        [JsonProperty("apiKey")]
        public string ApiKey { get; set; } = string.Empty;

        [JsonProperty("endpointType")]
        [JsonConverter(typeof(StringEnumConverter))]
        public EndpointType EndpointType { get; set; }
    }

    private sealed class AssistantDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("partitionKey")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("description")]
        public string Description { get; set; } = string.Empty;

        [JsonProperty("tags")]
        public List<string> Tags { get; set; } = new();

        [JsonProperty("chatSettings")]
        public AssistantChatSettingsDocument ChatSettings { get; set; } = new();

        [JsonProperty("files")]
        public List<StoredAssistantFileDocument> Files { get; set; } = new();

        [JsonProperty("ownerId")]
        public string OwnerId { get; set; } = string.Empty;

        [JsonProperty("access", NullValueHandling = NullValueHandling.Ignore)]
        public AssistantAccessDocument? Access { get; set; }

        // May be absent in stored rows; the default value still works as a cache key.
        [JsonProperty("updatedAt")]
        public DateTime UpdatedAt { get; set; }
    }

    private sealed class AssistantAccessDocument
    {
        [JsonProperty("allowedRoles", ItemConverterType = typeof(StringEnumConverter))]
        public List<UserRole> AllowedRoles { get; set; } = new();

        [JsonProperty("allowedGroupIds")]
        public List<string> AllowedGroupIds { get; set; } = new();
    }

    private sealed class StoredAssistantFileDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("sourceFilename")]
        public string SourceFilename { get; set; } = string.Empty;

        [JsonProperty("category")]
        public string Category { get; set; } = AssistantFileCategories.AlwaysLoaded;

        [JsonProperty("description")]
        public string? Description { get; set; }

        [JsonProperty("chunks")]
        public List<StoredFileChunkDocument> Chunks { get; set; } = new();
    }

    private sealed class AssistantContentBlockDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("assistantId")]
        public string AssistantId { get; set; } = string.Empty;

        [JsonProperty("ownerId")]
        public string OwnerId { get; set; } = string.Empty;

        [JsonProperty("contentType")]
        public StoredContentType ContentType { get; set; }

        [JsonProperty("chunkIndex")]
        public int ChunkIndex { get; set; }

        [JsonProperty("isEncrypted")]
        public bool IsEncrypted { get; set; }

        [JsonProperty("payload")]
        public string Payload { get; set; } = string.Empty;
    }

    private sealed class AssistantChatSettingsDocument
    {
        [JsonProperty("systemPrompt")]
        public string SystemPrompt { get; set; } = string.Empty;

        [JsonProperty("modelId")]
        public string ModelId { get; set; } = string.Empty;

        [JsonProperty("temperature")]
        public float Temperature { get; set; } = 0.5f;

        [JsonProperty("reasoningEffort")]
        [JsonConverter(typeof(StringEnumConverter))]
        public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;

        [JsonProperty("availableToolIds")]
        public List<string> AvailableToolIds { get; set; } = new();

        [JsonProperty("promptSnippets")]
        public List<string> PromptSnippets { get; set; } = new();
    }

    private sealed class UserDocument
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("userId")]
        public string UserId { get; set; } = string.Empty;

        [JsonProperty("roles")]
        public List<UserRole> Roles { get; set; } = new();

        [JsonProperty("preferences")]
        public UserPreferences Preferences { get; set; } = new();
    }
}