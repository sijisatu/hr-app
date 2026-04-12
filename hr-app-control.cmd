@echo off
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0" >nul 2>nul
set "PROJECT_DIR=%CD%"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"
set "BACKEND_PID_FILE=%LOG_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%LOG_DIR%\frontend.pid"
set "PS_FILE=%TEMP%\hr_app_launch_%RANDOM%.ps1"
set "IS_CLI=0"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

if /i not "%~1"=="" (
set "IS_CLI=1"
goto cli
)

:menu
cls
echo ==============================
echo        HR APP CONTROL
echo ==============================
echo Project Dir : %PROJECT_DIR%
echo Log Dir     : %LOG_DIR%
echo.
echo [1] Pull ^+ Start (background)
echo [2] Stop service
echo [3] Status service
echo [4] Pull only
echo [5] Exit
echo.
set /p CHOICE=Pilih opsi (1/2/3/4/5):

if "%CHOICE%"=="1" goto start_app
if "%CHOICE%"=="2" goto stop_app
if "%CHOICE%"=="3" goto status_app
if "%CHOICE%"=="4" goto pull_only
if "%CHOICE%"=="5" goto end

echo.
echo [ERROR] Pilihan tidak valid.
pause
goto menu

:cli
set "CMD=%~1"
if /i "%CMD%"=="start" goto start_app
if /i "%CMD%"=="stop" goto stop_app
if /i "%CMD%"=="status" goto status_app
if /i "%CMD%"=="pull" goto pull_only
if /i "%CMD%"=="restart" goto restart_app
echo [ERROR] Argumen tidak dikenal: %CMD%
echo [INFO] Pakai: start ^| stop ^| status ^| pull ^| restart
goto end

:preflight
where git >nul 2>nul || (echo [ERROR] Git belum tersedia di PATH.& exit /b 1)
where node >nul 2>nul || (echo [ERROR] Node.js belum tersedia di PATH.& exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm belum tersedia di PATH.& exit /b 1)
if not exist "%PROJECT_DIR%\package.json" (echo [ERROR] package.json frontend tidak ditemukan.& exit /b 1)
if not exist "%PROJECT_DIR%\backend\package.json" (echo [ERROR] package.json backend tidak ditemukan.& exit /b 1)
git -C "%PROJECT_DIR%" rev-parse --is-inside-work-tree >nul 2>nul || (echo [ERROR] Folder ini bukan git repository.& exit /b 1)
exit /b 0

:pull_only
cls
echo ==============================
echo          PULL REPO
echo ==============================
echo.
call :preflight || (pause & goto post_action)
echo [INFO] Menarik update terbaru...
git -C "%PROJECT_DIR%" pull --ff-only origin main
if errorlevel 1 (
  echo [ERROR] Git pull gagal.
) else (
  echo [OK] Pull berhasil.
)
goto post_action

:start_app
cls
echo ==============================
echo    START APP (BACKGROUND)
echo ==============================
echo.
call :preflight || (pause & goto post_action)

echo [STEP] Stop service lama kalau masih ada...
call :stop_app_silent

echo [STEP] Pull update terbaru...
git -C "%PROJECT_DIR%" pull --ff-only origin main
if errorlevel 1 (
  echo [ERROR] Git pull gagal. Service tidak dijalankan.
  goto post_action
)

echo [STEP] Cek dependency frontend...
if not exist "%PROJECT_DIR%\node_modules\" (
  echo [INFO] node_modules frontend belum ada, install dependency...
  call npm --prefix "%PROJECT_DIR%" install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] Install dependency frontend gagal.
    goto post_action
  )
)

echo [STEP] Cek dependency backend...
if not exist "%PROJECT_DIR%\backend\node_modules\" (
  echo [INFO] node_modules backend belum ada, install dependency...
  call npm --prefix "%PROJECT_DIR%\backend" install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] Install dependency backend gagal.
    goto post_action
  )
)

call :reset_log_file "%BACKEND_LOG%"
call :reset_log_file "%FRONTEND_LOG%"
call :reset_log_file "%BACKEND_LOG%.err"
call :reset_log_file "%FRONTEND_LOG%.err"
del /f /q "%BACKEND_PID_FILE%" >nul 2>nul
del /f /q "%FRONTEND_PID_FILE%" >nul 2>nul

echo [STEP] Menjalankan backend...
call :write_ps_launch "backend" "%PROJECT_DIR%\backend" "npm.cmd run dev" "%BACKEND_LOG%" "%BACKEND_PID_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"
del /f /q "%PS_FILE%" >nul 2>nul

echo [STEP] Menunggu backend siap (http://127.0.0.1:4000/api/health)...
call :wait_http "http://127.0.0.1:4000/api/health" 55
if errorlevel 1 (
  echo [WARN] Backend dev mode belum siap. Coba fallback build + start...
  if exist "%BACKEND_PID_FILE%" (
    set /p BPID=<"%BACKEND_PID_FILE%"
    if not "!BPID!"=="" taskkill /PID !BPID! /T /F >nul 2>nul
  )
  del /f /q "%BACKEND_PID_FILE%" >nul 2>nul
  call :write_ps_launch "backend" "%PROJECT_DIR%\backend" "npm.cmd run build ^&^& npm.cmd run start" "%BACKEND_LOG%" "%BACKEND_PID_FILE%"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"
  del /f /q "%PS_FILE%" >nul 2>nul
  call :wait_http "http://127.0.0.1:4000/api/health" 90
)
if errorlevel 1 (
  echo [ERROR] Backend gagal start.
  call :print_log_tail "%BACKEND_LOG%" "backend"
  goto post_action
)

echo [STEP] Menjalankan frontend...
call :write_ps_launch "frontend" "%PROJECT_DIR%" "npm.cmd run dev" "%FRONTEND_LOG%" "%FRONTEND_PID_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"
del /f /q "%PS_FILE%" >nul 2>nul

echo [STEP] Menunggu frontend siap (http://127.0.0.1:3000)...
call :wait_http "http://127.0.0.1:3000" 75
if errorlevel 1 (
  echo [ERROR] Frontend gagal start.
  call :print_log_tail "%FRONTEND_LOG%" "frontend"
  goto post_action
)

echo.
echo ==============================
echo      SERVICE SUDAH JALAN
echo ==============================
echo Frontend    : http://127.0.0.1:3000
echo Backend     : http://127.0.0.1:4000
echo Backend log : %BACKEND_LOG%
echo Frontend log: %FRONTEND_LOG%
echo.
goto post_action

:restart_app
call :stop_app_silent
goto start_app

:stop_app
cls
echo ==============================
echo         STOP SERVICE
echo ==============================
echo.
call :stop_app_silent
echo [OK] Semua service sudah dicoba dimatikan.
goto post_action

:stop_app_silent
for /l %%i in (1,1,4) do (
  call :stop_pid_file "%BACKEND_PID_FILE%"
  call :stop_pid_file "%FRONTEND_PID_FILE%"
  call :stop_port 3000
  call :stop_port 4000
  call :stop_project_processes
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 600" >nul 2>nul
)
call :wait_port_free 3000 20
call :wait_port_free 4000 20
del /f /q "%BACKEND_PID_FILE%" >nul 2>nul
del /f /q "%FRONTEND_PID_FILE%" >nul 2>nul
exit /b 0

:stop_pid_file
set "TARGET_PID_FILE=%~1"
if exist "%TARGET_PID_FILE%" (
  set "TARGET_PID="
  set /p TARGET_PID=<"%TARGET_PID_FILE%"
  if not "!TARGET_PID!"=="" taskkill /PID !TARGET_PID! /T /F >nul 2>nul
)
exit /b 0

:stop_port
set "TARGET_PORT=%~1"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  taskkill /PID %%a /T /F >nul 2>nul
)
exit /b 0

:stop_project_processes
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\hr-app-stop-processes.ps1" -ProjectDir "%PROJECT_DIR%" >nul 2>nul
exit /b 0

:wait_port_free
set "WAIT_PORT=%~1"
set "WAIT_RETRY=%~2"
for /l %%i in (1,1,%WAIT_RETRY%) do (
  netstat -ano | findstr /R /C:":%WAIT_PORT% .*LISTENING" >nul 2>nul
  if errorlevel 1 exit /b 0
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>nul
)
exit /b 1

:reset_log_file
set "TARGET_LOG=%~1"
for /l %%i in (1,1,12) do (
  (type nul > "%TARGET_LOG%") >nul 2>nul && exit /b 0
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 400" >nul 2>nul
)
echo [WARN] Gagal reset log file: %TARGET_LOG%
exit /b 0

:status_app
cls
echo ==============================
echo        SERVICE STATUS
echo ==============================
echo.
call :print_status_line "Backend" "%BACKEND_PID_FILE%" 4000
call :print_status_line "Frontend" "%FRONTEND_PID_FILE%" 3000
echo.
echo [INFO] Endpoint check:
call :print_http_status "Backend Health" "http://127.0.0.1:4000/api/health"
call :print_http_status "Frontend Root " "http://127.0.0.1:3000"
goto post_action

:print_status_line
set "SVC_NAME=%~1"
set "PID_FILE=%~2"
set "PORT=%~3"
set "PID_VALUE="
set "PID_OK=0"
if exist "%PID_FILE%" (
  set /p PID_VALUE=<"%PID_FILE%"
  if not "!PID_VALUE!"=="" (
    tasklist /FI "PID eq !PID_VALUE!" 2>nul | findstr /I "!PID_VALUE!" >nul 2>nul && set "PID_OK=1"
  )
)
set "PORT_OK=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "PORT_OK=1"
)
if "!PID_OK!"=="1" (
  echo %SVC_NAME% : RUNNING ^(PID !PID_VALUE!, port %PORT%^)
) else if "!PORT_OK!"=="1" (
  echo %SVC_NAME% : RUNNING ^(PID file stale/missing, port %PORT% aktif^)
) else (
  echo %SVC_NAME% : STOPPED ^(port %PORT% tidak aktif^)
)
exit /b 0

:wait_http
set "URL=%~1"
set "RETRY=%~2"
for /l %%i in (1,1,%RETRY%) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 exit /b 0
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 900" >nul 2>nul
)
exit /b 1

:print_http_status
set "LABEL=%~1"
set "URL=%~2"
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; Write-Output ('  - %LABEL% : UP (' + $r.StatusCode + ')'); exit 0 } catch { Write-Output '  - %LABEL% : DOWN'; exit 0 }"
exit /b 0

:print_log_tail
set "LOG_FILE=%~1"
set "TITLE=%~2"
echo.
echo ===== %TITLE%.log (tail) =====
if exist "%LOG_FILE%" (
  powershell -NoProfile -Command "Get-Content -Path '%LOG_FILE%' -Tail 60"
) else (
  echo [INFO] Log file belum tersedia: %LOG_FILE%
)
if exist "%LOG_FILE%.err" (
  echo ----- %TITLE%.log.err (tail) -----
  powershell -NoProfile -Command "Get-Content -Path '%LOG_FILE%.err' -Tail 40"
)
echo ===============================
exit /b 0

:write_ps_launch
set "SVC_NAME=%~1"
set "WORKDIR=%~2"
set "RUN_CMD=%~3"
set "LOG_FILE=%~4"
set "PID_FILE=%~5"
(
  echo $workDir = "%WORKDIR%"
  echo $logPath = "%LOG_FILE%"
  echo $errLogPath = "%LOG_FILE%.err"
  echo $pidFilePath = "%PID_FILE%"
  echo $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c %RUN_CMD%" -WorkingDirectory $workDir -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $errLogPath -PassThru
  echo $p.Id ^| Out-File -FilePath $pidFilePath -Encoding ascii -Force
) > "%PS_FILE%"
exit /b 0

:post_action
if /i "%IS_CLI%"=="1" goto end
if /i not "%~1"=="" goto end
echo.
pause
goto menu

:end
popd >nul 2>nul
exit /b 0
