/**
 * ==============================================================
 *  Users.gs — เก็บชื่อ+ตำแหน่งผู้ใช้ (ไม่มี RBAC)
 *  คอลัมน์: userId | name | position | lastUpdated
 * ==============================================================
 */

function getUsersSheet_() {
  return getOrCreateSheet_(USERS_SHEET_NAME, ['userId', 'name', 'position', 'lastUpdated']);
}

// บันทึกผู้ใช้ (ชื่อ+ตำแหน่ง) — upsert ตามผู้ใช้ที่ส่งมา
function saveUserInfo(userId, name, position) {
  userId = (userId || '').toString().trim();
  name = (name || '').toString().trim();
  position = (position || '').toString().trim();

  if (!userId) throw new Error('ไม่สามารถระบุผู้ใช้');
  if (!name) throw new Error('กรุณาระบุชื่อ');
  if (!position) throw new Error('กรุณาระบุตำแหน่ง');

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  // หาแถวที่มี userId เดียวกัน
  for (let i = 1; i < values.length; i++) {
    if ((values[i][0] || '').toString().trim() === userId) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[userId, name, position, now]]);
      return { success: true, userId: userId, updated: true };
    }
  }
  
  // ไม่พบ = เพิ่มแถวใหม่
  sheet.appendRow([userId, name, position, now]);
  return { success: true, userId: userId, updated: false };
}
