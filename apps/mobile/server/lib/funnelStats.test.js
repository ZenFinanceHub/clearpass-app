'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { computeFunnelStats, formatFunnelLines } = require('./funnelStats');

const NOW = '2026-10-21T08:00:00.000Z';
const HOUR_AGO = '2026-10-21T07:00:00.000Z';
const THREE_DAYS_AGO = '2026-10-18T08:00:00.000Z';
const TEN_DAYS_AGO = '2026-10-11T08:00:00.000Z';

function step(steps, key) {
  return steps.find(s => s.key === key);
}

test('counts distinct people, not events', () => {
  const events = [
    { user_id: 'u1', anon_id: 'a1', event: 'paywall_viewed', created_at: HOUR_AGO },
    { user_id: 'u1', anon_id: 'a1', event: 'paywall_viewed', created_at: HOUR_AGO },
    { user_id: 'u2', anon_id: 'a2', event: 'paywall_viewed', created_at: HOUR_AGO },
  ];
  const s = computeFunnelStats({ events, excludedUserIds: [], nowIso: NOW });
  assert.equal(step(s, 'paywall_viewed').last24h, 2);
  assert.equal(step(s, 'paywall_viewed').last7d, 2);
});

test('splits 24h and 7d windows and ignores older events', () => {
  const events = [
    { user_id: 'u1', anon_id: 'a1', event: 'daily_limit_hit', created_at: HOUR_AGO },
    { user_id: 'u2', anon_id: 'a2', event: 'daily_limit_hit', created_at: THREE_DAYS_AGO },
    { user_id: 'u3', anon_id: 'a3', event: 'daily_limit_hit', created_at: TEN_DAYS_AGO },
  ];
  const s = step(computeFunnelStats({ events, excludedUserIds: [], nowIso: NOW }), 'daily_limit_hit');
  assert.equal(s.last24h, 1);
  assert.equal(s.last7d, 2);
});

test('excluded accounts and their pre-signup anon events are dropped', () => {
  const events = [
    { user_id: null, anon_id: 'craig-phone', event: 'taster_completed', created_at: HOUR_AGO },
    { user_id: 'craig', anon_id: 'craig-phone', event: 'onboarding_completed', created_at: HOUR_AGO },
    { user_id: null, anon_id: 'stranger', event: 'taster_completed', created_at: HOUR_AGO },
  ];
  const s = computeFunnelStats({ events, excludedUserIds: ['craig'], nowIso: NOW });
  assert.equal(step(s, 'taster_completed').last24h, 1);
  assert.equal(step(s, 'onboarding_completed').last24h, 0);
});

test('unknown events are ignored', () => {
  const events = [{ user_id: 'u1', anon_id: 'a1', event: 'something_else', created_at: HOUR_AGO }];
  const s = computeFunnelStats({ events, excludedUserIds: [], nowIso: NOW });
  assert.ok(s.every(x => x.last24h === 0 && x.last7d === 0));
});

test('formatFunnelLines renders one line per step', () => {
  const s = computeFunnelStats({ events: [], excludedUserIds: [], nowIso: NOW });
  const lines = formatFunnelLines(s);
  assert.ok(lines.some(l => l.includes('Opened paywall: 0 / 0')));
  assert.equal(lines.length, s.length + 2);
});
