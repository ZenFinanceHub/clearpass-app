# Question-Bank Image Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the systemic blank-answer-options bug at its root, ship a genuine "4 images, pick the matching sign" question format for the 21 questions that actually need it, and correctly resolve every other image gap found in the 2026-07-16 audit — without leaving the bug class able to recur silently.

**Architecture:** One new optional field on the shared `Question` type (`optionImages?: string[]`) carries per-option images without breaking any existing text-option question. One new shared React Native component (`AnswerOptions`) replaces five independent, copy-pasted option-rendering blocks (Mock Test, Practice, Battle, Weak Spot, Speed Round) so the new format — and any future one — only has to be built once. A content-validation script becomes the permanent regression guard: it encodes "no question may have blank text options without image options to replace them," which is precisely the invariant that silently broke in the original DVSA import.

**Tech Stack:** TypeScript, React Native / Expo Router, `@clearpass/core` (shared types), `@clearpass/content` (question data), Node scripts for content validation, Supabase Storage (public `question-images` bucket).

## Global Constraints

- Do not change the `Question` type in a way that breaks existing questions — `optionImages` must be optional and every current text-option question must render exactly as it does today.
- Every question that ends up with `optionImages` must have exactly 4 entries, matching `options.length` position-for-position, since `options[i]` remains the accessible/TTS label for that image (see Task 1).
- No question may ship with all-blank `options` and no `optionImages` — this is the exact bug being fixed; the validation script in Task 2 must enforce it permanently.
- All image URLs (existing or newly added) must resolve with HTTP 200 from the public Supabase `question-images` bucket before a question is considered fixed.
- Follow existing house style: `StyleSheet.create`, `useTheme()`, `Colors` from `@/src/constants/theme`, `LABELS = ['A','B','C','D']` badge pattern already used in `mock.tsx`/`practice.tsx`.

---

## Investigation findings (read before starting)

### Root cause of the blank-options bug

Confirmed via git archaeology, not guessed. Commit `f7caf69` ("Replace placeholder questions with official DVSA question bank (Feb 2026)") imported 744 official questions from `Car (Cat B) QB Feb 2026.xlsx`, the DVSA licence source file. **The blank `["","","",""]` options already exist at that exact commit, for every one of the 27 affected questions, with no `imageUrl` at all.** This is not an app bug that developed over time — the official DVSA source spreadsheet itself has ~27 questions whose four answer options are images (e.g. "pick the sign that means X" from four candidate sign pictures), not text. The `Question` type's `options: string[]` field has no way to represent "this option is an image," so the import left them blank.

A later commit, `89d9057` ("add DVSA question images to 156 questions"), patched in a single `imageUrl` for most (not all) of these 27 questions as a stopgap — but a single image can't represent four answer choices, so it used a loosely representative image instead (often the correct answer's sign, sometimes a generic shape icon). That's why several of these render a **plausible-looking but structurally wrong** image: the pipeline was never asked to solve "four images," only "at least show something."

**Fix implication:** this needs a genuine schema addition (`optionImages`), not per-question data patches. Tasks 1–8 build that; Tasks 9–13 populate it.

### Overlap analysis — "wrong image" list vs. "4-image format" list

Checked all 10 IDs from the "wrong image" list against the 19 from the "4-image format" list and against the original 27 blank-options questions from the audit.

**7 of the 10 "wrong image" questions are already in the stated 19-question 4-image list** (`AB2176`, `AB2304`, `AB2429`, `AB2375`, `AB2117`, `AB2357`, `AB2892`) — exactly as flagged. Fixing these means building the 4-image format and sourcing their images, not swapping one file for another.

**The remaining 3 (`AB2294`, `AB2324`, `AB2763`) are also blank-options questions** (confirmed against the original audit data) but are *not* in the 19-list. Investigated why: all three are pure **shape** questions — "What shape are traffic signs giving orders?", "What shape is a 'stop' sign?", "Which shape is used for a 'give way' sign?" — which the real DVSA bank answers with **text options** (Triangular / Circular / Octagonal / Rectangular etc.), not images. `AB2294`'s adjacent sibling `AB2293` in the same file already has exactly this pattern with real text options, confirming it's the right template. **So all 10 "wrong image" questions turn out to be blank-options-bug instances — none need a standalone "just swap the image" fix.** They resolve via one of two paths: the 4-image format (7) or corrected text options (3). See Task 8 and Task 11.

**TS4647 and TS4015** (the two "lower-confidence, worth a final check" cases): `TS4647` is used by `AB2887`, already in the 19-list. `TS4015` is used by `AB2389`, also already in the 19-list. Neither adds new scope — both are already covered by the 4-image format work.

**Two more blank-options questions turned up that aren't in any of your three lists:** `AB2295` ("Which type of sign tells you what you must not do?") and `AB2212` ("Which plate may appear with this road sign?"). Confirmed for inclusion — both fold into the 4-image work in Task 11.

Net picture: **21 questions genuinely need the 4-image format** (19 given + `AB2295` + `AB2212`), **3 need text-option conversion** (`AB2294`, `AB2324`, `AB2763`), **3 need a brand-new sourced image each** (`BB1591`, `AB2401`, `BB1237`), and the original "10 straightforward corrections" task **does not exist as separate work** — it's fully absorbed into the above.

### Asset sourcing — a decision point, but better news than expected

Before assuming anything needs sourcing from scratch, checked what's already sitting unused:

- **Two of the 21 four-image questions already have their 4 images** — `AB2674` and `AB2768` use montage images (`TS4509.png`, `TS4682.png`) that are exactly 430×430 2×2 grids of four distinct, correctly-relevant signs. These just need cropping into 4 files, no new sourcing (Task 9).
- **Listed the full Supabase `question-images` bucket via service-role access (151 files total) against the 133 currently referenced — 18 files are sitting completely unused, and all 18 are named by question ID** (`AB2301.png`, `BB1207.png`, `AB2087.png`, etc.), matching all 18 "missing image" questions from the original audit exactly. Visually spot-checked two (`AB2301` → correctly shows the "no motor vehicles" prohibition sign; `BB1207` → correctly shows the national-speed-limit derestriction sign) — both exactly right. **Confirmed for inclusion — Task 10.**
- For the remaining ~19 four-image questions still needing genuine sourcing (4 images × ~19 = up to 76 image slots, likely fewer once duplicates across questions are accounted for), the **first move should be checking the existing local Road Signs asset pack** (`apps/mobile/assets/signs/`, 679 files, real DVSA sign photos already licensed and in the repo) before sourcing anything new — many of the "4 candidate signs" for a given question are standard UK signs almost certainly already photographed in that pack for the Road Signs library feature. Task 11 starts there.
- **For whatever's left after that reuse pass, and for the 3 entirely-new images (`BB1591`, `AB2401`, `BB1237`), this needs a decision from you:** stock/licensed photo purchase, hand-drawn vector (matching the style already used for the local Road Signs SVG fallbacks), or DVSA's own "Know Your Traffic Signs" diagram style. I haven't picked one — flagged clearly at Task 11 and Task 12 below.

---

## Task 1: Add `optionImages` to the shared `Question` type

**Files:**
- Modify: `packages/core/src/types/Question.ts`
- Create: `packages/core/src/isImageChoiceQuestion.ts`
- Modify: `packages/core/src/index.ts` (export the new helper)
- Test: `packages/core/src/isImageChoiceQuestion.test.ts`

**Interfaces:**
- Produces: `Question.optionImages?: string[]`, and `isImageChoiceQuestion(q: Question): boolean` — every later task that needs to detect "is this an image-choice question" calls this, never re-implements the check inline.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/isImageChoiceQuestion.test.ts
import { isImageChoiceQuestion } from './isImageChoiceQuestion';
import { TopicCategory } from './types/TopicCategory';
import { Question } from './types/Question';

const base: Question = {
  id: 'X1',
  questionText: 'test',
  options: ['a', 'b', 'c', 'd'],
  correctIndex: 0,
  explanation: 'test',
  topicCategory: TopicCategory.RoadAndTrafficSigns,
  difficulty: 1,
};

test('false when optionImages is absent', () => {
  expect(isImageChoiceQuestion(base)).toBe(false);
});

test('false when optionImages length does not match options length', () => {
  expect(isImageChoiceQuestion({ ...base, optionImages: ['img1.png'] })).toBe(false);
});

test('true when optionImages has one entry per option', () => {
  expect(isImageChoiceQuestion({
    ...base,
    optionImages: ['img1.png', 'img2.png', 'img3.png', 'img4.png'],
  })).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run isImageChoiceQuestion` (this package uses vitest, not jest — check `packages/core/package.json`'s `test` script if in doubt)
Expected: FAIL with "Cannot find module './isImageChoiceQuestion'"

- [ ] **Step 3: Add the field to the Question type**

```ts
// packages/core/src/types/Question.ts
import { TopicCategory } from './TopicCategory';

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicCategory: TopicCategory;
  difficulty: 1 | 2 | 3;
  imageUrl?: string;
  /**
   * When set, one image per entry in `options` (same length, same order).
   * `options[i]` becomes the accessible/TTS label for that image rather
   * than visible button text — see isImageChoiceQuestion().
   */
  optionImages?: string[];
}
```

- [ ] **Step 4: Write the helper**

```ts
// packages/core/src/isImageChoiceQuestion.ts
import { Question } from './types/Question';

export function isImageChoiceQuestion(q: Question): boolean {
  return Array.isArray(q.optionImages) && q.optionImages.length === q.options.length;
}
```

- [ ] **Step 5: Export it**

```ts
// packages/core/src/index.ts — add alongside the existing Question export
export { isImageChoiceQuestion } from './isImageChoiceQuestion';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/core && npx vitest run isImageChoiceQuestion`
Expected: PASS (3 tests)

- [ ] **Step 7: Run `tsc --noEmit` in apps/mobile to confirm no existing question breaks**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: same pre-existing baseline error count as before this change (see prior audit sessions for the known 17-error baseline) — zero new errors, since `optionImages` is optional and no existing question object sets it.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types/Question.ts packages/core/src/isImageChoiceQuestion.ts packages/core/src/isImageChoiceQuestion.test.ts packages/core/src/index.ts
git commit -m "feat: add optionImages field to Question type for 4-image-choice questions"
```

---

## Task 2: Content-validation regression guard

This is the permanent fix for "this bug class can recur silently." It encodes the exact invariant that broke: no question may have all-blank text options unless it has valid `optionImages` to replace them. Written now, before any content is fixed, so it fails loudly against the current 27 broken questions — then Tasks 8–13 turn those failures green one by one.

**⚠️ Discovered during execution, not in the original audit:** `packages/content/src/index.ts` already has a stopgap `.filter(hasUsableOptions)` on the `allQuestions` export (added 2026-07-06, commit `6b033fb`), with a comment stating it excludes exactly these 27 picture-choice questions "until that [asset] pack arrives." This means these 27 are **not currently reaching users as broken blank-button questions** — they're silently absent from the live question pool entirely (~27 fewer questions in circulation than the full 752). This doesn't change what needs fixing, but it does mean: (a) testing against the exported `allQuestions` would always show 0 violations regardless of real content state, defeating the guard's purpose, so the test must run against the raw, unfiltered concatenation of all 14 topic arrays instead; (b) once Tasks 9–13 give every one of these 27 real non-blank `options[i]` text (either genuine DVSA text answers or accessibility labels for image choices — both approaches in this plan already do this), `hasUsableOptions` naturally starts returning `true` for all of them and the filter becomes a permanent no-op; Task 14 should remove it and its now-stale comment as a final cleanup, restoring the full 752-question pool.

**Files:**
- Modify: `packages/content/package.json` (add `vitest` devDependency + `test` script — this package has neither yet, unlike `packages/core`)
- Create: `packages/content/src/validateQuestions.ts`
- Create: `packages/content/src/validateQuestions.test.ts`

**Interfaces:**
- Consumes: the raw concatenation of all 14 per-topic question arrays (same imports `packages/content/src/index.ts` uses internally — e.g. `alertnessQuestions`, `roadsignsQuestions`, etc. — NOT the filtered `allQuestions` export, per the discovery above), `isImageChoiceQuestion` from Task 1.
- Produces: `validateQuestions(questions: Question[]): string[]` — returns a list of human-readable problem descriptions, empty array if clean. Task 14's final pass re-runs this and requires an empty array.

- [ ] **Step 0: Add vitest to packages/content**

`packages/content/package.json` currently has no `scripts` or `devDependencies` block at all (unlike `packages/core`, which already has `"test": "vitest run"`). Add the matching setup:

```json
{
  "name": "@clearpass/content",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@clearpass/core": "*"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

Then run `cd packages/content && npm install` to fetch it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/content/src/validateQuestions.test.ts
import { validateQuestions } from './validateQuestions';
import { TopicCategory } from '@clearpass/core';
import { Question } from '@clearpass/core';

const okTextQuestion: Question = {
  id: 'OK1', questionText: 'test', options: ['a', 'b', 'c', 'd'],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.Alertness, difficulty: 1,
};

const okImageQuestion: Question = {
  id: 'OK2', questionText: 'test', options: ['sign A', 'sign B', 'sign C', 'sign D'],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.RoadAndTrafficSigns, difficulty: 1,
  optionImages: ['a.png', 'b.png', 'c.png', 'd.png'],
};

const brokenBlankQuestion: Question = {
  id: 'BROKEN1', questionText: 'test', options: ['', '', '', ''],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.RoadAndTrafficSigns, difficulty: 1,
};

test('passes for a normal text-option question', () => {
  expect(validateQuestions([okTextQuestion])).toEqual([]);
});

test('passes for a correctly-formed image-choice question', () => {
  expect(validateQuestions([okImageQuestion])).toEqual([]);
});

test('flags a question with blank options and no optionImages', () => {
  const errors = validateQuestions([brokenBlankQuestion]);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('BROKEN1');
});

test('flags optionImages with wrong length', () => {
  const bad: Question = { ...okImageQuestion, id: 'BROKEN2', optionImages: ['a.png'] };
  const errors = validateQuestions([bad]);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('BROKEN2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/content && npx vitest run validateQuestions`
Expected: FAIL with "Cannot find module './validateQuestions'"

- [ ] **Step 3: Implement the validator**

```ts
// packages/content/src/validateQuestions.ts
import { Question, isImageChoiceQuestion } from '@clearpass/core';

export function validateQuestions(questions: Question[]): string[] {
  const errors: string[] = [];

  for (const q of questions) {
    const allOptionsBlank = q.options.every((o) => o.trim() === '');
    const hasValidImageChoice = isImageChoiceQuestion(q);
    const hasMismatchedImageCount =
      Array.isArray(q.optionImages) && q.optionImages.length !== q.options.length;

    if (allOptionsBlank && !hasValidImageChoice) {
      errors.push(
        `${q.id}: all 4 options are blank and optionImages is not set (or wrong length) — question is unanswerable as rendered.`
      );
    } else if (hasMismatchedImageCount) {
      errors.push(
        `${q.id}: optionImages has ${q.optionImages!.length} entries but options has ${q.options.length} — must match.`
      );
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/content && npx vitest run validateQuestions`
Expected: PASS (4 tests)

- [ ] **Step 5: Add the permanent regression-guard test against the real question bank**

This is the test that makes the bug class unable to recur silently — it runs the validator against the actual shipped content, not just fixtures, and it's what Task 14's final pass re-checks. **Must import the raw per-topic arrays directly, not the filtered `allQuestions` export** (see the discovery note above) — otherwise this test would show 0 violations right now regardless of real content state, since `allQuestions` already hides exactly the broken questions this test exists to catch. Append to `packages/content/src/validateQuestions.test.ts`:

```ts
import { alertnessQuestions } from './questions/alertness';
import { attitudeQuestions } from './questions/attitude';
import { safetyMarginsQuestions } from './questions/safetyMargins';
import { hazardAwarenessQuestions } from './questions/hazardAwareness';
import { roadsignsQuestions } from './questions/roadsigns';
import { rulesOfTheRoadQuestions } from './questions/rulesOfTheRoad';
import { safetyAndYourVehicleQuestions } from './questions/safetyAndYourVehicle';
import { vulnerableRoadUsersQuestions } from './questions/vulnerableRoadUsers';
import { otherTypesQuestions } from './questions/otherTypes';
import { vehicleHandlingQuestions } from './questions/vehicleHandling';
import { motorwayRulesQuestions } from './questions/motorwayRules';
import { documentsAndRegulationsQuestions } from './questions/documentsAndRegulations';
import { accidentsAndEmergenciesQuestions } from './questions/accidentsAndEmergencies';
import { vehicleLoadingQuestions } from './questions/vehicleLoading';

const rawQuestions = [
  ...alertnessQuestions, ...attitudeQuestions, ...safetyMarginsQuestions,
  ...hazardAwarenessQuestions, ...roadsignsQuestions, ...rulesOfTheRoadQuestions,
  ...safetyAndYourVehicleQuestions, ...vulnerableRoadUsersQuestions, ...otherTypesQuestions,
  ...vehicleHandlingQuestions, ...motorwayRulesQuestions, ...documentsAndRegulationsQuestions,
  ...accidentsAndEmergenciesQuestions, ...vehicleLoadingQuestions,
];

test('the real question bank has no blank-options-without-images violations (known baseline: 27 as of 2026-07-16, target: 0)', () => {
  const errors = validateQuestions(rawQuestions);
  // This assertion is EXPECTED TO FAIL right now — that's the point. It documents
  // the exact current state and turns green as Tasks 9-13 fix content. Do not
  // weaken this test to make it pass; fix the content instead. Do NOT import
  // `allQuestions` here — it already filters these exact questions out (see
  // the discovery note above this task), which would make this test vacuously
  // pass and defeat its purpose.
  expect(errors).toEqual([]);
});
```

- [ ] **Step 6: Run it and confirm it fails with exactly the known 27**

Run: `cd packages/content && npx vitest run validateQuestions`
Expected: FAIL — vitest's `toEqual([])` failure diff will print the full array of 27 error strings. Confirm the count and IDs match the audit's blank-options list. This failing test is the correct state to commit in — it's the acceptance baseline Task 14 requires to reach 0, not a broken build (make sure whatever CI/pre-commit hook exists for this repo either doesn't run `packages/content`'s tests yet, or is expected to go red until Task 14 — check before committing so this doesn't block an unrelated push).

- [ ] **Step 7: Commit**

```bash
git add packages/content/src/validateQuestions.ts packages/content/src/validateQuestions.test.ts
git commit -m "test: add content-validation guard against blank-options questions"
```

---

## Task 3: Shared `AnswerOptions` component

Replaces the 5 independent, duplicated option-rendering blocks found in `mock.tsx:380` and `practice.tsx:1178/1759/1972/2130` (main Practice quiz, Battle, Weak Spot, Speed Round). Building this once, correctly, is what makes the 4-image format actually work everywhere these questions can appear.

**⚠️ Revised after task review found the first draft incomplete.** The initial version of this component only handled text-vs-image rendering and a single "selected" highlight — it dropped two things all 4 non-Mock-Test screens actually have: (1) post-answer reveal styling (correct = green, wrong = red, the rest dimmed), and (2) `useTheme()`-driven text sizing/font/letterSpacing, which is how this app's large-text/dyslexia-font/dark-mode accessibility settings reach quiz options today. Dropping either would be a real regression for every existing text-option question — exactly what the plan's own Global Constraints forbid ("every current text-option question must render exactly as it does today"). Verified by reading all 4 blocks directly (`practice.tsx` lines ~1178-1230 main quiz, ~1759-1797 Battle, ~1972-1995 Weak Spot, ~2130-2168 Speed Round): all 4 share one exact reveal-styling pattern (`isCorrect`/`isSelected` → `optionCorrect`/`optionWrong`/`optionDimmed`/`optionDefault` + matching badge/text variants) and one exact theme-text pattern. Only the main Practice quiz additionally has a scale-bounce tap animation and a "tap to hear the option again" TTS behavor once answered (`practice.tsx:1201-1221`); Mock Test alone never reveals correctness at all (it defers all feedback to its results screen) — it only ever shows a plain "selected" highlight, which is why the first draft (built by generalizing from Mock Test's simpler block) missed the other 4 screens' actual needs.

One accepted, deliberate tradeoff: Mock Test's own block currently uses a slightly different badge size/corner-radius and literal hex text colors (`mock.tsx:855-872`) than Practice's block (`practice.tsx:2361-2392`) — a pre-existing inconsistency between the two files, not something introduced here. This component adopts Practice's fuller token set (`Colors.emerald`/`Colors.red`/etc., all confirmed present in `apps/mobile/src/constants/theme.ts`) as the one canonical style, since 4 of 5 consumers already use it and it's a superset of what Mock Test needs. Mock Test's badge will shift by a few px (30→28, radius 8→14) — a genuinely cosmetic homogenization, not a functional change, and the unavoidable result of actually unifying 5 previously-independent blocks into 1 component rather than a sign anything was missed.

**Files:**
- Create: `apps/mobile/src/components/AnswerOptions.tsx`
- Test: manual verification via Tasks 4-8 (this is a presentational component; its correctness is proven by the screens that consume it rendering correctly — see each wiring task's verification step)

**Interfaces:**
- Consumes: `Question`, `isImageChoiceQuestion` from `@clearpass/core`; `useTheme` from `@/src/theme`; `Colors` from `@/src/constants/theme`; `Speech` from `expo-speech`.
- Produces: `<AnswerOptions question selectedIndex onSelect disabled? isAnswered? highContrast? ttsEnabled? animateOnPress? />` (full prop list below) and exports `LABELS = ['A','B','C','D']` — Tasks 4–8 import both from here instead of each file defining its own `LABELS` constant (currently duplicated in `mock.tsx:46` and `practice.tsx:73`).
- **Prop meaning, so Tasks 4-8 wire the right value per screen:**
  - `isAnswered?: boolean` (default `false`) — when `true`, shows correct/wrong/dimmed reveal styling instead of the plain selected highlight. Mock Test never passes `true` (it has no reveal concept). Battle/Weak Spot/Speed Round pass their own `isAnswered`/`selected !== null` expression. Practice's main quiz passes its own `isAnswered`.
  - `highContrast?: boolean` (default `false`) — border override, pre-answer only. Practice passes `settings.highContrast`; Battle passes `theme.highContrast` (the two screens read this from different sources today — that's existing, not something to reconcile here). Weak Spot and Speed Round don't currently have this at all — pass `false`/omit.
  - `ttsEnabled?: boolean` (default `false`) — only Practice's main quiz has "tap an answered option to hear it again"; pass `settings.textToSpeech`. Also changes the disabled calculation: when `true`, an answered option stays tappable (to trigger speech) instead of fully disabling.
  - `animateOnPress?: boolean` (default `false`) — only Practice's main quiz has the scale-bounce-on-tap animation; pass `true` there, omit everywhere else.
  - `disabled?: boolean` (default `false`) — an additional, unconditional disable (e.g. Mock Test doesn't use this at all today, but it's kept for forward compatibility — pass `false`/omit unless a screen has its own separate reason to force-disable).

- [ ] **Step 1: Create the component**

```tsx
// apps/mobile/src/components/AnswerOptions.tsx
import React, { useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Question, isImageChoiceQuestion } from '@clearpass/core';
import { Colors } from '@/src/constants/theme';
import { useTheme } from '@/src/theme';

export const LABELS = ['A', 'B', 'C', 'D'];

export function AnswerOptions({
  question,
  selectedIndex,
  onSelect,
  disabled = false,
  isAnswered = false,
  highContrast = false,
  ttsEnabled = false,
  animateOnPress = false,
}: {
  question: Question;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  isAnswered?: boolean;
  highContrast?: boolean;
  ttsEnabled?: boolean;
  animateOnPress?: boolean;
}) {
  const theme = useTheme();
  const imageChoice = isImageChoiceQuestion(question);
  const scales = useRef(question.options.map(() => new Animated.Value(1))).current;

  function handlePress(idx: number, optionLabel: string) {
    if (isAnswered) {
      if (ttsEnabled) {
        Speech.stop();
        Speech.speak(optionLabel, { language: 'en-GB' });
      }
      return;
    }
    if (animateOnPress) {
      Animated.sequence([
        Animated.timing(scales[idx], { toValue: 0.95, duration: 70, useNativeDriver: true }),
        Animated.spring(scales[idx], { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }),
      ]).start();
    }
    onSelect(idx);
  }

  return (
    <View style={imageChoice ? styles.imageGrid : styles.textList}>
      {question.options.map((option, idx) => {
        const isCorrect = idx === question.correctIndex;
        const isSelected = idx === selectedIndex;

        let cardStyle: object = styles.optionDefault;
        let badgeStyle: object = styles.badgeDefault;
        let textStyle: object = styles.optionTextDefault;
        let badgeTextStyle: object = styles.badgeTextDefault;

        if (isAnswered) {
          if (isCorrect) {
            cardStyle = styles.optionCorrect; badgeStyle = styles.badgeCorrect;
            textStyle = styles.optionTextCorrect; badgeTextStyle = styles.badgeTextColored;
          } else if (isSelected) {
            cardStyle = styles.optionWrong; badgeStyle = styles.badgeWrong;
            textStyle = styles.optionTextWrong; badgeTextStyle = styles.badgeTextColored;
          } else {
            cardStyle = styles.optionDimmed; textStyle = styles.optionTextDimmed;
          }
        } else if (isSelected) {
          // Pre-answer "selected" highlight — Mock Test's only state (it never
          // reveals correctness); the other 4 screens go straight from
          // unanswered to isAnswered=true in one tap, so they never render this.
          // Mock Test's original block escalated all three parts (card border/
          // background, badge fill, text weight+color), not just the card —
          // match that exactly, it's the same 3-part pattern as the reveal states.
          cardStyle = styles.optionSelected;
          badgeStyle = styles.badgeSelected;
          textStyle = styles.optionTextSelected;
          badgeTextStyle = styles.badgeTextColored;
        }

        const isDisabled = disabled || (isAnswered && !ttsEnabled);
        const contrastBorder = highContrast
          ? { borderWidth: 2, borderColor: isAnswered ? undefined : theme.borderColor }
          : undefined;

        const badge = (
          <View style={[styles.badge, badgeStyle]}>
            <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
          </View>
        );
        const textNode = (
          <Text
            style={[
              styles.optionText,
              textStyle,
              { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing },
            ]}
          >
            {option}
          </Text>
        );

        if (imageChoice) {
          return (
            <Animated.View key={idx} style={[styles.imageOptionWrap, { transform: [{ scale: scales[idx] }] }]}>
              <TouchableOpacity
                style={[styles.imageOption, cardStyle, contrastBorder]}
                onPress={() => handlePress(idx, option)}
                activeOpacity={isDisabled ? 1 : 0.75}
                disabled={isDisabled}
                accessibilityLabel={option}
                accessibilityRole="button"
              >
                {badge}
                <Image source={{ uri: question.optionImages![idx] }} style={styles.optionImage} resizeMode="contain" />
              </TouchableOpacity>
            </Animated.View>
          );
        }

        return (
          <Animated.View key={idx} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={[styles.textOption, cardStyle, contrastBorder]}
              onPress={() => handlePress(idx, option)}
              activeOpacity={isDisabled ? 1 : 0.75}
              disabled={isDisabled}
            >
              {badge}
              {textNode}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  textList: { gap: 10 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  imageOptionWrap: { width: '48%' },
  textOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  imageOption: {
    width: '100%', borderRadius: 16, borderWidth: 1, padding: 8, alignItems: 'center',
  },
  optionImage: { width: '100%', height: 110, marginTop: 6 },
  optionDefault:  { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  optionSelected: { backgroundColor: Colors.indigoBg, borderColor: Colors.indigo, borderWidth: 2 },
  optionCorrect:  { backgroundColor: Colors.emeraldBg, borderColor: Colors.emerald, borderWidth: 2 },
  optionWrong:    { backgroundColor: Colors.redBg, borderColor: Colors.red, borderWidth: 2 },
  optionDimmed:   { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeDefault:   { backgroundColor: Colors.surfaceGray },
  badgeSelected:  { backgroundColor: Colors.indigo },
  badgeCorrect:   { backgroundColor: Colors.emerald },
  badgeWrong:     { backgroundColor: Colors.red },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeTextDefault: { color: Colors.mutedText },
  badgeTextColored: { color: Colors.cardWhite },
  optionText: { flex: 1, lineHeight: 22 },
  optionTextDefault:  { color: Colors.textPrimary },
  optionTextSelected: { color: Colors.textPrimary, fontWeight: '600' },
  optionTextCorrect: { color: Colors.emerald, fontWeight: '600' },
  optionTextWrong:   { color: Colors.red, fontWeight: '600' },
  optionTextDimmed:  { color: Colors.subtleText },
});
```

- [ ] **Step 2: `tsc --noEmit` sanity check (component not wired in yet, just confirming it compiles standalone)**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: same baseline error count, zero new errors from this new file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/AnswerOptions.tsx
git commit -m "feat: add shared AnswerOptions component supporting text and image-choice questions"
```

---

## Task 4: Wire `AnswerOptions` into Mock Test

**Files:**
- Modify: `apps/mobile/app/(tabs)/mock.tsx:380-397` (replace the inline `q.options.map(...)` block)
- Modify: `apps/mobile/app/(tabs)/mock.tsx:46` (remove the now-duplicated local `LABELS` constant, import from the shared component instead)

**Interfaces:**
- Consumes: `AnswerOptions`, `LABELS` from Task 3.

- [ ] **Step 1: Replace the inline options block**

Remove `mock.tsx:46`'s `const LABELS = ['A', 'B', 'C', 'D'];` and the import section adds:
```ts
import { AnswerOptions } from '@/src/components/AnswerOptions';
```

Replace the block at `mock.tsx:378-397` (the `{/* Options */}` section) with:
```tsx
{/* Options */}
<AnswerOptions
  question={q}
  selectedIndex={selectedOption}
  onSelect={handleSelect}
/>
```

- [ ] **Step 2: Remove now-unused styles**

Check `styles.optionList`, `styles.option`, `styles.optionSelected`, `styles.badge`, `styles.badgeSelected`, `styles.badgeText`, `styles.badgeTextSelected`, `styles.optionText`, `styles.optionTextSelected` in `mock.tsx`'s `StyleSheet.create` block — remove any that are now dead code (no longer referenced anywhere else in the file). Grep the file for each style name first to confirm nothing else uses it before deleting.

- [ ] **Step 3: `tsc --noEmit`**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: baseline error count, zero new.

- [ ] **Step 4: Manual verification**

Start the app (`/run` skill or `npx expo start`), open Mock Test, answer a normal text-option question — confirm selection highlighting and submit flow work identically to before. This question set has zero `optionImages` questions until Task 9+ lands, so this step only proves no regression.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/mock.tsx"
git commit -m "refactor: use shared AnswerOptions component in Mock Test"
```

---

## Task 5: Wire `AnswerOptions` into Practice (main quiz view)

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:1178` (main `PracticeScreen` quiz render — the block spans roughly lines 1176-1225: the `<View style={styles.optionList}>...` through its closing `</View>`)
- Modify: `apps/mobile/app/(tabs)/practice.tsx:73` (remove duplicated local `LABELS`)

This screen has the richest existing behavior of all 5: reveal styling (`isAnswered`), a high-contrast border override (`settings.highContrast`), tap-to-hear-again via TTS once answered (`settings.textToSpeech`), and a scale-bounce tap animation — all of which `AnswerOptions` (Task 3, revised) now supports via props.

- [ ] **Step 1: Replace the inline options block**

The existing block (verified present at these exact lines) uses local variables `selectedIndex` (the selected index state), `isAnswered` (already in scope, not redeclared inline), `handleAnswer` (the select handler), and `settings.highContrast` / `settings.textToSpeech`. **Keep the existing outer `<View style={styles.optionList}>` wrapper — do not remove it, only replace its `.map(...)` children.** `styles.optionList` (`{ gap: 10, marginBottom: 14 }`) supplies real spacing this screen's `ScrollView` content container doesn't otherwise provide (unlike Mock Test's, which has its own `gap: 12` on the container — that's why `AnswerOptions`'s internal wrapper deliberately has no `marginBottom` of its own, so it doesn't double up when Mock Test's parent already spaces it). Dropping this wrapper loses the 14px gap before the next element (the explanation box) on every answered question — found and must be avoided this time. Replace the block as:
```tsx
<View style={styles.optionList}>
  <AnswerOptions
    question={question}
    selectedIndex={selectedIndex}
    onSelect={(idx) => void handleAnswer(idx)}
    isAnswered={isAnswered}
    highContrast={settings.highContrast}
    ttsEnabled={settings.textToSpeech}
    animateOnPress
  />
</View>
```
If any of these 4 identifier names (`selectedIndex`, `isAnswered`, `handleAnswer`, `settings`) don't actually match what's in scope at this exact call site once you read the surrounding ~40 lines, use the real names — this is the expected shape based on this session's direct reading of the file, not a guarantee line numbers haven't shifted by the time you implement.

- [ ] **Step 2: Remove the local `LABELS` constant at line 73**, import `AnswerOptions` (and `LABELS` only if still referenced elsewhere in this file, e.g. the text-to-speech option-reading logic at lines 277/1149 which builds `Option ${LABELS[i]}: ${opt}` strings — keep using the shared `LABELS` export there instead of a local copy).

- [ ] **Step 3: Remove now-dead per-option styles** in this file's `StyleSheet.create` (`optionDefault`, `optionCorrect`, `optionWrong`, `optionDimmed`, `badgeDefault`, `badgeCorrect`, `badgeWrong`, `badgeTextDefault`, `badgeTextColored`, `optionTextDefault`, `optionTextCorrect`, `optionTextWrong`, `optionTextDimmed`, and the base `option`/`badge`/`badgeText`/`optionText` if nothing else in this large file still uses them). **Do NOT remove `optionList`** — unlike the others, it's still actively used as the wrapper around `<AnswerOptions>` (see Step 1), not dead. Grep each remaining name first, this file has multiple view components and some style names may be reused elsewhere (e.g. Battle/Weak Spot/Speed Round currently share this same `StyleSheet.create` block, and won't stop needing these styles until Tasks 6-8 also land — **do not remove any of these styles until Task 8 is also complete and nothing in the file references them**; if in doubt, leave the cleanup for whichever of Tasks 5-8 finishes last and note it in your report rather than risk breaking a sibling mode that hasn't been migrated yet).

- [ ] **Step 4: `tsc --noEmit`, then manually verify** a normal Practice session renders and answers correctly: tap an option, confirm correct/wrong/dimmed coloring appears, confirm the bounce animation still plays on tap, confirm tapping an answered option speaks it aloud when text-to-speech is enabled in settings (no `optionImages` questions exist in the bank yet, so this only proves the text-option path has no regression).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "refactor: use shared AnswerOptions component in Practice main quiz view"
```

---

## Task 6: Wire `AnswerOptions` into Battle mode

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:1759` (`BattleView`, function starts ~line 1677; options block spans roughly 1757-1797)

Simpler than Task 5 — Battle has reveal styling but no animation and no TTS-tap-to-repeat. It computes `isAnswered` inline as `selected !== null` (not a separate state variable like the main quiz), uses `selected` for the selection state, `onAnswer` as the handler, and reads the high-contrast flag from `theme.highContrast` (not `settings.highContrast` — a different source than Task 5's screen; this is pre-existing, not something to reconcile).

- [ ] **Step 1: Read `BattleView`'s existing state/handlers around line 1677-1812 first** to confirm `selected`, `onAnswer`, and `theme.highContrast` are still the real names before editing — line numbers may have shifted since this session's reading.

- [ ] **Step 2: Replace the inline options block** — keep the existing outer `<View style={styles.optionList}>` wrapper (do not remove it; it supplies real spacing `AnswerOptions` deliberately doesn't — see Task 5's note if unclear why) — with:
```tsx
<View style={styles.optionList}>
  <AnswerOptions
    question={question}
    selectedIndex={selected}
    onSelect={onAnswer}
    isAnswered={selected !== null}
    highContrast={theme.highContrast}
  />
</View>
```

- [ ] **Step 3: `tsc --noEmit`, then manually verify** a Battle round still scores/combos correctly, reveal coloring appears immediately on tap (Battle has no separate "selected but not revealed" moment), spacing before the next element looks unchanged, with no `optionImages` questions.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "refactor: use shared AnswerOptions component in Battle mode"
```

---

## Task 7: Wire `AnswerOptions` into Weak Spot mode

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:1972` (`WeakSpotView`, function starts ~line 1904; options block spans roughly 1971-1995, wrapped in a `{!showCleared && (...)}` conditional — keep that wrapper, only replace the `<View style={styles.optionList}>...` inside it)

Uses `selected` for selection state, a pre-existing `isAnswered` variable already in scope (not recomputed inline), and `onAnswer` as the handler. This screen doesn't currently have a high-contrast border override at all (unlike Battle/Practice) — don't add one that wasn't there before.

- [ ] **Step 1: Read `WeakSpotView`'s state/handlers (line 1904-2016) first** to confirm `selected`, `isAnswered`, `onAnswer` are still accurate, then replace the inner options block — keep its existing `<View style={styles.optionList}>` wrapper (do not remove; see Task 5's note) — with:
```tsx
<View style={styles.optionList}>
  <AnswerOptions
    question={question}
    selectedIndex={selected}
    onSelect={onAnswer}
    isAnswered={isAnswered}
  />
</View>
```
- [ ] **Step 2: `tsc --noEmit`, then manually verify** Weak Spot mode still functions: reveal coloring, spacing before the next element, the "Cleared!" banner logic (`showCleared`) and post-answer explanation banner are untouched by this change, no `optionImages` questions yet.
- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "refactor: use shared AnswerOptions component in Weak Spot mode"
```

---

## Task 8: Wire `AnswerOptions` into Speed Round mode

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:2130` (`SpeedRoundView`, function starts ~line 2073; options block spans roughly 2129-2168)

Structurally identical to Battle: `selected` for selection state, `isAnswered` computed inline as `selected !== null`, `onAnswer` as the handler, no high-contrast override in this screen today.

- [ ] **Step 1: Read `SpeedRoundView`'s state/handlers (line 2073-2183) first** to confirm `selected`/`onAnswer` are still accurate — this mode is timed, confirm selection auto-submits (no separate confirm step) before replacing the block — keep its existing `<View style={styles.optionList}>` wrapper (do not remove; see Task 5's note) — with:
```tsx
<View style={styles.optionList}>
  <AnswerOptions
    question={question}
    selectedIndex={selected}
    onSelect={onAnswer}
    isAnswered={selected !== null}
  />
</View>
```
- [ ] **Step 2: `tsc --noEmit`, then manually verify** Speed Round's timer/scoring still works, reveal coloring appears on tap, spacing before the next element looks unchanged, no `optionImages` questions yet.

- [ ] **Step 3: Now that all of Tasks 5-8 are done, remove the dead per-option styles** flagged in Task 5 Step 3 (`optionDefault`, `optionCorrect`, `optionWrong`, `optionDimmed`, `badgeDefault`, `badgeCorrect`, `badgeWrong`, `badgeTextDefault`, `badgeTextColored`, `optionTextDefault`, `optionTextCorrect`, `optionTextWrong`, `optionTextDimmed`, base `option`/`badge`/`badgeText`/`optionText`) from `practice.tsx`'s `StyleSheet.create` — grep each name first to confirm nothing in the file (including `ResultsScreen`, `BattleResultsScreen`, etc.) still references it before deleting. **Do NOT remove `optionList`** — it's still actively used as the wrapper around every `<AnswerOptions>` call site in this file (Tasks 5-8 all keep it deliberately, see Task 5 Step 1's note on why `AnswerOptions` itself doesn't supply this spacing).

- [ ] **Step 3b: Clean up the now-fully-dead reveal-bounce animation** in `PracticeScreen` (found during Task 5's review): the `optionScales` ref, its per-question reset `useEffect`, and the "bounce correct answer on reveal" `useEffect` (originally around lines 234-260, keyed on `selectedIndex`, animating `optionScales[q.correctIndex]` via `Animated.spring` to 1.04 and back) no longer render into anything — `AnswerOptions` uses its own internal per-option scale refs for the tap-bounce, so this old ref array is orphaned. This was assessed as a Minor, polish-only loss (the actual correct/wrong color-and-badge reveal is unaffected and fully preserved) — not worth its own fix cycle, but clean it up now as dead code while touching this area. Confirm via grep that `optionScales` has no other readers before deleting the ref and both effects.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "refactor: use shared AnswerOptions component in Speed Round mode; remove dead per-option styles"
```

**Checkpoint after Task 8:** all 5 question-rendering surfaces (Mock Test, Practice, Battle, Weak Spot, Speed Round) now support `optionImages` structurally, and zero content has been changed yet. This is the right point to pause and confirm the refactor introduced no regressions across every mode before touching any question data.

---

## Task 9: Split the 2 montage images and wire `AB2674` / `AB2768`

No new assets needed — `TS4509.png` and `TS4682.png` are already-correct 430×430 2×2 grids of 4 distinct signs each (confirmed by direct visual inspection during this planning phase).

**Files:**
- Modify: `packages/content/src/questions/roadsigns.ts` (both `AB2674` and `AB2768` entries)
- Create (uploaded to Supabase, not local repo files): 8 new cropped images

- [ ] **Step 1: Download both source montages**

```bash
curl -sS -o TS4509.png "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4509.png"
curl -sS -o TS4682.png "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4682.png"
```

- [ ] **Step 2: Crop each into 4 quadrants** (each source is 430×430, so each quadrant is 215×215 — use whatever image tool is available, e.g. ImageMagick if installed: `convert TS4509.png -crop 215x215+0+0 TS4509-A.png`, repeating for `+215+0` (B), `+0+215` (C), `+215+215` (D) — check actual crop boundaries visually first since the montage grid lines may not be exactly centered).

- [ ] **Step 3: Identify which quadrant is the correct answer for each question** — for both `AB2674` ("priority over oncoming vehicles") and `AB2768` ("no through road"), the **bottom-left** quadrant (blue square sign, in both cases) is correct, matching `correctIndex: 2` under row-major reading order (0=TL, 1=TR, 2=BL, 3=BR) — verified by cross-checking against the source's existing `correctIndex` value, not just visual inspection alone (an earlier pass in this plan had mistakenly said "bottom-right" for `AB2674` before this cross-check; corrected here). Confirm `correctIndex` in each question object matches the position you upload the correct quadrant to.

- [ ] **Step 4: Upload all 8 crops to the Supabase `question-images` bucket** (needs `SUPABASE_SERVICE_KEY` — see `apps/mobile/server/.env` pattern used by existing scripts in `apps/mobile/server/scripts/`). Use a clear naming convention, e.g. `TS4509-A.png` / `TS4509-B.png` / `TS4509-C.png` / `TS4509-D.png`.

- [ ] **Step 5: Update the question data**

```ts
// packages/content/src/questions/roadsigns.ts — AB2674 entry
{
  id: "AB2674",
  questionText: "Which sign means you have priority over oncoming vehicles?",
  options: [
    "Two-way traffic ahead",
    "Two-way traffic straddling a single lane",
    "One-way street",
    "Give priority to vehicles from the opposite direction",
  ],
  correctIndex: 3, // adjust to match whichever slot the correct quadrant was uploaded to
  optionImages: [
    "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4509-A.png",
    "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4509-B.png",
    "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4509-C.png",
    "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4509-D.png",
  ],
  explanation: "...", // keep existing explanation text
  topicCategory: TopicCategory.RoadAndTrafficSigns,
  difficulty: 1,
},
```
Remove the old single `imageUrl` field. Repeat the same pattern for `AB2768` with `TS4682-*.png` crops and appropriate option label text (write accessible labels describing each sign in words, matching the DVSA options for this question).

- [ ] **Step 6: Verify with the validator and a URL check**

Run `cd packages/content && npx vitest run validateQuestions` — the regression-guard test from Task 2 will still fail (there are 25 remaining violations after this task), but check its failure diff no longer lists `AB2674` or `AB2768` among the errors, confirming these two are now fixed specifically.

Also re-run an HTTP HEAD check against all 8 new URLs (same technique as the original audit) to confirm they resolve before considering this done.

- [ ] **Step 7: Manual verification** — open Mock Test or Practice, find `AB2674` or `AB2768` (may need a way to jump to a specific question ID for testing, or answer through until it appears), confirm 4 tappable images render correctly and selecting the right one scores correctly.

- [ ] **Step 8: Commit**

```bash
git add packages/content/src/questions/roadsigns.ts
git commit -m "fix: convert AB2674/AB2768 to 4-image format using split montage assets"
```

---

## Task 10: Wire up the 18 zero-cost missing-image fixes

Discovered during planning, approved for inclusion: all 18 of the original audit's "missing image" questions have a matching, ID-named file sitting unused in the bucket — confirmed by diffing the bucket's 151 files against the 133 in active use.

**Files:**
- Modify: `packages/content/src/questions/hazardAwareness.ts`, `roadsigns.ts`, `rulesOfTheRoad.ts` (wherever each ID lives)

- [ ] **Step 1: For each of the 18 confirmed IDs** (`AB2087`, `AB2088`, `AB2301`, `AB2305`, `AB2332`, `AB2343`, `AB2367`, `AB2381`, `AB2400`, `AB2737`, `AB2765`, `AB2889`, `BB1013`, `BB1207`, `BB1213`, `BB1351`, `BB1439`, `BB1664` — all confirmed as real questions currently missing an image, matched 1:1 by ID to an unused bucket file), add:
```ts
imageUrl: "https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/<ID>.png",
```
to each question's existing entry (no other fields change).

- [ ] **Step 2: Visually spot-check at least 5 more of these beyond the 2 already confirmed during planning** (`AB2301`, `BB1207`) before bulk-committing — download and view each, compare against its question text and correct answer, same method used throughout the audit.

- [ ] **Step 3: Run the URL-check script against all 18 to confirm 200 OK** (already known good from the bucket listing, but re-verify post-wiring).

- [ ] **Step 4: `tsc --noEmit`, commit**

```bash
git add packages/content/src/questions/*.ts
git commit -m "fix: wire up 18 previously-unused bucket images to their matching questions"
```

---

## Task 11: Extract official DVSA per-option images from the licence archive for all 22 remaining image-choice questions

**⚠️ Superseded the original "reuse pack / decision needed" plan below — resolved by locating the original DVSA source.** The blank-options bug's root cause (Task 1-2 investigation) named the exact source file: `Car (Cat B) QB Feb 2026.xlsx` from commit `f7caf69`. That file still exists, on disk, inside the licence delivery archive: `dvsa-clips/revision-materials/wetransfer_dvsa-revision-materials_2026-06-19_1306.zip` → `Car Updates/Latest Question Bank - February 2026/Car (Cat B) QB Feb 2026.xlsx`.

**What was found, verified this session (not assumed):**
- The spreadsheet has dedicated per-option image columns (`A.gif`/`B.gif`/`C.gif`/`D.gif`, and hi-res `A HiRes`/`B HiRes`/`C HiRes`/`D HiRes`) that were never mapped during the original import — only the question-level `Stem.gif`/`Stem HiRes` columns made it into the app. This is the exact mechanism of the bug: the per-option data always existed, it just never got imported.
- All 22 remaining image-needing questions (the 19 from the original 4-image list, plus `BB1591`/`AB2401`/`BB1237` from what was Task 13 — **all three of those also resolve via this exact same source and pipeline, folding Task 13 entirely into this task**) have complete hi-res filenames for all 4 options in the spreadsheet.
- Cross-referenced all 64 unique needed filenames against the rest of the archive (`Cars 2016 Hi Res.zip`, plus a few `Additional images`/`Cat B Hi-res 2022` folders) — **100% present**, nothing missing.
- Independently cross-checked the spreadsheet's letter-based "Current Answer" (A/B/C/D) against every one of the 22 questions' existing `correctIndex` in the app — **all 22 match** (A=0, B=1, C=2, D=3). This means `correctIndex` needs **no changes** for any of these 22 — the app's original import got this part right; it just dropped the images. Confirmed one genuine pre-existing wrong-image bug this same data explains: `AB2892`'s current stopgap `imageUrl` is `IMG_055b.jpg` (index 1), but the verified correct answer is `IMG_055c.jpg` (index 2) — this gets fixed as a side effect of this task.
- Validated the full conversion pipeline end-to-end on real files, not just in theory:
  - Most source files are `.eps` (vector) → Ghostscript (`gs`, already installed on this machine) renders to PNG, then PIL's `Image.getbbox()` + `.crop()` trims the large blank canvas down to just the sign artwork. Tested on `TS4051.eps` → clean, correctly-cropped, transparent-background PNG.
  - A few are `.tif` (the `AB2401` road-marking diagrams, `TS4045-4048.tif`) → PIL opens these directly (`Image.open(...).convert('RGBA')`). Tested on `TS4045.tif` → correct colors, clean diagram, proper transparency.
  - 4 are already `.jpg` (`IMG_055`/`055a`/`055b`/`055c`, shared between `AB2892` and `BB1237` — same 4 official arm-signal reference photos, each question just points at a different one as correct) → usable as-is, no conversion needed.

**Complete per-question reference data** (verified this session — hi-res filenames in `[A,B,C,D]` order, matching each question's existing, unchanged `correctIndex`):

| ID | Question | Files (A,B,C,D order) |
|---|---|---|
| `AB2935` | Which sign shows that a tanker is carrying dangerous goods? | `TS4055.eps, TS4051.eps, TS4627.eps, TS4517.eps` |
| `AB2176` | You're about to overtake a slow-moving motorcyclist... | `TS4518.eps, TS4664.eps, TS4693.eps, TS4691.eps` |
| `AB2304` | Which sign means 'no entry'? | `TS4691.eps, TS4690.eps, TS4675.eps, TS4667.eps` |
| `AB2307` | Which sign means no motor vehicles allowed? | `TS4674.eps, TS4669.eps, TS4670.eps, TS4672.eps` |
| `AB2314` | Which sign means 'no stopping'? | `TS4674.eps, TS4691.eps, TS4675.eps, TS4670.eps` |
| `AB2347` | Which sign means that pedestrians may be walking along the road? | `TS4647.eps, TS4648.eps, TS4646.eps, TS4649.eps` |
| `AB2351` | Which sign means there's a double bend ahead? | `TS4577.eps, TS4637.eps, TS4636.eps, TS4635.eps` |
| `AB2357` | Which sign means the end of a dual carriageway? | `TS4638.eps, TS4639.eps, TS4642.eps, TS4640.eps` |
| `AB2375` | Which is the sign for a ring road? | `TS4663.eps, TS4634.eps, TS4685.eps, TS4691.eps` |
| `AB2389` | ...Which signal means you must wait? | `TS4014.eps, TS4015.eps, TS4013.eps, TS4016.eps` |
| `AB2429` | Which sign means that the national speed limit applies? | `TS4667.eps, TS4668.eps, TS4691.eps, TS4675.eps` |
| `AB2885` | Which sign shows that you're entering a one-way system? | `TS4604.eps, TS4693.eps, TS4666.eps, TS4699.eps` |
| `AB2887` | Which of these signs warns you of a zebra crossing? | `TS4646.eps, TS4647.eps, TS4648.eps, TS4649.eps` |
| `AB2890` | Which sign means there will be two-way traffic crossing your route ahead? | `TS4666.eps, TS4642.eps, TS4641.eps, TS4662.eps` |
| `AB2892` | Which arm signal tells you that the car you're following is going to pull up? | `IMG_055.jpg, IMG_055b.jpg, IMG_055c.jpg, IMG_055a.jpg` |
| `AB2897` | Which sign means turn left ahead? | `TS4523.eps, TS4524.eps, TS4525.eps, TS4526.eps` |
| `AB2117` | Which sign means that there may be people walking along the road? | `TS4672.eps, TS4703.eps, TS4646.eps, TS4647.eps` |
| `AB2295` | Which type of sign tells you what you must not do? | `TS4668.eps, TS4003.eps, TS4004.eps, TS4005.eps` |
| `AB2212` | Which plate may appear with this road sign? | `TS4654.eps, TS4090.eps, TS4065.eps, TS4067.eps` |
| `BB1591` | Which instrument-panel warning light would show headlights are on main beam? | `TS4035f.eps, TS4035c.eps, TS4035i.eps, TS4039.eps` |
| `AB2401` | Which diagram shows a hazard warning line? | `TS4045.tif, TS4046.tif, TS4047.tif, TS4048.tif` |
| `BB1237` | How should you give an arm signal to turn left? | `IMG_055a.jpg, IMG_055c.jpg, IMG_055, IMG_055b.jpg` |

This task is split into two sub-tasks for manageable scope: 11a (bulk image pipeline) and 11b (wiring all 22 questions). Do not remove the source archive or any extracted intermediate files without confirming Task 14 is fully green first.

### Task 11a: Extract, convert, and upload all 64 unique images

**Files:** none in the repo — this uploads to Supabase Storage only. Working files go in a scratch directory, not the repo.

- [ ] **Step 1:** Extract `Car Updates/Latest Question Bank - February 2026/Car (Cat B) QB Feb 2026.xlsx` from the archive (already done this session, for reference — the path is `dvsa-clips/revision-materials/wetransfer_dvsa-revision-materials_2026-06-19_1306.zip`), and the two bulk image archives it references: `Car Updates/Historical question banks and updates - for reference only/Hi-res images/Cars 2016 Hi Res.zip` (contains 59 of the 64 needed files) and check `Car Updates/Car Images/Cat B Hi-res 2022/Cat B Hi-res 2022/` subfolders for the remaining 5 (`IMG_055.jpg`, `IMG_055a.jpg`, `IMG_055b.jpg`, `IMG_055c.jpg` in `AB Hi-Res (1)/`, and `TS4662.eps` in `BB Hi-Res/`).

- [ ] **Step 2:** For each of the 64 unique filenames in the reference table above, convert to PNG:
  - `.eps` files: `gs -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r150 -sOutputFile=<name>.png <name>.eps`, then crop with PIL: `img = Image.open(...); img = img.crop(img.getbbox()); img.save(...)`.
  - `.tif` files: `Image.open(...).convert('RGBA').save(...)` directly, no cropping needed (already tightly framed).
  - `.jpg` files: use as-is, or convert to PNG for consistency with the rest of the bucket — your call.

- [ ] **Step 3:** Upload all resulting PNGs to the Supabase `question-images` bucket (service-role credentials at `apps/mobile/server/.env`, already used in Tasks 9-10). Use the original filename stem with a `.png` extension (e.g. `TS4051.png`) — check first whether any of these 64 stems already exist in the bucket under a different extension or with slightly different content (e.g. `TS4051.png` may already exist from an earlier upload, per Task 9/10's bucket listing work) and do not silently overwrite an existing asset without checking it's actually the same image first.

- [ ] **Step 4:** Verify all 64 resulting URLs resolve with HTTP 200.

- [ ] **Step 5:** Spot-check at least 10 of the 64 converted images visually (view them, not just check they exist) to confirm the EPS/TIF conversion didn't introduce any visual corruption, color issues, or bad crops — include at least 2 of the `.tif` conversions and the 4 `.jpg` files in what you check.

No commit for this sub-task (nothing in the repo changes yet) — report the full list of uploaded URLs for Task 11b to consume.

### Task 11b: Wire all 22 questions with their `optionImages`

**Files:**
- Modify: `packages/content/src/questions/roadsigns.ts`, `hazardAwareness.ts` (or wherever `AB2935`/`AB2176`/`AB2117` actually live — confirm via grep), `attitude.ts` (`BB1591`)

- [ ] **Step 1:** For each of the 22 questions in the reference table, using the URLs uploaded in Task 11a: add `optionImages: [urlA, urlB, urlC, urlD]` in the exact `[A,B,C,D]` order shown in the table. Do **not** change `correctIndex` for any of them — verified this session to already be correct. Remove any existing single `imageUrl` field (e.g. `AB2892` currently has one pointing at the wrong image — remove it, the new `optionImages` array supersedes it).

- [ ] **Step 2:** Write genuine, specific accessible text labels for each `options[i]` entry (these become the screen-reader/TTS label for each image, same pattern as Task 9) — describe what each image actually shows, not a placeholder. View each image before writing its label, don't guess from the filename alone.

- [ ] **Step 3:** Run `cd packages/content && npx vitest run validateQuestions` — confirm all 22 of these IDs are no longer in the violation list (expect the count to drop to 3: `AB2294`, `AB2324`, `AB2763`, which Task 12 handles).

- [ ] **Step 4:** Run `cd apps/mobile && npx tsc --noEmit` — confirm the established baseline, zero new errors.

- [ ] **Step 5:** Commit. Given the volume (22 questions across possibly 3+ files), consider one commit for the whole batch is reasonable here (unlike Task 13's original per-question guidance) since it's one uniform mechanical change with one clear verification gate (the validator) — your call if you'd rather split by file.

```bash
git commit -m "fix: restore official DVSA per-option images for 22 image-choice questions"
```

---

## Task 12: Extract DVSA images for `AB2294`, `AB2324`, `AB2763` (not a text conversion — plan corrected)

**⚠️ The original plan for this task (convert to text options, using `AB2293` as a sibling template) was wrong — corrected after checking the DVSA source spreadsheet directly, same one mined in Task 11.** `AB2293` (the assumed template) turns out to have *no* image data at all in the source — a genuinely different, unrelated text-only question, not a sibling of this pattern. All three of `AB2294`, `AB2324`, `AB2763` in fact have complete per-option hi-res image references in the source spreadsheet, exactly like the 22 questions in Task 11 — they're real 4-image-choice questions, not shape-description text questions. Cross-checked `correctIndex` alignment (all 3 already match the source's letter-based answer, no changes needed) using the same method as Task 11.

**Per-question reference data** (verified this session, same `[A,B,C,D]` order convention as Task 11 — one file, `TS4668.eps` → `TS4668.png`, was already converted/uploaded in Task 11a; the other 7 are new):

| ID | Question | Files (A,B,C,D order) |
|---|---|---|
| `AB2294` | What shape are traffic signs giving orders? | `TS4073b.eps, TS4073d.eps, TS4629.eps, TS4668.eps` |
| `AB2324` | What shape is a 'stop' sign? | `TS4668.eps, TS4629a.eps, TS4002.eps, TS4031.eps` |
| `AB2763` | Which shape is used for a 'give way' sign? | `TS4629a.eps, TS4668.eps, TS4031.eps, TS4630.eps` |

(All 8 unique filenames — `TS4073b`, `TS4073d`, `TS4629`, `TS4668`, `TS4629a`, `TS4002`, `TS4031`, `TS4630` — confirmed present in the same `Cars 2016 Hi Res.zip` used for Task 11a.)

**Files:**
- Modify: `packages/content/src/questions/roadsigns.ts` (all 3 entries — confirm exact location via grep)

- [ ] **Step 1:** Extract, convert (EPS → Ghostscript render → PIL crop-to-bbox, identical to Task 11a's method), and upload the 7 new files to the Supabase `question-images` bucket (check first whether any already exist under a different upload, same diligence as Task 11a). Reuse the already-uploaded `TS4668.png` URL for its 3 appearances across these questions rather than re-uploading.

- [ ] **Step 2:** For each of the 3 questions: add `optionImages: [urlA, urlB, urlC, urlD]` in the exact order shown above (matches existing, unchanged `correctIndex`), remove any existing `imageUrl` (all 3 currently have a single wrong/generic stopgap image — e.g. `AB2294`'s current `TS4073d.png` turns out to genuinely be one of the 4 real options, just previously used incorrectly as if it were the single answer), and write genuine accessible labels per option after viewing each image (same standard as Task 11b).

- [ ] **Step 3:** Run `cd packages/content && npx vitest run validateQuestions` — confirm all 3 are gone from the violation list (expect **0 remaining violations** — this is the last of the original 27).

- [ ] **Step 4:** `cd apps/mobile && npx tsc --noEmit` — confirm established baseline, zero new.

- [ ] **Step 5:** Spot-check all 3 end-to-end (only 3 questions, no need to sample) — confirm each `optionImages[correctIndex]` genuinely shows the right shape/sign for its question.

- [ ] **Step 6:** Commit.

```bash
git commit -m "fix: restore official DVSA per-option images for AB2294/AB2324/AB2763"
```

---

## Task 13: ~~Resolve `BB1591`, `AB2401`, `BB1237`~~ — fully absorbed into Task 11

No separate work needed. All three were suspected to need new sourcing or a text-option conversion, but the DVSA source-archive discovery (Task 11) found and verified official per-option images for all three, via the exact same pipeline as the other 19 — see Task 11's reference table. `BB1591` → `TS4035f/c/i.eps` + `TS4039.eps` (dashboard warning-light icons, confirmed image-choice format as suspected). `AB2401` → `TS4045-4048.tif` (road-marking diagrams, confirmed image-choice format as suspected). `BB1237` → the same 4 official arm-signal photos already used for `AB2892` (`IMG_055`/`055a`/`055b`/`055c`), just with a different one as the correct answer — so no separate photo shoot or stock sourcing was ever needed, and no text-option conversion either, despite that being the earlier guess.

---

## Task 14: Final validation pass

**Files:**
- Modify: `packages/content/src/index.ts` (remove the now-stale `hasUsableOptions` filter — see Step 0 below)

- [ ] **Step 0: Remove the stopgap filter, once (and only once) Step 1 below confirms 0 violations**

`packages/content/src/index.ts:18-24,41` has a `.filter(hasUsableOptions)` on `allQuestions`, added 2026-07-06 (commit `6b033fb`) specifically to hide these exact 27 questions from users until they had real content — its own comment says "excluded from the pool until that pack arrives." Once Tasks 9–13 give every one of them real non-blank `options[i]` text, this filter has nothing left to exclude and becomes dead code with a misleading comment. Remove the `hasUsableOptions` function, its comment, and the `.filter(hasUsableOptions)` call so `allQuestions` is the plain concatenation again — restoring the full 752-question pool to users. Do this only after Step 1 confirms zero violations; removing it earlier would re-expose any not-yet-fixed question as a blank-button question to real users.

- [ ] **Step 1: Run the full content validator**

Run: `cd packages/content && npx vitest run validateQuestions`
Expected: the Task 2 Step 5 regression-guard test now PASSES (empty array) when run against the raw per-topic arrays. If Task 11 or 13's decisions are still pending for any question, this will legitimately still fail with the outstanding IDs listed in the diff — that's an honest progress signal, not a broken test; don't weaken the assertion to force a pass, and don't do Step 0 above until this is genuinely empty.

- [ ] **Step 2: Re-run the full unique-image-URL HTTP check** (same script used in the original audit) across the now-larger set of referenced URLs, confirm 0 broken.

- [ ] **Step 3: Regenerate the contact-sheet HTML** (same generator script used for the visual spot-check) against the updated question data, and do a final visual pass to confirm every previously-flagged image now looks correct.

- [ ] **Step 4: Update `docs/audits/2026-07-16-question-image-audit.md`** with a "resolved" section noting what changed, so the audit document stays accurate as a historical record rather than going stale.

- [ ] **Step 5: `tsc --noEmit` one last time across the whole change set, confirm baseline-only errors, then this body of work is done.**

---

## Self-review notes

- **Spec coverage:** Root cause (investigation section) ✓. 4-image data model (Task 1) ✓. UI rendering across all 4+1 quiz surfaces (Tasks 3-8) ✓. Existing-asset audit for the 2 montages (Task 9) and the wider 19-question set (Task 11 Step 1) ✓. Straightforward corrections, resolved as absorbed into Tasks 9/11/12 rather than a separate task, with the reasoning shown ✓. New-asset sourcing decision flagged, not guessed (Tasks 11 & 13) ✓. 18 zero-cost bucket fixes and `AB2295`/`AB2212` inclusion confirmed and folded into Tasks 10/11 ✓.
- **Two decision points are genuinely blocking** (Task 11 Step 3, Task 13 Step 1) — the plan cannot be fully executed end-to-end without input on sourcing method and format (image vs. text) for the residual few. Everything else (Tasks 1-12) can proceed without further decisions.
- **Environment corrections made post-write, before execution:** this repo has no `jest`, `ts-node`, or `tsx` — `packages/core`/`packages/content` use `vitest` directly. All test-runner references fixed to `npx vitest run`; the "manual verification script" steps (Task 2 Step 5, Task 9 Step 6, Task 14 Step 1) were rewritten as a real regression test against `allQuestions` rather than an unrunnable `node -e require('*.ts')` snippet, since plain Node can't load TypeScript directly. `packages/content` also needed a `vitest` devDependency + test script added from scratch (Task 2 Step 0) — it had neither before this plan.
- **Placeholder scan:** no TBD/TODO left in any step; every code block is complete; file paths and line numbers are exact, taken directly from this session's research rather than assumed.
