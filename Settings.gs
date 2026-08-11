/**
 * ==============================================================
 *  Settings.gs — การตั้งค่าระบบ (เก็บใน Script Properties)
 *  โหมดแอดมินปลดล็อกด้วยรหัสผ่าน (ADMIN_PASSWORD)
 * ==============================================================
 */

// รหัสแอดมินเริ่มต้น (ใช้เมื่อยังไม่เคยตั้งค่า ADMIN_PASSWORD)
// เข้าโหมดแอดมินด้วยรหัสนี้เพื่อไปตั้งรหัสจริงในหน้า "ตั้งค่า" ได้
const DEFAULT_ADMIN_PASSWORD = '1234';

// ใช้ภายใน server เท่านั้น — ห้ามส่งค่านี้กลับไป frontend ตรงๆ เพราะมี token
function getAdminSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    lineToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    lineTargetId: props.getProperty('LINE_TARGET_ID') || '',
    redMonths: parseInt(props.getProperty('RED_MONTHS'), 10) || 4,
    yellowMonths: parseInt(props.getProperty('YELLOW_MONTHS'), 10) || 8,
    webAppUrl: props.getProperty('WEB_APP_URL') || ''
  };
}

// เวอร์ชันสำหรับ frontend — ส่งแค่ boolean (hasLineToken / hasAdminPassword) แทนค่าจริง
function getClientSettings_() {
  const s = getAdminSettings();
  const props = PropertiesService.getScriptProperties();
  let webAppUrl = (s.webAppUrl || '').trim();
  if (!webAppUrl) {
    try { webAppUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { webAppUrl = ''; }
  }
  return {
    lineTargetId: s.lineTargetId,
    redMonths: s.redMonths,
    yellowMonths: s.yellowMonths,
    hasLineToken: !!s.lineToken,
    hasAdminPassword: !!props.getProperty('ADMIN_PASSWORD'),
    webAppUrl: webAppUrl
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
  if (data.webAppUrl !== undefined) {
    props.setProperty('WEB_APP_URL', (data.webAppUrl || '').toString().trim());
  }

  // อัปเดตรหัสแอดมินเฉพาะเมื่อมีการส่งค่าใหม่ที่ไม่ว่างเท่านั้น (เว้นว่าง = คงรหัสเดิม)
  if (data.adminPassword !== undefined) {
    const pw = (data.adminPassword || '').toString().trim();
    if (pw) props.setProperty('ADMIN_PASSWORD', pw);
  }

  const red = parseInt(data.redMonths, 10);
  const yellow = parseInt(data.yellowMonths, 10);

  if (!isNaN(red) && red >= 0) props.setProperty('RED_MONTHS', red.toString());
  if (!isNaN(yellow) && yellow >= red) props.setProperty('YELLOW_MONTHS', yellow.toString());

  // คืนค่าเวอร์ชันปลอดภัย (ไม่มี token/รหัส) ให้ frontend
  return { success: true, settings: getClientSettings_() };
}

/**
 * ตรวจรหัสแอดมินฝั่ง server (ไม่ส่งรหัสจริงไป frontend)
 * ถ้ายังไม่เคยตั้ง ADMIN_PASSWORD จะใช้รหัสเริ่มต้น DEFAULT_ADMIN_PASSWORD
 * คืน { success: boolean, usingDefault: boolean }
 */
function verifyAdminPassword(pw) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  const usingDefault = !(stored && stored.length);
  const expected = usingDefault ? DEFAULT_ADMIN_PASSWORD : stored;
  return { success: (pw || '').toString() === expected, usingDefault: usingDefault };
}
