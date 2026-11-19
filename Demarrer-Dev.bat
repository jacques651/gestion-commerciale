@echo off
chcp 65001 >nul
setlocal enableextensions
title Gestion Commerciale - Mode developpement
cd /d "%~dp0"

echo ============================================================
echo   GESTION COMMERCIALE - MODE DEVELOPPEMENT
echo ============================================================
echo.

REM ------------------------------------------------------------------
REM  Verification de Node.js
REM ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe sur ce PC.
    echo.
    echo   Telechargez-le sur https://nodejs.org ^(version LTS^)
    echo   puis relancez ce script.
    echo.
    echo   Astuce : si vous ne pouvez rien installer sur ce PC,
    echo   utilisez plutot "Demarrer.bat" qui embarque son propre Node.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('node --version') do set "NODEV=%%V"
echo   Node.js detecte : %NODEV%
echo.

REM ------------------------------------------------------------------
REM  Verification des dependances
REM ------------------------------------------------------------------
if not exist "node_modules\vite" (
    echo [!] Dependances absentes ou incompletes.
    echo     Installation en cours ^(necessite une connexion internet^)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERREUR] L'installation a echoue.
        echo Verifiez votre connexion internet, puis relancez.
        pause
        exit /b 1
    )
    echo.
) else (
    echo   Dependances : OK
    echo.
)

REM ------------------------------------------------------------------
REM  Lancement du serveur de developpement
REM ------------------------------------------------------------------
echo ------------------------------------------------------------
echo   Lancement du serveur de developpement...
echo   L'application s'ouvrira sur http://localhost:1420
echo.
echo   Les modifications du code sont appliquees automatiquement.
echo   Pour arreter : Ctrl+C dans cette fenetre.
echo ------------------------------------------------------------
echo.

REM API locale : ne pas ouvrir une seconde instance si le port est deja utilise.
set "GC_DEV_ROOT=%~dp0"
powershell -NoProfile -Command "try { $socket = [Net.Sockets.TcpClient]::new('127.0.0.1',8090); $socket.Dispose(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo   Demarrage de l'API locale : npm run server
    powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/d /c npm run server' -WorkingDirectory $env:GC_DEV_ROOT -WindowStyle Hidden"
)

start "" http://localhost:1420
call npm run dev

echo.
echo Le serveur s'est arrete.
pause
