@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado.
  echo Instala Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
echo Iniciando Cyber Maze con Node.js en el puerto 3010...
set PORT=3010
start "Cyber Maze Server" cmd /k "set PORT=3010&&npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3010/?v=audio-fix-3"
endlocal
