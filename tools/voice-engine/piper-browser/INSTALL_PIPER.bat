@echo off
cd /d "%~dp0"
set "KITSUNE_PWSH=pwsh"
where pwsh >nul 2>nul
if errorlevel 1 set "KITSUNE_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
"%KITSUNE_PWSH%" -NoProfile -File "%~dp0Install_Piper_Runtime.ps1"
if errorlevel 1 echo Installation failed. See the message above.
pause
