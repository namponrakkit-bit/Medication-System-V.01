@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ต้องติดตั้ง Node.js ก่อน แล้วเปิดหน้าต่างนี้ใหม่
  echo https://nodejs.org
  exit /b 1
)

if not exist ".clasp.json" (
  copy /Y ".clasp.json.example" ".clasp.json" >nul
  echo สร้างไฟล์ .clasp.json จากตัวอย่างแล้ว
)

echo.
echo กำลังดึงโค้ดจาก Google Apps Script...
echo ถ้าขึ้นให้ login ให้รันคำสั่งนี้ครั้งเดียวก่อน:
echo   npx --yes @google/clasp login
echo แล้วเปิด Apps Script API ที่:
echo   https://script.google.com/home/usersettings
echo.

npx --yes @google/clasp pull
exit /b %ERRORLEVEL%
