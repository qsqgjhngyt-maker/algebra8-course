@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_Training.ps1" -CheckOnly
if errorlevel 1 echo Check failed. See the log in the logs folder.
pause
