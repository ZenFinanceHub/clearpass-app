// Run: node --experimental-strip-types --test scripts/lib/scheduledMockList.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import {
  scheduledMockList, parseScheduledMocks, testDateRow, SCHEDULED_MOCKS_EMPTY,
} from '../../src/scheduledMocks.ts';

const NOW = new Date(2026, 10, 26, 12, 0, 0); // 26 Nov 2026, 12:00 local
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m, 0).toISOString();

test('lists every upcoming scheduled mock, soonest first, past ones dropped', () => {
  const rows = scheduledMockList([
    { id: 'c', dateTimeIso: at(30, 9), label: 'Final check', notifId: null },
    { id: 'past', dateTimeIso: at(25, 9), label: 'Old', notifId: null },
    { id: 'a', dateTimeIso: at(26, 18, 30), label: 'Evening mock', notifId: 'n1' },
    { id: 'b', dateTimeIso: at(27, 10), label: '', notifId: null },
  ], NOW);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(rows[0], { id: 'a', label: 'Evening mock', when: 'Today at 18:30', route: '/(tabs)/mock' });
  assert.equal(rows[1].label, 'Mock Test'); // existing default label
  assert.equal(rows[1].when, 'Tomorrow at 10:00');
  assert.equal(rows[2].when, '30 Nov at 09:00');
});

test('no limit: the full list, not just the next one Home shows', () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ id: String(i), dateTimeIso: at(27, 8 + i), label: `M${i}`, notifId: null }));
  assert.equal(scheduledMockList(list, NOW).length, 12);
});

test('empty, missing or corrupt storage gives an empty list (empty state), never a throw', () => {
  assert.deepEqual(scheduledMockList([], NOW), []);
  assert.deepEqual(parseScheduledMocks(null), []);
  assert.deepEqual(parseScheduledMocks('not json'), []);
  assert.deepEqual(parseScheduledMocks('{"a":1}'), []);
  assert.deepEqual(parseScheduledMocks('[{"id":"x"},{"id":"y","dateTimeIso":"2026-12-01T10:00:00.000Z","label":"L","notifId":null}]').map((m) => m.id), ['y']);
  assert.deepEqual(scheduledMockList([{ id: 'bad', dateTimeIso: 'nope', label: 'x', notifId: null }], NOW), []);
  assert.match(SCHEDULED_MOCKS_EMPTY, /No mock tests scheduled/);
});

test('theory test date row from the existing test date (future only)', () => {
  // Stored as the ISO of local midnight (TestDateModal parseDdMmYyyy).
  const day = (m, d) => new Date(2026, m, d).toISOString();
  assert.deepEqual(testDateRow(day(11, 15), NOW), { label: 'Your theory test', when: '15 Dec 2026', daysLeft: 19 });
  assert.equal(testDateRow(day(10, 26), NOW).daysLeft, 0);
  assert.equal(testDateRow(day(10, 20), NOW), null);
  assert.equal(testDateRow(null, NOW), null);
  assert.equal(testDateRow('garbage', NOW), null);
});
