@echo off
cd /d "%~dp0"
set "KITSUNE_PWSH=pwsh"
where pwsh >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" (
    set "KITSUNE_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
  ) else (
    echo PowerShell 7 is required. Install it, then run START.bat again.
    pause
    exit /b 1
  )
)
"%KITSUNE_PWSH%" -NoProfile -File "%~dp0Start_Local.ps1"
pause
