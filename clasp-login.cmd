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

echo กำลังเปิดหน้า login Google สำหรับ clasp...
npx --yes @google/clasp login
exit /b %ERRORLEVEL%
