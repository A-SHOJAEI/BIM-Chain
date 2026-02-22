using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BIMChain.Plugin.Models;

public record ChangeRecord
{
    [JsonPropertyName("modelId")]
    public string ModelId { get; init; } = string.Empty;

    [JsonPropertyName("elementUniqueId")]
    public string ElementUniqueId { get; init; } = string.Empty;

    [JsonPropertyName("changeType")]
    public string ChangeType { get; init; } = string.Empty;

    [JsonPropertyName("elementHash")]
    public string ElementHash { get; init; } = string.Empty;

    [JsonPropertyName("previousHash")]
    public string? PreviousHash { get; init; }

    [JsonPropertyName("userId")]
    public string UserId { get; init; } = string.Empty;

    /// <summary>
    /// Organization identifier sent by the plugin. The middleware maps this to
    /// "orgMspId" (the Fabric MSP ID) before submitting to the chaincode.
    /// Either "orgId" or "orgMspId" is accepted by the middleware validation.
    /// </summary>
    [JsonPropertyName("orgId")]
    public string OrgId { get; init; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; init; } = DateTimeOffset.UtcNow.ToString("o");

    [JsonPropertyName("parameterChanges")]
    public List<ParameterChange> ParameterChanges { get; init; } = new();
}

public record ParameterChange
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("oldValue")]
    public string OldValue { get; init; } = string.Empty;

    [JsonPropertyName("newValue")]
    public string NewValue { get; init; } = string.Empty;
}
