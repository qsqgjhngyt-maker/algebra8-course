@echo off
cd /d "%~dp0"
py -3 LAN_SERVER.py --port 8080 || python LAN_SERVER.py --port 8080
pause
