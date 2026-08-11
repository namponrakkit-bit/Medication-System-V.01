/**
 * serve.js — local preview server for the Medication System web app.
 *
 * Google Apps Script web apps normally run only on Google's servers. This dev
 * server lets you preview the *real* client UI (Index/Styles/Scripts.html) in a
 * normal browser locally by:
 *
 *   - serving the HTML produced by the project's real doGet() entry point, and
 *   - shimming the client-side `google.script.run` bridge so every
 *     `.withSuccessHandler(...).someFn(args)` call is POSTed to /__call and
 *     executed against the real `.gs` server functions loaded into the local
 *     Apps Script emulation (tools/gas-runtime.js).
 *
 * State lives in the in-memory mock spreadsheet and is seeded with sample data
 * on startup. This is a development aid only; it is NOT the deployed app.
 *
 * Usage:  node tools/serve.js [port]   (default port 3000)
 */

'use strict';

const http = require('http');
const { loadProject } = require('./gas-runtime');

const PORT = parseInt(process.argv[2], 10) || 3000;
const project = loadProject();
const { call } = project;

/* ------------------------------- seed data ------------------------------ */

function dateInDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function seed() {
  project.scriptProps.set('RED_MONTHS', '4');
  project.scriptProps.set('YELLOW_MONTHS', '8');
  project.scriptProps.set('WEB_APP_URL', `http://localhost:${PORT}/`);

  const actor = ['สมชาย ใจดี', 'เภสัชกร'];
  ['ยาเม็ด', 'ยาฉีด', 'ยาน้ำ'].forEach((c) => call('addOption', 'category', c));
  ['ตู้เย็น A', 'ชั้นวาง B', 'ห้องฉุกเฉิน'].forEach((l) => call('addOption', 'location', l));

  [
    { 'รหัสยา': 'MED-001', 'ชื่อยา': 'Paracetamol 500mg', 'ชื่อสามัญ': 'Paracetamol', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 1200, 'หน่วย': 'เม็ด', 'วันหมดอายุ': dateInDays(420), 'ที่จัดเก็บ': 'ชั้นวาง B', 'ราคา/หน่วย': 0.5 },
    { 'รหัสยา': 'MED-002', 'ชื่อยา': 'Adrenaline (HAD)', 'ชื่อสามัญ': 'Epinephrine', 'หมวดหมู่': 'ยาฉีด', 'จำนวนคงเหลือ': 30, 'หน่วย': 'amp', 'วันหมดอายุ': dateInDays(60), 'ที่จัดเก็บ': 'ตู้เย็น A', 'ราคา/หน่วย': 25 },
    { 'รหัสยา': 'MED-003', 'ชื่อยา': 'Amoxicillin 250mg', 'ชื่อสามัญ': 'Amoxicillin', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 500, 'หน่วย': 'แคปซูล', 'วันหมดอายุ': dateInDays(200), 'ที่จัดเก็บ': 'ชั้นวาง B', 'ราคา/หน่วย': 2 },
    { 'รหัสยา': 'MED-004', 'ชื่อยา': 'Old Aspirin 300mg', 'ชื่อสามัญ': 'Aspirin', 'หมวดหมู่': 'ยาเม็ด', 'จำนวนคงเหลือ': 10, 'หน่วย': 'เม็ด', 'วันหมดอายุ': dateInDays(-15), 'ที่จัดเก็บ': 'ชั้นวาง B', 'ราคา/หน่วย': 1 },
  ].forEach((m) => call('addMedicine', m, actor[0], actor[1]));

  const box = call('createBox', { boxNo: 'CART-ER-01', department: 'ห้องฉุกเฉิน', notes: 'รถ Emergency ER' }, actor[0], actor[1]);
  call('addAdminBoxItem', box.boxId, { drugName: 'Adrenaline', unit: 'amp', qtyStandard: 5, expiryDate: dateInDays(90) }, 'สมชาย (เภสัชกร)');
  call('addAdminBoxItem', box.boxId, { drugName: 'Atropine', unit: 'amp', qtyStandard: 3, expiryDate: dateInDays(150) }, 'สมชาย (เภสัชกร)');
}

seed();

/* ---------------------- google.script.run shim -------------------------- */

const SHIM = `
<script>
(function () {
  window.google = window.google || {};
  google.script = google.script || {};
  function makeRunner() {
    var succ = null, fail = null;
    var proxy = new Proxy({}, {
      get: function (t, prop) {
        if (prop === 'withSuccessHandler') return function (f) { succ = f; return proxy; };
        if (prop === 'withFailureHandler') return function (f) { fail = f; return proxy; };
        if (prop === 'withUserObject') return function () { return proxy; };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          fetch('/__call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fn: String(prop), args: args })
          }).then(function (r) { return r.json(); })
            .then(function (res) {
              if (res.ok) { if (succ) succ(res.result); }
              else { var e = new Error(res.error || 'server error'); if (fail) fail(e); else console.error(e); }
            })
            .catch(function (e) { if (fail) fail(e); else console.error(e); });
          return undefined;
        };
      }
    });
    return proxy;
  }
  Object.defineProperty(google.script, 'run', { configurable: true, get: makeRunner });
  google.script.host = google.script.host || {
    close: function () {}, setWidth: function () {}, setHeight: function () {},
    editor: { focus: function () {} }
  };
})();
</script>
`;

function renderPage(query) {
  const output = call('doGet', { parameter: query });
  let html = output.getContent();

  // Resolve the one non-include scriptlet the app uses for bootstrap params.
  const init = JSON.stringify({ qr: query.qr || '', view: query.view || '' });
  html = html.replace(/<\?!?=?[\s\S]*?RXEBOX_INIT[\s\S]*?\?>/, init);
  html = html.replace(/window\.__RXEBOX_INIT__\s*=\s*<\?[\s\S]*?\?>\s*;/, `window.__RXEBOX_INIT__ = ${init};`);

  // Strip any remaining scriptlets so the browser never sees raw <? ... ?>.
  html = html.replace(/<\?[\s\S]*?\?>/g, '');

  // Inject the google.script.run shim as early as possible.
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + SHIM);
  else html = SHIM + html;

  return html;
}

/* ------------------------------- server --------------------------------- */

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/__call') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'bad JSON body' }));
      }
      try {
        const result = call(payload.fn, ...(payload.args || []));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, result: result === undefined ? null : result }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }
    const query = Object.fromEntries(url.searchParams.entries());
    try {
      const html = renderPage(query);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Render error: ' + (err && err.stack ? err.stack : err));
    }
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Medication System preview running at http://localhost:${PORT}/`);
  console.log(`  RxEbox view:       http://localhost:${PORT}/?view=box`);
  console.log('  (local Apps Script emulation — seeded with sample data)');
});
