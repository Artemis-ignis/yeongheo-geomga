@echo off
rem ---------------------------------------------------------------------------
rem  영허검가 — double-click this file to play.
rem
rem  The project is a Vite app, which means it needs a local web server: a
rem  browser will not run ES modules from a file:// path, so opening
rem  dist/index.html directly shows a blank screen. That is the entire reason
rem  this file exists — everything below is what you would otherwise have to
rem  type into a terminal.
rem ---------------------------------------------------------------------------
chcp 65001 >nul
cd /d "%~dp0"
title 영허검가

echo.
echo   영허검가를 준비합니다...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js가 필요합니다.
  echo.
  echo       https://nodejs.org 에서 LTS 버전을 설치한 뒤
  echo       이 파일을 다시 실행해 주세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo   처음 실행이라 필요한 파일을 받습니다. 몇 분 걸릴 수 있습니다.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [!] 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)

echo   빌드 중...
call npm run build
if errorlevel 1 (
  echo.
  echo   [!] 빌드에 실패했습니다.
  pause
  exit /b 1
)

echo.
echo   브라우저가 열립니다. 이 창은 게임이 켜져 있는 동안 그대로 두세요.
echo   끄려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo.

rem `--open` launches the default browser once the server is actually listening,
rem which is why the browser is not opened before this line.
call npx vite preview --open

pause
