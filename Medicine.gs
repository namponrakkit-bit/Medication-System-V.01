/**
 * ==============================================================
 *  Medicine.gs — คลังยาหลัก: อ่าน / เพิ่ม / แก้ไข / ลบ
 *  + getInitialData() ที่หน้าเว็บเรียกตอนเปิด
 *  + getMedicineStats() / searchMedicines() สำหรับข้อมูลจำนวนมาก
 * ==============================================================
 */

var MEDICINES_CACHE_KEY_ = 'meds:v1';
var MEDICINES_CACHE_TTL_SEC_ = 90;
var medicinesMemo_ = null;

function invalidateMedicinesCache_() {
  medicinesMemo_ = null;
  try {
    CacheService.getScriptCache().remove(MEDICINES_CACHE_KEY_);
  } catch (e) {}
}

function readMedicinesFromSheet_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return [];
  const headers = values.shift();
  return values
    .filter(row => row[0] !== '' && row[0] !== null)
    .map(row => rowToObject_(headers, row));
}

function getAllMedicines() {
  if (medicinesMemo_ !== null) return medicinesMemo_;

  try {
    const cached = CacheService.getScriptCache().get(MEDICINES_CACHE_KEY_);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        medicinesMemo_ = parsed;
        return medicinesMemo_;
      }
    }
  } catch (e) {}

  medicinesMemo_ = readMedicinesFromSheet_();
  try {
    CacheService.getScriptCache().put(
      MEDICINES_CACHE_KEY_,
      JSON.stringify(medicinesMemo_),
      MEDICINES_CACHE_TTL_SEC_
    );
  } catch (e) {
    // ข้ามถ้าเกิน 100KB ต่อคีย์ — ยังใช้ memo ในคำขอนี้ได้
  }
  return medicinesMemo_;
}

function getCatalogFromMeds_() {
  const all = getAllMedicines();
  const map = new Map();
  all.forEach(m => {
    const name = (m['ชื่อยา'] || '').toString().trim();
    if (name && !map.has(name)) {
      map.set(name, {
        'ชื่อยา': name,
        'ชื่อสามัญ': m['ชื่อสามัญ'] || '',
        'หมวดหมู่': m['หมวดหมู่'] || '',
        'หน่วย': m['หน่วย'] || '',
        'ราคา/หน่วย': m['ราคา/หน่วย'] || ''
      });
    }
  });
  return Array.from(map.values());
}

function getInitialData() {
  const firstPage = searchMedicines({ page: 1, pageSize: 50 });
  return {
    medicines: firstPage.items,
    medicineTotal: firstPage.total,
    medicinePage: firstPage.page,
    medicineTotalPages: firstPage.totalPages,
    options: getOptions(),
    catalog: getCatalogFromMeds_(),
    settings: getClientSettings_(),
    currentUser: getCurrentUser(),
    stats: firstPage.stats || getMedicineStats()
  };
}

/* -------------------- Write path (ต้องเป็นแอดมิน) -------------------- */

function findRowIndexByCode_(sheet, code) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] !== '' && values[i][0] !== null && values[i][0].toString() === code.toString()) {
      return i + 1;
    }
  }
  return -1;
}

function sanitizeMedicineData_(data) {
  data = data || {};
  const name = (data['ชื่อยา'] || '').toString().trim();
  if (!name) throw new Error('กรุณาระบุชื่อยา');
  return data;
}

function addMedicine(data, actorName, actorPosition) {
  data = sanitizeMedicineData_(data);
  const sheet = getSheet_();
  let code = (data['รหัสยา'] || '').toString().trim();
  if (!code) code = 'MED-' + new Date().getTime();
  if (findRowIndexByCode_(sheet, code) !== -1) throw new Error('รหัสยา "' + code + '" มีอยู่แล้วในระบบ');

  const row = DEFAULT_HEADERS.map(h => (h === 'รหัสยา') ? code : (data[h] !== undefined ? data[h] : ''));
  sheet.appendRow(row);
  invalidateMedicinesCache_();

  logChange_('เพิ่ม', code, data['ชื่อยา'], 'เพิ่มยาใหม่เข้าสต็อก จำนวน ' + (data['จำนวนคงเหลือ'] || 0) + ' ' + (data['หน่วย'] || ''), actorName, actorPosition);
  return { success: true, code: code };
}

function updateMedicine(originalCode, data, actorName, actorPosition) {
  data = sanitizeMedicineData_(data);
  const sheet = getSheet_();
  const rowIndex = findRowIndexByCode_(sheet, originalCode);
  if (rowIndex === -1) throw new Error('ไม่พบรายการยาที่ต้องการแก้ไข');

  const newCode = (data['รหัสยา'] || originalCode).toString().trim() || originalCode;
  if (newCode !== originalCode.toString() && findRowIndexByCode_(sheet, newCode) !== -1) throw new Error('รหัสยาใหม่ "' + newCode + '" ซ้ำกับรายการอื่น');

  const row = DEFAULT_HEADERS.map(h => (h === 'รหัสยา') ? newCode : (data[h] !== undefined ? data[h] : ''));
  sheet.getRange(rowIndex, 1, 1, DEFAULT_HEADERS.length).setValues([row]);
  invalidateMedicinesCache_();
  logChange_('แก้ไข', newCode, data['ชื่อยา'], 'แก้ไขข้อมูลยา (รหัสเดิม: ' + originalCode + ')', actorName, actorPosition);
  return { success: true, code: newCode };
}

function deleteMedicine(code, actorName, actorPosition) {
  const sheet = getSheet_();
  const rowIndex = findRowIndexByCode_(sheet, code);
  if (rowIndex === -1) throw new Error('ไม่พบรายการยาที่ต้องการลบ');

  const values = sheet.getRange(rowIndex, 1, 1, DEFAULT_HEADERS.length).getValues()[0];
  const name = values[1];
  sheet.deleteRow(rowIndex);
  invalidateMedicinesCache_();
  logChange_('ลบ', code, name, 'ลบรายการยาออกจากระบบ', actorName, actorPosition);
  return { success: true };
}

// logChange_ ใหม่: รับข้อมูลผู้ใช้จากพารามิเตอร์ (ส่งมาจาก frontend)
function logChange_(action, code, name, detail, actorName, actorPosition) {
  const sheet = getLogSheet_();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const actor = (actorName && actorPosition) ? `${actorName} (${actorPosition})` : 'Unknown';
  sheet.appendRow([now, action, code, name, detail, actor, 'บันทึกแล้ว']);
}

/* ==================================================================
 *  API สำหรับข้อมูลจำนวนมาก (Phase 3) — แยก "สถิติ" กับ "รายการ"
 *  ยังไม่ถูกเรียกใช้โดย frontend ในตอนนี้ (คลังยายังไม่ใหญ่)
 *  พร้อมสลับมาใช้เมื่อรายการยาเข้าใกล้หลักพันเพื่อลดการโหลดทั้งก้อน
 * ================================================================== */

// สรุปจำนวนยาตามสถานะวันหมดอายุ โดยไม่ต้องส่งรายการทั้งหมดไป frontend
function getMedicineStats() {
  const all = getAllMedicines();
  const stats = { total: all.length, expired: 0, red: 0, yellow: 0, green: 0, nodate: 0 };
  all.forEach(m => {
    const info = getExpiryStatus_(m['วันหมดอายุ']);
    if (info.status === 'expired') stats.expired++;
    else if (info.status === 'red') stats.red++;
    else if (info.status === 'yellow') stats.yellow++;
    else if (info.status === 'green') stats.green++;
    else stats.nodate++;
  });
  return stats;
}

// ค้นหา + กรอง + แบ่งหน้าฝั่ง server คืนหน้าละ pageSize รายการ
function searchMedicines(params) {
  params = params || {};
  const page = Math.max(parseInt(params.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(params.pageSize, 10) || 50, 1), 200);
  const q = (params.q || '').toString().trim().toLowerCase();
  const category = (params.category || '').toString();
  const location = (params.location || '').toString();
  const expiry = (params.expiry || '').toString();
  const hadOnly = params.had === 'had' || params.had === true;

  const filtered = getAllMedicines().filter(item => {
    if (location && item['ที่จัดเก็บ'] !== location) return false;
    if (category && item['หมวดหมู่'] !== category) return false;
    if (q) {
      const match = Object.keys(item).some(key => {
        const v = item[key];
        return v !== null && v !== undefined && v.toString().toLowerCase().indexOf(q) !== -1;
      });
      if (!match) return false;
    }
    if (expiry) {
      const info = getExpiryStatus_(item['วันหมดอายุ']);
      if (info.status !== expiry) return false;
    }
    if (hadOnly && !isHighAlertDrug_(item)) return false;
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: total,
    page: page,
    pageSize: pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    stats: getMedicineStats()
  };
}

// ตรวจ High Alert Drug ฝั่ง server (mirror ของ isHighAlertDrug ใน frontend)
function isHighAlertDrug_(item) {
  const fields = [item['ชื่อยา'], item['ชื่อสามัญ'], item['หมวดหมู่']];
  return fields.some(v => {
    if (!v) return false;
    const s = v.toString();
    return /\bHAD\b/i.test(s) || /high[\s-]?alert/i.test(s);
  });
}
