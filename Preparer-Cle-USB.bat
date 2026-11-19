@echo off
chcp 65001 >nul
setlocal enableextensions
title Preparation cle USB - Code source Gestion Commerciale
cd /d "%~dp0"

echo ============================================================
echo   COPIE DU CODE SOURCE SUR CLE USB
echo   (pour travailler sur le code depuis n'importe quel PC)
echo ============================================================
echo.

REM ------------------------------------------------------------------
REM  Choix de la destination
REM ------------------------------------------------------------------
set "CIBLE="
set /p CIBLE="Lettre de la cle USB (ex. E) ou chemin complet : "
if "%CIBLE%"=="" (
    echo [ERREUR] Aucune destination indiquee.
    pause
    exit /b 1
)

REM Si l'utilisateur n'a tape qu'une lettre, on construit le chemin
if "%CIBLE:~1,1%"=="" set "CIBLE=%CIBLE%:"
if "%CIBLE:~2,1%"=="" set "CIBLE=%CIBLE%\"

set "DEST=%CIBLE%\GestionCommerciale-Source"

echo.
echo   Source      : %CD%
echo   Destination : %DEST%
echo.

if not exist "%CIBLE%" (
    echo [ERREUR] Destination introuvable : %CIBLE%
    echo Verifiez que la cle est bien branchee.
    pause
    exit /b 1
)

echo Appuyez sur une touche pour demarrer la copie...
pause >nul
echo.

REM ------------------------------------------------------------------
REM  1. Code source (leger, quelques Mo)
REM     /MIR sur les sous-dossiers utiles uniquement, pas de /MIR global
REM     pour ne jamais effacer autre chose sur la cle.
REM ------------------------------------------------------------------
echo [1/4] Copie du code source...
robocopy "." "%DEST%" /E /NFL /NDL /NJH /NJS /NP /R:2 /W:2 ^
  /XD node_modules dist Distribution Portable node .git target gen ^
  /XF *.zip *.log zi2DktT8 >nul
if errorlevel 8 (
    echo [ERREUR] La copie du code source a echoue.
    pause
    exit /b 1
)
echo [OK] Code source copie.
echo.

REM ------------------------------------------------------------------
REM  2. Dependances (node_modules) : volumineux mais permet de
REM     travailler SANS connexion internet sur l'autre PC.
REM     Robocopy est repris la ou il s'arrete si vous relancez.
REM ------------------------------------------------------------------
echo [2/4] Copie des dependances (node_modules)...
echo       Cette etape est longue (plusieurs centaines de Mo).
echo       Si elle est interrompue, relancez ce script : la copie reprend.
robocopy "node_modules" "%DEST%\node_modules" /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 >nul
if errorlevel 8 (
    echo [AVERTISSEMENT] La copie des dependances est incomplete.
    echo Relancez le script, ou lancez "npm install" sur l'autre PC.
) else (
    echo [OK] Dependances copiees.
)
echo.

REM ------------------------------------------------------------------
REM  3. Base de donnees de travail
REM ------------------------------------------------------------------
echo [3/4] Copie de la base de donnees...
if exist "data" (
    robocopy "data" "%DEST%\data" /E /NFL /NDL /NJH /NJS /NP /R:2 /W:2 >nul
    echo [OK] Base copiee.
    echo.
    echo   *** ATTENTION ***
    echo   La cle contient desormais vos donnees commerciales reelles.
    echo   Ne la laissez pas sans surveillance et evitez de la preter.
) else (
    echo [INFO] Aucun dossier data : une base vierge sera creee au 1er lancement.
)
echo.

REM ------------------------------------------------------------------
REM  4. Verification
REM ------------------------------------------------------------------
echo [4/4] Verification...
set "OK=1"
if not exist "%DEST%\package.json"  set "OK=0"
if not exist "%DEST%\src\App.tsx"   set "OK=0"
if not exist "%DEST%\node_modules\vite" set "OK=0"

if "%OK%"=="1" (
    echo [OK] Tout est en place.
) else (
    echo [AVERTISSEMENT] Des elements semblent manquer. Verifiez %DEST%
)
echo.

echo ============================================================
echo   [OK] CLE PRETE
echo ============================================================
echo.
echo   SUR L'AUTRE PC :
echo     1. Copier le dossier GestionCommerciale-Source depuis la cle
echo        VERS LE DISQUE DUR (ex. C:\Dev\). Ne travaillez pas
echo        directement sur la cle : c'est lent et risque.
echo     2. Ouvrir le dossier et double-cliquer "Demarrer-Dev.bat"
echo.
echo   Lisez LISEZMOI-DEV.md pour le detail.
echo.
pause
exit /b 0
