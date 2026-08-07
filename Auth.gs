/**
 * ==============================================================
 *  Auth.gs — ดึงข้อมูลผู้ใช้ปัจจุบัน (เก็บชื่อ+ตำแหน่งใน Users sheet)
 *  ไม่มี RBAC — ทุกคนมีสิทธิ์ทำได้หมด
 * ==============================================================
 */

function getUserEmail_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || 'ไม่ทราบผู้ใช้ (Anonymous)';
  } catch (e) {
    return 'ไม่ทราบผู้ใช้';
  }
}

// ดึงชื่อ+ตำแหน่งจากแท็บ Users (โดย userId)
// Note: web app ไม่สามารถได้ Session email ได้ ใช้ userId จาก frontend แทน
function getCurrentUser() {
  // ใน web app context frontend จะส่ง userId ผ่าน localStorage
  // backend ไม่ได้ implement โดยตรง ใช้ app tracking ผ่าน ChangeLog แทน
  return {
    userId: '',
    name: '',
    position: ''
  };
}

// ฟังก์ชันติดตาม (debug) — กด Run ใน GAS editor แล้วดู Execution log
function whoAmI() {
  const user = getCurrentUser();
  Logger.log(JSON.stringify(user, null, 2));
  return user;
}
