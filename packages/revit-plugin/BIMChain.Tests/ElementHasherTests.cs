using System.Collections.Generic;
using BIMChain.Plugin.Services;
using Xunit;

namespace BIMChain.Tests;

public class ElementHasherTests
{
    private readonly ElementHasher _hasher = new();

    [Fact]
    public void ComputeHash_SameInput_ProducesSameOutput()
    {
        var data = new SortedDictionary<string, string>
        {
            ["category"] = "Walls",
            ["uniqueId"] = "abc-123",
            ["typeName"] = "Basic Wall"
        };

        var hash1 = _hasher.ComputeHash(data);
        var hash2 = _hasher.ComputeHash(data);

        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void ComputeHash_DifferentInput_ProducesDifferentOutput()
    {
        var data1 = new SortedDictionary<string, string> { ["id"] = "a" };
        var data2 = new SortedDictionary<string, string> { ["id"] = "b" };

        Assert.NotEqual(_hasher.ComputeHash(data1), _hasher.ComputeHash(data2));
    }

    [Fact]
    public void ComputeHash_ReturnsSHA256HexString()
    {
        var data = new SortedDictionary<string, string> { ["key"] = "value" };
        var hash = _hasher.ComputeHash(data);

        Assert.Equal(64, hash.Length); // SHA-256 = 64 hex chars
        Assert.Matches("^[a-f0-9]{64}$", hash);
    }
}
