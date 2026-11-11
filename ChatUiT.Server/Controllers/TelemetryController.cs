using System.Text.Json;
using ChatUiT.Server.Telemetry;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Services.Training;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// Takes batches of usage and error records from the web client and the Office and Teams panes.
/// Each record is checked against <see cref="Schema"/>: an unknown record name, an unknown field,
/// or a value of the wrong type or length rejects that record, and the rejection is recorded as
/// <c>client.telemetry_rejected</c>.
/// </summary>
[ApiController]
[Route("api/telemetry")]
[AllowWithoutTraining]
[Authorize]
public class TelemetryController : ControllerBase
{
    public const int MaxRecords = 50;
    public const int MaxStringLength = 300;

    private enum FieldKind
    {
        Text,
        Number,
        Choice
    }

    private sealed record Field(FieldKind Kind, IReadOnlySet<string>? Choices = null);

    private sealed record RecordSchema(EventKind Kind, IReadOnlyDictionary<string, Field> Fields);

    private static Field Text => new(FieldKind.Text);
    private static Field Number => new(FieldKind.Number);
    private static Field Choice(params string[] values) => new(FieldKind.Choice, values.ToHashSet(StringComparer.Ordinal));

    public static readonly IReadOnlySet<string> ErrorKinds = new HashSet<string>(StringComparer.Ordinal)
    {
        "render", "unhandled_rejection", "network", "realtime", "auth", "file_import", "render_markdown",
        "render_mermaid", "clipboard", "storage", "tokenizer", "client_tool"
    };

    private static readonly IReadOnlyDictionary<string, RecordSchema> Schema = new Dictionary<string, RecordSchema>(StringComparer.Ordinal)
    {
        ["client.page_viewed"] = new(EventKind.Usage, new Dictionary<string, Field>
        {
            ["route"] = Text,
            [FieldNames.ChatId] = Text,
            [FieldNames.AssistantId] = Text
        }),
        ["client.file_imported"] = new(EventKind.Usage, new Dictionary<string, Field>
        {
            [FieldNames.FileName] = Text,
            [FieldNames.FileType] = Text,
            [FieldNames.FileBytes] = Number,
            ["processor"] = Text,
            [FieldNames.DurationMs] = Number,
            [FieldNames.Outcome] = Choice(Outcomes.Succeeded, Outcomes.Failed)
        }),
        ["client.setting_changed"] = new(EventKind.Usage, new Dictionary<string, Field>
        {
            ["setting"] = Text,
            ["value"] = Text
        }),
        ["client.message_copied"] = new(EventKind.Usage, new Dictionary<string, Field>
        {
            [FieldNames.MessageId] = Text,
            ["copied"] = Choice("message", "code")
        }),
        ["client.error"] = new(EventKind.Error, new Dictionary<string, Field>
        {
            ["kind"] = new(FieldKind.Choice, ErrorKinds),
            ["error.name"] = Text,
            ["message"] = Text,
            ["route"] = Text,
            ["http.status"] = Number,
            [FieldNames.ErrorCode] = Text,
            [FieldNames.FileName] = Text,
            [FieldNames.FileType] = Text,
            [FieldNames.FileBytes] = Number,
            ["processor"] = Text,
            [FieldNames.ToolName] = Text,
            ["encoding"] = Text
        })
    };

    private readonly AppTelemetry _telemetry;

    public TelemetryController(AppTelemetry telemetry)
    {
        _telemetry = telemetry;
    }

    public sealed class ClientRecordDto
    {
        public string? Name { get; set; }

        public Dictionary<string, JsonElement>? Fields { get; set; }
    }

    public sealed class ClientBatchDto
    {
        public List<ClientRecordDto>? Records { get; set; }
    }

    [HttpPost]
    [RequestSizeLimit(64 * 1024)]
    public IActionResult Post([FromBody] ClientBatchDto batch)
    {
        var records = batch.Records ?? [];
        if (records.Count > MaxRecords)
        {
            return BadRequest($"At most {MaxRecords} records per batch.");
        }

        var accepted = 0;
        foreach (var record in records)
        {
            var problems = new List<string>();
            var fields = Check(record, problems);
            if (fields == null || problems.Count > 0)
            {
                _telemetry.ClientRecordRejected(Clip(record.Name), problems);
                continue;
            }

            _telemetry.ClientRecord(record.Name!, Schema[record.Name!].Kind, fields);
            accepted++;
        }

        return Accepted(new { accepted, rejected = records.Count - accepted });
    }

    private static TelemetryFields? Check(ClientRecordDto record, List<string> problems)
    {
        if (record.Name == null || !Schema.TryGetValue(record.Name, out var schema))
        {
            problems.Add("unknown record name");
            return null;
        }

        var fields = new TelemetryFields();
        foreach (var (key, value) in record.Fields ?? [])
        {
            if (!schema.Fields.TryGetValue(key, out var field))
            {
                problems.Add($"unknown field {Clip(key)}");
                continue;
            }

            if (value.ValueKind == JsonValueKind.Null)
            {
                continue;
            }

            switch (field.Kind)
            {
                case FieldKind.Number when value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number):
                    fields[key] = number;
                    break;
                case FieldKind.Text when value.ValueKind == JsonValueKind.String && value.GetString()!.Length <= MaxStringLength:
                    fields[key] = value.GetString();
                    break;
                case FieldKind.Choice when value.ValueKind == JsonValueKind.String && field.Choices!.Contains(value.GetString()!):
                    fields[key] = value.GetString();
                    break;
                default:
                    problems.Add($"invalid value for {key}");
                    break;
            }
        }

        return fields;
    }

    private static string? Clip(string? value) =>
        value == null ? null : value.Length <= 64 ? value : value[..64];
}
