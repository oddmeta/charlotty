@echo off
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
cd /d "%~dp0"
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm.cmd install
pause
