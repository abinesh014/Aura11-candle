@echo off
title Aura_11 Launcher
color 0A
echo.
echo  ====================================
echo   Aura_11 - Starting...
echo  ====================================
echo.
echo  Starting backend server...
start "Aura_11 Backend" cmd /k "cd /d d:\Candle\backend && node server.js"

echo  Waiting for server to start...
timeout /t 3 /nobreak >nul

echo  Opening website at http://localhost:8080 ...
start "" "http://localhost:8080"

echo.
echo  Done! Your site is now open.
echo  Close the "Aura_11 Backend" window to stop the server.
timeout /t 3 /nobreak >nul
exit
