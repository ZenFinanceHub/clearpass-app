// Run: node --experimental-strip-types --test scripts/lib/listRow.test.mjs
// P1-2 ListRow (ClearPass 2.0). The React component is a thin view over
// listRowSemantics(); this pins its accessibility contract.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRowSemantics, LIST_ROW_MIN_HEIGHT } from '../../src/ui/listRowSemantics.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

test('tappable row: a button, 48pt tall, chevron, one label reading title, detail and value', () => {
  const s = listRowSemantics({ title: 'Mock Test', subtitle: 'Tomorrow at 10:00', value: '50 Qs', pressable: true });
  assert.equal(s.role, 'button');
  assert.equal(s.label, 'Mock Test. Tomorrow at 10:00. 50 Qs');
  assert.equal(s.minHeight, LIST_ROW_MIN_HEIGHT);
  assert.ok(LIST_ROW_MIN_HEIGHT >= 48);
  assert.equal(s.showChevron, true);
  assert.deepEqual(s.state, { disabled: false });
});

test('static row: text role, no chevron; still meets the minimum height', () => {
  const s = listRowSemantics({ title: 'Your theory test', value: '15 Dec 2026' });
  assert.equal(s.role, 'text');
  assert.equal(s.showChevron, false);
  assert.equal(s.label, 'Your theory test. 15 Dec 2026');
  assert.equal(s.minHeight, LIST_ROW_MIN_HEIGHT);
});

test('disabled row: says why, is not a live button target', () => {
  const s = listRowSemantics({ title: 'Ask Pip', subtitle: 'Get help', pressable: true, disabledNote: 'Requires internet' });
  assert.equal(s.label, 'Ask Pip. Requires internet');
  assert.deepEqual(s.state, { disabled: true });
  assert.equal(s.showChevron, false);
});

test('explicit accessibilityLabel wins; blank parts are skipped', () => {
  assert.equal(listRowSemantics({ title: 'A', subtitle: '', value: '  ' }).label, 'A');
  assert.equal(listRowSemantics({ title: 'A', accessibilityLabel: 'Custom' }).label, 'Custom');
  assert.equal(listRowSemantics({ title: 'A', pressable: true, chevron: false }).showChevron, false);
});

test('ListRow is exported from the ui kit and used by the M1 screens', () => {
  const index = fs.readFileSync(path.join(root, 'src/ui/index.ts'), 'utf8');
  assert.match(index, /export \{ ListRow/);
  const hubs = fs.readFileSync(path.join(root, 'src/nav/HubScreens.tsx'), 'utf8');
  assert.match(hubs, /<ListRow\b/);
  const sub = fs.readFileSync(path.join(root, 'src/profile/SubscriptionCardV2.tsx'), 'utf8');
  assert.match(sub, /<ListRow\b/);
});
