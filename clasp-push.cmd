@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ต้องติดตั้ง Node.js ก่อน แล้วเปิดหน้าต่างนี้ใหม่
  echo https://nodejs.org
  exit /b 1
)

if not exist "node_modules\@google\clasp" (
  echo กำลังติดตั้ง clasp...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist ".clasp.json" (
  echo ไม่พบ .clasp.json — รัน clasp-install.cmd หรือ npm install ก่อน
  exit /b 1
)

echo.
echo กำลังส่งโค้ดขึ้น Google Apps Script...
echo ถ้ายังไม่ login ให้รัน clasp-login.cmd ก่อน
echo และเปิด Apps Script API ที่ https://script.google.com/home/usersettings
echo.

call npx clasp push --force
exit /b %ERRORLEVEL%
