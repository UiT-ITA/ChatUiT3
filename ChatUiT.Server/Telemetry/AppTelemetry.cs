using System.Collections;
using System.Text;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// The catalog of every usage, audit, error and operational record the server writes. Usage and
/// audit records become custom events. Error and operational records become traces, or exceptions
/// when they carry one. A usage or audit record that carries an exception is written twice: once
/// as the event without the exception, once as an error record with it.
/// </summary>
public sealed class AppTelemetry
{
    private readonly ILogger<AppTelemetry> _logger;

    public AppTelemetry(ILogger<AppTelemetry> logger)
    {
        _logger = logger;
    }

    #region Chats

    public void ChatCreated(string chatId, string? assistantId) =>
        Usage("chat.created", new() { [FieldNames.ChatId] = chatId, [FieldNames.AssistantId] = assistantId });

    public void ChatNamed(string chatId, string? title, string? modelId, long durationMs, string outcome, Exception? exception = null) =>
        Usage("chat.named", new()
        {
            [FieldNames.ChatId] = chatId,
            [FieldNames.ChatTitle] = title,
            [FieldNames.ModelId] = modelId,
            [FieldNames.DurationMs] = durationMs,
            [FieldNames.Outcome] = outcome,
            [FieldNames.ErrorCategory] = exception == null ? null : ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception, LogLevel.Warning);

    public void ChatUpdated(string chatId, string? newTitle, bool? favorite, string? newAssistantId) =>
        Usage("chat.updated", new()
        {
            [FieldNames.ChatId] = chatId,
            ["changed"] = TelemetryFields.Join(new[]
            {
                newTitle != null ? "title" : null,
                favorite != null ? "favorite" : null,
                newAssistantId != null ? "assistant" : null
            }),
            [FieldNames.ChatTitle] = newTitle,
            ["chat.favorite"] = favorite,
            [FieldNames.AssistantId] = newAssistantId
        });

    public void ChatRedEnabled(string chatId, string? assistantId) =>
        Audit("chat.red_enabled", new() { [FieldNames.ChatId] = chatId, [FieldNames.AssistantId] = assistantId });

    public void ChatDeleted(string chatId, string? title, int? messageCount, int? ageDays) =>
        Usage("chat.deleted", new()
        {
            [FieldNames.ChatId] = chatId,
            [FieldNames.ChatTitle] = title,
            ["message.count"] = messageCount,
            ["age_days"] = ageDays
        });

    public void ChatNamingUnavailable(string reason, string? modelId, string? endpointType) =>
        Operational(LogLevel.Warning, "chat.naming_unavailable", new()
        {
            ["reason"] = reason,
            [FieldNames.ModelId] = modelId,
            ["endpoint.type"] = endpointType
        });

    #endregion

    #region Messages and generations

    public void MessageSent(MessageSentInfo info) =>
        Usage("message.sent", new()
        {
            [FieldNames.ChatId] = info.ChatId,
            [FieldNames.MessageId] = info.MessageId,
            [FieldNames.AssistantId] = info.AssistantId,
            [FieldNames.ModelId] = info.ModelId,
            ["classification"] = info.Classification,
            ["reasoning_effort"] = info.ReasoningEffort,
            ["file.count"] = info.FileNames.Count,
            ["file.names"] = TelemetryFields.Join(info.FileNames),
            ["file.types"] = TelemetryFields.Join(info.FileTypes),
            [FieldNames.FileBytes] = info.FileBytes,
            ["pinned_file.count"] = info.PinnedFileIds.Count,
            ["pinned_file.ids"] = TelemetryFields.Join(info.PinnedFileIds),
            ["on_demand_file.count"] = info.OnDemandFileIds.Count,
            ["on_demand_file.ids"] = TelemetryFields.Join(info.OnDemandFileIds),
            ["toolboxes"] = TelemetryFields.Join(info.Toolboxes),
            ["tools.loaded"] = TelemetryFields.Join(info.LoadedToolIds),
            ["client_tool.names"] = TelemetryFields.Join(info.ClientToolNames),
            ["tokens.prompt"] = info.PromptTokens
        });

    public void GenerationStarted(string chatId, string messageId, string modelId, string endpointType) =>
        Usage("generation.started", new()
        {
            [FieldNames.ChatId] = chatId,
            [FieldNames.MessageId] = messageId,
            [FieldNames.ModelId] = modelId,
            ["endpoint.type"] = endpointType
        });

    public void GenerationFinished(GenerationFinishedInfo info, Exception? exception = null) =>
        Usage("generation.finished", new()
        {
            [FieldNames.ChatId] = info.ChatId,
            [FieldNames.MessageId] = info.MessageId,
            [FieldNames.ModelId] = info.ModelId,
            [FieldNames.Outcome] = info.Outcome,
            [FieldNames.DurationMs] = info.DurationMs,
            ["time_to_first_token_ms"] = info.TimeToFirstTokenMs,
            ["thinking_ms"] = info.ThinkingMs,
            ["tool_ms"] = info.ToolMs,
            ["tool.rounds"] = info.ToolRounds,
            ["model.turns"] = info.ModelTurns,
            [FieldNames.TokensInput] = info.InputTokens,
            [FieldNames.TokensOutput] = info.OutputTokens,
            [FieldNames.TokensCached] = info.CachedTokens,
            [FieldNames.TokensCacheWrite] = info.CacheWriteTokens,
            ["stop_reason"] = info.StopReason,
            ["awaiting_user"] = info.AwaitingUser ? true : null,
            [FieldNames.ErrorCategory] = exception == null ? null : ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception);

    public void MessageStatusSaveFailed(string messageId, Exception exception) =>
        Error("message.status_save_failed", new() { [FieldNames.MessageId] = messageId }, exception);

    public void GenerationReasoningDropped(string protocol, Exception? exception = null) =>
        Operational(LogLevel.Warning, "generation.reasoning_dropped", new() { ["protocol"] = protocol }, exception);

    public void FileProcessingFailed(string? fileId, string? fileName, string? fileType, long? fileBytes, Exception exception) =>
        Error("file.processing_failed", new()
        {
            [FieldNames.FileId] = fileId,
            [FieldNames.FileName] = fileName,
            [FieldNames.FileType] = fileType,
            [FieldNames.FileBytes] = fileBytes
        }, exception);

    #endregion

    #region Tools and agents

    public void ToolCallFinished(ToolCallFinishedInfo info, Exception? exception = null) =>
        Usage("tool.call_finished", new()
        {
            [FieldNames.ChatId] = info.ChatId,
            [FieldNames.MessageId] = info.MessageId,
            [FieldNames.ToolId] = info.ToolId,
            ["toolbox"] = info.Toolbox,
            ["execution"] = info.Execution,
            ["status"] = info.Status,
            [FieldNames.DurationMs] = info.DurationMs,
            [FieldNames.ErrorCategory] = info.ErrorCategory ?? (exception == null ? null : ErrorClassification.Category(exception)),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception);

    public void ToolUnknownCalled(string? chatId, string toolName, bool toolboxNotLoaded) =>
        Error("tool.unknown_called", new()
        {
            [FieldNames.ChatId] = chatId,
            [FieldNames.ToolName] = toolName,
            ["toolbox_not_loaded"] = toolboxNotLoaded
        }, level: LogLevel.Warning);

    public void ToolResponded(string chatId, string messageId, string? toolId, string response) =>
        Usage("tool.responded", new()
        {
            [FieldNames.ChatId] = chatId,
            [FieldNames.MessageId] = messageId,
            [FieldNames.ToolId] = toolId,
            ["response"] = response
        });

    public void ToolArgumentsUnparsable(string toolName, Exception exception) =>
        Operational(LogLevel.Warning, "tool.arguments_unparsable", new() { [FieldNames.ToolName] = toolName }, exception);

    public void ToolCallDropped(string? toolCallId, string? toolName) =>
        Operational(LogLevel.Warning, "tool.call_dropped", new() { ["tool_call.id"] = toolCallId, [FieldNames.ToolName] = toolName });

    public void AgentRunStarted(string agentId, string modelId) =>
        Usage("agent.run_started", new() { ["agent.id"] = agentId, [FieldNames.ModelId] = modelId });

    public void AgentRunFinished(string agentId, string? modelId, int rounds, int functionCalls, int answerLength, string outcome, long durationMs, Exception? exception = null) =>
        Usage("agent.run_finished", new()
        {
            ["agent.id"] = agentId,
            [FieldNames.ModelId] = modelId,
            ["rounds"] = rounds,
            ["function_call.count"] = functionCalls,
            ["answer.length"] = answerLength,
            [FieldNames.Outcome] = outcome,
            [FieldNames.DurationMs] = durationMs,
            [FieldNames.ErrorCategory] = exception == null ? null : ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception);

    public void AgentFunctionFinished(string agentId, string function, string status, long durationMs) =>
        Usage("agent.function_finished", new()
        {
            ["agent.id"] = agentId,
            ["function"] = function,
            ["status"] = status,
            [FieldNames.DurationMs] = durationMs
        });

    public void AgentModelUnusable(string agentId, string? modelId) =>
        Operational(LogLevel.Warning, "agent.model_unusable", new() { ["agent.id"] = agentId, [FieldNames.ModelId] = modelId });

    #endregion

    #region Knowledge

    public void KnowledgeFileLoaded(string fileId, string fileName, string assistantId, string? chatId) =>
        Usage("knowledge_file.loaded", new()
        {
            [FieldNames.FileId] = fileId,
            [FieldNames.FileName] = fileName,
            [FieldNames.AssistantId] = assistantId,
            [FieldNames.ChatId] = chatId
        });

    public void KnowledgeFilePinFailed(string fileId, string? chatId) =>
        Operational(LogLevel.Warning, "knowledge_file.pin_failed", new() { [FieldNames.FileId] = fileId, [FieldNames.ChatId] = chatId, ["reason"] = "chat_not_found" });

    public void KnowledgeSourceLoaded(string sourceId, long durationMs, int length, string outcome, Exception? exception = null) =>
        Usage("knowledge_source.loaded", new()
        {
            ["source.id"] = sourceId,
            [FieldNames.DurationMs] = durationMs,
            ["length"] = length,
            [FieldNames.Outcome] = outcome,
            [FieldNames.ErrorCategory] = exception == null ? null : ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception, LogLevel.Warning);

    #endregion

    #region Assistants

    /// <summary><paramref name="action"/> is created, updated or deleted.</summary>
    public void AssistantChanged(string action, AssistantSummary assistant, IReadOnlyList<string>? changed = null, string? changes = null) =>
        Usage($"assistant.{action}", new()
        {
            [FieldNames.AssistantId] = assistant.Id,
            [FieldNames.AssistantName] = assistant.Name,
            [FieldNames.ModelId] = assistant.ModelId,
            ["tool.count"] = assistant.ToolCount,
            ["file.count"] = assistant.FileCount,
            ["knowledge_source.count"] = assistant.KnowledgeSourceCount,
            ["classification"] = assistant.Classification,
            ["changed"] = TelemetryFields.Join(changed),
            ["changes"] = changes
        });

    /// <summary><paramref name="kind"/> is visibility, default or favorite.</summary>
    public void AssistantPreferenceChanged(string? assistantId, string kind, object? value) =>
        Usage("assistant.preference_changed", new() { [FieldNames.AssistantId] = assistantId, ["kind"] = kind, ["value"] = value });

    /// <summary><paramref name="action"/> is shared_added, shared_removed or share_link_created.</summary>
    public void AssistantShared(string action, string assistantId, string? assistantName) =>
        Usage($"assistant.{action}", new() { [FieldNames.AssistantId] = assistantId, [FieldNames.AssistantName] = assistantName });

    #endregion

    #region Images

    public void ImagePromptRefined(string modelId, long durationMs, string outcome, Exception? exception = null) =>
        Usage("image.prompt_refined", new()
        {
            [FieldNames.ModelId] = modelId,
            [FieldNames.DurationMs] = durationMs,
            [FieldNames.Outcome] = outcome,
            [FieldNames.ErrorCategory] = exception == null ? null : ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception)
        }, exception, LogLevel.Warning);

    public void ImageGenerationStarted(ImageGenerationInfo info) =>
        Usage("image.generation_started", ImageFields(info));

    public void ImageGenerationFinished(ImageGenerationInfo info, string outcome, long durationMs, int? inputTokens, int? outputTokens, string? errorCategory, Exception? exception = null)
    {
        var fields = ImageFields(info);
        fields[FieldNames.Outcome] = outcome;
        fields[FieldNames.DurationMs] = durationMs;
        fields[FieldNames.TokensInput] = inputTokens;
        fields[FieldNames.TokensOutput] = outputTokens;
        fields[FieldNames.ErrorCategory] = errorCategory ?? (exception == null ? null : ErrorClassification.Category(exception));
        fields[FieldNames.ErrorCode] = exception == null ? null : ErrorClassification.Code(exception);
        Usage("image.generation_finished", fields, exception);
    }

    public void ImageStreamMissing(string generationId) =>
        Operational(LogLevel.Warning, "image.stream_missing", new() { ["generation.id"] = generationId });

    public void ImageStreamFailed(string generationId, string connectionId, Exception exception) =>
        Error("image.stream_failed", new() { ["generation.id"] = generationId, ["connection.id"] = connectionId }, exception);

    private static TelemetryFields ImageFields(ImageGenerationInfo info) => new()
    {
        ["generation.id"] = info.GenerationId,
        [FieldNames.ModelId] = info.ModelId,
        ["size"] = info.Size,
        ["quality"] = info.Quality,
        ["count"] = info.Count,
        ["input_image.count"] = info.InputImageCount
    };

    #endregion

    #region Profile, auth and admin

    public void ProfileUpdated(IReadOnlyList<string> changedFields) =>
        Usage("profile.updated", new() { ["changed"] = TelemetryFields.Join(changedFields) });

    public void AccessDenied(string? route, string? toolId, string reason) =>
        Audit("auth.access_denied", new() { ["route"] = route, [FieldNames.ToolId] = toolId, ["reason"] = reason });

    /// <summary><paramref name="action"/> is created, updated or deleted.</summary>
    public void AdminChanged(string entityType, string entityId, string action, IReadOnlyList<string>? changed = null, string? changes = null) =>
        Audit("admin.changed", new()
        {
            ["entity.type"] = entityType,
            ["entity.id"] = entityId,
            ["action"] = action,
            ["changed"] = TelemetryFields.Join(changed),
            ["changes"] = changes
        });

    public void AdminModelTested(string modelId, string outcome) =>
        Audit("admin.model_tested", new() { [FieldNames.ModelId] = modelId, [FieldNames.Outcome] = outcome });

    public void AdminDeploymentsUnavailable(string endpointId, Exception exception) =>
        Operational(LogLevel.Warning, "admin.deployments_unavailable", new() { ["endpoint.id"] = endpointId }, exception);

    public void DelegatedTokenFailed(string reason, IEnumerable<string> scopes, string? code, Exception? exception) =>
        Error("auth.delegated_token_failed", new()
        {
            ["reason"] = reason,
            ["scopes"] = TelemetryFields.Join(scopes),
            [FieldNames.ErrorCode] = code
        }, exception);

    public void UnauthenticatedIdentity() =>
        Operational(LogLevel.Warning, "auth.unauthenticated_identity", new());

    public void GroupsOverage() =>
        Operational(LogLevel.Warning, "auth.groups_overage", new());

    #endregion

    #region Requests and streams

    public void RequestFailed(string method, string? route, Exception exception) =>
        Error("request.failed", new()
        {
            ["http.method"] = method,
            ["route"] = route,
            [FieldNames.ErrorCategory] = ErrorClassification.Category(exception),
            [FieldNames.ErrorCode] = ErrorClassification.Code(exception)
        }, exception);

    public void StreamChunkDropped(string streamKey) =>
        Operational(LogLevel.Warning, "stream.chunk_dropped", new() { ["stream.key"] = streamKey });

    public void StreamMissing(string streamKey) =>
        Operational(LogLevel.Warning, "stream.missing", new() { ["stream.key"] = streamKey });

    public void StreamClientFailed(string streamKey, string clientId, Exception exception) =>
        Error("stream.client_failed", new() { ["stream.key"] = streamKey, ["connection.id"] = clientId }, exception);

    #endregion

    #region System

    public void SystemStarted(SystemStartedInfo info) =>
        Operational(LogLevel.Information, "system.started", new()
        {
            ["tools"] = TelemetryFields.Join(info.ToolIds),
            ["toolboxes"] = TelemetryFields.Join(info.ToolboxIds),
            ["agents"] = TelemetryFields.Join(info.AgentIds),
            ["knowledge_sources"] = TelemetryFields.Join(info.KnowledgeSourceIds),
            ["settings.default_model_id"] = info.DefaultModelId,
            ["settings.chat_naming_model_id"] = info.ChatNamingModelId,
            ["settings.default_assistant_id"] = info.DefaultAssistantId
        });

    public void EndpointSeeded(string url) =>
        Operational(LogLevel.Information, "system.endpoint_seeded", new() { ["endpoint.url"] = url });

    public void EndpointSeedFailed(Exception exception) =>
        Error("system.endpoint_seed_failed", new(), exception);

    public void DatabaseReady(string endpoint) =>
        Operational(LogLevel.Information, "system.database_ready", new() { ["database.endpoint"] = endpoint });

    public void DatabaseCheckFailed(string endpoint, Exception exception) =>
        Error("system.database_check_failed", new() { ["database.endpoint"] = endpoint }, exception);

    public void DatabaseSetupFailed(string reason, string detail) =>
        Error("system.database_setup_failed", new() { ["reason"] = reason, ["detail"] = detail }, level: LogLevel.Critical);

    public void DatabaseIdentityUnreadable(Exception exception) =>
        Operational(LogLevel.Warning, "system.database_identity_unreadable", new(), exception);

    public void ContentDecryptFailed(string blockId, Exception exception) =>
        Error("content.decrypt_failed", new() { ["block.id"] = blockId }, exception);

    public void SettingModelFallback(string settingName, string? storedModelId, string? fallbackModelId) =>
        Operational(LogLevel.Warning, "settings.model_fallback", new()
        {
            ["setting"] = settingName,
            ["stored_model.id"] = storedModelId,
            ["fallback_model.id"] = fallbackModelId
        });

    #endregion

    #region Client

    /// <summary>A record the web client sent, already checked against the client schema.</summary>
    public void ClientRecord(string name, EventKind kind, TelemetryFields fields)
    {
        if (kind == EventKind.Error)
        {
            Error(name, fields, level: LogLevel.Warning);
        }
        else
        {
            Usage(name, fields);
        }
    }

    public void ClientRecordRejected(string? name, IReadOnlyList<string> problems) =>
        Operational(LogLevel.Warning, "client.telemetry_rejected", new() { ["rejected.name"] = name, ["problems"] = string.Join("; ", problems) });

    #endregion

    #region Writing

    private void Usage(string name, TelemetryFields fields, Exception? exception = null, LogLevel exceptionLevel = LogLevel.Error) =>
        WriteEvent(EventKind.Usage, name, fields, exception, exceptionLevel);

    private void Audit(string name, TelemetryFields fields) =>
        WriteEvent(EventKind.Audit, name, fields, null, LogLevel.Error);

    private void Error(string name, TelemetryFields fields, Exception? exception = null, LogLevel level = LogLevel.Error) =>
        Write(level, EventKind.Error, name, fields, exception, customEvent: false);

    private void Operational(LogLevel level, string name, TelemetryFields fields, Exception? exception = null) =>
        Write(level, EventKind.Operational, name, fields, exception, customEvent: false);

    private void WriteEvent(EventKind kind, string name, TelemetryFields fields, Exception? exception, LogLevel exceptionLevel)
    {
        Write(LogLevel.Information, kind, name, fields, null, customEvent: true);
        if (exception != null)
        {
            Write(exceptionLevel, EventKind.Error, name, fields, exception, customEvent: false);
        }
    }

    private void Write(LogLevel level, EventKind kind, string name, TelemetryFields fields, Exception? exception, bool customEvent)
    {
        if (!_logger.IsEnabled(level))
        {
            return;
        }

        _logger.Log(level, default, new Record(name, kind, fields, customEvent), exception, static (record, _) => record.ToString());
    }

    /// <summary>The state of one record: its fields as attributes.</summary>
    private sealed class Record : IReadOnlyList<KeyValuePair<string, object?>>
    {
        private readonly List<KeyValuePair<string, object?>> _items;

        public Record(string name, EventKind kind, TelemetryFields fields, bool customEvent)
        {
            _items = new List<KeyValuePair<string, object?>>(fields.Items.Count + 4);
            if (customEvent)
            {
                _items.Add(new(FieldNames.CustomEventName, name));
            }

            _items.Add(new(FieldNames.EventName, name));
            _items.Add(new(FieldNames.EventKind, KindName(kind)));
            _items.AddRange(fields.Items.Where(item => item.Value != null));
            _items.Add(new("{OriginalFormat}", name));
        }

        public KeyValuePair<string, object?> this[int index] => _items[index];

        public int Count => _items.Count;

        public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => _items.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public override string ToString()
        {
            var text = new StringBuilder();
            foreach (var (key, value) in _items)
            {
                if (key == "{OriginalFormat}" || key == FieldNames.CustomEventName)
                {
                    continue;
                }

                if (key == FieldNames.EventName)
                {
                    text.Append(value);
                    continue;
                }

                text.Append(' ').Append(key).Append('=').Append(value);
            }

            return text.ToString();
        }
    }

    private static string KindName(EventKind kind) => kind switch
    {
        EventKind.Usage => "usage",
        EventKind.Audit => "audit",
        EventKind.Error => "error",
        _ => "operational"
    };

    #endregion
}

public sealed record MessageSentInfo(
    string ChatId,
    string MessageId,
    string? AssistantId,
    string? ModelId,
    string? Classification,
    string? ReasoningEffort,
    IReadOnlyList<string> FileNames,
    IReadOnlyList<string> FileTypes,
    long FileBytes,
    IReadOnlyList<string> PinnedFileIds,
    IReadOnlyList<string> OnDemandFileIds,
    IReadOnlyList<string> Toolboxes,
    IReadOnlyList<string> LoadedToolIds,
    IReadOnlyList<string> ClientToolNames,
    int? PromptTokens);

public sealed record GenerationFinishedInfo(
    string ChatId,
    string MessageId,
    string? ModelId,
    string Outcome,
    long DurationMs,
    long? TimeToFirstTokenMs,
    long ThinkingMs,
    long ToolMs,
    int ToolRounds,
    int ModelTurns,
    long InputTokens,
    long OutputTokens,
    long CachedTokens,
    long CacheWriteTokens,
    string? StopReason,
    bool AwaitingUser);

public sealed record ToolCallFinishedInfo(
    string? ChatId,
    string? MessageId,
    string ToolId,
    string? Toolbox,
    string Execution,
    string Status,
    long DurationMs,
    string? ErrorCategory);

public sealed record AssistantSummary(
    string Id,
    string? Name,
    string? ModelId,
    int ToolCount,
    int FileCount,
    int KnowledgeSourceCount,
    string? Classification);

public sealed record ImageGenerationInfo(
    string GenerationId,
    string ModelId,
    string? Size,
    string? Quality,
    int Count,
    int InputImageCount);

public sealed record SystemStartedInfo(
    IReadOnlyList<string> ToolIds,
    IReadOnlyList<string> ToolboxIds,
    IReadOnlyList<string> AgentIds,
    IReadOnlyList<string> KnowledgeSourceIds,
    string? DefaultModelId,
    string? ChatNamingModelId,
    string? DefaultAssistantId);
