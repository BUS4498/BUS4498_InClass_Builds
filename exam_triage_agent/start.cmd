@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
echo Opening Exam Triage Agent on this computer...
start "" "http://127.0.0.1:4173"
node app\server.mjs
echo.
echo The app has stopped. Press any key to close this window.
pause >nul
