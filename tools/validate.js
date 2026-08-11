/**
 * validate.js — lightweight "lint" for this Google Apps Script project.
 *
 * There is no linter configured in this repo (Apps Script provides none by
 * default). As a fast, dependency-free correctness check we:
 *   1. Syntax-check every `.gs` file with `node --check` (they are plain V8 JS).
 *   2. Syntax-check the whole project *concatenated*, which is how Apps Script
 *      actually runs it (shared global scope) — this catches duplicate
 *      top-level `const`/`let`/`class` declarations that only fail once merged.
 *   3. Confirm the HTML client files referenced by include()/templates exist.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function gsFiles() {
  return fs
    .readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.gs'))
    .sort();
}

// `node --check` infers module type from the file extension and rejects `.gs`,
// so we syntax-check the source through a temporary `.js` file instead.
function checkSyntaxSource(source, label) {
  const tmp = path.join(os.tmpdir(), `gas-check-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmp, source);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`  ok   ${label}`);
    return true;
  } catch (err) {
    console.error(`  FAIL ${label}`);
    console.error(String(err.stderr || err.message).trim());
    return false;
  } finally {
    fs.unlinkSync(tmp);
  }
}

function main() {
  const files = gsFiles();
  let ok = true;

  console.log(`Syntax-checking ${files.length} .gs files individually:`);
  for (const f of files) {
    ok = checkSyntaxSource(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), f) && ok;
  }

  console.log('\nSyntax-checking the concatenated project (shared global scope):');
  const bundle = files
    .map((f) => `// ===== ${f} =====\n${fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')}`)
    .join('\n\n');
  ok = checkSyntaxSource(bundle, 'gas-project.bundle.js') && ok;

  console.log('\nChecking referenced HTML client files exist:');
  for (const html of ['Index', 'Styles', 'Scripts']) {
    const p = path.join(REPO_ROOT, `${html}.html`);
    if (fs.existsSync(p)) {
      console.log(`  ok   ${html}.html`);
    } else {
      console.error(`  FAIL ${html}.html (missing)`);
      ok = false;
    }
  }

  console.log('');
  if (ok) {
    console.log('validate: PASS');
    process.exit(0);
  } else {
    console.error('validate: FAIL');
    process.exit(1);
  }
}

main();
