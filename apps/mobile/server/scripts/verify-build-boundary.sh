#!/usr/bin/env bash
# Simulates Railway's build boundary for this service.
#
# Railway's Root Directory for clearpass-app is apps/mobile/server —
# nothing outside that directory exists in the deployed container,
# regardless of how a require() path is phrased. This is exactly the bug
# that took production down from at least 2026-08-14 to 2026-08-15:
# proxy.js required '../src/constants/earnings', which resolves outside
# apps/mobile/server and therefore didn't exist in the build —
# MODULE_NOT_FOUND, crash loop, no webhooks or crons processed for over a
# day, and nothing in this repo tested that boundary before it shipped.
#
# This script copies ONLY the apps/mobile/server subtree to a temp
# directory (no node_modules, no .env — Railway has neither; real env vars
# are injected directly by Railway, not read from a file) and statically
# verifies every local require('./...'/'../...') reachable from proxy.js
# resolves to a file that actually exists inside that copy. It does NOT
# check npm package dependencies (express, stripe, ...) — those install
# fine via Railway's own `npm install` from package.json/package-lock.json,
# and a missing npm dependency is a different, already-caught bug class
# (the build itself would fail loudly), not this one.
#
# Run this before merging any change that touches proxy.js or adds/moves a
# file under apps/mobile/server/lib/.
#
# Usage (from anywhere): apps/mobile/server/scripts/verify-build-boundary.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Simulating Railway's build root ($SERVER_DIR only, copied to $TMP_DIR)..."

if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude 'node_modules' --exclude '.env' "$SERVER_DIR/" "$TMP_DIR/"
else
  cp -r "$SERVER_DIR"/. "$TMP_DIR/"
  rm -rf "$TMP_DIR/node_modules" "$TMP_DIR/.env"
fi

node "$SCRIPT_DIR/check-local-requires.js" "$TMP_DIR/proxy.js"
