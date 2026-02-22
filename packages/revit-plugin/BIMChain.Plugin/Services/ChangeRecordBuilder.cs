using System;
using System.Collections.Generic;
using BIMChain.Plugin.Models;

namespace BIMChain.Plugin.Services;

public class ChangeRecordBuilder
{
    public ChangeRecord BuildAddRecord(string modelId, string elementUniqueId,
        string elementHash, string userId, string orgId,
        List<ParameterChange>? paramChanges = null)
    {
        return new ChangeRecord
        {
            ModelId = modelId,
            ElementUniqueId = elementUniqueId,
            ChangeType = "ADD",
            ElementHash = elementHash,
            UserId = userId,
            OrgId = orgId,
            Timestamp = DateTimeOffset.UtcNow.ToString("o"),
            ParameterChanges = paramChanges ?? new List<ParameterChange>()
        };
    }

    public ChangeRecord BuildModifyRecord(string modelId, string elementUniqueId,
        string elementHash, string previousHash, string userId, string orgId,
        List<ParameterChange>? paramChanges = null)
    {
        return new ChangeRecord
        {
            ModelId = modelId,
            ElementUniqueId = elementUniqueId,
            ChangeType = "MODIFY",
            ElementHash = elementHash,
            PreviousHash = previousHash,
            UserId = userId,
            OrgId = orgId,
            Timestamp = DateTimeOffset.UtcNow.ToString("o"),
            ParameterChanges = paramChanges ?? new List<ParameterChange>()
        };
    }

    public ChangeRecord BuildDeleteRecord(string modelId, string elementUniqueId,
        string userId, string orgId)
    {
        return new ChangeRecord
        {
            ModelId = modelId,
            ElementUniqueId = elementUniqueId,
            ChangeType = "DELETE",
            ElementHash = "deleted",
            UserId = userId,
            OrgId = orgId,
            Timestamp = DateTimeOffset.UtcNow.ToString("o"),
            ParameterChanges = new List<ParameterChange>()
        };
    }
}
