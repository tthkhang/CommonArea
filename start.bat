@echo off
rem Top 1 Server - double-click to play on this computer (needs Node.js 18+ for multiplayer).
cd /d "%~dp0"
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=admin"
if "%PORT%"=="" set "PORT=5173"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found: starting SOLO mode with Python. Install Node.js 18+ from https://nodejs.org for multiplayer.
  python serve.py --open
) else (
  set "OPEN_BROWSER=1"
  node server.mjs
)
pause
