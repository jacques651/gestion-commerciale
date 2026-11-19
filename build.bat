@echo off
setlocal enableextensions disabledelayedexpansion
cd /d "%~dp0"
title GestionPro - Mise a jour et compilation
set "GC_BUILD_PAUSE=1"
set "GC_BUILD_PULL=1"
set "GC_BUILD_SKIP_INSTALL=0"

:arguments
if "%~1"=="" goto :prepare
if /i "%~1"=="--help" goto :help
if /i "%~1"=="--no-pause" (set "GC_BUILD_PAUSE=0"& shift& goto :arguments)
if /i "%~1"=="--pull" (set "GC_BUILD_PULL=1"& shift& goto :arguments)
if /i "%~1"=="--no-pull" (set "GC_BUILD_PULL=0"& shift& goto :arguments)
if /i "%~1"=="--skip-install" (set "GC_BUILD_SKIP_INSTALL=1"& shift& goto :arguments)
echo [ERREUR] Option inconnue : %~1
goto :failed

:prepare
echo ============================================================
echo   GestionPro - mise a jour, compilation et migration de GestionPro.exe
echo   Les fichiers locaux et le dossier data sont conserves.
echo ============================================================
if not exist "package.json" (echo [ERREUR] Placer build.bat dans le dossier du projet.& goto :failed)
where node >nul 2>&1
if errorlevel 1 (echo [ERREUR] Node.js et npm sont requis sur le poste de compilation.& goto :failed)
where npm >nul 2>&1
if errorlevel 1 (echo [ERREUR] npm est introuvable.& goto :failed)
REM GestionPro.exe ne doit pas tourner : l executable et la base seraient verrouilles.
tasklist /FI "IMAGENAME eq GestionPro.exe" 2>nul | find /i "GestionPro.exe" >nul
if not errorlevel 1 (echo [ERREUR] GestionPro.exe est ouvert. Fermez-le puis relancez build.bat.& goto :failed)
echo.
echo [1/5] Mise a jour du code (Git)...
if "%GC_BUILD_PULL%"=="0" (echo   Ignoree ^(--no-pull^).& goto :dependencies)

REM Aucun reset, stash, merge force ou ecrasement local : en cas de doute, on compile les fichiers locaux.
where git >nul 2>&1
if errorlevel 1 (set "GC_PULL_MSG=Git est introuvable."& goto :pullskip)
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (set "GC_PULL_MSG=Ce dossier n est pas un depot Git."& goto :pullskip)
git diff --quiet
if errorlevel 1 (set "GC_PULL_MSG=Modifications locales presentes."& goto :pullskip)
git diff --cached --quiet
if errorlevel 1 (set "GC_PULL_MSG=Modifications locales indexees presentes."& goto :pullskip)
for /f "delims=" %%F in ('git ls-files --others --exclude-standard') do (set "GC_PULL_MSG=Fichiers locaux non suivis presents."& goto :pullskip)
git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1
if errorlevel 1 (set "GC_PULL_MSG=Aucune branche distante configuree."& goto :pullskip)
git fetch
if errorlevel 1 (set "GC_PULL_MSG=Recuperation distante impossible, reseau indisponible ?"& goto :pullskip)
REM Refuser toute mise a jour distante qui touche aux dossiers de donnees.
for /f "delims=" %%F in ('git diff --name-only HEAD..@{u} -- data backups') do (set "GC_PULL_MSG=La mise a jour distante touche data ou backups : verification manuelle requise."& goto :pullskip)
git merge --ff-only "@{u}"
if errorlevel 1 (set "GC_PULL_MSG=Fusion sans conflit impossible."& goto :pullskip)
echo   Code a jour.
goto :dependencies

:pullskip
echo   [AVERTISSEMENT] Mise a jour Git ignoree : %GC_PULL_MSG%
echo   La compilation continue avec les fichiers locaux actuels.

:dependencies
echo.
echo [2/5] Verification des dependances verrouillees...
if "%GC_BUILD_SKIP_INSTALL%"=="1" goto :compile
node -e "const f=require('fs'),c=require('crypto');try{const h=c.createHash('sha256').update(f.readFileSync('package.json')).update(f.readFileSync('package-lock.json')).digest('hex');process.exit(f.readFileSync('node_modules/.gestionpro-deps.sha256','utf8')===h&&f.existsSync('node_modules/tsx/dist/cli.mjs')&&f.existsSync('node_modules/postject/dist/cli.js')?0:1)}catch{process.exit(1)}"
if not errorlevel 1 goto :compile
REM Le serveur utilise node:sqlite ; pas de compilation des anciens modules natifs de maintenance.
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :failed
node -e "const f=require('fs'),c=require('crypto');f.writeFileSync('node_modules/.gestionpro-deps.sha256',c.createHash('sha256').update(f.readFileSync('package.json')).update(f.readFileSync('package-lock.json')).digest('hex'))"
if errorlevel 1 goto :failed

:compile
echo.
echo [3/5] Verification TypeScript et compilation de l interface et du serveur...
call npm run build
if errorlevel 1 goto :failed
echo.
echo [4/5] Creation et verification de GestionPro.exe et de l outil de preparation...
node "node_modules\tsx\dist\cli.mjs" "scripts\build-gestionpro.ts"
if errorlevel 1 goto :failed
node "node_modules\tsx\dist\cli.mjs" "scripts\build-gestionpro.ts" --preparer-prestations
if errorlevel 1 goto :failed
echo.
echo [5/5] Migration des prestations sur data\gestion-commerciale.db...
if not exist "data\gestion-commerciale.db" (echo   Aucune base dans data : rien a migrer ^(premiere installation^).& goto :done)
REM Sauvegarde complete puis migration ; sans effet si deja appliquee.
node "node_modules\tsx\dist\cli.mjs" "scripts\preparer-prestations.ts" --no-pause
if errorlevel 1 goto :failed

:done
echo.
echo [OK] Application compilee : %CD%\GestionPro.exe
echo Double-cliquez sur GestionPro.exe pour ouvrir l application.
echo Vos donnees restent dans data a cote de l executable.
echo En cas de preparation manquante : utiliser Preparer-prestations.exe sur le PC concerne.
if "%GC_BUILD_PAUSE%"=="1" pause
exit /b 0

:failed
echo.
echo [ECHEC] Consultez le message ci-dessus. Aucune base n est remplacee ; une sauvegarde precede toute migration.
if "%GC_BUILD_PAUSE%"=="1" pause
exit /b 1

:help
echo build.bat                  : mise a jour Git si possible, dependances, compilation, GestionPro.exe, migration de data
echo build.bat --no-pull        : sans mise a jour Git
echo build.bat --pull           : (par defaut) mise a jour Git sans conflit
echo build.bat --skip-install   : conserve les dependances deja installees
echo build.bat --no-pause       : execution sans pause finale
echo GestionPro.exe --check     : informations sans ouvrir la base ni demarrer le serveur
echo GestionPro.exe --no-browser: demarre le serveur sans ouvrir le navigateur
exit /b 0
