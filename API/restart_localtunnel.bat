@echo off
REM LocalTunnel Auto-Restart Script for Windows
REM Usage: Double-click this file or run from command prompt

REM Configuration - Change these values as needed
set PORT=3000
set SUBDOMAIN=azania
set REGION=eu
set RESTART_DELAY=1

REM Colors (if supported)
title LocalTunnel Auto-Restart

echo.
echo ========================================
echo   LocalTunnel Auto-Restart Script
echo ========================================
echo Port: %PORT%
echo Subdomain: %SUBDOMAIN%
echo Region: %REGION%
echo ========================================
echo.

REM Check if LocalTunnel is installed
where lt >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] LocalTunnel is not installed!
    echo Please install it first: npm install -g localtunnel
    echo.
    pause
    exit /b 1
)

REM Initialize attempt counter
set ATTEMPT=1

:START_TUNNEL
echo [%date% %time%] [Attempt %ATTEMPT%] Starting LocalTunnel...
echo.

REM Start LocalTunnel
lt --port %PORT% --subdomain %SUBDOMAIN% --region %REGION%

REM If we reach here, LocalTunnel has crashed/exited
set EXIT_CODE=%ERRORLEVEL%
echo.
echo [%date% %time%] LocalTunnel exited with code: %EXIT_CODE%

REM Check if it was interrupted by user (Ctrl+C usually gives ERRORLEVEL 1)
if %EXIT_CODE% equ 0 (
    echo LocalTunnel ended normally.
    goto END_SCRIPT
)

echo [%date% %time%] Restarting in %RESTART_DELAY% seconds...
echo Press Ctrl+C to stop the auto-restart script
echo.

REM Wait before restart
timeout /t %RESTART_DELAY% /nobreak >nul

REM Increment attempt counter
set /a ATTEMPT+=1

REM Loop back to start
goto START_TUNNEL

:END_SCRIPT
echo.
echo ========================================
echo   Auto-restart script ended
echo ========================================
echo.
pause