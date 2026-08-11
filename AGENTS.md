# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
This is a **Google Apps Script (GAS)** web app for hospital pharmacy medication
management (Thai UI). It has two product modules served by one web app
(`doGet` in `Main.gs` → `Index.html`):
- **Main Medicine Inventory** (`Medicine.gs`, `ExportNotify.gs`, `Options.gs`)
- **RxEbox Emergency Box System** (`Boxes.gs`) — boxes, items, history, printable QR labels.

Backing store is a Google Sheet; config lives in Apps Script **Script Properties**
(`SHEET_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_ID`, `RED_MONTHS`,
`YELLOW_MONTHS`, `WEB_APP_URL`). LINE Messaging API and `api.qrserver.com` are
optional integrations (core CRUD works without them).

### Key runtime fact (non-obvious)
There is **no local runtime and no localhost server for the real app** — GAS code
executes on Google's servers, and every `.gs` file shares **one global scope**
(they are effectively concatenated, alphabetically). Deploying/running the real
app requires a Google account and `clasp login` (interactive Google OAuth), which
is **not available headlessly** in a cloud VM. Do not expect `.gs` code to run
under plain Node except through the local emulation described below.

### Local development workflow (dev tooling only — not deployed)
`package.json` and everything under `tools/` are **development aids only**; they
are never part of the deployed Apps Script project. Commands (see `package.json`
scripts for the source of truth):
- `npm run validate` (alias `npm run lint`) — syntax-checks every `.gs` file and
  the whole concatenated project (catches duplicate top-level `const`/`let`/`class`
  that only fail once merged into GAS's shared scope). This is the closest thing to
  a linter here; no formal ESLint is configured.
- `npm test` / `npm run demo` — runs the real `.gs` server functions headlessly
  against an in-memory Apps Script emulation (`tools/gas-runtime.js`) and asserts
  core inventory + RxEbox flows end-to-end.
- `npm run serve` — starts a local browser preview at `http://localhost:3000/`
  (`?view=box` for RxEbox). It serves the real `doGet()` HTML and bridges the
  client's `google.script.run` calls to the real `.gs` functions, seeded with
  sample data. Use this for manual/GUI testing of the actual UI.

`clasp` (installed as a dev dependency) is the official tool to push/pull/deploy
to Apps Script, but it needs `clasp login` + a linked script project first.

### Gotchas
- **Manifest is malformed**: the manifest is misnamed `appsscrioy.json` (should be
  `appsscript.json`) and is missing its enclosing `{ }` braces. `clasp push` /
  Apps Script expects a valid `appsscript.json`. Left as-is (pre-existing); fix only
  if a task requires deploying.
- **Duplicate settings code**: `SheetHelpers.gs` is an older copy of `Settings.gs`
  (both define `getAdminSettings` / `getClientSettings_` / `saveAdminSettings`).
  Because GAS loads files alphabetically and later definitions win, `SheetHelpers.gs`
  overrides `Settings.gs`, dropping the newer `webAppUrl` field. Pre-existing.
- When asserting on values returned by the local emulation, note they come from a
  separate VM context (different `Array`/`Object` prototypes) — compare by value
  (e.g. JSON), not `assert.deepStrictEqual`.
- If you set up `clasp`, add a `.claspignore` so it only pushes `*.gs`/`*.html` and
  never `tools/`, `package.json`, or `node_modules/`.
