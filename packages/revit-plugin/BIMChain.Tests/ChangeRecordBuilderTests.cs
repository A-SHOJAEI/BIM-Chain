using System.Collections.Generic;
using System.Text.Json;
using BIMChain.Plugin.Models;
using BIMChain.Plugin.Services;
using Xunit;

namespace BIMChain.Tests;

public class ChangeRecordBuilderTests
{
    private readonly ChangeRecordBuilder _builder = new();

    [Fact]
    public void BuildAddRecord_SetsChangeTypeAdd()
    {
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1");
        Assert.Equal("ADD", record.ChangeType);
    }

    [Fact]
    public void BuildModifyRecord_SetsChangeTypeModify()
    {
        var record = _builder.BuildModifyRecord("model-1", "elem-1", "hash2", "hash1", "user1", "org1");
        Assert.Equal("MODIFY", record.ChangeType);
    }

    [Fact]
    public void BuildDeleteRecord_SetsChangeTypeDelete()
    {
        var record = _builder.BuildDeleteRecord("model-1", "elem-1", "user1", "org1");
        Assert.Equal("DELETE", record.ChangeType);
    }

    [Fact]
    public void BuildRecord_IncludesTimestamp()
    {
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1");
        Assert.False(string.IsNullOrEmpty(record.Timestamp));
    }

    [Fact]
    public void BuildRecord_IncludesModelId()
    {
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1");
        Assert.Equal("model-1", record.ModelId);
    }

    [Fact]
    public void BuildRecord_SerializesToValidJSON()
    {
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1");
        var json = JsonSerializer.Serialize(record);
        Assert.Contains("\"modelId\"", json);
        Assert.Contains("\"changeType\"", json);
        var deserialized = JsonSerializer.Deserialize<ChangeRecord>(json);
        Assert.NotNull(deserialized);
        Assert.Equal(record.ModelId, deserialized!.ModelId);
    }

    [Fact]
    public void BuildBatch_SerializesArray()
    {
        var records = new List<ChangeRecord>
        {
            _builder.BuildAddRecord("m1", "e1", "h1", "u1", "o1"),
            _builder.BuildModifyRecord("m1", "e2", "h2", "h1", "u1", "o1"),
        };
        var json = JsonSerializer.Serialize(records);
        Assert.StartsWith("[", json);
        var deserialized = JsonSerializer.Deserialize<List<ChangeRecord>>(json);
        Assert.Equal(2, deserialized!.Count);
    }

    [Fact]
    public void BuildRecord_HandlesNullParameters()
    {
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1", null);
        Assert.NotNull(record.ParameterChanges);
        Assert.Empty(record.ParameterChanges);
    }

    [Fact]
    public void BuildRecord_IncludesParameterChanges()
    {
        var changes = new List<ParameterChange>
        {
            new() { Name = "Height", OldValue = "3000", NewValue = "3500" }
        };
        var record = _builder.BuildAddRecord("model-1", "elem-1", "hash1", "user1", "org1", changes);
        Assert.Single(record.ParameterChanges);
        Assert.Equal("Height", record.ParameterChanges[0].Name);
    }
}
