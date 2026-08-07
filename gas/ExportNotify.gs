/**
 * ==============================================================
 *  ExportNotify.gs — คำนวณสถานะวันหมดอายุ, Export CSV/Sheet,
 *                    และแจ้งเตือนผ่าน LINE (Flex Message)
 * ==============================================================
 */

/* -------------------- Expiry helpers -------------------- */

function getExpiryStatus_(dateStr) {
  const settings = getAdminSettings();
  const redM = settings.redMonths;
  const yellowM = settings.yellowMonths;

  if (!dateStr) return { status: 'nodate', diffDays: null, months: null, redM, yellowM };

  const d = new Date(dateStr + 'T00:00:00+07:00');
  if (isNaN(d.getTime())) return { status: 'nodate', diffDays: null, months: null, redM, yellowM };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays < 0) return { status: 'expired', diffDays, months: null, redM, yellowM };

  const months = Math.floor(diffDays / 30);
  let status;
  if (months <= redM) status = 'red';
  else if (months <= yellowM) status = 'yellow';
  else status = 'green';

  return { status, diffDays, months, redM, yellowM };
}

function getExpiringMedicines_() {
  const all = getAllMedicines();
  const result = [];
  all.forEach(item => {
    const info = getExpiryStatus_(item['วันหมดอายุ']);
    if (info.status === 'expired' || info.status === 'red' || info.status === 'yellow') {
      const enriched = {};
      DEFAULT_HEADERS.forEach(h => enriched[h] = item[h]);
      enriched['สถานะ'] = info.status;
      enriched['เหลือกี่วัน'] = info.diffDays;
      result.push(enriched);
    }
  });
  result.sort((a, b) => (a['เหลือกี่วัน'] ?? -999999) - (b['เหลือกี่วัน'] ?? -999999));
  return result;
}

/* -------------------- Export CSV / Sheet -------------------- */

function csvEscape_(val) {
  if (val === null || val === undefined) return '';
  const s = val.toString();
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportExpiringMedicinesCSV() {
  const items = getExpiringMedicines_();
  const headers = DEFAULT_HEADERS.concat(['สถานะ', 'เหลือกี่วัน']);
  const lines = [headers.join(',')];
  items.forEach(item => lines.push(headers.map(h => csvEscape_(item[h])).join(',')));
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const base64 = Utilities.base64Encode(csvContent, Utilities.Charset.UTF_8);
  return { filename: 'รายการยาใกล้หมดอายุ_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm') + '.csv', base64: base64, mimeType: 'text/csv', count: items.length };
}

function exportExpiringMedicinesToSheet() {
  const items = getExpiringMedicines_();
  const headers = DEFAULT_HEADERS.concat(['สถานะ', 'เหลือกี่วัน']);
  const ss = getSpreadsheet_();
  const name = 'Export_ยาใกล้หมดอายุ_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  const sheet = ss.insertSheet(name);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  if (items.length > 0) {
    const rows = items.map(item => headers.map(h => item[h] !== undefined ? item[h] : ''));
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
  return { url: ss.getUrl() + '#gid=' + sheet.getSheetId(), sheetName: name, count: items.length };
}

/* -------------------- LINE Flex Message notification -------------------- */

function checkExpiryAndNotify() {
  const all = getAllMedicines();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expired = [], red = [], yellow = [];
  all.forEach(item => {
    const info = getExpiryStatus_(item['วันหมดอายุ']);
    if (info.status === 'nodate') return;
    if (info.status === 'expired') expired.push({ item, diffDays: info.diffDays, months: null });
    else if (info.status === 'red') red.push({ item, diffDays: info.diffDays, months: info.months });
    else if (info.status === 'yellow') yellow.push({ item, diffDays: info.diffDays, months: info.months });
  });
  if (expired.length === 0 && red.length === 0 && yellow.length === 0) { Logger.log('✅ ไม่มียาหมดอายุ/ใกล้หมดอายุ ในวันนี้'); return; }
  red.sort((a, b) => a.diffDays - b.diffDays);
  yellow.sort((a, b) => a.diffDays - b.diffDays);
  const flexMessages = buildFlexMessages_(expired, red, yellow, getAdminSettings());
  sendLineFlexMessages_(flexMessages);
}

function buildFlexMessages_(expired, red, yellow, settings) {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const rows = [];
  if (expired.length > 0) { rows.push(buildSectionHeaderRow_('❌ หมดอายุแล้ว (' + expired.length + ' รายการ)', '#7a1f1f')); expired.forEach(({ item, diffDays, months }) => rows.push(buildCompactRow_(item, 'expired', diffDays, months))); }
  if (red.length > 0) { rows.push(buildSectionHeaderRow_('🔴 ใกล้หมดอายุมาก 0-' + settings.redMonths + ' เดือน (' + red.length + ' รายการ)', '#d64545')); red.forEach(({ item, diffDays, months }) => rows.push(buildCompactRow_(item, 'red', diffDays, months))); }
  if (yellow.length > 0) { rows.push(buildSectionHeaderRow_('🟡 เฝ้าระวัง ' + (settings.redMonths + 1) + '-' + settings.yellowMonths + ' เดือน (' + yellow.length + ' รายการ)', '#a97511')); yellow.forEach(({ item, diffDays, months }) => rows.push(buildCompactRow_(item, 'yellow', diffDays, months))); }
  const rowChunks = [];
  for (let i = 0; i < rows.length; i += ITEMS_PER_BUBBLE) { rowChunks.push(rows.slice(i, i + ITEMS_PER_BUBBLE)); }
  if (rowChunks.length === 0) rowChunks.push([]);
  const bubbles = rowChunks.map((chunk, idx) => idx === 0 ? buildSummaryBubble_(expired, red, yellow, dateStr, chunk, rowChunks.length, settings) : buildContinuationBubble_(chunk, idx + 1, rowChunks.length));
  const messages = [];
  for (let i = 0; i < bubbles.length; i += BUBBLES_PER_CAROUSEL) {
    const group = bubbles.slice(i, i + BUBBLES_PER_CAROUSEL);
    if (group.length === 1) messages.push({ type: 'flex', altText: '💊 แจ้งเตือนระบบยา', contents: group[0] });
    else messages.push({ type: 'flex', altText: '💊 แจ้งเตือนระบบยา (' + group.length + ' หน้า)', contents: { type: 'carousel', contents: group } });
  }
  return messages;
}
function buildSectionHeaderRow_(label, color) { return { type: 'box', layout: 'vertical', margin: 'lg', spacing: 'xs', contents: [{ type: 'separator' }, { type: 'text', text: label, size: 'sm', weight: 'bold', color: color, margin: 'sm' }] }; }
function buildCompactRow_(item, status, diffDays, months) { let icon, statusText, statusColor; if (status === 'expired') { icon = '❌'; statusText = 'หมดอายุแล้ว ' + Math.abs(diffDays) + ' วัน'; statusColor = '#7a1f1f'; } else if (status === 'red') { icon = '🔴'; statusText = 'เหลือ ' + months + ' ด. (' + diffDays + ' วัน)'; statusColor = '#d64545'; } else { icon = '🟡'; statusText = 'เหลือ ' + months + ' ด. (' + diffDays + ' วัน)'; statusColor = '#a97511'; } const medName = item['ชื่อยา'] || '(ไม่ระบุชื่อยา)'; return { type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs', contents: [{ type: 'text', text: icon + ' ' + medName, size: 'sm', weight: 'bold', color: statusColor, wrap: true }, { type: 'text', text: statusText + ' • หมดอายุ ' + (item['วันหมดอายุ'] || '-') + ' • 📍' + (item['ที่จัดเก็บ'] || '-'), size: 'xxs', color: '#888888', wrap: true }] }; }
function buildContinuationBubble_(rows, pageNum, totalPages) { return { type: 'bubble', header: { type: 'box', layout: 'vertical', backgroundColor: '#d64545', paddingAll: 'md', contents: [{ type: 'text', text: '💊 รายการต่อ (' + pageNum + '/' + totalPages + ')', weight: 'bold', size: 'sm', color: '#ffffff' }] }, body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: rows.length > 0 ? rows : [{ type: 'text', text: '-', size: 'sm', color: '#999999' }] } }; }
function buildSummaryBubble_(expired, red, yellow, dateStr, medicineBoxes, totalPages, settings) { const countRow = { type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md', contents: [{ type: 'text', text: '❌ ' + expired.length, size: 'sm', weight: 'bold', color: '#7a1f1f', flex: 0 }, { type: 'text', text: '🔴 ' + red.length, size: 'sm', weight: 'bold', color: '#d64545', flex: 0 }, { type: 'text', text: '🟡 ' + yellow.length, size: 'sm', weight: 'bold', color: '#a97511', flex: 0 }] }; return { type: 'bubble', header: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#d64545', paddingAll: 'md', contents: [{ type: 'text', text: '💊 แจ้งเตือนระบบยา ⚠️', weight: 'bold', size: 'lg', color: '#ffffff' }, { type: 'text', text: 'สรุปสถานะยาใกล้หมดอายุ', size: 'xs', color: '#ffffff', margin: 'sm' }] }, body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [{ type: 'box', layout: 'horizontal', spacing: 'md', contents: [{ type: 'text', text: '📅 ตรวจสอบวันที่:', size: 'sm', color: '#666666', flex: 0 }, { type: 'text', text: dateStr, size: 'sm', weight: 'bold', color: '#333333', flex: 5 }] }, countRow, { type: 'separator', margin: 'md' }, { type: 'text', text: '📋 รายการตรวจสอบ', size: 'sm', weight: 'bold', color: '#333333', margin: 'md' }, { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: medicineBoxes.length > 0 ? medicineBoxes : [{ type: 'text', text: '✅ ไม่มียาที่ใกล้หมดอายุ', size: 'sm', color: '#2f9e6f', align: 'center' }] }, totalPages > 1 ? { type: 'text', text: '📄 หน้า 1/' + totalPages + ' — เลื่อนดูรายการที่เหลือในหน้าถัดไปของข้อความนี้ได้เลย', size: 'xs', color: '#999999', margin: 'md', align: 'center' } : null].filter(Boolean) }, footer: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#f5fbfa', paddingAll: 'sm', contents: [{ type: 'text', text: '📱 ตรวจสอบระบบบริหารยาเพื่อการจัดการที่ดีขึ้น', size: 'xs', color: '#999999', align: 'center' }] } }; }

function sendLineFlexMessages_(flexMessages) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const targetId = props.getProperty('LINE_TARGET_ID');
  if (!token || !targetId) { Logger.log('❌ ข้อผิดพลาด: ยังไม่ได้ตั้งค่า LINE credentials'); return false; }
  const MESSAGES_PER_PUSH = 5;
  const url = 'https://api.line.me/v2/bot/message/push';
  for (let i = 0; i < flexMessages.length; i += MESSAGES_PER_PUSH) {
    const batch = flexMessages.slice(i, i + MESSAGES_PER_PUSH);
    const payload = { to: targetId, messages: batch };
    const options = { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(payload), muteHttpExceptions: true };
    try {
      const res = UrlFetchApp.fetch(url, options);
      if (res.getResponseCode() === 200) Logger.log('✅ ส่ง Flex Message LINE สำเร็จ (' + batch.length + ' ข้อความ)');
      else Logger.log('⚠️ LINE API response: ' + res.getResponseCode() + ' ' + res.getContentText());
    } catch (err) { Logger.log('❌ ข้อผิดพลาด: ' + err.toString()); }
  }
  return true;
}

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'checkExpiryAndNotify') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkExpiryAndNotify').timeBased().everyDays(1).atHour(8).create();
  Logger.log('✅ ตั้งเวลาแจ้งเตือนอัตโนมัติทุกวัน 08:00 น. เรียบร้อยแล้ว');
}
