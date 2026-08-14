/**
 * ==============================================================
 *  Main.gs — Web App entry point + include() สำหรับแยกไฟล์ HTML
 * ==============================================================
 */

function doGet(e) {
  e = e || {};
  const p = e.parameter || {};

  // สแกน QR กล่องยา → เปิดเฉพาะกล่องของ QR นั้นเท่านั้น
  if (p.view === 'box' && p.t) {
    const tpl = HtmlService.createTemplateFromFile('BoxView');
    tpl.token = String(p.t || '');
    tpl.boxId = String(p.id || '');
    return tpl.evaluate()
      .setTitle('รายการยาในกล่อง')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบจัดการยา & กล่องยา')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ตรวจรหัสแอดมิน — อยู่ Main.gs เพื่อให้ google.script.run เรียกได้เสมอ */
function checkAdminCode(code) {
  if (typeof verifyAdminCode_ === 'function') {
    if (!verifyAdminCode_(code)) {
      throw new Error('รหัสแอดมินไม่ถูกต้อง');
    }
    return { success: true };
  }
  const given = (code || '').toString().trim();
  if (!given) throw new Error('กรุณาใส่รหัสแอดมิน');
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  const expected = (stored || '1234').toString().trim();
  if (given !== expected) throw new Error('รหัสแอดมินไม่ถูกต้อง');
  return { success: true };
}
