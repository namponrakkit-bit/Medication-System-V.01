/**
 * ==============================================================
 *  Main.gs — Web App entry point + include() สำหรับแยกไฟล์ HTML
 * ==============================================================
 */

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialQr = params.qr ? String(params.qr) : '';
  template.initialView = params.view ? String(params.view) : '';
  return template.evaluate()
    .setTitle('ระบบจัดการยา & กล่องยา')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
