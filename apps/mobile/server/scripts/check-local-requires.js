'use strict';

// Companion to verify-build-boundary.sh. Statically walks every LOCAL
// require('./...' | '../...') reachable from the given entry file and
// confirms each one resolves to a real file — without executing any code,
// so it needs no npm install, no env vars, and can't start a server or
// bind a port.
//
// Bare package names (express, stripe, @supabase/supabase-js, ...) are
// deliberately skipped: npm installs those from package.json as part of
// Railway's own build, and that's a different bug class from the one this
// checks for — a LOCAL relative require that resolves outside the copied
// build root (exactly what took production down: proxy.js required
// '../src/constants/earnings', which doesn't exist once only
// apps/mobile/server is copied).

const fs = require('fs');
const path = require('path');

const entry = process.argv[2];
if (!entry) {
  console.error('Usage: node check-local-requires.js <entry-file>');
  process.exit(1);
}

// [^'"\n] rather than [^'"]: a require() call is always a single-line
// string literal in this codebase, and matching across newlines risks a
// false positive on any comment that happens to mention require('./...')
// split across lines (this script caught itself doing exactly that on its
// first run against a doc comment in earnings.js).
const REQUIRE_RE = /require\(\s*['"](\.[^'"\n]+)['"]\s*\)/g;

function resolveLocal(fromFile, importPath) {
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  return candidates.find(fs.existsSync) || null;
}

const visited = new Set();
const missing = [];

function walk(file) {
  const resolved = path.resolve(file);
  if (visited.has(resolved)) return;
  visited.add(resolved);

  if (!fs.existsSync(resolved)) {
    missing.push({ file: resolved, importPath: null });
    return;
  }

  const source = fs.readFileSync(resolved, 'utf8');
  let match;
  while ((match = REQUIRE_RE.exec(source))) {
    const importPath = match[1];
    const target = resolveLocal(resolved, importPath);
    if (!target) {
      missing.push({ file: resolved, importPath });
    } else {
      walk(target);
    }
  }
}

walk(entry);

if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} local require(s) do not resolve inside the build root:\n`);
  for (const m of missing) {
    if (m.importPath) {
      console.error(`  ${m.file}\n    requires '${m.importPath}' — not found`);
    } else {
      console.error(`  ${m.file} — entry file itself not found`);
    }
  }
  process.exit(1);
}

console.log(`OK: every local require() reachable from ${path.basename(entry)} resolves inside the build root (${visited.size} file(s) checked).`);
