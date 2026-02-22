using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BIMChain.Plugin.Services;

public class ElementHasher
{
    /// <summary>
    /// Computes a deterministic SHA-256 hash of element data.
    /// Input dictionary keys are sorted to ensure determinism.
    /// </summary>
    public string ComputeHash(SortedDictionary<string, string> elementData)
    {
        ArgumentNullException.ThrowIfNull(elementData);

        var json = JsonSerializer.Serialize(elementData, new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
