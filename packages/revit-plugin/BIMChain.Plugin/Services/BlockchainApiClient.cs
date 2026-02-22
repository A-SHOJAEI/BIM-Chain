using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BIMChain.Plugin.Models;

namespace BIMChain.Plugin.Services;

public class BlockchainApiClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly int _maxRetries = 3;
    private string? _cachedToken;

    /// <summary>Stores the last error message for diagnostics.</summary>
    public string? LastError { get; private set; }

    /// <summary>Number of records successfully submitted in last call.</summary>
    public int LastSubmittedCount { get; private set; }

    /// <summary>The last JSON payload sent (for debugging).</summary>
    public string? LastPayload { get; private set; }

    public BlockchainApiClient(HttpClient httpClient, string baseUrl)
    {
        _httpClient = httpClient;
        _baseUrl = baseUrl.TrimEnd('/');
    }

    /// <summary>
    /// Authenticates with the middleware and caches the JWT token.
    /// </summary>
    public async Task<string> GetAuthTokenAsync(CancellationToken ct = default)
    {
        if (_cachedToken != null) return _cachedToken;

        var loginUrl = $"{_baseUrl}/api/v1/auth/login";
        var loginBody = JsonSerializer.Serialize(new { username = "admin", password = "adminpw" });

        using var request = new HttpRequestMessage(HttpMethod.Post, loginUrl);
        request.Content = new StringContent(loginBody, Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var responseBody = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(responseBody);
        _cachedToken = doc.RootElement.GetProperty("token").GetString();
        return _cachedToken!;
    }

    public async Task<bool> SubmitChangesAsync(List<ChangeRecord> changes,
        string authToken, CancellationToken ct = default)
    {
        LastError = null;
        LastSubmittedCount = 0;

        try
        {
            // Auto-login if no token provided
            if (string.IsNullOrEmpty(authToken))
            {
                authToken = await GetAuthTokenAsync(ct);
            }

            var json = JsonSerializer.Serialize(changes);
            LastPayload = json;
            var url = $"{_baseUrl}/api/v1/changes";

            for (int attempt = 1; attempt <= _maxRetries; attempt++)
            {
                ct.ThrowIfCancellationRequested();

                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authToken);

                var response = await _httpClient.SendAsync(request, ct);

                if (response.IsSuccessStatusCode)
                {
                    LastSubmittedCount = changes.Count;
                    return true;
                }

                var body = await response.Content.ReadAsStringAsync(ct);

                // If 401, token may have expired — clear cache and retry once
                if ((int)response.StatusCode == 401 && attempt == 1)
                {
                    _cachedToken = null;
                    authToken = await GetAuthTokenAsync(ct);
                    continue;
                }

                // 503 = temporary, retry with backoff
                if ((int)response.StatusCode == 503 && attempt < _maxRetries)
                {
                    await Task.Delay(100 * attempt, ct);
                    continue;
                }

                // Any other error (400, 500, etc.) — fail immediately with details
                LastError = $"HTTP {(int)response.StatusCode}: {body}";
                throw new HttpRequestException(LastError);
            }
        }
        catch (HttpRequestException)
        {
            throw; // Already set LastError
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            throw;
        }

        return false;
    }
}
