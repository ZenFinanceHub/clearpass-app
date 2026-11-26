// Run: node --experimental-strip-types --test scripts/lib/topicRevision.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topicRevisionList, TOPIC_PICKER_PARAM } from '../../src/nav/topicRevision.ts';
import { LEARN_HUB, TOPIC_PICKER_ROUTE, withTapNonce } from '../../src/nav/routeMap.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

/** TopicCategory values, read from the core enum (plain Node can't import @clearpass/core). */
function topicCategories() {
  const src = fs.readFileSync(path.resolve(root, '../../packages/core/src/types/TopicCategory.ts'), 'utf8');
  return [...src.matchAll(/^\s*\w+ = '(\w+)',/gm)].map((m) => m[1]);
}

test('lists every practice topic, in the core order, each opening the existing topic launcher', () => {
  const list = topicRevisionList({});
  assert.deepEqual(list.map((t) => t.key), topicCategories());
  for (const t of list) {
    assert.equal(t.route, `/(tabs)/practice?topic=${t.key}`);
    assert.ok(t.name.length > 0);
    // Same per-tap nonce rule as Home's "Practise <topic>".
    assert.equal(withTapNonce(t.route, 7), `${t.route}&t=7`);
  }
  assert.equal(list.find((t) => t.key === 'SafetyAndYourVehicle').name, 'Safety & Your Vehicle');
});

test('shows the learner\'s score where attempted, and marks the weakest topic', () => {
  const list = topicRevisionList({ Alertness: 81.6, Attitude: 0, MotorwayRules: 42.2, VehicleLoading: 55 });
  const by = Object.fromEntries(list.map((t) => [t.key, t]));
  assert.equal(by.Alertness.score, 82);
  assert.equal(by.Attitude.score, null); // 0 = not attempted
  assert.equal(by.HazardAwareness.score, null);
  assert.equal(by.MotorwayRules.score, 42);
  assert.deepEqual(list.filter((t) => t.weakest).map((t) => t.key), ['MotorwayRules']);
});

test('no weakest marker when nothing is below the weak threshold or nothing is attempted', () => {
  assert.equal(topicRevisionList({ Alertness: 95 }).some((t) => t.weakest), false);
  assert.equal(topicRevisionList(null).some((t) => t.weakest), false);
  assert.equal(topicRevisionList(undefined).length, topicCategories().length);
});

test('Learn hub has a Topic revision entry that opens the picker on the Learn tab', () => {
  const e = LEARN_HUB.find((x) => x.id === 'topic-revision');
  assert.ok(e, 'topic-revision entry');
  assert.equal(e.title, 'Topic revision');
  assert.equal(e.route, TOPIC_PICKER_ROUTE);
  assert.equal(TOPIC_PICKER_ROUTE, `/(tabs)/learn?${TOPIC_PICKER_PARAM}=topics`);
  // Not a per-tap launch route: opening the picker starts nothing.
  assert.equal(withTapNonce(TOPIC_PICKER_ROUTE, 7), TOPIC_PICKER_ROUTE);
});

test('Home\'s weak-topic coach card links to the picker (ui_v2 screen only)', () => {
  const home = fs.readFileSync(path.join(root, 'src/home/DailyCoachHome.tsx'), 'utf8');
  assert.match(home, /coach\.action\.id === 'weak-topic' \?/);
  assert.match(home, /onNavigate\(TOPIC_PICKER_ROUTE\)/);
});
