using System.Collections.Generic;
using System.Threading.Tasks;
using BIMChain.Plugin.Models;
using BIMChain.Plugin.Services;
using Xunit;

namespace BIMChain.Tests;

public class ChangeQueueTests
{
    private readonly ChangeQueue _queue = new();

    [Fact]
    public void Enqueue_SingleItem_CanDequeue()
    {
        var record = new ChangeRecord { ModelId = "m1", ElementUniqueId = "e1" };
        _queue.Enqueue(record);
        var results = _queue.DequeueAll();
        Assert.Single(results);
        Assert.Equal("m1", results[0].ModelId);
    }

    [Fact]
    public void Enqueue_MultipleItems_FIFOOrder()
    {
        _queue.Enqueue(new ChangeRecord { ModelId = "first" });
        _queue.Enqueue(new ChangeRecord { ModelId = "second" });
        _queue.Enqueue(new ChangeRecord { ModelId = "third" });
        var results = _queue.DequeueAll();
        Assert.Equal(3, results.Count);
        Assert.Equal("first", results[0].ModelId);
        Assert.Equal("second", results[1].ModelId);
        Assert.Equal("third", results[2].ModelId);
    }

    [Fact]
    public void Enqueue_ConcurrentAccess_ThreadSafe()
    {
        Parallel.For(0, 100, i =>
        {
            _queue.Enqueue(new ChangeRecord { ModelId = $"model-{i}" });
        });
        var results = _queue.DequeueAll();
        Assert.Equal(100, results.Count);
    }

    [Fact]
    public void DequeueAll_EmptyQueue_ReturnsEmpty()
    {
        var results = _queue.DequeueAll();
        Assert.Empty(results);
    }

    [Fact]
    public void DequeueAll_ClearsQueue()
    {
        _queue.Enqueue(new ChangeRecord { ModelId = "m1" });
        _queue.Enqueue(new ChangeRecord { ModelId = "m2" });
        _queue.DequeueAll();
        Assert.Equal(0, _queue.Count);
    }

    [Fact]
    public void Count_ReflectsQueueSize()
    {
        Assert.Equal(0, _queue.Count);
        _queue.Enqueue(new ChangeRecord { ModelId = "m1" });
        Assert.Equal(1, _queue.Count);
        _queue.Enqueue(new ChangeRecord { ModelId = "m2" });
        Assert.Equal(2, _queue.Count);
    }
}
