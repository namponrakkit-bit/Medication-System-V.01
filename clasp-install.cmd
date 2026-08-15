@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  ปรับไฟล์ในเครื่อง — ยังไม่ส่งขึ้น Google
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ต้องติดตั้ง Node.js ก่อน แล้วเปิดหน้าต่างนี้ใหม่
  echo https://nodejs.org
  exit /b 1
)

echo [1/3] ติดตั้ง clasp...
call npm install
if errorlevel 1 exit /b 1

if not exist ".clasp.json" (
  if exist ".clasp.json.example" (
    copy /y ".clasp.json.example" ".clasp.json" >nul
    echo สร้าง .clasp.json จากตัวอย่างแล้ว
  ) else (
    echo ไม่พบ .clasp.json.example
    exit /b 1
  )
)

echo.
echo [2/3] โปรเจกต์ที่ลิงก์อยู่:
type .clasp.json
echo.

echo [3/3] ไฟล์ที่จะถูก clasp push:
call npx clasp status
if errorlevel 1 exit /b 1

echo.
echo ปรับไฟล์ในเครื่องเสร็จแล้ว — ยังไม่ได้ส่งขึ้น Google
echo.
echo ขั้นถัดไป:
echo   1. เปิด Apps Script API  https://script.google.com/home/usersettings
echo   2. รัน clasp-login.cmd   (เปิดเบราว์เซอร์ login Google)
echo   3. รัน clasp-push.cmd    (ส่งโค้ดขึ้นโปรเจกต์)
echo.
exit /b 0
