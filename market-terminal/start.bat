@echo off
REM Market Terminal Startup Script (Windows)
REM Starts both backend and frontend services

setlocal enabledelayedexpansion

REM Configuration
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=3000"
set "HEALTH_ENDPOINT=http://localhost:%BACKEND_PORT%/api/health"
set "RUN_DIR=.run"
set "MAX_WAIT_SECONDS=30"

REM PID files
set "BACKEND_PID_FILE=%RUN_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%RUN_DIR%\frontend.pid"

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo =========================================
echo   Market Terminal Startup
echo =========================================
echo.

REM Check Python version
echo [INFO] Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3 is not installed.
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
for /f "tokens=1,2 delims=." %%a in ("%PYTHON_VERSION%") do (
    set PYTHON_MAJOR=%%a
    set PYTHON_MINOR=%%b
)

if %PYTHON_MAJOR% LSS 3 (
    echo [ERROR] Python 3.11+ is required. Found: %PYTHON_VERSION%
    exit /b 1
)
if %PYTHON_MAJOR% EQU 3 if %PYTHON_MINOR% LSS 11 (
    echo [ERROR] Python 3.11+ is required. Found: %PYTHON_VERSION%
    exit /b 1
)

echo [INFO] Python version: %PYTHON_VERSION% ^(^)
echo.

REM Check Node.js version
echo [INFO] Checking Node.js version...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=-%
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 18 (
    echo [ERROR] Node.js 18+ is required. Found: %NODE_VERSION%
    exit /b 1
)

echo [INFO] Node.js version: %NODE_VERSION% ^(^)
echo.

REM Setup environment file
echo [INFO] Setting up environment...
if exist ".env.example" (
    if not exist ".env" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env" >nul
    ) else (
        echo [INFO] .env already exists, skipping.
    )
) else (
    echo [WARN] .env.example not found, skipping environment setup.
)
echo.

REM Create run directory
echo [INFO] Creating run directory...
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"
echo.

REM Function to handle cleanup on exit
goto :main

:cleanup
echo [INFO] Shutting down Market Terminal...

REM Kill backend if running
if exist "%BACKEND_PID_FILE%" (
    set /p BACKEND_PID=<"%BACKEND_PID_FILE%"
    if defined BACKEND_PID (
        taskkill /F /PID %BACKEND_PID% >nul 2>&1
        echo [INFO] Stopped backend ^(PID: %BACKEND_PID%^)
    )
    del /f /q "%BACKEND_PID_FILE%" >nul 2>&1
)

REM Kill frontend if running
if exist "%FRONTEND_PID_FILE%" (
    set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"
    if defined FRONTEND_PID (
        taskkill /F /PID %FRONTEND_PID% >nul 2>&1
        echo [INFO] Stopped frontend ^(PID: %FRONTEND_PID%^)
    )
    del /f /q "%FRONTEND_PID_FILE%" >nul 2>&1
)

echo [INFO] Market Terminal stopped.
exit /b 0

:main

REM Start backend server
echo [INFO] Starting backend server on port %BACKEND_PORT%...
cd /d "%SCRIPT_DIR%backend"

if exist "requirements.txt" (
    echo [INFO] Installing backend dependencies...
    pip install -r requirements.txt -q
)

REM Start uvicorn in background
start /b python -m uvicorn app.main:app --host 0.0.0.0 --port %BACKEND_PORT% > nul 2>&1
timeout /t 2 /nobreak >nul

for /f "tokens=2" %%i in ('wmic process where "name='python.exe'" get processid /format:list ^| findstr "ProcessId"') do (
    echo %%i > "%BACKEND_PID_FILE%"
    set BACKEND_PID=%%i
)
echo [INFO] Backend started

REM Wait for backend health check
cd /d "%SCRIPT_DIR%"
echo [INFO] Waiting for backend health check...
set COUNTER=0
:wait_backend
if %COUNTER% GEQ %MAX_WAIT_SECONDS% (
    echo.
    echo [ERROR] Backend health check failed after %MAX_WAIT_SECONDS% seconds
    call :cleanup
    exit /b 1
)
curl -s "%HEALTH_ENDPOINT%" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    set /a COUNTER=COUNTER+1
    goto :wait_backend
)
echo [INFO] Backend is healthy!
echo.

REM Start frontend server
echo [INFO] Starting frontend server on port %FRONTEND_PORT%...
cd /d "%SCRIPT_DIR%frontend"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install
)

REM Start dev server in background
start /b npm run dev > nul 2>&1
timeout /t 2 /nobreak >nul

for /f "tokens=2" %%i in ('wmic process where "name='node.exe'" get processid /format:list ^| findstr "ProcessId"') do (
    echo %%i > "%FRONTEND_PID_FILE%"
)
echo [INFO] Frontend started

cd /d "%SCRIPT_DIR%"
echo.
echo =========================================
echo [INFO] Market Terminal is running!
echo [INFO] Backend:  http://localhost:%BACKEND_PORT%
echo [INFO] Frontend: http://localhost:%FRONTEND_PORT%
echo =========================================
echo.

REM Open browser
echo [INFO] Opening browser...
start http://localhost:%FRONTEND_PORT%

echo [INFO] Press Ctrl+C to stop the servers.

REM Wait for user to press Ctrl+C
pause >nul
call :cleanup