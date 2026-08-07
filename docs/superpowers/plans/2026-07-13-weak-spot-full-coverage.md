# Weak-Spot Full-Coverage Wire-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Battle mode, Speed Round, and Mock Test feed the weak-spot tracker (`recordWeakSpotResult`) the same way Start Practice already does, so users who mainly play those modes can also unlock and use Weak Spot Drill.

**Architecture:** `recordWeakSpotResult(questionId, correct)` (`apps/mobile/src/storage.ts:263-271`) is a fire-and-forget AsyncStorage write, independent of any screen's own result object. Each mode already computes per-question `correct`/`isCorrect` at a single well-defined grading moment; we add one `void recordWeakSpotResult(...)` call at each of those three moments, mirroring the existing call in Practice's `handleAnswer` (`practice.tsx:744`). No new storage, no schema change, no new abstraction.

**Tech Stack:** React Native / Expo Router app (`apps/mobile`), TypeScript, AsyncStorage. No unit test framework exists in this app (Playwright e2e only — zero unit tests today for `storage.ts`, `practice.tsx`, or `mock.tsx`). Introducing one is out of scope for this task, so each task is verified with `npx tsc --noEmit` plus a manual runtime smoke test, not new unit tests.

## Global Constraints

- Do not change `recordWeakSpotResult`, `getWeakSpotQuestions`, or the "wrong twice = weak spot / 5 distinct = unlock" thresholds in `apps/mobile/src/storage.ts` and `practice.tsx:1373` — only add new *call sites* that feed the existing logic.
- Do not change the `MockTestResult` type (`packages/core/src/types/MockTestResult.ts`) or anything persisted to `progress.mockTestHistory` / Supabase `user_progress` — weak-spot data stays entirely in the separate `@clearpass/wrong_counts` AsyncStorage key, untouched by this change (see Design Decisions below).
- Match each mode's own existing correctness expression exactly (`optionIndex === q.correctIndex` for Battle/Speed Round, `ans[i] === qs[i].correctIndex` for Mock Test) — do not introduce a second, possibly-diverging definition of "correct."
- All edits are in `apps/mobile/app/(tabs)/practice.tsx` and `apps/mobile/app/(tabs)/mock.tsx`. Commit using the repo's normal git identity (this is the `clearpass` repo, not `zen-footy` — no identity override applies here).

## Design Decisions (resolved during research, not left to the implementer)

1. **`MockTestResult` shape does NOT need to change.** `doSubmit()` in `mock.tsx` already computes per-question correctness transiently inside `scoreTest()`'s loop before collapsing it into topic tallies. `recordWeakSpotResult` is a side-effect call independent of what gets stored in `MockTestResult` — so per-question data is captured and immediately discarded (fed into AsyncStorage, not into the result object). This means **no downstream consumer is affected**: not `syncProgressToCloud`/Supabase `user_progress`, not `progress.tsx`, `instructor.tsx`, `passProbability.ts`, `tutorNudges.ts`, `celebrations.ts`, `RoadmapPath.tsx`, or `screenshot-mode.tsx`'s fixture data. No migration/backfill is needed for existing users — this only affects new results going forward, same as how Practice mode's weak-spot data has never been backfilled retroactively.
2. **Unanswered Mock Test questions count as wrong for weak-spot purposes**, matching `scoreTest`'s own tally (`answers[i] === q.correctIndex` is `false` when `answers[i]` is `null`). This keeps weak-spot recording consistent with the score the user is shown — no separate "skipped" handling.
3. **Disabled-state copy is unchanged.** The copy at `practice.tsx:1402` ("Keep practising -- we will identify your weak spots after a few sessions") never names Practice specifically — it's already mode-agnostic and remains accurate now that four modes contribute. No edit needed; this was verified by reading the surrounding `StartView` component, not assumed.
4. **The "wrong twice / 5 distinct" logic is untouched.** `getWeakSpotQuestions()` (`storage.ts:273-282`) and `hasWeakSpots = weakSpotCount >= 5` (`practice.tsx:1373`) are pure readers of the same `@clearpass/wrong_counts` map; adding more writers doesn't change how that map is read or gated.

---

### Task 1: Battle mode — record weak-spot result on each answer

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:427-428` (inside `handleBattleAnswer`)

**Interfaces:**
- Consumes: `recordWeakSpotResult(questionId: string, correct: boolean): Promise<void>` — already imported in this file (`practice.tsx:41`, from `@/src/storage`).
- Produces: nothing new consumed by later tasks — Battle mode is independent of Speed Round and Mock Test.

- [ ] **Step 1: Add the call**

In `handleBattleAnswer`, immediately after the existing `applyDailyChallengeProgress` call (which is the precedent for "per-question side effect at grading time"):

```ts
    const isCorrect = optionIndex === q.correctIndex;  // <-- correctness known here
    applyDailyChallengeProgress(q, isCorrect);
    void recordWeakSpotResult(q.id, isCorrect);
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (the codebase may already have pre-existing errors elsewhere; confirm none are newly introduced in `practice.tsx`).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/practice.tsx
git commit -m "feat: record weak-spot results from Battle mode"
```

---

### Task 2: Speed Round — record weak-spot result on each answer

**Files:**
- Modify: `apps/mobile/app/(tabs)/practice.tsx:530-531` (inside `handleSpeedAnswer`)

**Interfaces:**
- Consumes: `recordWeakSpotResult(questionId: string, correct: boolean): Promise<void>` — same import as Task 1, already present.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the call**

In `handleSpeedAnswer`, immediately after `correct` is computed and before the sound-effect branch:

```ts
    const q = speedQsRef.current[speedIdxRef.current];   // question object (.id, .correctIndex)
    if (!q) return;
    const correct = optionIndex === q.correctIndex;      // <-- correctness known here
    void recordWeakSpotResult(q.id, correct);

    if (settings.soundEffects) {
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/practice.tsx
git commit -m "feat: record weak-spot results from Speed Round"
```

---

### Task 3: Mock Test — record weak-spot result per question in doSubmit

**Files:**
- Modify: `apps/mobile/app/(tabs)/mock.tsx:24-28` (import block)
- Modify: `apps/mobile/app/(tabs)/mock.tsx:228` (inside `doSubmit`)

**Interfaces:**
- Consumes: `recordWeakSpotResult(questionId: string, correct: boolean): Promise<void>` from `@/src/storage` — not currently imported in this file, must be added.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the import**

```ts
import {
  createFreshUserProgress,
  loadUserProgress,
  recordWeakSpotResult,
  saveUserProgress,
} from '@/src/storage';
```

- [ ] **Step 2: Add the per-question recording loop**

In `doSubmit()`, immediately after `scoreTest` is called (using the same `qs`/`ans` arrays already in scope, and the same correctness expression `scoreTest` itself uses):

```ts
    const { correct, byTopic } = scoreTest(qs, ans);
    for (let i = 0; i < qs.length; i++) {
      void recordWeakSpotResult(qs[i].id, ans[i] === qs[i].correctIndex);
    }
    const passed = correct >= activePassMarkRef.current;
```

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/mock.tsx
git commit -m "feat: record weak-spot results from Mock Test"
```

---

### Task 4: Full verification and report

**Files:** none (verification only)

- [ ] **Step 1: Full project type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean (matches whatever the baseline was before this change — confirm no *new* errors versus a pre-change baseline if the project already had unrelated pre-existing errors).

- [ ] **Step 2: Manual runtime smoke test**

Use the `run` skill to launch the app. For each of Battle mode, Speed Round, and Mock Test:
- Start the mode, answer at least a few questions (including at least one deliberately wrong answer), and let it finish/submit normally.
- Confirm no crash and no new console/Metro errors appear (in particular nothing thrown from `recordWeakSpotResult`, which itself swallows errors internally so a regression would show up as a silent no-op, not a crash — watch for `@clearpass/wrong_counts` simply not growing rather than an exception).
- Return to the Start Practice screen after each mode and confirm the weak-spot button's subtitle/copy still renders correctly in both the locked (`< 5`) and, if reachable, unlocked (`>= 5`) states.

- [ ] **Step 3: Prepare the report**

Summarize for the user:
- Files touched: `apps/mobile/app/(tabs)/practice.tsx` (Battle + Speed Round), `apps/mobile/app/(tabs)/mock.tsx` (Mock Test + new import).
- `MockTestResult`'s shape did **not** change — no migration/backfill needed (see Design Decision 1 above); existing users' stored mock history is untouched, and new mock test submissions will retroactively start contributing to weak-spot data going forward only.
- The "wrong twice = weak spot, 5 distinct = unlock" logic in `storage.ts` and `practice.tsx:1373` was not modified — only three new callers of the existing `recordWeakSpotResult` function were added, each passing the same correctness definition already used by its own mode's scoring/grading code.
- Disabled-state copy was reviewed and left unchanged (Design Decision 3).