@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ต้องติดตั้ง Node.js ก่อน แล้วเปิดหน้าต่างนี้ใหม่
  echo https://nodejs.org
  exit /b 1
)

echo กำลังติดตั้ง clasp...
call npm install
if errorlevel 1 exit /b 1

echo.
echo ติดตั้งเสร็จแล้ว
echo ขั้นถัดไป: รัน clasp-login.cmd แล้วค่อยรัน clasp-pull.cmd
exit /b 0
