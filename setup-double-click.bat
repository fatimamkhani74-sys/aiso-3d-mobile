@echo off
title Register 3D Model Associations
cd /d "%~dp0"
echo ===================================================
echo   Registering 3D Model Viewer (.glb, .gltf, .obj, .fbx, .stl)
echo ===================================================
powershell -ExecutionPolicy Bypass -File "%~dp0register-file-associations.ps1"
pause
