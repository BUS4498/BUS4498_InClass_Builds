@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20.12 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>20||major===20&&minor>=12?0:1)"
if errorlevel 1 (
  echo This app needs Node.js 20.12 or newer.
  pause
  exit /b 1
)
echo Opening Exam Triage Agent on this computer...
start "" "http://127.0.0.1:4173"
node app\server.mjs
echo.
echo The app has stopped. Press any key to close this window.
pause >nul
