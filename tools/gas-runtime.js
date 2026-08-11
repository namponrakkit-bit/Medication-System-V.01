/**
 * gas-runtime.js — a tiny local emulation of the Google Apps Script runtime.
 *
 * Google Apps Script has no local runtime: `.gs` files execute on Google's
 * servers with globals like SpreadsheetApp / PropertiesService / Utilities, and
 * every `.gs` file shares one global scope. This module provides in-memory
 * mocks of the Apps Script services that this project actually uses, then loads
 * all of the repository's `.gs` files into a single shared scope (exactly like
 * Apps Script does) so the real server-side business logic can be exercised
 * locally without deploying to Google.
 *
 * It is a development / demonstration aid only — it is NOT used by the deployed
 * web app.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');

/* ----------------------------- Spreadsheet ------------------------------ */

let sheetIdCounter = 1000;

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.grid = []; // array of rows; each row is an array of cell values
    this.frozenRows = 0;
    this._id = ++sheetIdCounter;
  }

  _maxCols() {
    return this.grid.reduce((m, r) => Math.max(m, r.length), 0);
  }

  _normalize() {
    const cols = this._maxCols();
    this.grid.forEach((r) => {
      while (r.length < cols) r.push('');
    });
  }

  appendRow(arr) {
    this.grid.push(arr.slice());
    this._normalize();
    return this;
  }

  getLastRow() {
    return this.grid.length;
  }

  getLastColumn() {
    return this._maxCols();
  }

  getDataRange() {
    const rows = Math.max(this.grid.length, 1);
    const cols = Math.max(this._maxCols(), 1);
    return new FakeRange(this, 1, 1, rows, cols);
  }

  getRange(row, col, numRows, numCols) {
    if (numRows === undefined) numRows = 1;
    if (numCols === undefined) numCols = 1;
    return new FakeRange(this, row, col, numRows, numCols);
  }

  deleteRow(rowIndex) {
    this.grid.splice(rowIndex - 1, 1);
    return this;
  }

  setFrozenRows(n) {
    this.frozenRows = n;
    return this;
  }

  autoResizeColumns() {
    return this;
  }

  getSheetId() {
    return this._id;
  }
}

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  _ensure(untilRow, untilCol) {
    const g = this.sheet.grid;
    while (g.length < untilRow) g.push([]);
    for (let i = 0; i < g.length; i++) {
      while (g[i].length < untilCol) g[i].push('');
    }
  }

  getValues() {
    const out = [];
    const g = this.sheet.grid;
    for (let r = 0; r < this.numRows; r++) {
      const rowArr = [];
      const src = g[this.row - 1 + r] || [];
      for (let c = 0; c < this.numCols; c++) {
        const v = src[this.col - 1 + c];
        rowArr.push(v === undefined ? '' : v);
      }
      out.push(rowArr);
    }
    return out;
  }

  getValue() {
    return this.getValues()[0][0];
  }

  setValues(values) {
    this._ensure(this.row - 1 + this.numRows, this.col - 1 + this.numCols);
    const g = this.sheet.grid;
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        g[this.row - 1 + r][this.col - 1 + c] = values[r][c];
      }
    }
    this.sheet._normalize();
    return this;
  }

  setValue(value) {
    this._ensure(this.row, this.col);
    this.sheet.grid[this.row - 1][this.col - 1] = value;
    this.sheet._normalize();
    return this;
  }

  clearContent() {
    const g = this.sheet.grid;
    for (let r = 0; r < this.numRows; r++) {
      const src = g[this.row - 1 + r];
      if (!src) continue;
      for (let c = 0; c < this.numCols; c++) {
        if (src[this.col - 1 + c] !== undefined) src[this.col - 1 + c] = '';
      }
    }
    return this;
  }

  setFontWeight() {
    return this;
  }
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.url = 'https://docs.google.com/spreadsheets/d/LOCAL_MOCK_SHEET/edit';
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }

  getUrl() {
    return this.url;
  }
}

/* ---------------------------- Service factory --------------------------- */

function buildServices() {
  const spreadsheet = new FakeSpreadsheet();

  const scriptProps = new Map();
  const propsService = {
    getProperty: (k) => (scriptProps.has(k) ? scriptProps.get(k) : null),
    setProperty: (k, v) => {
      scriptProps.set(k, String(v));
      return propsService;
    },
    deleteProperty: (k) => {
      scriptProps.delete(k);
      return propsService;
    },
    getProperties: () => Object.fromEntries(scriptProps),
  };

  const SpreadsheetApp = {
    getActiveSpreadsheet: () => spreadsheet,
    openById: () => spreadsheet,
  };

  const PropertiesService = {
    getScriptProperties: () => propsService,
    getUserProperties: () => propsService,
    getDocumentProperties: () => propsService,
  };

  const Session = {
    getScriptTimeZone: () => 'Asia/Bangkok',
    getActiveUser: () => ({ getEmail: () => 'dev.local@example.com' }),
    getEffectiveUser: () => ({ getEmail: () => 'dev.local@example.com' }),
  };

  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const Utilities = {
    // Only supports the format tokens used in this repo, in Asia/Bangkok (+07:00, no DST).
    formatDate: (date, _tz, format) => {
      const t = new Date(date.getTime() + 7 * 3600 * 1000); // shift to +07:00, read UTC parts
      const map = {
        yyyy: t.getUTCFullYear(),
        MM: pad(t.getUTCMonth() + 1),
        dd: pad(t.getUTCDate()),
        HH: pad(t.getUTCHours()),
        mm: pad(t.getUTCMinutes()),
        ss: pad(t.getUTCSeconds()),
      };
      return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (tok) => map[tok]);
    },
    base64Encode: (str) => Buffer.from(String(str), 'utf8').toString('base64'),
    Charset: { UTF_8: 'UTF_8' },
    getUuid: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }),
  };

  const logs = [];
  const Logger = {
    log: (...args) => {
      const line = args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      logs.push(line);
      return Logger;
    },
    getLog: () => logs.join('\n'),
    clear: () => {
      logs.length = 0;
    },
  };

  const htmlFileContent = (name) => {
    const file = path.join(REPO_ROOT, `${name}.html`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  };

  function makeHtmlOutput(content) {
    return {
      _content: content,
      getContent: () => content,
      setTitle() {
        return this;
      },
      addMetaTag() {
        return this;
      },
      setXFrameOptionsMode() {
        return this;
      },
      append(more) {
        this._content += more;
        return this;
      },
    };
  }

  const HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
    createHtmlOutputFromFile: (name) => makeHtmlOutput(htmlFileContent(name)),
    createTemplateFromFile: (name) => {
      const raw = htmlFileContent(name);
      return {
        _raw: raw,
        evaluate() {
          // Real Apps Script runs a scriptlet engine here. For local dev we only
          // need to prove the template resolves and includes work, so we resolve
          // <?!= include('X') ?> calls and leave other scriptlets untouched.
          const resolved = raw.replace(
            /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g,
            (_m, inc) => htmlFileContent(inc)
          );
          return makeHtmlOutput(resolved);
        },
      };
    },
  };

  const triggers = [];
  const ScriptApp = {
    getService: () => ({ getUrl: () => scriptProps.get('WEB_APP_URL') || '' }),
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: (t) => {
      const i = triggers.indexOf(t);
      if (i >= 0) triggers.splice(i, 1);
    },
    newTrigger: (handler) => {
      const builder = {
        _handler: handler,
        timeBased: () => builder,
        everyDays: () => builder,
        atHour: () => builder,
        create: () => {
          const trg = { getHandlerFunction: () => handler };
          triggers.push(trg);
          return trg;
        },
      };
      return builder;
    },
  };

  const urlFetchCalls = [];
  const UrlFetchApp = {
    fetch: (url, options) => {
      urlFetchCalls.push({ url, options });
      return {
        getResponseCode: () => 200,
        getContentText: () => '{"mock":true}',
      };
    },
  };

  return {
    spreadsheet,
    scriptProps,
    logs,
    urlFetchCalls,
    globals: {
      SpreadsheetApp,
      PropertiesService,
      Session,
      Utilities,
      Logger,
      HtmlService,
      ScriptApp,
      UrlFetchApp,
      console,
    },
  };
}

/* ------------------------------ Loader ---------------------------------- */

// Apps Script loads `.gs` files alphabetically into one shared global scope.
function listGsFiles() {
  return fs
    .readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.gs'))
    .sort();
}

/**
 * Loads every `.gs` file in the repository into a single shared VM context
 * (mirroring Apps Script's shared global scope) and returns handles for the
 * emulated services plus the context (which exposes all top-level functions).
 */
function loadProject() {
  const services = buildServices();
  const context = vm.createContext(services.globals);

  const files = listGsFiles();
  const combined = files
    .map((f) => `// ===== ${f} =====\n${fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')}`)
    .join('\n\n');

  vm.runInContext(combined, context, { filename: 'gas-project.bundle.js' });

  return {
    context, // top-level function declarations are attached here
    files,
    spreadsheet: services.spreadsheet,
    scriptProps: services.scriptProps,
    logs: services.logs,
    urlFetchCalls: services.urlFetchCalls,
    call(fnName, ...args) {
      const fn = context[fnName];
      if (typeof fn !== 'function') {
        throw new Error(`Function "${fnName}" is not defined in the project`);
      }
      return fn(...args);
    },
  };
}

module.exports = { loadProject, buildServices, listGsFiles, REPO_ROOT };
