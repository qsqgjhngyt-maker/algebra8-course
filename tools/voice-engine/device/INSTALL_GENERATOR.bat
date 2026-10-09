@echo off
cd /d "%~dp0"
where pwsh.exe >nul 2>nul
if %errorlevel% equ 0 (
  pwsh.exe -NoProfile -File "%~dp0Install_Browser_Runtime.ps1"
) else (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" -NoProfile -File "%~dp0Install_Browser_Runtime.ps1"
)
if errorlevel 1 (
  echo.
  echo Installation failed. See the message above.
  pause
  exit /b 1
)
echo.
if exist "%~dp0START.bat" (
  call "%~dp0START.bat"
) else (
  pause
)
