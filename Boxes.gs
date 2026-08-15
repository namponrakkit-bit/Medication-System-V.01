/**
 * ==============================================================
 *  Boxes.gs — RxEbox: ระบบจัดการกล่องยาฉุกเฉิน
 *  (กล่อง + รายการยาในกล่อง + ประวัติการเคลื่อนย้าย)
 * ==============================================================
 */

function getBoxesData() {
  const sheet = getBoxSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values.shift();
  return values.map(row => rowToObject_(headers, row));
}

function createBox(payload, actorName, actorPosition) {
  const sheet = getBoxSheet_();
  const now = new Date();
  const boxId = 'BOX-' + now.getTime();
  const qrToken = makeUniqueBoxQrToken_(boxId);
  const status = payload.department === 'ห้องยา' ? 'พร้อมจ่าย' : 'อยู่ที่แผนก';
  const actor = resolveActor_(actorName, actorPosition);

  const newRow = [
    boxId, payload.boxNo, payload.department, payload.homeDepartment || payload.department,
    status, '', '', parseInt(payload.alertDaysBefore, 10) || 30,
    qrToken, payload.notes || '', now, now
  ];
  sheet.appendRow(newRow);
  logBoxHistory_(boxId, payload.boxNo, 'สร้างกล่อง', payload.department, actor, 'สร้างกล่องยาใหม่');
  return { success: true, boxId: boxId };
}

function resolveActor_(actorName, actorPosition) {
  if (actorName && actorPosition) return `${actorName} (${actorPosition})`;
  if (actorName) return String(actorName);
  return 'Unknown';
}

function updateBoxDetails(boxId, payload, actorName, actorPosition) {
  payload = payload || {};
  const sheet = getBoxSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const idIdx = headers.indexOf('boxId');
  const boxNoIdx = headers.indexOf('boxNo');
  const deptIdx = headers.indexOf('department');
  const homeDeptIdx = headers.indexOf('homeDepartment');
  const statusIdx = headers.indexOf('status');
  const alertDaysIdx = headers.indexOf('alertDaysBefore');
  const notesIdx = headers.indexOf('notes');
  const updatedAtIdx = headers.indexOf('updatedAt');
  const actor = resolveActor_(actorName, actorPosition);

  for (let i = 0; i < values.length; i++) {
    if (values[i][idIdx].toString() === boxId.toString()) {
      const row = i + 2;
      let boxNo = values[i][boxNoIdx];

      if (payload.boxNo !== undefined) {
        const newBoxNo = String(payload.boxNo || '').trim();
        if (!newBoxNo) throw new Error('กรุณาระบุหมายเลข/ชื่อกล่อง');
        if (newBoxNo !== String(boxNo)) {
          sheet.getRange(row, boxNoIdx + 1).setValue(newBoxNo);
          logBoxHistory_(boxId, newBoxNo, 'แก้ชื่อกล่อง', values[i][deptIdx], actor, `เปลี่ยนจาก "${boxNo}" เป็น "${newBoxNo}"`);
          boxNo = newBoxNo;
        }
      }

      if (payload.homeDepartment !== undefined && homeDeptIdx >= 0) {
        sheet.getRange(row, homeDeptIdx + 1).setValue(payload.homeDepartment);
      }

      if (payload.department !== undefined) {
        const oldDept = values[i][deptIdx];
        const newDept = payload.department;
        if (oldDept !== newDept) {
          const newStatus = newDept === 'ห้องยา' ? 'พร้อมจ่าย' : 'อยู่ที่แผนก';
          sheet.getRange(row, deptIdx + 1).setValue(newDept);
          sheet.getRange(row, statusIdx + 1).setValue(newStatus);
          logBoxHistory_(boxId, boxNo, 'เปลี่ยนแผนก', newDept, actor, `ย้ายจาก ${oldDept} ไป ${newDept}`);
        }
      }

      if (payload.alertDaysBefore !== undefined && alertDaysIdx >= 0) {
        const days = parseInt(payload.alertDaysBefore, 10);
        if (!isNaN(days) && days >= 1) sheet.getRange(row, alertDaysIdx + 1).setValue(days);
      }

      if (payload.notes !== undefined) sheet.getRange(row, notesIdx + 1).setValue(payload.notes);
      sheet.getRange(row, updatedAtIdx + 1).setValue(new Date());
      return { success: true };
    }
  }
  throw new Error('ไม่พบกล่องยาที่ต้องการแก้ไข');
}

function deleteBox(boxId, actor) {
  const sheet = getBoxSheet_();
  const itemsSheet = getBoxItemsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const idIdx = headers.indexOf('boxId');
  const boxNoIdx = headers.indexOf('boxNo');

  for (let i = 0; i < values.length; i++) {
    if (values[i][idIdx].toString() === boxId.toString()) {
      const boxNo = values[i][boxNoIdx];
      sheet.deleteRow(i + 2);

      const itemValues = itemsSheet.getDataRange().getValues();
      let itemRowsToDelete = [];
      for (let j = itemValues.length - 1; j >= 1; j--) {
        if (itemValues[j][0].toString() === boxId.toString()) itemRowsToDelete.push(j + 1);
      }
      itemRowsToDelete.forEach(r => itemsSheet.deleteRow(r));

      logBoxHistory_(boxId, boxNo, 'ลบกล่อง', '-', actor, 'ลบกล่องยาและรายการยาทั้งหมด');
      return { success: true };
    }
  }
  throw new Error('ไม่พบกล่องยาที่ต้องการลบ');
}

function getAdminBoxDetails(boxId) {
  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  let boxInfo = null;
  for (let i = 0; i < boxValues.length; i++) {
    if (boxValues[i][boxHeaders.indexOf('boxId')].toString() === boxId.toString()) {
      boxInfo = rowToObject_(boxHeaders, boxValues[i]);
      break;
    }
  }
  if (!boxInfo) throw new Error('ไม่พบกล่องยา');

  const itemsSheet = getBoxItemsSheet_();
  const itemValues = itemsSheet.getDataRange().getValues();
  const itemHeaders = itemValues.shift();
  const items = [];
  itemValues.forEach(function(row, i) {
    if (row[itemHeaders.indexOf('boxId')].toString() === boxId.toString()) {
      const obj = rowToObject_(itemHeaders, row);
      obj.sheetRow = i + 2;
      items.push(obj);
    }
  });

  const historySheet = getBoxHistorySheet_();
  const histValues = historySheet.getDataRange().getValues();
  const histHeaders = histValues.shift();
  const history = histValues.filter(row => row[histHeaders.indexOf('boxId')].toString() === boxId.toString()).map(row => rowToObject_(histHeaders, row));

  return { box: boxInfo, items: items, history: history };
}

/** สร้าง qrToken ยาวและไม่ซ้ำ — ผูกกับกล่องเดียวเท่านั้น */
function makeUniqueBoxQrToken_(boxId) {
  const existing = collectAllQrTokens_();
  let token = '';
  for (let n = 0; n < 8; n++) {
    token = Utilities.getUuid().replace(/-/g, '').substring(0, 20);
    if (!existing[token]) return token;
  }
  // fallback
  return String(boxId).replace(/[^A-Za-z0-9]/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

function collectAllQrTokens_() {
  const map = {};
  const sheet = getBoxSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return map;
  const headers = values.shift();
  const tokenIdx = headers.indexOf('qrToken');
  if (tokenIdx < 0) return map;
  values.forEach(row => {
    const t = String(row[tokenIdx] || '').trim();
    if (t) map[t] = true;
  });
  return map;
}

/** สร้าง/คืนค่า qrToken ของกล่อง (ว่างหรือซ้ำจะสร้างใหม่ให้) */
function ensureBoxQrToken_(boxId) {
  const sheet = getBoxSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const idIdx = headers.indexOf('boxId');
  const tokenIdx = headers.indexOf('qrToken');
  if (idIdx < 0 || tokenIdx < 0) throw new Error('ชีต Boxes ไม่มีคอลัมน์ที่จำเป็น');

  // นับว่า token ซ้ำกี่กล่อง
  const tokenOwners = {};
  values.forEach((row, i) => {
    const t = String(row[tokenIdx] || '').trim();
    if (!t) return;
    if (!tokenOwners[t]) tokenOwners[t] = [];
    tokenOwners[t].push({ row: i, boxId: String(row[idIdx]) });
  });

  for (let i = 0; i < values.length; i++) {
    if (values[i][idIdx].toString() === boxId.toString()) {
      let token = String(values[i][tokenIdx] || '').trim();
      const owners = token ? (tokenOwners[token] || []) : [];
      const isDuplicate = owners.length > 1;
      if (!token || isDuplicate) {
        token = makeUniqueBoxQrToken_(boxId);
        sheet.getRange(i + 2, tokenIdx + 1).setValue(token);
      }
      return token;
    }
  }
  throw new Error('ไม่พบกล่องยา');
}

/** ข้อมูลฉลาก + URL สำหรับพิมพ์ QR (เฉพาะกล่องนี้) */
function getBoxLabelData(boxId) {
  const details = getAdminBoxDetails(boxId);
  const token = ensureBoxQrToken_(boxId);
  const baseUrl = ScriptApp.getService().getUrl();
  if (!baseUrl) throw new Error('ยังไม่ได้ Deploy เป็น Web App — Deploy ก่อนแล้วลองใหม่');
  // ใส่ทั้ง id + t เพื่อให้สแกนแล้วเปิดได้เฉพาะกล่องนี้เท่านั้น
  const scanUrl = baseUrl +
    '?view=box' +
    '&id=' + encodeURIComponent(String(boxId)) +
    '&t=' + encodeURIComponent(token);
  return {
    boxId: boxId,
    boxNo: details.box.boxNo || '',
    department: details.box.department || '',
    homeDepartment: details.box.homeDepartment || '',
    status: details.box.status || '',
    expiryDate: details.box.expiryDate || '',
    itemCount: (details.items || []).length,
    qrToken: token,
    scanUrl: scanUrl
  };
}

/** QR ทุกกล่อง สำหรับทดสอบสแกน — ไม่ดึงรายการยา */
function getAllBoxLabelData() {
  const boxes = getBoxesData() || [];
  const baseUrl = ScriptApp.getService().getUrl();
  if (!baseUrl) throw new Error('ยังไม่ได้ Deploy เป็น Web App — Deploy ก่อนแล้วลองใหม่');
  return boxes.map(function(box) {
    const boxId = box.boxId;
    const token = ensureBoxQrToken_(boxId);
    return {
      boxId: boxId,
      boxNo: box.boxNo || '',
      department: box.department || '',
      homeDepartment: box.homeDepartment || '',
      status: box.status || '',
      expiryDate: box.expiryDate || '',
      qrToken: token,
      scanUrl: baseUrl +
        '?view=box' +
        '&id=' + encodeURIComponent(String(boxId)) +
        '&t=' + encodeURIComponent(token)
    };
  });
}

/**
 * หา box จาก qrToken (+ boxId ถ้ามี)
 * ต้องตรงกันทั้งคู่ถ้าส่ง id มาด้วย — กันดู/แก้ผิดกล่อง
 */
function findBoxByQrToken_(token, expectedBoxId) {
  token = String(token || '').trim();
  if (!token) throw new Error('ไม่พบรหัส QR');

  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  const tokenIdx = boxHeaders.indexOf('qrToken');
  const idIdx = boxHeaders.indexOf('boxId');
  if (tokenIdx < 0) throw new Error('ชีต Boxes ไม่มีคอลัมน์ qrToken');

  let matched = null;
  for (let i = 0; i < boxValues.length; i++) {
    if (String(boxValues[i][tokenIdx] || '').trim() === token) {
      const boxInfo = rowToObject_(boxHeaders, boxValues[i]);
      matched = { boxInfo: boxInfo, boxId: boxInfo.boxId };
      break;
    }
  }
  if (!matched) throw new Error('ไม่พบกล่องยาจาก QR นี้');

  if (expectedBoxId) {
    const want = String(expectedBoxId).trim();
    if (want && String(matched.boxId) !== want) {
      throw new Error('QR นี้ไม่ตรงกับกล่องที่ระบุ — ดูได้เฉพาะกล่องของ QR นี้เท่านั้น');
    }
  }
  return matched;
}

function resolveMobileActor_(actorName) {
  const name = String(actorName || '').trim();
  if (!name) throw new Error('กรุณาลงชื่อก่อนแก้ไขกล่องยา');
  return name;
}

/** หน้ามือถือเมื่อสแกน QR — เฉพาะกล่องของ token นั้น */
function getPublicBoxByToken(token, boxId) {
  const found = findBoxByQrToken_(token, boxId);
  const boxInfo = found.boxInfo;
  const resolvedId = found.boxId;

  const itemsSheet = getBoxItemsSheet_();
  const itemValues = itemsSheet.getDataRange().getValues();
  const items = [];
  if (itemValues.length > 1) {
    const itemHeaders = itemValues.shift();
    const boxIdIdx = itemHeaders.indexOf('boxId');
    itemValues.forEach((row, i) => {
      if (row[boxIdIdx].toString() === String(resolvedId)) {
        const obj = rowToObject_(itemHeaders, row);
        items.push({
          sheetRow: i + 2,
          drugName: obj.drugName || '',
          unit: obj.unit || '',
          qtyStandard: obj.qtyStandard || '',
          expiryDate: obj.expiryDate || '',
          lastEditedBy: obj.lastEditedBy || '',
          lastEditedAt: obj.lastEditedAt || ''
        });
      }
    });
  }

  return {
    box: {
      boxId: resolvedId,
      boxNo: boxInfo.boxNo,
      department: boxInfo.department,
      homeDepartment: boxInfo.homeDepartment,
      status: boxInfo.status,
      expiryDate: boxInfo.expiryDate || ''
    },
    items: items
  };
}

/** แก้ชื่อ/ข้อมูลกล่องจากมือถือ (ยืนยันด้วย qrToken + boxId) */
function updatePublicBoxByToken(token, payload, actorName, boxId) {
  const found = findBoxByQrToken_(token, boxId);
  return updateBoxDetails(found.boxId, payload || {}, resolveMobileActor_(actorName), '');
}

/** เพิ่มยาในกล่องจากมือถือ */
function addPublicBoxItemByToken(token, payload, actorName, boxId) {
  const found = findBoxByQrToken_(token, boxId);
  return addAdminBoxItem(found.boxId, payload || {}, resolveMobileActor_(actorName));
}

/** แก้รายการยาจากมือถือ */
function updatePublicBoxItemByToken(token, sheetRow, payload, actorName, boxId) {
  const found = findBoxByQrToken_(token, boxId);
  return updateAdminBoxItem(found.boxId, sheetRow, payload || {}, resolveMobileActor_(actorName));
}

/** ลบรายการยาจากมือถือ */
function deletePublicBoxItemByToken(token, sheetRow, actorName, boxId) {
  const found = findBoxByQrToken_(token, boxId);
  return deleteAdminBoxItem(found.boxId, sheetRow, resolveMobileActor_(actorName));
}

function recomputeBoxExpiry_(boxId) {
  const sheet = getBoxItemsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const expIdx = headers.indexOf('expiryDate');
  const boxIdIdx = headers.indexOf('boxId');

  let earliestDate = null;
  values.forEach(row => {
    if (row[boxIdIdx].toString() === boxId.toString()) {
      const d = new Date(row[expIdx]);
      if (!isNaN(d.getTime())) {
        if (earliestDate === null || d < earliestDate) earliestDate = d;
      }
    }
  });

  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  const idIdx = boxHeaders.indexOf('boxId');
  const expDateIdx = boxHeaders.indexOf('expiryDate');
  const returnDueIdx = boxHeaders.indexOf('returnDueDate');
  const alertDaysIdx = boxHeaders.indexOf('alertDaysBefore');
  const updatedAtIdx = boxHeaders.indexOf('updatedAt');

  for (let i = 0; i < boxValues.length; i++) {
    if (boxValues[i][idIdx].toString() === boxId.toString()) {
      const alertDays = boxValues[i][alertDaysIdx] || 30;
      const returnDue = earliestDate ? new Date(earliestDate.getTime() - (alertDays * 86400000)) : '';
      boxSheet.getRange(i + 2, expDateIdx + 1).setValue(earliestDate);
      boxSheet.getRange(i + 2, returnDueIdx + 1).setValue(returnDue);
      boxSheet.getRange(i + 2, updatedAtIdx + 1).setValue(new Date());
      break;
    }
  }
}

function addAdminBoxItem(boxId, payload, actor) {
  const sheet = getBoxItemsSheet_();
  const now = new Date();
  sheet.appendRow([boxId, payload.drugName, payload.unit, payload.qtyStandard, payload.expiryDate, actor, now]);
  recomputeBoxExpiry_(boxId);

  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  for (let i = 0; i < boxValues.length; i++) {
    if (boxValues[i][boxHeaders.indexOf('boxId')].toString() === boxId.toString()) {
      logBoxHistory_(boxId, boxValues[i][boxHeaders.indexOf('boxNo')], 'เพิ่มยา', boxValues[i][boxHeaders.indexOf('department')], actor, `เพิ่ม ${payload.drugName} ${payload.qtyStandard} ${payload.unit}`);
      break;
    }
  }
  return { success: true };
}

function updateAdminBoxItem(boxId, rowIndex, payload, actor) {
  const sheet = getBoxItemsSheet_();
  const row = sheet.getRange(rowIndex, 1, 1, BOX_ITEM_HEADERS.length).getValues()[0];
  if (row[0].toString() !== boxId.toString()) throw new Error('Box ID ไม่ตรงกัน');
  const oldName = row[1];

  sheet.getRange(rowIndex, 2).setValue(payload.drugName);
  sheet.getRange(rowIndex, 3).setValue(payload.unit);
  sheet.getRange(rowIndex, 4).setValue(payload.qtyStandard);
  sheet.getRange(rowIndex, 5).setValue(payload.expiryDate);
  sheet.getRange(rowIndex, 6).setValue(actor);
  sheet.getRange(rowIndex, 7).setValue(new Date());

  recomputeBoxExpiry_(boxId);

  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  for (let i = 0; i < boxValues.length; i++) {
    if (boxValues[i][boxHeaders.indexOf('boxId')].toString() === boxId.toString()) {
      const note = (String(oldName) !== String(payload.drugName))
        ? `แก้ยาจาก "${oldName}" เป็น "${payload.drugName}"`
        : `แก้รายการยา ${payload.drugName}`;
      logBoxHistory_(boxId, boxValues[i][boxHeaders.indexOf('boxNo')], 'แก้รายการยา', boxValues[i][boxHeaders.indexOf('department')], actor, note);
      break;
    }
  }
  return { success: true };
}

function deleteAdminBoxItem(boxId, rowIndex, actor) {
  const sheet = getBoxItemsSheet_();
  const row = sheet.getRange(rowIndex, 1, 1, BOX_ITEM_HEADERS.length).getValues()[0];
  if (row[0].toString() !== boxId.toString()) throw new Error('Box ID ไม่ตรงกัน');
  const drugName = row[1];

  sheet.deleteRow(rowIndex);
  recomputeBoxExpiry_(boxId);

  const boxSheet = getBoxSheet_();
  const boxValues = boxSheet.getDataRange().getValues();
  const boxHeaders = boxValues.shift();
  for (let i = 0; i < boxValues.length; i++) {
    if (boxValues[i][boxHeaders.indexOf('boxId')].toString() === boxId.toString()) {
      logBoxHistory_(boxId, boxValues[i][boxHeaders.indexOf('boxNo')], 'ลบยา', boxValues[i][boxHeaders.indexOf('department')], actor, `ลบ ${drugName} ออกจากกล่อง`);
      break;
    }
  }
  return { success: true };
}

function logBoxHistory_(boxId, boxNo, actionType, department, user, notes) {
  const sheet = getBoxHistorySheet_();
  sheet.appendRow([new Date(), boxId, boxNo, actionType, department, user, notes]);
}

/**
 * รายงานรายชื่อผู้แก้ไขกล่องยา (สำหรับแอดมิน)
 * รวมจาก BoxHistory ทั้งระบบ
 */
function getBoxEditorsReport() {
  const sheet = getBoxHistorySheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { editors: [], recent: [] };

  const headers = values.shift();
  const tsIdx = headers.indexOf('timestamp');
  const boxNoIdx = headers.indexOf('boxNo');
  const actionIdx = headers.indexOf('actionType');
  const userIdx = headers.indexOf('user');
  const notesIdx = headers.indexOf('notes');
  const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

  function fmtTs_(v) {
    if (v instanceof Date && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm');
    }
    return v ? String(v) : '';
  }

  const map = {};
  const recent = [];

  values.forEach(row => {
    const name = String(row[userIdx] || '').trim() || 'ไม่ระบุ';
    const tsRaw = row[tsIdx];
    const ts = fmtTs_(tsRaw);
    const action = String(row[actionIdx] || '');
    const boxNo = String(row[boxNoIdx] || '');
    const notes = String(row[notesIdx] || '');
    const tsMs = (tsRaw instanceof Date && !isNaN(tsRaw.getTime())) ? tsRaw.getTime() : 0;

    if (!map[name]) {
      map[name] = {
        name: name,
        count: 0,
        lastAt: '',
        lastAtMs: 0,
        lastAction: '',
        lastBoxNo: '',
        boxes: {}
      };
    }
    const ed = map[name];
    ed.count += 1;
    if (boxNo) ed.boxes[boxNo] = (ed.boxes[boxNo] || 0) + 1;
    if (tsMs >= ed.lastAtMs) {
      ed.lastAtMs = tsMs;
      ed.lastAt = ts;
      ed.lastAction = action;
      ed.lastBoxNo = boxNo;
    }

    recent.push({
      timestamp: ts,
      timestampMs: tsMs,
      user: name,
      actionType: action,
      boxNo: boxNo,
      notes: notes
    });
  });

  const editors = Object.keys(map).map(k => {
    const ed = map[k];
    const boxList = Object.keys(ed.boxes).sort();
    return {
      name: ed.name,
      count: ed.count,
      lastAt: ed.lastAt,
      lastAction: ed.lastAction,
      lastBoxNo: ed.lastBoxNo,
      boxCount: boxList.length,
      boxes: boxList
    };
  }).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'th');
  });

  recent.sort((a, b) => b.timestampMs - a.timestampMs);

  return {
    editors: editors,
    recent: recent.slice(0, 80).map(r => ({
      timestamp: r.timestamp,
      user: r.user,
      actionType: r.actionType,
      boxNo: r.boxNo,
      notes: r.notes
    }))
  };
}
