# 3D Model Viewer - Windows File Association Script
# Run as Administrator

param([string]$AppPath = "")

if ($AppPath -eq "") {
    $AppPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$electronPath = Join-Path $AppPath "node_modules\electron\dist\electron.exe"
$command = "`"$electronPath`" `"$AppPath`" `"%1`""

Write-Host "Registering file associations for 3D Model Viewer..."
Write-Host "App Path: $AppPath"
Write-Host "Electron: $electronPath"

$extensions = @('.glb', '.gltf', '.obj', '.fbx', '.stl')
$descriptions = @{
    '.glb'  = 'GL Binary 3D Model'
    '.gltf' = 'GL Transmission Format 3D Model'
    '.obj'  = 'Wavefront OBJ 3D Model'
    '.fbx'  = 'Autodesk FBX 3D Model'
    '.stl'  = 'Stereolithography 3D Model'
}

foreach ($ext in $extensions) {
    $progId = "3DModelViewer$($ext.TrimStart('.'))"
    
    # Create ProgID
    New-Item -Force -Path "HKCU:\Software\Classes\$progId" -Value $descriptions[$ext] | Out-Null
    New-Item -Force -Path "HKCU:\Software\Classes\$progId\DefaultIcon" -Value "$electronPath,0" | Out-Null
    New-Item -Force -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Value $command | Out-Null
    
    # Associate extension
    New-Item -Force -Path "HKCU:\Software\Classes\$ext" | Out-Null
    Set-ItemProperty -Path "HKCU:\Software\Classes\$ext" -Name "(Default)" -Value $progId
    
    Write-Host "  ✓ Registered $ext -> $progId"
}

# Refresh Windows shell
$code = @"
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
"@
$shell = Add-Type -MemberDefinition $code -Name "WinShell" -Namespace "Win32" -PassThru
$shell::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host ""
Write-Host "File associations registered successfully!" -ForegroundColor Green
Write-Host "You can now double-click .glb, .gltf, .obj, .fbx, .stl files to open them." -ForegroundColor Cyan
Write-Host "Note: You may need to right-click a file and choose 'Open With' once." -ForegroundColor Yellow
Read-Host "Press Enter to close"
