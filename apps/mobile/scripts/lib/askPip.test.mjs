// Run: node --experimental-strip-types --test scripts/lib/askPip.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askPipAboutQuestion, ASK_PIP_LABEL, TUTOR_PATHNAME } from '../../src/nav/askPip.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../../app');

const Q = {
  questionText: 'What does a red traffic light mean?',
  options: ['Go', 'Stop', 'Slow down', 'Speed up'],
  correctIndex: 1,
  explanation: 'Red means stop.',
};

test('builds the existing tutor entry point with the question context prefilled', () => {
  const nav = askPipAboutQuestion(Q, 2, '/(tabs)/practice');
  assert.equal(nav.pathname, '/(tabs)/tutor');
  assert.equal(TUTOR_PATHNAME, '/(tabs)/tutor');
  assert.deepEqual(nav.params, {
    questionText: 'What does a red traffic light mean?',
    userAnswerText: 'Slow down',
    correctAnswerText: 'Stop',
    explanation: 'Red means stop.',
    from: '/(tabs)/practice',
  });
});

test('unanswered question: says so (same wording as the mock review today)', () => {
  assert.equal(askPipAboutQuestion(Q, null, '/(tabs)/mock').params.userAnswerText, 'No answer selected');
  assert.equal(askPipAboutQuestion(Q, 9, '/(tabs)/mock').params.userAnswerText, 'No answer selected');
  assert.equal(askPipAboutQuestion({ ...Q, explanation: undefined }, 0, '/x').params.explanation, '');
});

test('label', () => {
  assert.equal(ASK_PIP_LABEL, 'Ask Pip about this');
});

test('drift guard: the tutor screen reads exactly these params (no new endpoint, no new prompt)', () => {
  const src = fs.readFileSync(path.join(appDir, '(tabs)/tutor.tsx'), 'utf8');
  const block = src.match(/useLocalSearchParams<\{([\s\S]*?)\}>/)[1];
  for (const key of Object.keys(askPipAboutQuestion(Q, 0, '/x').params)) {
    assert.match(block, new RegExp(`\\b${key}\\?:`), key);
  }
  // The tutor builds its opening message from questionText / correct / user answer.
  assert.match(src, /Can you explain this question: \$\{q\}/);
});

test('results screens use it only under ui_v2 (flag off unchanged)', () => {
  for (const file of ['(tabs)/practice.tsx', '(tabs)/mock.tsx']) {
    const src = fs.readFileSync(path.join(appDir, file), 'utf8');
    assert.match(src, /<AskPipAboutThis\b/, file);
    // Every render of the new button sits behind the flag.
    for (const m of src.matchAll(/<AskPipAboutThis\b/g)) {
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      assert.match(before, /uiV2/, `${file}: AskPipAboutThis must be gated on uiV2`);
    }
  }
});
