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
  if exist ".clasp.json.example" copy /y ".clasp.json.example" ".clasp.json" >nul
)

echo กำลังเปิดหน้า login Google สำหรับ clasp...
echo เลือกบัญชีที่เป็นเจ้าของสคริปต์ แล้วรอจนขึ้นสำเร็จ
echo หลัง login เสร็จ รัน clasp-push.cmd เพื่อส่งโค้ดขึ้น Google
echo.
call npx clasp login
exit /b %ERRORLEVEL%
