using BIMChain.Plugin.Models;
using BIMChain.Plugin.Services;
using BIMChain.Plugin.Handlers;
#if REVIT_SDK
using Autodesk.Revit.UI;
using Autodesk.Revit.DB.Events;
#endif

namespace BIMChain.Plugin;

/// <summary>
/// Entry point for the BIM Chain Revit plugin.
/// Implements IExternalApplication from the Revit API.
/// When built without the Revit SDK (CI/testing), compiles as a plain class with stub methods.
/// </summary>
#if REVIT_SDK
public class BIMChainApplication : IExternalApplication
#else
public class BIMChainApplication
#endif
{
    private ChangeQueue? _queue;
    private BlockchainApiClient? _client;
    private ElementHasher? _hasher;
    private ChangeRecordBuilder? _builder;
    private DocumentChangedHandler? _changeHandler;
    private System.Threading.Timer? _syncTimer;
    private PluginSettings _settings = new();

    /// <summary>Static instance for commands to access plugin state.</summary>
    public static BIMChainApplication? Instance { get; private set; }

    /// <summary>Current plugin settings.</summary>
    public PluginSettings Settings => _settings;

    /// <summary>Number of changes currently in the queue.</summary>
    public int QueueCount => _queue?.Count ?? 0;

    /// <summary>The last JSON payload attempted for sync (for debugging).</summary>
    public string? LastSyncPayload => _client?.LastPayload;

    /// <summary>
    /// Force an immediate sync of all queued changes.
    /// Returns (submittedCount, errorMessage). errorMessage is null on success.
    /// Uses Task.Run to avoid deadlocking the Revit UI thread.
    /// </summary>
    public (int submitted, string? error) ForceSyncNow()
    {
        if (_queue == null || _client == null)
            return (0, "Plugin not fully initialized");

        var changes = _queue.DequeueAll();
        if (changes.Count == 0)
            return (0, null);

        try
        {
            // Task.Run avoids SynchronizationContext deadlock on Revit's UI thread
            Task.Run(() => _client.SubmitChangesAsync(changes, string.Empty)).GetAwaiter().GetResult();
            return (_client.LastSubmittedCount, null);
        }
        catch (Exception ex)
        {
            // Re-enqueue the changes so they're not lost
            foreach (var c in changes) _queue.Enqueue(c);
            return (0, _client.LastError ?? ex.Message);
        }
    }

#if REVIT_SDK
    /// <summary>
    /// Called by Revit when the add-in is loaded.
    /// </summary>
    public Result OnStartup(UIControlledApplication application)
    {
        try
        {
            Instance = this;

            // 1. Initialize services
            _hasher = new ElementHasher();
            _queue = new ChangeQueue();
            _builder = new ChangeRecordBuilder();
            _client = new BlockchainApiClient(new HttpClient(), _settings.ApiBaseUrl);
            _changeHandler = new DocumentChangedHandler(
                _hasher, _builder, _queue,
                Environment.UserName, _settings.OrgId);

            // 2. Subscribe to Revit document events
            application.ControlledApplication.DocumentChanged += OnDocumentChanged;
            application.ControlledApplication.DocumentOpened += OnDocumentOpened;

            // 3. Create sync timer to periodically flush queue
            _syncTimer = new System.Threading.Timer(
                SyncCallback, null,
                TimeSpan.FromSeconds(_settings.SyncIntervalSeconds),
                TimeSpan.FromSeconds(_settings.SyncIntervalSeconds));

            // 4. Create Ribbon tab with buttons
            try
            {
                application.CreateRibbonTab("BIM Chain");
            }
            catch (Exception)
            {
                // Tab may already exist; safe to ignore
            }

            var panel = application.CreateRibbonPanel("BIM Chain", "Blockchain");
            var assemblyPath = System.Reflection.Assembly.GetExecutingAssembly().Location;

            // Sync Now button
            var syncButtonData = new PushButtonData(
                "SyncNow", "Sync\nNow",
                assemblyPath,
                "BIMChain.Plugin.Commands.SyncNowCommand")
            {
                ToolTip = "Submit all queued changes to the blockchain immediately"
            };
            panel.AddItem(syncButtonData);

            // Status button
            var statusButtonData = new PushButtonData(
                "Status", "Status",
                assemblyPath,
                "BIMChain.Plugin.Commands.StatusCommand")
            {
                ToolTip = "Show BIM-Chain plugin connection status and queue info"
            };
            panel.AddItem(statusButtonData);

            // Open Dashboard button
            var dashboardButtonData = new PushButtonData(
                "Dashboard", "Open\nDashboard",
                assemblyPath,
                "BIMChain.Plugin.Commands.OpenDashboardCommand")
            {
                ToolTip = "Open the BIM-Chain web dashboard in your browser"
            };
            panel.AddItem(dashboardButtonData);

            return Result.Succeeded;
        }
        catch (Exception)
        {
            return Result.Failed;
        }
    }

    /// <summary>
    /// Called by Revit when the add-in is unloaded.
    /// </summary>
    public Result OnShutdown(UIControlledApplication application)
    {
        // 1. Stop sync timer
        _syncTimer?.Dispose();

        // 2. Flush remaining queue items (best-effort, never crash Revit)
        try
        {
            if (_queue != null && _client != null)
            {
                var remaining = _queue.DequeueAll();
                if (remaining.Count > 0)
                {
                    Task.Run(() => _client.SubmitChangesAsync(remaining, string.Empty)).GetAwaiter().GetResult();
                }
            }
        }
        catch
        {
            // Swallow errors on shutdown — don't prevent Revit from closing
        }

        // 3. Unsubscribe from all Revit events
        application.ControlledApplication.DocumentChanged -= OnDocumentChanged;
        application.ControlledApplication.DocumentOpened -= OnDocumentOpened;

        // 4. Cleanup
        _client = null;
        Instance = null;

        return Result.Succeeded;
    }

    private void OnDocumentChanged(object sender, DocumentChangedEventArgs e)
    {
        _changeHandler?.OnDocumentChanged(sender, e);
    }

    private void OnDocumentOpened(object sender, DocumentOpenedEventArgs e)
    {
        // Initial model scan could be implemented here
    }
#else
    /// <summary>
    /// Stub for non-Revit builds. See REVIT_SDK build for real implementation.
    /// </summary>
    public int OnStartup(object application)
    {
        Instance = this;
        _hasher = new ElementHasher();
        _queue = new ChangeQueue();
        _builder = new ChangeRecordBuilder();
        _client = new BlockchainApiClient(new HttpClient(), _settings.ApiBaseUrl);

        _syncTimer = new System.Threading.Timer(
            SyncCallback, null,
            TimeSpan.FromSeconds(30),
            TimeSpan.FromSeconds(30));

        return 0; // Result.Succeeded
    }

    /// <summary>
    /// Stub for non-Revit builds. See REVIT_SDK build for real implementation.
    /// </summary>
    public int OnShutdown(object application)
    {
        _syncTimer?.Dispose();

        if (_queue != null && _client != null)
        {
            var remaining = _queue.DequeueAll();
            if (remaining.Count > 0)
            {
                Task.Run(() => _client.SubmitChangesAsync(remaining, string.Empty)).GetAwaiter().GetResult();
            }
        }

        _client = null;
        Instance = null;
        return 0; // Result.Succeeded
    }
#endif

    private void SyncCallback(object? state)
    {
        if (_queue == null || _client == null) return;

        var changes = _queue.DequeueAll();
        if (changes.Count > 0)
        {
            try
            {
                Task.Run(() => _client.SubmitChangesAsync(changes, string.Empty)).GetAwaiter().GetResult();
            }
            catch
            {
                // Re-enqueue on failure so changes aren't lost
                foreach (var c in changes) _queue.Enqueue(c);
            }
        }
    }
}
