/**
 * ==============================================================
 *  Options.gs — จัดการหมวดหมู่ / ที่จัดเก็บ (dropdown options)
 * ==============================================================
 */

function getOptions() {
  const sheet = getOptionsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { categories: [], locations: [] };
  values.shift();
  const categories = [], locations = [];
  values.forEach(row => {
    if (row[0]) categories.push(row[0].toString());
    if (row[1]) locations.push(row[1].toString());
  });
  return { categories: categories, locations: locations };
}

function addOption(type, value) {
  value = (value || '').toString().trim();
  if (!value) throw new Error('กรุณาระบุชื่อรายการ');
  const colIndex = (type === 'category') ? 1 : 2;
  const sheet = getOptionsSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][colIndex - 1] && values[i][colIndex - 1].toString().trim().toLowerCase() === value.toLowerCase()) {
      throw new Error('มีรายการ "' + value + '" อยู่แล้ว');
    }
  }
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][colIndex - 1] === '' || values[i][colIndex - 1] === null) { targetRow = i + 1; break; }
  }
  if (targetRow === -1) targetRow = Math.max(values.length + 1, 2);
  sheet.getRange(targetRow, colIndex).setValue(value);
  return getOptions();
}

function deleteOption(type, value) {
  const colIndex = (type === 'category') ? 1 : 2;
  const sheet = getOptionsSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][colIndex - 1] && values[i][colIndex - 1].toString() === value.toString()) {
      sheet.getRange(i + 1, colIndex).clearContent();
      break;
    }
  }
  return getOptions();
}
