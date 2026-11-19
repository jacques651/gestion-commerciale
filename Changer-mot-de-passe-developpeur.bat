@echo off
setlocal enableextensions
cd /d "%~dp0"
title GestionPro - Mot de passe developpeur
where node >nul 2>&1
if errorlevel 1 (echo [ERREUR] Node.js est requis.& pause & exit /b 1)
node "scripts\changer-mot-de-passe-dev.mjs"
set "CODE=%ERRORLEVEL%"
echo.
pause
exit /b %CODE%
