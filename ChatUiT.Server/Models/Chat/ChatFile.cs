using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace ChatUiT.Server.Models;

/// <summary>
/// A file on a message or an assistant, stored as it is in the message's or assistant's
/// <c>files</c> list. The file lies in Blob Storage under <see cref="SourceFilename"/>.
/// </summary>
public class ChatFile
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>The name in Blob Storage.</summary>
    [JsonProperty("sourceFilename")]
    public string SourceFilename { get; set; } = string.Empty;

    /// <summary>The size of the original in bytes.</summary>
    [JsonProperty("size")]
    public long Size { get; set; }

    /// <summary>The MIME type of the original.</summary>
    [JsonProperty("contentType")]
    public string ContentType { get; set; } = string.Empty;

    /// <summary>The file is encrypted with the owner's key.</summary>
    [JsonProperty("isEncrypted")]
    public bool IsEncrypted { get; set; }

    [JsonProperty("tokenCounts")]
    public Dictionary<string, int> TokenCounts { get; set; } = new();

    /// <summary>The parts in reading order.</summary>
    [JsonProperty("chunks")]
    public List<ChatFileChunk> Chunks { get; set; } = new();

    [JsonIgnore]
    public bool IsContentLoaded => Chunks.All(chunk => chunk.Text != null || chunk.Data != null);
}

public class ChatFileChunk
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>"text" or "image".</summary>
    [JsonProperty("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>Images only: "image/jpeg" for every file.</summary>
    [JsonProperty("mediaType")]
    public string? MediaType { get; set; }

    /// <summary>Images only, in pixels.</summary>
    [JsonProperty("width")]
    public int Width { get; set; }

    /// <summary>Images only, in pixels.</summary>
    [JsonProperty("height")]
    public int Height { get; set; }

    /// <summary>Content, loaded from Blob Storage, never stored in the database.</summary>
    [JsonIgnore]
    public string? Text { get; set; }

    /// <summary>Content, loaded from Blob Storage, never stored in the database.</summary>
    [JsonIgnore]
    public byte[]? Data { get; set; }

    [JsonIgnore]
    public bool IsText => Type == "text";

    [JsonIgnore]
    public bool IsImage => Type == "image";
}
