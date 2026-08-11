/**
 * demo.js — end-to-end "hello world" for the Medication System.
 *
 * Loads the real `.gs` server code into the local Apps Script emulation
 * (tools/gas-runtime.js) and drives the core flows of both product modules:
 *
 *   1. Main Medicine Inventory  — add / list / search / stats / expiry status /
 *                                 update / delete + change log
 *   2. RxEbox Emergency Boxes   — create box (+QR token) / add item / print
 *                                 label data / scan-by-QR lookup
 *   3. Web entry point          — doGet() renders Index with include()s resolved
 *
 * Assertions make this usable as a smoke test (`npm test`).
 */

'use strict';

const assert = require('assert');
const { loadProject } = require('./gas-runtime');

/* --------------------------- small helpers ------------------------------ */

let sectionNo = 0;
function section(title) {
  sectionNo += 1;
  console.log(`\n=== ${sectionNo}. ${title} ===`);
}

function pass(msg) {
  console.log(`   \u2713 ${msg}`);
}

// yyyy-MM-dd for `days` from now (UTC-based; gaps are large so TZ is irrelevant).
function dateInDays(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/* -------------------------------- run ----------------------------------- */

function main() {
  const project = loadProject();
  const { call } = project;

  console.log('Loaded Google Apps Script project files:');
  console.log('   ' + project.files.join(', '));

  // ---- Configure script properties (like Project Settings > Script props) --
  project.scriptProps.set('RED_MONTHS', '4');
  project.scriptProps.set('YELLOW_MONTHS', '8');
  project.scriptProps.set('WEB_APP_URL', 'https://script.google.com/macros/s/LOCALDEV/exec');

  const actor = ['สมชาย ใจดี', 'เภสัชกร']; // name, position

  /* ============================ MODULE 1 ================================ */
  section('Inventory: dropdown options');
  call('addOption', 'category', 'ยาฉีด');
  call('addOption', 'category', 'ยาเม็ด');
  call('addOption', 'location', 'ตู้เย็น A');
  const options = call('getOptions');
  // Values returned from the VM context have a different Array prototype, so
  // compare by value (JSON) rather than with deepStrictEqual.
  assert.strictEqual(JSON.stringify(options.categories.slice().sort()), JSON.stringify(['ยาฉีด', 'ยาเม็ด']));
  pass(`categories=${JSON.stringify(options.categories)} locations=${JSON.stringify(options.locations)}`);

  section('Inventory: add medicines (varied expiry)');
  const meds = [
    { 'รหัสยา': 'MED-001', 'ชื่อยา': 'Paracetamol 500mg', 'ชื่อสามัญ': 'Paracetamol', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 1200, 'หน่วย': 'เม็ด', 'วันหมดอายุ': dateInDays(420), 'ที่จัดเก็บ': 'ตู้เย็น A' },
    { 'รหัสยา': 'MED-002', 'ชื่อยา': 'Adrenaline (HAD)', 'ชื่อสามัญ': 'Epinephrine', 'หมวดหมู่': 'ยาฉีด', 'จำนวนคงเหลือ': 30, 'หน่วย': 'amp', 'วันหมดอายุ': dateInDays(60), 'ที่จัดเก็บ': 'ตู้เย็น A' },
    { 'รหัสยา': 'MED-003', 'ชื่อยา': 'Amoxicillin 250mg', 'ชื่อสามัญ': 'Amoxicillin', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 500, 'หน่วย': 'แคปซูล', 'วันหมดอายุ': dateInDays(200), 'ที่จัดเก็บ': 'ตู้เย็น A' },
    { 'รหัสยา': 'MED-004', 'ชื่อยา': 'Old Aspirin', 'ชื่อสามัญ': 'Aspirin', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 10, 'หน่วย': 'เม็ด', 'วันหมดอายุ': dateInDays(-15), 'ที่จัดเก็บ': 'ตู้เย็น A' },
  ];
  meds.forEach((m) => {
    const res = call('addMedicine', m, actor[0], actor[1]);
    assert.strictEqual(res.success, true);
  });
  const all = call('getAllMedicines');
  assert.strictEqual(all.length, 4);
  pass(`added ${all.length} medicines`);

  section('Inventory: expiry-status classification');
  const cases = [
    ['MED-001', 'green'],
    ['MED-002', 'red'],
    ['MED-003', 'yellow'],
    ['MED-004', 'expired'],
  ];
  const byCode = Object.fromEntries(all.map((m) => [m['รหัสยา'], m]));
  cases.forEach(([code, expected]) => {
    const info = call('getExpiryStatus_', byCode[code]['วันหมดอายุ']);
    assert.strictEqual(info.status, expected, `${code} expected ${expected} got ${info.status}`);
    pass(`${code} (${byCode[code]['วันหมดอายุ']}) -> ${info.status} (${info.diffDays} days)`);
  });

  section('Inventory: stats');
  const stats = call('getMedicineStats');
  assert.strictEqual(
    JSON.stringify(stats),
    JSON.stringify({ total: 4, expired: 1, red: 1, yellow: 1, green: 1, nodate: 0 })
  );
  pass(JSON.stringify(stats));

  section('Inventory: search + filters');
  const searchAll = call('searchMedicines', { page: 1, pageSize: 10 });
  assert.strictEqual(searchAll.total, 4);
  const hadOnly = call('searchMedicines', { had: 'had' });
  assert.strictEqual(hadOnly.total, 1);
  assert.strictEqual(hadOnly.items[0]['รหัสยา'], 'MED-002');
  pass(`full search total=${searchAll.total}; High-Alert-Drug filter -> ${hadOnly.items[0]['ชื่อยา']}`);
  const byText = call('searchMedicines', { q: 'amox' });
  assert.strictEqual(byText.total, 1);
  pass(`text search "amox" -> ${byText.items[0]['ชื่อยา']}`);

  section('Inventory: update + delete');
  call('updateMedicine', 'MED-001', Object.assign({}, meds[0], { 'จำนวนคงเหลือ': 999 }), actor[0], actor[1]);
  const afterUpdate = call('getAllMedicines').find((m) => m['รหัสยา'] === 'MED-001');
  assert.strictEqual(Number(afterUpdate['จำนวนคงเหลือ']), 999);
  pass('updated MED-001 quantity -> 999');
  call('deleteMedicine', 'MED-004', actor[0], actor[1]);
  assert.strictEqual(call('getAllMedicines').length, 3);
  pass('deleted MED-004 (expired) -> 3 medicines remain');

  section('Inventory: CSV export of expiring medicines');
  const csv = call('exportExpiringMedicinesCSV');
  assert.ok(csv.filename.endsWith('.csv'));
  assert.ok(csv.count >= 1);
  pass(`export file="${csv.filename}" rows=${csv.count}`);

  /* ============================ MODULE 2 ================================ */
  section('RxEbox: create emergency box (auto QR token)');
  const created = call('createBox', { boxNo: 'CART-ER-01', department: 'ห้องฉุกเฉิน', notes: 'รถ Emergency ER' }, actor[0], actor[1]);
  assert.strictEqual(created.success, true);
  assert.ok(created.qrToken && created.qrToken.length > 0);
  pass(`boxId=${created.boxId} qrToken=${created.qrToken}`);

  section('RxEbox: add items to box');
  call('addAdminBoxItem', created.boxId, { drugName: 'Adrenaline', unit: 'amp', qtyStandard: 5, expiryDate: dateInDays(90) }, 'สมชาย (เภสัชกร)');
  call('addAdminBoxItem', created.boxId, { drugName: 'Atropine', unit: 'amp', qtyStandard: 3, expiryDate: dateInDays(150) }, 'สมชาย (เภสัชกร)');
  const details = call('getAdminBoxDetails', created.boxId);
  assert.strictEqual(details.items.length, 2);
  pass(`box "${details.box.boxNo}" now has ${details.items.length} items; status=${details.box.status}`);

  section('RxEbox: printable QR label data');
  const label = call('getBoxLabelData', created.boxId);
  assert.strictEqual(label.qrToken, created.qrToken);
  assert.ok(label.scanUrl.includes('qr='), 'label scanUrl should carry ?qr=');
  pass(`label boxNo=${label.boxNo} scanUrl=${label.scanUrl}`);
  const allLabels = call('getAllBoxLabelData');
  assert.strictEqual(allLabels.labels.length, 1);
  pass(`getAllBoxLabelData -> ${allLabels.labels.length} label(s), webAppUrl=${allLabels.webAppUrl}`);

  section('RxEbox: scan QR -> resolve box');
  const scanned = call('findBoxByQrToken', 'RXEBOX:' + created.qrToken);
  assert.strictEqual(scanned.boxId, created.boxId);
  pass(`scanning token resolved to boxId=${scanned.boxId} (boxNo=${scanned.box.boxNo})`);

  /* ============================ ENTRY POINT ============================= */
  section('Web app entry point: doGet() renders Index');
  const output = call('doGet', { parameter: { view: 'box' } });
  const html = output.getContent();
  assert.ok(html.length > 1000, 'rendered HTML should be non-trivial');
  assert.ok(/<html|<body|<!DOCTYPE/i.test(html), 'looks like an HTML document');
  pass(`doGet returned ${html.length} bytes of HTML (include()s resolved)`);

  /* ============================ AUDIT TRAIL ============================= */
  section('Audit trail (ChangeLog + BoxHistory)');
  const changeLog = project.spreadsheet.getSheetByName('ChangeLog');
  const boxHistory = project.spreadsheet.getSheetByName('BoxHistory');
  assert.ok(changeLog.getLastRow() > 1);
  assert.ok(boxHistory.getLastRow() > 1);
  pass(`ChangeLog rows=${changeLog.getLastRow() - 1}, BoxHistory rows=${boxHistory.getLastRow() - 1}`);

  console.log('\nSheets created in the mock spreadsheet:');
  console.log('   ' + [...project.spreadsheet.sheets.keys()].join(', '));

  console.log('\n\u2705 DEMO PASSED — core inventory + RxEbox flows executed end-to-end.');
}

main();
