@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 영허검가

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-game.ps1"
if errorlevel 1 (
  echo.
  echo   실행에 실패했습니다. 위 오류 내용을 확인해 주세요.
  echo   아무 키나 누르면 창을 닫습니다.
  pause >nul
  exit /b 1
)
