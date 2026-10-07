@echo off
title Grade Tracker
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org then run this again.
  pause
  exit /b
)
if not exist node_modules (
  echo First run: installing packages, about a minute...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Send the error above to Claude.
    pause
    exit /b
  )
)
echo Starting Grade Tracker. Keep this window open while you use it.
call npm start
pause
