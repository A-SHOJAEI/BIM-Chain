#if REVIT_SDK
using Autodesk.Revit.UI;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;

namespace BIMChain.Plugin.Commands;

/// <summary>
/// External command that opens the BIM-Chain web dashboard in the default browser.
/// </summary>
[Transaction(TransactionMode.Manual)]
public class OpenDashboardCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            var url = BIMChainApplication.Instance?.Settings.ApiBaseUrl?.Replace("/api", "") ?? "http://localhost:3200";
            // Dashboard runs on a different port than the API
            var dashboardUrl = url.Contains("3100") ? url.Replace("3100", "3200") : "http://localhost:3200";
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = dashboardUrl,
                UseShellExecute = true
            });
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
