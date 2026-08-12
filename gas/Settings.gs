/**
 * ==============================================================
 *  Settings.gs — การตั้งค่าระบบ (เก็บใน Script Properties)
 *  ลงชื่อก่อนใช้ + รหัสแอดมินสำหรับหน้าตั้งค่า (ไม่มี RBAC อีเมล)
 * ==============================================================
 */

var DEFAULT_ADMIN_CODE = '1234';
var DEFAULT_RED_DAYS = 90;
var DEFAULT_YELLOW_DAYS = 180;
var DEFAULT_NOTIFY_HOUR = 8;

function getAdminCode_() {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  return (stored || DEFAULT_ADMIN_CODE).toString().trim();
}

function verifyAdminCode_(code) {
  const given = (code || '').toString().trim();
  if (!given) return false;
  return given === getAdminCode_();
}

function getRedDays_() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('RED_DAYS');
  if (stored !== null && stored !== '') {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  const legacyMonths = parseInt(props.getProperty('RED_MONTHS'), 10);
  if (!isNaN(legacyMonths) && legacyMonths >= 0) return legacyMonths * 30;
  return DEFAULT_RED_DAYS;
}

function getYellowDays_() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('YELLOW_DAYS');
  if (stored !== null && stored !== '') {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  const legacyMonths = parseInt(props.getProperty('YELLOW_MONTHS'), 10);
  if (!isNaN(legacyMonths) && legacyMonths >= 0) return legacyMonths * 30;
  return DEFAULT_YELLOW_DAYS;
}

function getNotifyHour_() {
  const stored = PropertiesService.getScriptProperties().getProperty('NOTIFY_HOUR');
  if (stored !== null && stored !== '') {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 0 && n <= 23) return n;
  }
  return DEFAULT_NOTIFY_HOUR;
}

// ใช้ภายใน server เท่านั้น — ห้ามส่งค่านี้กลับไป frontend ตรงๆ เพราะมี token
function getAdminSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    lineToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    lineTargetId: props.getProperty('LINE_TARGET_ID') || '',
    redDays: getRedDays_(),
    yellowDays: getYellowDays_(),
    notifyHour: getNotifyHour_()
  };
}

// เวอร์ชันสำหรับ frontend — ส่งแค่ hasLineToken (boolean) แทน token จริง
function getClientSettings_() {
  const s = getAdminSettings();
  return {
    lineTargetId: s.lineTargetId,
    redDays: s.redDays,
    yellowDays: s.yellowDays,
    notifyHour: s.notifyHour,
    hasLineToken: !!s.lineToken
  };
}

function saveAdminSettings(data) {
  data = data || {};

  if (!verifyAdminCode_(data.adminCode)) {
    throw new Error('รหัสแอดมินไม่ถูกต้อง — ไม่สามารถบันทึกการตั้งค่าได้');
  }

  // ใช้ตอนปลดล็อก modal เท่านั้น — ไม่แก้ค่าอื่น
  if (data.verifyOnly) {
    return { success: true, settings: getClientSettings_() };
  }

  const props = PropertiesService.getScriptProperties();

  if (data.lineToken !== undefined) {
    const token = (data.lineToken || '').toString().trim();
    if (token) props.setProperty('LINE_CHANNEL_ACCESS_TOKEN', token);
  }
  if (data.lineTargetId !== undefined) props.setProperty('LINE_TARGET_ID', data.lineTargetId);

  const red = parseInt(data.redDays, 10);
  const yellow = parseInt(data.yellowDays, 10);
  const notifyHour = parseInt(data.notifyHour, 10);

  if (!isNaN(red) && red >= 0) props.setProperty('RED_DAYS', red.toString());
  if (!isNaN(yellow) && yellow >= red) props.setProperty('YELLOW_DAYS', yellow.toString());
  if (!isNaN(notifyHour) && notifyHour >= 0 && notifyHour <= 23) {
    props.setProperty('NOTIFY_HOUR', notifyHour.toString());
  }

  const newCode = (data.newAdminCode || '').toString().trim();
  if (newCode) {
    if (newCode.length < 4) {
      throw new Error('รหัสแอดมินใหม่ต้องมีอย่างน้อย 4 ตัวอักษร');
    }
    props.setProperty('ADMIN_CODE', newCode);
  }

  if (typeof createDailyTrigger_ === 'function') {
    createDailyTrigger_(getNotifyHour_());
  }

  return { success: true, settings: getClientSettings_() };
}
