// Run: node --experimental-strip-types --test scripts/lib/askPip.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askPipAboutQuestion, ASK_PIP_LABEL, TUTOR_PATHNAME, incorrectForAskPip } from '../../src/nav/askPip.ts';

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
    // Every render of the new button sits behind the flag. (Battle and Weak
    // Spots results gate a whole review section; the function-scoped test
    // below covers those.)
    for (const m of src.matchAll(/<AskPipAboutThis\b/g)) {
      const owner = [...src.slice(0, m.index).matchAll(/\nfunction (\w+)\(/g)].pop()?.[1];
      if (owner === 'BattleResultsScreen' || owner === 'WeakSpotResultsView') continue;
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      assert.match(before, /uiV2/, `${file}: AskPipAboutThis must be gated on uiV2`);
    }
  }
});

// ─── Speed Round / Weak Spots / Battle results ───────────────────────────────

const q = (id) => ({ id, questionText: `Q ${id}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0 });

test('incorrectForAskPip: keeps only incorrect answers, in the order first seen', () => {
  const a = q('a'), b = q('b'), c = q('c');
  const out = incorrectForAskPip([
    { question: a, selectedIndex: 0, correct: true },
    { question: b, selectedIndex: 2, correct: false },
    { question: c, selectedIndex: 1, correct: false },
  ]);
  assert.deepEqual(out, [
    { question: b, selectedIndex: 2 },
    { question: c, selectedIndex: 1 },
  ]);
  assert.deepEqual(incorrectForAskPip([]), []);
  assert.deepEqual(incorrectForAskPip([{ question: a, selectedIndex: 0, correct: true }]), []);
});

test('incorrectForAskPip: a question missed more than once (Weak Spots requeues) appears once, with the latest wrong answer', () => {
  const a = q('a'), b = q('b');
  const out = incorrectForAskPip([
    { question: a, selectedIndex: 1, correct: false },
    { question: b, selectedIndex: 3, correct: false },
    { question: a, selectedIndex: 0, correct: true },
    { question: a, selectedIndex: 2, correct: false },
  ]);
  assert.deepEqual(out, [
    { question: a, selectedIndex: 2 },
    { question: b, selectedIndex: 3 },
  ]);
});

test('incorrectForAskPip: output feeds askPipAboutQuestion unchanged', () => {
  const [first] = incorrectForAskPip([{ question: { ...Q, id: 'r' }, selectedIndex: 3, correct: false }]);
  const nav = askPipAboutQuestion(first.question, first.selectedIndex, '/(tabs)/practice');
  assert.equal(nav.params.userAnswerText, 'Speed up');
  assert.equal(nav.params.correctAnswerText, 'Stop');
});

test('Speed Round, Weak Spots and Battle results each render it, gated on ui_v2 (flag off unchanged)', () => {
  const src = fs.readFileSync(path.join(appDir, '(tabs)/practice.tsx'), 'utf8');
  for (const fn of ['SpeedRoundResultsView', 'WeakSpotResultsView', 'BattleResultsScreen']) {
    const start = src.indexOf(`function ${fn}(`);
    assert.ok(start >= 0, fn);
    const next = src.indexOf('\nfunction ', start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);
    const renders = [...body.matchAll(/<AskPipAboutThis\b/g)];
    assert.ok(renders.length > 0, `${fn} renders AskPipAboutThis`);
    // The whole review section (or the button) sits inside a uiV2 && … block.
    for (const m of renders) {
      const before = body.slice(0, m.index);
      assert.match(before, /\{uiV2 && /, `${fn}: AskPipAboutThis must be gated on uiV2`);
    }
    assert.match(body, /from="\/\(tabs\)\/practice"/, `${fn}: tutor back returns to practice`);
  }
});
