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
  const qrToken = Math.random().toString(36).substring(2, 10);
  const status = payload.department === 'ห้องยา' ? 'พร้อมจ่าย' : 'อยู่ที่แผนก';
  const actor = (actorName && actorPosition) ? `${actorName} (${actorPosition})` : 'Unknown';

  const newRow = [
    boxId, payload.boxNo, payload.department, payload.homeDepartment || payload.department,
    status, '', '', parseInt(payload.alertDaysBefore, 10) || 30,
    qrToken, payload.notes || '', now, now
  ];
  sheet.appendRow(newRow);
  logBoxHistory_(boxId, payload.boxNo, 'สร้างกล่อง', payload.department, actor, 'สร้างกล่องยาใหม่');
  return { success: true, boxId: boxId };
}

function updateBoxDetails(boxId, payload, actor) {
  const sheet = getBoxSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const idIdx = headers.indexOf('boxId');
  const deptIdx = headers.indexOf('department');
  const statusIdx = headers.indexOf('status');
  const notesIdx = headers.indexOf('notes');
  const updatedAtIdx = headers.indexOf('updatedAt');

  for (let i = 0; i < values.length; i++) {
    if (values[i][idIdx].toString() === boxId.toString()) {
      const oldDept = values[i][deptIdx];
      const newDept = payload.department;

      if (oldDept !== newDept) {
        const newStatus = newDept === 'ห้องยา' ? 'พร้อมจ่าย' : 'อยู่ที่แผนก';
        sheet.getRange(i + 2, deptIdx + 1).setValue(newDept);
        sheet.getRange(i + 2, statusIdx + 1).setValue(newStatus);
        logBoxHistory_(boxId, values[i][headers.indexOf('boxNo')], 'เปลี่ยนแผนก', newDept, actor, `ย้ายจาก ${oldDept} ไป ${newDept}`);
      }

      if (payload.notes !== undefined) sheet.getRange(i + 2, notesIdx + 1).setValue(payload.notes);
      sheet.getRange(i + 2, updatedAtIdx + 1).setValue(new Date());
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
  const items = itemValues.filter(row => row[itemHeaders.indexOf('boxId')].toString() === boxId.toString()).map(row => rowToObject_(itemHeaders, row));

  const historySheet = getBoxHistorySheet_();
  const histValues = historySheet.getDataRange().getValues();
  const histHeaders = histValues.shift();
  const history = histValues.filter(row => row[histHeaders.indexOf('boxId')].toString() === boxId.toString()).map(row => rowToObject_(histHeaders, row));

  return { box: boxInfo, items: items, history: history };
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

  sheet.getRange(rowIndex, 2).setValue(payload.drugName);
  sheet.getRange(rowIndex, 3).setValue(payload.unit);
  sheet.getRange(rowIndex, 4).setValue(payload.qtyStandard);
  sheet.getRange(rowIndex, 5).setValue(payload.expiryDate);
  sheet.getRange(rowIndex, 6).setValue(actor);
  sheet.getRange(rowIndex, 7).setValue(new Date());

  recomputeBoxExpiry_(boxId);
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
