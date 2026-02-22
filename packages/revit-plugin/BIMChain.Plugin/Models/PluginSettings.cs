using System.Text.Json.Serialization;

namespace BIMChain.Plugin.Models;

public record PluginSettings
{
    [JsonPropertyName("apiBaseUrl")]
    public string ApiBaseUrl { get; init; } = "http://localhost:3100";

    [JsonPropertyName("syncIntervalSeconds")]
    public int SyncIntervalSeconds { get; init; } = 30;

    [JsonPropertyName("orgId")]
    public string OrgId { get; init; } = "ArchitectOrgMSP";

    [JsonPropertyName("authToken")]
    public string AuthToken { get; init; } = string.Empty;
}
