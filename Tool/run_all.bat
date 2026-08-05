@echo off
title TeamTaatom Manager & Launcher
setlocal EnableDelayedExpansion

set "NODE_PATH=C:\Users\sukes\AppData\Roaming\nvm\v20.20.1"
set "PATH=%NODE_PATH%;%PATH%"

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"

:menu
cls
echo ===================================================
echo              TeamTaatom Control Center             
echo ===================================================
echo Project Root: %PROJECT_ROOT%
echo ===================================================
echo [1] Start Backend API (Port 3000)
echo [2] Start SuperAdmin Dashboard (Port 5001)
echo [3] Start Web App (Port 3001)
echo [4] Start Mobile App / Expo (Frontend)
echo [5] Start ALL Services (1 + 2 + 3 + 4)
echo [6] Stop ALL Running Services (Ports 3000, 3001, 5001, 8081)
echo [7] Exit
echo ===================================================
set /p choice="Select an option (1-7): "

if "%choice%"=="1" goto start_backend
if "%choice%"=="2" goto start_superadmin
if "%choice%"=="3" goto start_web
if "%choice%"=="4" goto start_expo
if "%choice%"=="5" goto start_all
if "%choice%"=="6" goto stop_all
if "%choice%"=="7" goto end_script

echo.
echo Invalid selection! Please choose 1 to 7.
timeout /t 2 >nul
goto menu

:start_backend
echo.
echo Launching Backend API on Port 3000...
start "Backend API (Port 3000)" cmd /k "cd /d %PROJECT_ROOT%\backend && set PATH=%NODE_PATH%;%%PATH%% && npm start"
echo Backend started in a new window!
timeout /t 2 >nul
goto menu

:start_superadmin
echo.
echo Launching SuperAdmin Dashboard on Port 5001...
start "SuperAdmin Dashboard (Port 5001)" cmd /k "cd /d %PROJECT_ROOT%\SuperAdmin && set PATH=%NODE_PATH%;%%PATH%% && npm run dev"
echo SuperAdmin started in a new window!
timeout /t 2 >nul
goto menu

:start_web
echo.
echo Launching Web App on Port 3001...
start "Web App (Port 3001)" cmd /k "cd /d %PROJECT_ROOT%\web && set PATH=%NODE_PATH%;%%PATH%% && npm run dev"
echo Web App started in a new window!
timeout /t 2 >nul
goto menu

:start_expo
echo.
echo Launching Mobile App (Expo)...
start "Frontend (Expo)" cmd /k "cd /d %PROJECT_ROOT%\frontend && set PATH=%NODE_PATH%;%%PATH%% && npx expo start"
echo Expo started in a new window!
timeout /t 2 >nul
goto menu

:start_all
echo.
echo Launching Backend API (Port 3000)...
start "Backend API (Port 3000)" cmd /k "cd /d %PROJECT_ROOT%\backend && set PATH=%NODE_PATH%;%%PATH%% && npm start"

echo Launching SuperAdmin Dashboard (Port 5001)...
start "SuperAdmin Dashboard (Port 5001)" cmd /k "cd /d %PROJECT_ROOT%\SuperAdmin && set PATH=%NODE_PATH%;%%PATH%% && npm run dev"

echo Launching Web App (Port 3001)...
start "Web App (Port 3001)" cmd /k "cd /d %PROJECT_ROOT%\web && set PATH=%NODE_PATH%;%%PATH%% && npm run dev"

echo Launching Mobile App (Expo)...
start "Frontend (Expo)" cmd /k "cd /d %PROJECT_ROOT%\frontend && set PATH=%NODE_PATH%;%%PATH%% && npx expo start"

echo.
echo All 4 services launched!
timeout /t 3 >nul
goto menu

:stop_all
echo.
echo Stopping all processes running on ports 3000, 3001, 5001, 8081...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000, 3001, 5001, 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
echo All services stopped successfully!
timeout /t 2 >nul
goto menu

:end_script
echo.
echo Exiting control center. Have a great day!
endlocal
exit /b 0
