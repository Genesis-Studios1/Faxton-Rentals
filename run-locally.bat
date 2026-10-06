@echo off
rem Starts Faxton Rentals on your computer. Needs Node.js (https://nodejs.org) or Python.
cd /d "%~dp0"
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:3000
  npx --yes serve public -l 3000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:3000
  python -m http.server 3000 -d public
  goto :eof
)
echo Please install Node.js from https://nodejs.org and run this file again.
pause
