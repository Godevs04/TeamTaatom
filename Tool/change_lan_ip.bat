@echo off
setlocal EnableDelayedExpansion

REM Change LAN IP across frontend, backend, superAdmin, and web configs (Windows).
REM Usage: change_lan_ip.bat [LAN_IP]
REM If LAN_IP is omitted, attempts to auto-detect (192.168.x.x or 10.x.x.x).

set "USER_IP=%~1"
if "%USER_IP%"=="" (
  REM Auto-detect: first IPv4 that looks like 192.168.x.x or 10.x.x.x from ipconfig
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "192.168. 10\."') do (
    set "USER_IP=%%a"
    set "USER_IP=!USER_IP: =!"
    if not "!USER_IP!"=="" goto :ip_done
  )
  :ip_done
  if "!USER_IP!"=="" (
    echo ERROR: Could not auto-detect LAN IP. Please specify it manually: %~nx0 ^<LAN_IP^>
    exit /b 1
  )
  echo Auto-detected LAN IP: !USER_IP!
) else (
  echo Using user-supplied LAN IP: %USER_IP%
)

set "NEW_IP=%USER_IP%"
REM Script is in Tool/; project root is parent of Tool
pushd "%~dp0"
cd ..
set "PROJECT_ROOT=%CD%"
popd

REM ---------- frontend/app.json ----------
set "FRONTEND_JSON=%PROJECT_ROOT%\frontend\app.json"
if exist "%FRONTEND_JSON%" (
  echo Updating frontend/app.json API_BASE_URL and WEB_SHARE_URL...
  powershell -NoProfile -Command "$c = Get-Content -Raw -Path '%FRONTEND_JSON%'; $c = $c -replace '\"API_BASE_URL\"\\s*:\\s*\"http://[^\"]+\"', '\"API_BASE_URL\": \"http://%NEW_IP%:3000\"'; $c = $c -replace '\"WEB_SHARE_URL\"\\s*:\\s*\"http://[^\"]+\"', '\"WEB_SHARE_URL\": \"http://%NEW_IP%:3000\"'; Set-Content -Path '%FRONTEND_JSON%' -Value $c -NoNewline"
) else (
  echo frontend/app.json not found
)

REM ---------- frontend/.env ----------
set "FRONTEND_ENV=%PROJECT_ROOT%\frontend\.env"
if exist "%FRONTEND_ENV%" (
  echo Updating frontend/.env API_BASE_URL and EXPO_PUBLIC_API_BASE_URL...
  powershell -NoProfile -Command "(Get-Content '%FRONTEND_ENV%') -replace '^(API_BASE_URL=)http://[0-9A-Za-z.-]+(:[0-9]+)', '$1http://%NEW_IP%$2' -replace '^(EXPO_PUBLIC_API_BASE_URL\\s*=\\s*)http://[0-9A-Za-z.-]+(:[0-9]+)', '$1http://%NEW_IP%$2' | Set-Content '%FRONTEND_ENV%'"
) else (
  echo frontend/.env not found
)

REM ---------- backend/.env ----------
set "BACKEND_DOT_ENV=%PROJECT_ROOT%\backend\.env"
if exist "%BACKEND_DOT_ENV%" (
  echo Updating backend/.env FRONTEND_URL, WEB_FRONTEND_URL, API_BASE_URL and SUPERADMIN_URL...
  powershell -NoProfile -Command "(Get-Content '%BACKEND_DOT_ENV%') -replace '^(FRONTEND_URL=http://)[0-9.]+(:8081)', '$1%NEW_IP%$2' -replace '^(WEB_FRONTEND_URL=http://)[0-9.]+(:3001)', '$1%NEW_IP%$2' -replace '^(API_BASE_URL=http://)[0-9.]+(:3000)', '$1%NEW_IP%$2' -replace '^(SUPERADMIN_URL=http://)[0-9.]+(:5001)', '$1%NEW_IP%$2' | Set-Content '%BACKEND_DOT_ENV%'"
) else (
  echo backend/.env not found
)

REM ---------- backend/src/app.js CORS ----------
set "BACKEND_APP_JS=%PROJECT_ROOT%\backend\src\app.js"
if exist "%BACKEND_APP_JS%" (
  echo Updating backend/src/app.js CORS allowed origins...
  powershell -NoProfile -Command "(Get-Content '%BACKEND_APP_JS%') -replace '''http://192\.168\.[0-9]+\.[0-9]+(:8081)''', '''http://%NEW_IP%$1''' -replace '''http://192\.168\.[0-9]+\.[0-9]+(:3000)''', '''http://%NEW_IP%$1''' -replace '\"http://192\.168\.[0-9]+\.[0-9]+(:8081)\"', '\"http://%NEW_IP%$1\"' -replace '\"http://192\.168\.[0-9]+\.[0-9]+(:3000)\"', '\"http://%NEW_IP%$1\"' | Set-Content '%BACKEND_APP_JS%'"
) else (
  echo backend/src/app.js not found
)

REM ---------- superAdmin/.env ----------
set "SUPERADMIN_ENV=%PROJECT_ROOT%\superAdmin\.env"
if exist "%SUPERADMIN_ENV%" (
  echo Updating superAdmin/.env VITE_API_URL...
  powershell -NoProfile -Command "(Get-Content '%SUPERADMIN_ENV%') -replace '^(VITE_API_URL=http://)[0-9.]+(:3000)', '$1%NEW_IP%$2' | Set-Content '%SUPERADMIN_ENV%'"
) else (
  echo superAdmin/.env not found
)

REM ---------- web/.env.local ----------
set "WEB_ENV_LOCAL=%PROJECT_ROOT%\web\.env.local"
if exist "%WEB_ENV_LOCAL%" (
  echo Updating web/.env.local BACKEND_ORIGIN and NEXT_PUBLIC_WEB_URL...
  powershell -NoProfile -Command "(Get-Content '%WEB_ENV_LOCAL%') -replace '^(BACKEND_ORIGIN=)http://[0-9.]+(:3000)(.*)$', '$1http://%NEW_IP%$2$3' -replace '^(NEXT_PUBLIC_WEB_URL=)http://[0-9.]+(:3001)(.*)$', '$1http://%NEW_IP%$2$3' | Set-Content '%WEB_ENV_LOCAL%'"
) else (
  echo web/.env.local not found
)

echo.
echo LAN IP updated to %NEW_IP% across frontend, backend, superAdmin, and web configs.
endlocal
exit /b 0
