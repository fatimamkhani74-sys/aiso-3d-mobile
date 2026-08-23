@echo off
echo Starting 3D Model Viewer...
cd /d "%~dp0"
node_modules\electron\dist\electron.exe . %1
