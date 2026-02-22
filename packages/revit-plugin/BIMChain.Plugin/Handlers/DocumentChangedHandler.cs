using BIMChain.Plugin.Models;
using BIMChain.Plugin.Services;
#if REVIT_SDK
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Events;
#endif

namespace BIMChain.Plugin.Handlers;

/// <summary>
/// Handles Revit DocumentChanged events.
/// For each element in Added/Modified/Deleted:
/// 1. Get UniqueId
/// 2. Get element data (Category, Type, Parameters)
/// 3. Compute hash via ElementHasher
/// 4. Build ChangeRecord via ChangeRecordBuilder
/// 5. Enqueue via ChangeQueue
/// </summary>
public class DocumentChangedHandler
{
    private readonly ElementHasher _hasher;
    private readonly ChangeRecordBuilder _builder;
    private readonly ChangeQueue _queue;
    private readonly string _userId;
    private readonly string _orgId;

    public DocumentChangedHandler(
        ElementHasher hasher,
        ChangeRecordBuilder builder,
        ChangeQueue queue,
        string userId,
        string orgId)
    {
        _hasher = hasher;
        _builder = builder;
        _queue = queue;
        _userId = userId;
        _orgId = orgId;
    }

#if REVIT_SDK
    /// <summary>
    /// Processes a document change event from Revit.
    /// </summary>
    public void OnDocumentChanged(object sender, DocumentChangedEventArgs e)
    {
        try
        {
            var doc = e.GetDocument();
            var pathName = doc.PathName;
            var title = doc.Title;
            string modelId = !string.IsNullOrEmpty(pathName) ? pathName
                           : !string.IsNullOrEmpty(title) ? title
                           : "unsaved-model";

            foreach (var elementId in e.GetAddedElementIds())
            {
                var element = doc.GetElement(elementId);
                if (element == null) continue;

                var data = ExtractElementData(element);
                var hash = _hasher.ComputeHash(data);
                var paramChanges = ExtractParameterChanges(element);
                var record = _builder.BuildAddRecord(
                    modelId, element.UniqueId, hash, _userId, _orgId, paramChanges);
                _queue.Enqueue(record);
            }

            foreach (var elementId in e.GetModifiedElementIds())
            {
                var element = doc.GetElement(elementId);
                if (element == null) continue;

                var data = ExtractElementData(element);
                var hash = _hasher.ComputeHash(data);
                var paramChanges = ExtractParameterChanges(element);
                var record = _builder.BuildModifyRecord(
                    modelId, element.UniqueId, hash, "", _userId, _orgId, paramChanges);
                _queue.Enqueue(record);
            }

            foreach (var elementId in e.GetDeletedElementIds())
            {
                var record = _builder.BuildDeleteRecord(
                    modelId, elementId.ToString()!, _userId, _orgId);
                _queue.Enqueue(record);
            }
        }
        catch (Exception)
        {
            // Log error but don't crash Revit
        }
    }

    private static SortedDictionary<string, string> ExtractElementData(Element element)
    {
        var data = new SortedDictionary<string, string>
        {
            ["uniqueId"] = element.UniqueId,
            ["category"] = element.Category?.Name ?? "",
            ["typeName"] = element.GetType().Name,
        };

        try
        {
            foreach (Parameter param in element.Parameters)
            {
                if (param.HasValue)
                {
                    data[$"param:{param.Definition.Name}"] = param.AsValueString() ?? param.AsString() ?? "";
                }
            }
        }
        catch (Exception)
        {
            // Some parameters may not be accessible; continue
        }

        return data;
    }

    private static List<ParameterChange> ExtractParameterChanges(Element element)
    {
        var changes = new List<ParameterChange>();
        try
        {
            foreach (Parameter param in element.Parameters)
            {
                if (param.HasValue)
                {
                    changes.Add(new ParameterChange
                    {
                        Name = param.Definition.Name,
                        OldValue = "",
                        NewValue = param.AsValueString() ?? param.AsString() ?? ""
                    });
                }
            }
        }
        catch (Exception)
        {
            // Some parameters may not be accessible
        }
        return changes;
    }
#else
    /// <summary>
    /// Stub for non-Revit builds. See REVIT_SDK build for real implementation.
    /// </summary>
    public void OnDocumentChanged(object sender, object eventArgs)
    {
        // Requires Revit SDK. Build with REVIT_SDK defined for full implementation.
    }

    private static SortedDictionary<string, string> ExtractElementData(object element)
    {
        return new SortedDictionary<string, string>();
    }
#endif
}
