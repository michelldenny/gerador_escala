@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Definir senha de edicao
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22 e abra este arquivo novamente.
  echo Download oficial: https://nodejs.org/
  pause
  exit /b 1
)
node scripts/set-password.mjs
pause
