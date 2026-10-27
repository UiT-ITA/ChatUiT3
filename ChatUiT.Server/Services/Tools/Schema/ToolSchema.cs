using System;
using System.ComponentModel;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// Builds the JSON Schema for a tool's arguments from a C# type, and reads arguments back
/// with the same options so what the model was told matches what the tool receives.
///
/// The exporter's output is adjusted for what the model providers accept: nullable members
/// lose the <c>["type","null"]</c> union, non-nullable members become <c>required</c>,
/// <see cref="DescriptionAttribute"/> text becomes <c>description</c>, and objects close with
/// <c>additionalProperties: false</c>.
/// </summary>
public static class ToolSchema
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        RespectNullableAnnotations = true,
        // Web defaults allow numbers as strings, which the exporter renders as a string|integer union.
        NumberHandling = JsonNumberHandling.Strict,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private static readonly JsonSchemaExporterOptions ExporterOptions = new()
    {
        TreatNullObliviousAsNonNullable = true,
        TransformSchemaNode = Transform
    };

    public static JsonObject For<TArgs>() => For(typeof(TArgs));

    public static JsonObject For(Type argsType)
    {
        var node = Options.GetJsonSchemaAsNode(argsType, ExporterOptions);
        if (node is not JsonObject schema)
        {
            throw new InvalidOperationException($"{argsType.Name} did not produce an object schema.");
        }

        schema.Remove("$schema");

        // An argument-less record exports without "properties"; match the shape of Empty().
        schema["properties"] ??= new JsonObject();
        return schema;
    }

    /// <summary>An object schema with no properties, for tools that take no arguments.</summary>
    public static JsonObject Empty() => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject(),
        ["additionalProperties"] = false
    };

    public static TArgs Deserialize<TArgs>(JsonElement arguments) where TArgs : class
    {
        try
        {
            return JsonSerializer.Deserialize<TArgs>(arguments, Options)
                ?? throw new ToolArgumentException("Arguments must be a JSON object.");
        }
        catch (JsonException ex)
        {
            throw new ToolArgumentException($"Invalid arguments: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Checks a schema supplied by a client. It must be an object schema within the size and
    /// depth caps; anything else is rejected before it reaches a model provider.
    /// </summary>
    public static JsonObject ValidateClientSchema(JsonElement schema, ToolOptions options)
    {
        if (schema.ValueKind != JsonValueKind.Object)
        {
            throw new ToolArgumentException("parametersSchema must be a JSON object.");
        }

        var raw = schema.GetRawText();
        if (raw.Length > options.MaxClientSchemaBytes)
        {
            throw new ToolArgumentException($"parametersSchema exceeds {options.MaxClientSchemaBytes} bytes.");
        }

        if (!schema.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String || type.GetString() != "object")
        {
            throw new ToolArgumentException("parametersSchema must declare \"type\": \"object\".");
        }

        if (Depth(schema) > options.MaxClientSchemaDepth)
        {
            throw new ToolArgumentException($"parametersSchema nests deeper than {options.MaxClientSchemaDepth} levels.");
        }

        return JsonNode.Parse(raw) as JsonObject
            ?? throw new ToolArgumentException("parametersSchema must be a JSON object.");
    }

    private static int Depth(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => 1 + element.EnumerateObject().Select(p => Depth(p.Value)).DefaultIfEmpty(0).Max(),
        JsonValueKind.Array => 1 + element.EnumerateArray().Select(Depth).DefaultIfEmpty(0).Max(),
        _ => 0
    };

    private static JsonNode Transform(JsonSchemaExporterContext context, JsonNode node)
    {
        if (node is not JsonObject schema)
        {
            return node;
        }

        // Providers want a single type, and optionality is expressed through "required".
        if (schema["type"] is JsonArray types)
        {
            var remaining = types.Where(t => t?.GetValue<string>() != "null").Select(t => t!.GetValue<string>()).ToList();
            schema["type"] = remaining.Count == 1 ? JsonValue.Create(remaining[0]) : new JsonArray(remaining.Select(t => JsonValue.Create(t)).ToArray<JsonNode?>());
        }

        // A nullable enum lists null as a member; optionality is expressed through "required" instead.
        if (schema["enum"] is JsonArray members)
        {
            if (members.Any(m => m == null))
            {
                var kept = members.Where(m => m != null).Select(m => m!.DeepClone()).ToArray();
                schema["enum"] = new JsonArray(kept);
            }

            // Enums are serialised as strings; the exporter omits the type for non-nullable ones.
            schema["type"] ??= "string";
        }

        var description = DescriptionOf(context);
        if (description != null && schema["description"] == null)
        {
            schema["description"] = description;
        }

        if (context.PropertyInfo == null && context.TypeInfo.Kind == JsonTypeInfoKind.Object)
        {
            var required = context.TypeInfo.Properties
                .Where(p => !p.IsSetNullable)
                .Select(p => (JsonNode?)JsonValue.Create(p.Name))
                .ToArray();

            if (required.Length > 0)
            {
                schema["required"] = new JsonArray(required);
            }
            else
            {
                schema.Remove("required");
            }

            schema["additionalProperties"] = false;
        }

        return schema;
    }

    private static string? DescriptionOf(JsonSchemaExporterContext context)
    {
        var provider = context.PropertyInfo?.AttributeProvider
            ?? (ICustomAttributeProvider?)context.TypeInfo.Type;

        return provider?.GetCustomAttributes(typeof(DescriptionAttribute), inherit: true)
            .OfType<DescriptionAttribute>()
            .FirstOrDefault()?.Description;
    }
}

/// <summary>The model sent arguments the tool cannot use. The message is written for the model.</summary>
public class ToolArgumentException : Exception
{
    public ToolArgumentException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}
