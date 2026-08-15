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
  echo ไม่พบ .clasp.json — รัน clasp-install.cmd ก่อนเพื่อปรับไฟล์ในเครื่อง
  exit /b 1
)

if not exist "%USERPROFILE%\.clasprc.json" (
  echo ยังไม่ได้ login clasp บนเครื่องนี้
  echo รัน clasp-login.cmd ก่อน แล้วค่อยรัน clasp-push.cmd อีกครั้ง
  exit /b 1
)

echo.
echo กำลังส่งโค้ดขึ้น Google Apps Script...
echo ถ้า error ให้เปิด Apps Script API ที่ https://script.google.com/home/usersettings
echo.

call npx clasp push --force
exit /b %ERRORLEVEL%
