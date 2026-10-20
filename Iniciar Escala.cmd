@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22.16 ou superior e abra este arquivo novamente.
  echo Download oficial: https://nodejs.org/
  pause
  exit /b 1
)
node scripts/launch.js
if errorlevel 1 pause
