using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BIMChain.Plugin.Models;
using BIMChain.Plugin.Services;
using Xunit;

namespace BIMChain.Tests;

public class BlockchainApiClientTests
{
    private static BlockchainApiClient CreateClient(MockHttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler);
        return new BlockchainApiClient(httpClient, "http://localhost:3001");
    }

    [Fact]
    public async Task SubmitChanges_Success_Returns201()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.Created, "{}");
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1" } };

        var result = await client.SubmitChangesAsync(changes, "test-token");
        Assert.True(result);
    }

    [Fact]
    public async Task SubmitChanges_SendsCorrectJSON()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.Created, "{}");
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1", ChangeType = "ADD" } };

        await client.SubmitChangesAsync(changes, "test-token");

        var body = handler.LastRequestBody;
        Assert.Contains("\"modelId\"", body);
        Assert.Contains("\"changeType\"", body);
    }

    [Fact]
    public async Task SubmitChanges_IncludesAuthHeader()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.Created, "{}");
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1" } };

        await client.SubmitChangesAsync(changes, "my-secret-token");

        Assert.Equal("Bearer my-secret-token", handler.LastAuthHeader);
    }

    [Fact]
    public async Task SubmitChanges_Retry_On503()
    {
        var handler = new MockHttpMessageHandler(new Queue<HttpStatusCode>(new[]
        {
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.Created
        }));
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1" } };

        var result = await client.SubmitChangesAsync(changes, "token");
        Assert.True(result);
        Assert.Equal(3, handler.RequestCount);
    }

    [Fact]
    public async Task SubmitChanges_Timeout_ThrowsException()
    {
        var handler = new MockHttpMessageHandler(TimeSpan.FromSeconds(30));
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1" } };

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => client.SubmitChangesAsync(changes, "token", cts.Token));
    }

    [Fact]
    public async Task SubmitChanges_ServerError_ThrowsImmediately()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.InternalServerError, "error");
        var client = CreateClient(handler);
        var changes = new List<ChangeRecord> { new() { ModelId = "m1" } };

        await Assert.ThrowsAsync<HttpRequestException>(
            () => client.SubmitChangesAsync(changes, "token"));
        // Non-503 errors fail immediately (no retry)
        Assert.Equal(1, handler.RequestCount);
    }
}

/// <summary>
/// Mock HTTP handler for testing BlockchainApiClient.
/// </summary>
public class MockHttpMessageHandler : HttpMessageHandler
{
    private readonly Queue<HttpStatusCode>? _statusCodes;
    private readonly HttpStatusCode _fixedStatusCode;
    private readonly string _responseBody;
    private readonly TimeSpan? _delay;

    public string? LastRequestBody { get; private set; }
    public string? LastAuthHeader { get; private set; }
    public int RequestCount { get; private set; }

    public MockHttpMessageHandler(HttpStatusCode statusCode, string responseBody = "{}")
    {
        _fixedStatusCode = statusCode;
        _responseBody = responseBody;
    }

    public MockHttpMessageHandler(Queue<HttpStatusCode> statusCodes)
    {
        _statusCodes = statusCodes;
        _responseBody = "{}";
    }

    public MockHttpMessageHandler(TimeSpan delay)
    {
        _delay = delay;
        _fixedStatusCode = HttpStatusCode.OK;
        _responseBody = "{}";
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        RequestCount++;

        if (request.Content != null)
            LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);

        if (request.Headers.Authorization != null)
            LastAuthHeader = $"{request.Headers.Authorization.Scheme} {request.Headers.Authorization.Parameter}";

        if (_delay.HasValue)
        {
            await Task.Delay(_delay.Value, cancellationToken);
        }

        var status = _statusCodes != null && _statusCodes.Count > 0
            ? _statusCodes.Dequeue()
            : _fixedStatusCode;

        return new HttpResponseMessage(status)
        {
            Content = new StringContent(_responseBody)
        };
    }
}
