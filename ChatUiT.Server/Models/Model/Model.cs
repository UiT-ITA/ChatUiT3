using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

/// <summary>What a model produces. Each type has its own subclass of <see cref="Model"/>.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ModelType
{
    Language,
    Image,
    Voice
}

/// <summary>
/// A deployed model on an endpoint. Holds what every model type shares; the subclass for
/// its <see cref="Type"/> holds the API it is called with and what it supports.
/// </summary>
public abstract class Model
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public abstract ModelType Type { get; }

    /// <summary>The model id or deployment name sent on the wire.</summary>
    public string ModelId { get; set; } = string.Empty;

    public string ModelName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}
