/**
 * ==============================================================
 *  Config.gs — ค่าคงที่ของทั้งระบบ (ชื่อชีต / หัวตาราง / ค่าคงที่ LINE)
 *  ทุกไฟล์ .gs ใช้ global scope ร่วมกัน จึงอ้างถึงค่าเหล่านี้ได้ทุกไฟล์
 * ==============================================================
 */

const SHEET_NAME = 'MedicineList';
const OPTIONS_SHEET_NAME = 'Options';
const LOG_SHEET_NAME = 'ChangeLog';
const USERS_SHEET_NAME = 'Users';
const USER_HEADERS = ['name', 'position'];

// RxEbox Sheets
const BOX_SHEET_NAME = 'Boxes';
const BOX_ITEMS_SHEET_NAME = 'BoxItems';
const BOX_HISTORY_SHEET_NAME = 'BoxHistory';

const DEFAULT_HEADERS = [
  'รหัสยา', 'ชื่อยา', 'ชื่อสามัญ', 'หมวดหมู่', 'จำนวนคงเหลือ',
  'หน่วย', 'วันหมดอายุ', 'Lot No.', 'ที่จัดเก็บ', 'ราคา/หน่วย'
];
const LOG_HEADERS = ['เวลา', 'การกระทำ', 'รหัสยา', 'ชื่อยา', 'รายละเอียด', 'ผู้ทำรายการ', 'สถานะแจ้งเตือน'];

const BOX_HEADERS = [
  'boxId', 'boxNo', 'department', 'homeDepartment', 'status',
  'expiryDate', 'returnDueDate', 'alertDaysBefore', 'qrToken', 'notes', 'createdAt', 'updatedAt'
];
const BOX_ITEM_HEADERS = ['boxId', 'drugName', 'unit', 'qtyStandard', 'expiryDate', 'lastEditedBy', 'lastEditedAt'];
const BOX_HISTORY_HEADERS = ['timestamp', 'boxId', 'boxNo', 'actionType', 'department', 'user', 'notes'];

// LINE Flex Message
const ITEMS_PER_BUBBLE = 40;
const BUBBLES_PER_CAROUSEL = 12;

/**
 * ==============================================================
 *  Sheet Helper Functions (inline ใน Config เพื่อ load ก่อน)
 * ==============================================================
 */

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  return sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheet_() { return getOrCreateSheet_(SHEET_NAME, DEFAULT_HEADERS); }
function getOptionsSheet_() { return getOrCreateSheet_(OPTIONS_SHEET_NAME, ['หมวดหมู่', 'ที่จัดเก็บ']); }
function getLogSheet_() { return getOrCreateSheet_(LOG_SHEET_NAME, LOG_HEADERS); }
function getBoxSheet_() { return getOrCreateSheet_(BOX_SHEET_NAME, BOX_HEADERS); }
function getBoxItemsSheet_() { return getOrCreateSheet_(BOX_ITEMS_SHEET_NAME, BOX_ITEM_HEADERS); }
function getBoxHistorySheet_() { return getOrCreateSheet_(BOX_HISTORY_SHEET_NAME, BOX_HISTORY_HEADERS); }

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    let val = row[i];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    obj[h] = val;
  });
  return obj;
}
