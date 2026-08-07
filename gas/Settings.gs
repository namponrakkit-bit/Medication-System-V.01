/**
 * ==============================================================
 *  Settings.gs — การตั้งค่าระบบ (เก็บใน Script Properties)
 *  ไม่มี RBAC — ทุกคนสามารถอ่านการตั้งค่า
 * ==============================================================
 */

// ใช้ภายใน server เท่านั้น — ห้ามส่งค่านี้กลับไป frontend ตรงๆ เพราะมี token
function getAdminSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    lineToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    lineTargetId: props.getProperty('LINE_TARGET_ID') || '',
    redMonths: parseInt(props.getProperty('RED_MONTHS'), 10) || 4,
    yellowMonths: parseInt(props.getProperty('YELLOW_MONTHS'), 10) || 8
  };
}

// เวอร์ชันสำหรับ frontend — ส่งแค่ hasLineToken (boolean) แทน token จริง
function getClientSettings_() {
  const s = getAdminSettings();
  return {
    lineTargetId: s.lineTargetId,
    redMonths: s.redMonths,
    yellowMonths: s.yellowMonths,
    hasLineToken: !!s.lineToken
  };
}

function saveAdminSettings(data) {
  data = data || {};

  const props = PropertiesService.getScriptProperties();

  // อัปเดต token เฉพาะเมื่อมีการส่งค่าใหม่ที่ไม่ว่างเท่านั้น (เว้นว่าง = คงค่าเดิม)
  if (data.lineToken !== undefined) {
    const token = (data.lineToken || '').toString().trim();
    if (token) props.setProperty('LINE_CHANNEL_ACCESS_TOKEN', token);
  }
  if (data.lineTargetId !== undefined) props.setProperty('LINE_TARGET_ID', data.lineTargetId);

  const red = parseInt(data.redMonths, 10);
  const yellow = parseInt(data.yellowMonths, 10);

  if (!isNaN(red) && red >= 0) props.setProperty('RED_MONTHS', red.toString());
  if (!isNaN(yellow) && yellow >= red) props.setProperty('YELLOW_MONTHS', yellow.toString());

  // คืนค่าเวอร์ชันปลอดภัย (ไม่มี token) ให้ frontend
  return { success: true, settings: getClientSettings_() };
}
