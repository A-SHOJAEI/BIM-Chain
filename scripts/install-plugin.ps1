$addinsPath = [Environment]::GetFolderPath('ApplicationData') + '\Autodesk\Revit\Addins\2026'
$pluginDir = "$addinsPath\BIMChain"

# Create directories
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null

# Copy manifest
Copy-Item 'H:\BIM - Blockchain\packages\revit-plugin\BIMChain.Plugin\BIMChain.addin' $addinsPath -Force

# Copy all build outputs
Copy-Item 'H:\BIM - Blockchain\packages\revit-plugin\BIMChain.Plugin\bin\Release\net8.0\*' $pluginDir -Force -Recurse

# Verify installation
Write-Host "=== Installed Files ==="
Get-Item "$addinsPath\BIMChain.addin" | Select-Object FullName, Length
Get-Item "$pluginDir\BIMChain.Plugin.dll" | Select-Object FullName, Length
Write-Host "=== Plugin Ready ==="
