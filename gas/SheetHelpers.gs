/**
 * ==============================================================
 *  SheetHelpers.gs — เปิด Spreadsheet / Sheet และแปลงแถวเป็น object
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
