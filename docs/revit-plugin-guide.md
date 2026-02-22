# BIM-Chain Revit Plugin -- End User Guide

The BIM-Chain Revit Plugin is a .NET 8 add-in for Autodesk Revit that automatically captures BIM element changes and submits them to the BIM-Chain blockchain network via the middleware REST API. Every element addition, modification, or deletion is hashed, queued, and recorded as an immutable audit trail on Hyperledger Fabric.

---

## System Requirements

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| **Autodesk Revit** | 2025 | 2025 or later |
| **.NET Runtime** | .NET 8.0 | .NET 8.0 (ships with Revit 2025+) |
| **Operating System** | Windows 10 (64-bit), version 21H2 | Windows 11 (64-bit), version 22H2+ |
| **RAM** | 8 GB | 16 GB or more |
| **Network** | HTTPS connectivity to middleware API | Low-latency connection to middleware |
| **BIM-Chain Middleware** | Running and reachable | v0.1.0 or later |
| **Organization Credentials** | Valid username/password for JWT auth | -- |

**Important**: Revit 2025 introduced native .NET 8 support, replacing the older .NET Framework 4.8 requirement. The BIM-Chain plugin targets `net8.0` and is not compatible with Revit 2024 or earlier versions that use .NET Framework.

---

## Installation

### Step 1: Build from Source

Open a terminal (PowerShell, Command Prompt, or Developer Command Prompt for Visual Studio) and navigate to the plugin directory:

```powershell
cd H:\BIM - Blockchain\packages\revit-plugin
```

Restore NuGet packages and build the Release configuration:

```powershell
dotnet restore
dotnet build --configuration Release
```

The compiled output will be located at:

```
BIMChain.Plugin\bin\Release\net8.0\BIMChain.Plugin.dll
```

### Step 2: Copy Files to the Revit Add-ins Folder

Copy the DLL and the `.addin` manifest file to Revit's add-in loading directory. For Revit 2025 on a per-user basis:

```powershell
# Define the target directory
$revitAddins = "$env:APPDATA\Autodesk\Revit\Addins\2025"

# Create the directory if it does not exist
New-Item -ItemType Directory -Force -Path $revitAddins

# Copy the plugin DLL and dependencies
Copy-Item "BIMChain.Plugin\bin\Release\net8.0\BIMChain.Plugin.dll" -Destination $revitAddins
Copy-Item "BIMChain.Plugin\bin\Release\net8.0\*.dll" -Destination $revitAddins -Exclude "Revit*.dll"

# Copy the .addin manifest
Copy-Item "BIMChain.Plugin\BIMChain.addin" -Destination $revitAddins
```

Alternatively, for a machine-wide installation (requires Administrator privileges), copy to:

```
C:\ProgramData\Autodesk\Revit\Addins\2025\
```

### Step 3: Verify the .addin Manifest

The `BIMChain.addin` file should contain the following XML. A copy is included in the source at `packages/revit-plugin/BIMChain.Plugin/BIMChain.addin`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>BIM Chain</Name>
    <Assembly>BIMChain.Plugin.dll</Assembly>
    <FullClassName>BIMChain.Plugin.BIMChainApplication</FullClassName>
    <ClientId>a1b2c3d4-e5f6-7890-abcd-ef1234567890</ClientId>
    <VendorId>BIMChain</VendorId>
    <VendorDescription>BIM Chain - Blockchain BIM Governance</VendorDescription>
  </AddIn>
</RevitAddIns>
```

Verify that:
- The `<Assembly>` value matches the DLL filename (`BIMChain.Plugin.dll`)
- The `<FullClassName>` value is `BIMChain.Plugin.BIMChainApplication`
- The file is saved with UTF-8 encoding

### Step 4: Restart Revit

Close and reopen Autodesk Revit. When Revit starts, it scans the add-ins folder and loads all valid `.addin` files. You should see the **BIM Chain** tab appear in the Revit ribbon.

If Revit displays a security warning about loading a third-party add-in, click **Always Load** to trust the BIM-Chain plugin.

---

## Configuration

### Settings File

The plugin reads its configuration from a `PluginSettings` record. Create a JSON settings file named `bimchain-settings.json` in the same directory as the plugin DLL:

```json
{
  "apiBaseUrl": "http://localhost:3001",
  "syncIntervalSeconds": 30,
  "orgId": "ArchitectOrgMSP",
  "authToken": ""
}
```

### Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `apiBaseUrl` | `string` | `http://localhost:3001` | The full URL of the BIM-Chain middleware API. For production, use HTTPS (e.g., `https://bimchain.example.com:3001`). |
| `syncIntervalSeconds` | `int` | `30` | How often (in seconds) the plugin flushes the change queue and submits records to the middleware. Lower values mean faster blockchain recording but more network traffic. |
| `orgId` | `string` | `""` (empty) | Your organization's MSP identifier. Must match one of the organizations configured in the Fabric network (e.g., `ArchitectOrgMSP` or `EngineerOrgMSP`). |
| `authToken` | `string` | `""` (empty) | JWT access token for authenticating with the middleware API. Obtained by logging in via the plugin UI or the `/api/v1/auth/login` endpoint. The plugin will prompt for login if this is empty. |

### Authentication

The plugin authenticates with the middleware using JWT bearer tokens. The login flow is:

1. The plugin sends a `POST /api/v1/auth/login` request with `username` and `password` to the middleware.
2. The middleware validates credentials and returns a JWT token with a configurable expiry (default: 1 hour).
3. The plugin stores the token and includes it in the `Authorization: Bearer <token>` header for all subsequent API requests.
4. When the token nears expiry, the plugin can refresh it via `POST /api/v1/auth/refresh`.

**Default development credentials** (configured in the middleware):

| Username | Password | Organization |
|----------|----------|-------------|
| `admin` | `adminpw` | `Org1MSP` |
| `user1` | `user1pw` | `Org1MSP` |
| `user2` | `user2pw` | `Org2MSP` |

For production, configure real users through the `USERS_JSON` environment variable on the middleware or integrate with Fabric CA enrollment.

---

## Usage Walkthrough

### First-Time Setup

1. **Launch Revit** with the BIM-Chain plugin installed.
2. **Locate the BIM Chain tab** in the Revit ribbon bar (top of the window).
3. **Open Settings**: Click the **Settings** button in the BIM Chain ribbon panel.
4. **Configure the API URL**: Enter the middleware endpoint. For local development, leave the default `http://localhost:3001`. For production, enter the HTTPS URL of your middleware server.
5. **Set your Organization ID**: Enter your MSP identifier (e.g., `ArchitectOrgMSP`).
6. **Log In**: Click the **Login** button. Enter your username and password in the dialog. On success, the status indicator in the ribbon turns green.

### Normal Workflow

Once the plugin is connected and authenticated, it operates automatically in the background:

1. **Open or create a Revit model**. The plugin subscribes to the following Revit events:
   - `DocumentChanged` -- Fires when elements are added, modified, or deleted
   - `DocumentSynchronizingWithCentral` -- Pre-sync hook (for workshared models)
   - `DocumentSynchronizedWithCentral` -- Post-sync confirmation
   - `DocumentOpened` -- Initial model scan
   - `DocumentSaving` -- Local save hook

2. **Edit elements normally**. As you add walls, doors, windows, or any Revit element, the plugin captures each change:
   - Extracts the element's `UniqueId`, category, type, and parameter values
   - Computes a deterministic SHA-256 hash of the element data using `ElementHasher`
   - Builds a `ChangeRecord` with the model ID, element ID, change type (`ADD`, `MODIFY`, or `DELETE`), hash, user ID, org ID, timestamp, and parameter changes
   - Enqueues the record in the thread-safe `ChangeQueue`

3. **Automatic sync**. Every 30 seconds (configurable), the `SyncHandler` timer fires:
   - Dequeues all pending `ChangeRecord` objects from the queue
   - Submits them as a batch to `POST /api/v1/changes` via the `BlockchainApiClient`
   - The middleware validates and forwards each record to the Fabric blockchain
   - Transaction IDs are returned on success

4. **Manual sync**. Click the **Sync Now** button in the ribbon to immediately flush the queue without waiting for the timer.

5. **Monitor status**. The ribbon panel displays:
   - Connection status (green = connected, red = disconnected)
   - Queue depth (number of pending changes awaiting sync)

### Worksharing (Central Model) Support

When working with a Revit central model (worksharing enabled):

- **Local edits** are captured by the `DocumentChanged` event handler as usual.
- **Synchronize with Central** triggers a model version snapshot:
  1. The plugin computes a Merkle root hash from all tracked element hashes.
  2. A `ModelVersion` record is submitted via `AuditContract:RecordModelVersion`.
  3. The version number is incremented, and the `previousHash` links to the prior version.
  4. If IPFS is configured, the full model snapshot is stored off-chain with the CID recorded on-chain.
- **Element ownership** and workset borrowing are respected -- the plugin only captures changes to elements that the current user has permission to modify.

### Viewing the Audit Trail

Audit trail data is visible in two places:

1. **Frontend Dashboard** (http://localhost:3000): The Next.js web application provides a searchable audit trail viewer, IP attribution dashboard, and governance proposal workflow.
2. **Middleware API**: Query the audit trail directly via REST:
   ```bash
   curl http://localhost:3001/api/v1/audit-trail/<modelId> \
     -H "Authorization: Bearer <token>"
   ```

---

## Project Structure

```
packages/revit-plugin/
  BIMChain.Plugin/
    BIMChain.addin                   # Revit add-in manifest file
    BIMChain.Plugin.csproj           # .NET 8 project file
    BIMChainApplication.cs           # Plugin entry point (IExternalApplication)
    Handlers/
      DocumentChangedHandler.cs      # Revit DocumentChanged event handler
      SyncHandler.cs                 # Timer-based queue flush and sync
    Models/
      ChangeRecord.cs                # Change record data model (JSON-serializable)
      PluginSettings.cs              # Configuration model (JSON-serializable)
    Services/
      BlockchainApiClient.cs         # HTTP client for middleware API (retry logic)
      ChangeQueue.cs                 # Thread-safe ConcurrentQueue wrapper
      ChangeRecordBuilder.cs         # Builds ADD/MODIFY/DELETE records
      ElementHasher.cs               # Deterministic SHA-256 element hashing
  BIMChain.Tests/
    BlockchainApiClientTests.cs      # API client unit tests (mocked HttpClient)
    ChangeQueueTests.cs              # Queue thread-safety and batch tests
    ChangeRecordBuilderTests.cs      # Record builder correctness tests
    ElementHasherTests.cs            # Hash determinism and edge case tests
```

---

## Running Tests

The plugin includes a comprehensive unit test suite that runs without the Revit SDK:

```powershell
cd H:\BIM - Blockchain\packages\revit-plugin
dotnet test --configuration Release
```

The tests cover:

| Test Class | Coverage |
|-----------|----------|
| `ElementHasherTests` | SHA-256 hash computation, determinism, null input handling |
| `ChangeRecordBuilderTests` | ADD/MODIFY/DELETE record construction, timestamp format, parameter changes |
| `ChangeQueueTests` | Enqueue, DequeueAll, Count, thread-safety under concurrent access |
| `BlockchainApiClientTests` | Successful submission, retry on 503, authentication header inclusion, error propagation |

---

## Troubleshooting

### Plugin does not appear in Revit

| Possible cause | Solution |
|---------------|----------|
| `.addin` file is in the wrong directory | Verify the file is in `%APPDATA%\Autodesk\Revit\Addins\2025\` (per-user) or `C:\ProgramData\Autodesk\Revit\Addins\2025\` (machine-wide) |
| `.addin` file has incorrect XML | Validate that `<FullClassName>` is `BIMChain.Plugin.BIMChainApplication` and `<Assembly>` is `BIMChain.Plugin.dll` |
| DLL is missing | Confirm that `BIMChain.Plugin.dll` exists in the same directory as the `.addin` file |
| Revit version mismatch | The plugin requires Revit 2025 or later (.NET 8). Revit 2024 and earlier use .NET Framework 4.8 and are not compatible. |
| Security policy blocking | In Revit, go to File > Options > General > Allow Add-Ins and ensure third-party add-ins are permitted |

### Connection failed

| Possible cause | Solution |
|---------------|----------|
| Middleware not running | Start the middleware: `cd packages/middleware && npm start` |
| Wrong API URL | Verify the `apiBaseUrl` in settings matches the middleware address and port |
| Firewall blocking | Ensure port 3001 (or your configured port) is open for outbound connections from the Revit workstation |
| HTTPS certificate error | If using HTTPS, verify the TLS certificate is trusted by the Windows certificate store |

### Authentication errors (HTTP 401)

| Possible cause | Solution |
|---------------|----------|
| Invalid credentials | Double-check username and password. Default dev credentials: `admin`/`adminpw` |
| Expired JWT token | Tokens expire after 1 hour by default. Log out and log in again, or click refresh |
| Wrong organization ID | Verify your `orgId` setting matches a valid MSP ID in the Fabric network |

### Changes not appearing on the blockchain

| Possible cause | Solution |
|---------------|----------|
| Queue not flushing | Check the queue depth in the ribbon. Click **Sync Now** to force a flush |
| Sync timer not running | Verify `syncIntervalSeconds` is set to a positive integer in settings |
| Middleware validation error | Check the middleware logs for schema validation errors. Ensure all required fields (`modelId`, `elementUniqueId`, `changeType`, `elementHash`, `userId`, `orgId`) are present |
| Fabric network down | Verify the Fabric network is running: `docker ps` should show peer and orderer containers |
| Chaincode not deployed | Run `peer lifecycle chaincode querycommitted --channelID bim-project --name bim-governance` to verify |

### Hash mismatch warnings

| Possible cause | Solution |
|---------------|----------|
| Element modified outside tracking | This occurs when an element is changed by another user or process after the hash was recorded. Re-sync the model to capture the current state. |
| Non-deterministic parameters | Some Revit parameters (e.g., those tied to runtime state) may produce different hash values. These should be excluded from the hash computation in `ElementHasher`. |

### High memory usage

| Possible cause | Solution |
|---------------|----------|
| Large queue backlog | If the middleware is unreachable, records accumulate in memory. Increase `syncIntervalSeconds` or ensure network connectivity. |
| Very large model | Models with >100,000 elements generate many change records. Consider increasing the sync interval to batch more efficiently. |

---

## Uninstallation

To remove the BIM-Chain plugin from Revit:

1. Close Autodesk Revit.
2. Delete the following files from the Revit add-ins folder:
   - `BIMChain.addin`
   - `BIMChain.Plugin.dll`
   - Any other DLLs that were copied during installation
3. Optionally, delete the `bimchain-settings.json` file.
4. Restart Revit to confirm the BIM Chain tab no longer appears.
