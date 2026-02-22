#if REVIT_SDK
using Autodesk.Revit.UI;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;

namespace BIMChain.Plugin.Commands;

/// <summary>
/// External command that forces an immediate sync of queued changes.
/// </summary>
[Transaction(TransactionMode.Manual)]
public class SyncNowCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            var instance = BIMChainApplication.Instance;
            if (instance == null)
            {
                TaskDialog.Show("BIM Chain", "Plugin not initialized.");
                return Result.Failed;
            }

            var queueCount = instance.QueueCount;
            var (submitted, error) = instance.ForceSyncNow();

            if (error != null)
            {
                // Truncate payload for display (first 500 chars)
                var payload = instance.LastSyncPayload ?? "n/a";
                if (payload.Length > 500) payload = payload[..500] + "...";

                TaskDialog.Show("BIM Chain - Sync Error",
                    $"Queued: {queueCount} change(s)\n\n" +
                    $"Error: {error}\n\n" +
                    $"Payload sent:\n{payload}");
                return Result.Failed;
            }

            if (submitted == 0 && queueCount == 0)
            {
                TaskDialog.Show("BIM Chain", "No changes in queue. Nothing to sync.");
            }
            else
            {
                TaskDialog.Show("BIM Chain",
                    $"Sync completed!\n{submitted} change(s) submitted to blockchain.");
            }

            return Result.Succeeded;
        }
        catch (System.Exception ex)
        {
            message = ex.Message;
            return Result.Failed;
        }
    }
}
#endif
