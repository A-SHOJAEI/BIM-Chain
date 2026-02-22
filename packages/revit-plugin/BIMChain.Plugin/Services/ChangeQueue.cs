using System.Collections.Concurrent;
using System.Collections.Generic;
using BIMChain.Plugin.Models;

namespace BIMChain.Plugin.Services;

public class ChangeQueue
{
    private readonly ConcurrentQueue<ChangeRecord> _queue = new();

    public void Enqueue(ChangeRecord record)
    {
        _queue.Enqueue(record);
    }

    public List<ChangeRecord> DequeueAll()
    {
        var results = new List<ChangeRecord>();
        while (_queue.TryDequeue(out var record))
        {
            results.Add(record);
        }
        return results;
    }

    public int Count => _queue.Count;
}
