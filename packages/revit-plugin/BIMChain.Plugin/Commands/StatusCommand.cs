#if REVIT_SDK
using Autodesk.Revit.UI;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;

namespace BIMChain.Plugin.Commands;

/// <summary>
/// External command that shows the current BIM-Chain plugin status.
/// </summary>
[Transaction(TransactionMode.Manual)]
public class StatusCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            var instance = BIMChainApplication.Instance;
            var queueCount = instance?.QueueCount ?? 0;
            var apiUrl = instance?.Settings.ApiBaseUrl ?? "not configured";

            var status = $"BIM-Chain Plugin Status\n" +
                         $"=======================\n" +
                         $"API Endpoint: {apiUrl}\n" +
                         $"Queued Changes: {queueCount}\n" +
                         $"Sync Interval: {instance?.Settings.SyncIntervalSeconds ?? 30}s\n" +
                         $"User: {System.Environment.UserName}\n" +
                         $"Organization: {instance?.Settings.OrgId ?? "not set"}";

            TaskDialog.Show("BIM Chain - Status", status);
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
