# Question-Bank Image Audit — 2026-07-16

Audit only, per instructions — nothing has been fixed or changed. Covers the main quiz question bank (`packages/content/src/questions/*.ts`, 752 questions across 14 `TopicCategory` files), which is rendered by Mock Test and all four Practice modes.

## 1. How images are actually associated with questions

There is **no separate `imageId`/`signId` field**. The `Question` type (`packages/core/src/types/Question.ts`) has a single optional field:

```ts
imageUrl?: string;
```

When set, it's a full remote URL into a public Supabase Storage bucket, e.g. `https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/TS4073d.png`. Filenames follow official DVSA "TS" (Traffic Sign) diagram codes for signs, or descriptive names (`IMG_9457.jpg`, `85BW9937.jpg`) for photographed hazard/marking scenes.

`mock.tsx` and `practice.tsx` render it identically everywhere: `{q.imageUrl && <Image source={{uri: q.imageUrl}} .../>}` — a single image slot per question, no per-option images, no fallback for a bad or missing value beyond "don't render the `<Image>` at all."

**Important architectural note:** this is a completely separate system from `apps/mobile/src/signImages.ts` + `packages/content/src/roadSigns.ts`, which power the standalone "Road Signs" reference/study screen (89 signs, local bundled JPGs via `require()`). The June audit (commit `9a37381`) fixed *that* system, not the one this audit covers. See §5.

There is no text-inference fallback — if a question's phrasing implies an image but `imageUrl` is unset, nothing is shown; it's purely a data-completeness question.

## 2. Totals

| | Count |
|---|---|
| Total questions | 752 |
| Questions with `imageUrl` set | 156 (133 unique URLs — some images legitimately reused across question variants) |
| Unique image URLs checked via HTTP HEAD | 133 |
| **Broken/unreachable URLs** | **0** — every referenced file resolves with 200 OK |
| **Questions with correct images** (has `imageUrl`, not flagged below) | **~132** |
| Text implies an image but `imageUrl` is missing | 18 (17 high-confidence, 1 likely false-positive — see §3) |
| Systemic "blank options" render bug | 27 (see §4 — this is the headline finding) |

## 3. Questions with NO image where one should exist (18 candidates)

Found by pattern-matching question text against DVSA image-question phrasing ("this sign", "this marking", "in the picture", "arrowed", etc.), then confirming each by reading its actual content. **17 of 18 are genuine gaps; 1 is very likely a false positive.**

| ID | File | Question | Confidence |
|---|---|---|---|
| AB2087 | hazardAwareness | "What's the main hazard shown in this picture?" | High |
| AB2657 | hazardAwareness | "What should the driver of the red car (arrowed) do?" | High |
| AB2717 | hazardAwareness | "What's the main hazard the driver of the red car (arrowed) should be aware of?" | High |
| BB1100 | hazardAwareness | "...What do these signs above the lanes mean?" | High |
| AB2301, AB2305, AB2332, AB2343, AB2367, AB2381, AB2765, AB2889 | roadsigns | "What does this sign mean?" (×8) | High |
| AB2400 | roadsigns | "Where would you see this road marking?" | High |
| AB2401 | roadsigns | "Which diagram shows a hazard warning line?" | High (also in §4 — no image AND blank options) |
| BB1207 | rulesOfTheRoad | "A single carriageway road has this sign. What's the maximum permitted speed..." | High |
| BB1213 | rulesOfTheRoad | "...you see this sign. What should you do on the days and times shown?" | High |
| BB1351 | safetyMargins | "...You see this sign. What should you do after dealing safely with the hazard?" | High |
| AB2693 | roadsigns | "...What's the official meaning of this signal?" (headlight-flash question) | **Low — likely a false positive.** This is almost certainly the well-known trick question about headlight flashing having no official meaning; matched my pattern on the word "signal" but probably needs no image. Flagging for confirmation, not claiming it's broken. |

## 4. Systemic bug: 27 questions with blank answer options (headline finding)

This is bigger than a few missing/wrong images and affects the DVSA "which sign/shape/diagram is X" question format specifically. All 27 have `options: ["", "", "", ""]` — four literally empty strings. `mock.tsx`/`practice.tsx` render whatever string is in each option slot with **no fallback for empty string** — confirmed by reading the render code directly (`{option}` inside the button, nothing else).

- **3 have no image at all** (`BB1591`, `AB2401`, `BB1237`) — these render as four completely blank answer buttons and no image. Totally unanswerable as currently shipped.
- **24 have a single `imageUrl` set** — but I visually downloaded and inspected several of these images directly, and they are **not the specific sign/photo the question needs** — they're generic flat-colour vector placeholders (a plain red ring, a red rounded rectangle, a blue-and-red "no parking" icon) that don't match the shape/sign actually being tested. Concretely confirmed by eye:
  - `AB2294` "What shape are traffic signs giving orders?" (answer: circular) → image is a **red rounded rectangle**. Wrong shape entirely.
  - `AB2304` "Which sign means 'no entry'?" → image is a blue circle with a red diagonal slash (generic "prohibited" icon) — the real UK No Entry sign is a plain red disc with a white bar, no blue, no diagonal. Wrong.
  - `AB2429` "...national speed limit applies?" and `AB2763` "...shape used for a 'give way' sign?" **share the same image** — a plain red ring with no markings. Give-way signs are triangular, not circular, so at minimum one of these two is definitively wrong; the ring also doesn't show the diagonal stripe a national-speed-limit sign needs.

This strongly suggests these 24 (all "which of these signs is X" DVSA question variants) were originally meant to show **four different candidate sign images as the actual answer options** — the format DVSA uses for this question type — and that structure was lost on import, leaving one generic/wrong placeholder image and empty text options. This isn't a simple "swap the wrong file for the right one" fix; it likely needs either real per-option images (a data model change) or converting these back to text options, and is worth scoping as its own piece of work rather than folding into a quick image-swap pass.

Full list of all 27 IDs is in the raw data section at the bottom of this file if needed for ticketing.

## 5. Cross-reference against the June audit — different system, no regressions

The June audit (commit `9a37381`, "fix: correct mismatched and missing road sign images") was against `apps/mobile/src/signImages.ts` — the **Road Signs reference library**, not the quiz question bank this audit covers. Worth flagging: your recollection of "25/33 wrong mappings" and "7 signs removed entirely" doesn't literally match what's in that commit message or any doc/PR I could find — I couldn't locate a source for that exact ratio. What the commit actually documents: 3 wrong mappings corrected (red-route, no-cycling, hospital), 1 sign removed as fundamentally unmappable (`lane-closed-overhead` — a dynamic matrix signal, not a static numbered sign), 1 name-only fix, and 7 signs upgraded from SVG-fallback to real photos (horse-riders, elderly-people, risk-of-grounding, risk-of-ice, tunnel, camera-ahead, school-crossing).

I checked all of these directly against the current `signImages.ts`:
- **All 7 previously-SVG-fallback signs still have their real image mappings — no regression.**
- **All 3 corrected mappings (red-route→CW701, no-cycling→951, hospital→827.1) are still correct.**
- **`lane-closed-overhead` remains correctly absent** — I checked the local asset pack (`apps/mobile/assets/signs/`, 679 files) for anything matching "lane closed" / "overhead" / "matrix" and found nothing, so there's still no real DVSA photo to restore it with. No change recommended there.

If there's a written record of the actual "25/33" audit elsewhere (Slack, a doc not in this repo), worth checking that against this — I can only confirm what's in git history.

## 6. Today's specific finding: "SCHOOL KEEP CLEAR" (question 27)

Found and included in the systemic count above, but worth calling out on its own since it's a different failure mode from §4. Traced to `AB2729` ("What's the purpose of these road markings?") and its sibling `AB2545` ("Why should these road markings be kept clear?") — **both correctly reference the same image** (`TS4715.png`), and both have correct, on-topic explanations. The *mapping* is right.

The problem is the asset itself: I downloaded `TS4715.png` and it's a flat grey rectangle with plain yellow "SCHOOL KEEP CLEAR" text and zigzag underlines — not an actual photo of the road marking as it would appear painted on tarmac (compare to a normal DVSA sign photo I also downloaded for reference, which is a proper full-colour vector rendering). This is a **low-quality/placeholder-style asset that was never replaced with a real one**, not a mapping bug — same underlying failure mode as the generic placeholder images in §4 (present, correctly linked, but not real content), just not part of the blank-options group since this question's text options are intact.

## 7. Wrong-image confidence & suggested spot-check method

Beyond the confirmed cases in §4 and §6, I found **20 groups of questions (46 total) that share the same image** across different question IDs — reuse is expected and fine when it's the same real-world sign/marking asked about two ways, but it's also exactly the pattern that produces mismatches. I read the explanation text for every group; most look like legitimate DVSA repeats (e.g. the same "box junction" photo used for two related box-junction questions). A handful I could **not** verify from text alone and would want visually confirmed:

- `TS4546.png` — shared by 3 questions across 2 categories (hazardAwareness + vulnerableRoadUsers×2)
- `TS4578.png` — shared between a motorway-contraflow question and a generic "what does this sign mean"
- `TS4602.png` — shared by 3 differently-phrased questions, one of which (`AB2640`, about road humps and following distance) doesn't clearly sound sign-focused at all
- `TS4693.png` — shared between a one-way-system question and a "just passed this sign" question

**Confidence level on "wrong image" claims overall: high for the ~24+ cases in §4 (visually confirmed a representative sample, pattern is systemic and structural, not random) and for §6; low-to-medium for the 4 groups just listed (text-plausible, not visually confirmed).** Programmatic verification has a hard ceiling here — matching a photo's actual content against a question's intended meaning needs either a human eye or an image-classification pass; I did the former for a sample, not the full 133.

**Suggested next step for the remainder:** a visual spot-check pass is the only reliable way to close this out. I can generate a single contact-sheet-style page (thumbnail + question text + correct answer, for all 133 unique images) so a human reviewer can scan it in a few minutes rather than opening 133 individual URLs — happy to build that if useful before any fixes are scoped.

---

## Raw data: all 27 blank-options question IDs

AB2935, BB1591, AB2176, AB2294, AB2295, AB2304, AB2307, AB2314, AB2324, AB2347, AB2351, AB2357, AB2375, AB2389, AB2401, AB2429, AB2674, AB2763, AB2768, AB2885, AB2887, AB2890, AB2892, AB2897, BB1237, AB2212, AB2117

---

## Resolved — 2026-07-17

All 27 questions listed above are fixed. Summary of the work that closed this audit out, from the executed plan (a 14-task SDD plan run against this worktree, branch `worktree-question-image-fixes`):

**Data model & UI (Tasks 1-8).** Added an optional `optionImages?: string[]` field to the `Question` type (`packages/core/src/types/Question.ts`) — when set, one image per `options[i]` entry, same length/order, with `options[i]` doubling as the accessible/TTS label rather than visible button text. Added a permanent content-validation regression-guard test (`packages/content/src/validateQuestions.ts` + test) that checks the raw per-topic question arrays for blank options. Built a shared `AnswerOptions` React Native component and wired it into all 5 quiz surfaces (Mock Test, Practice, Battle, Weak Spot, Speed Round) so image-choice questions render real per-option images everywhere instead of blank buttons.

**Root cause, found late (Tasks 11-12).** The original DVSA licence source spreadsheet (`Car (Cat B) QB Feb 2026.xlsx`, from the project's own licence delivery archive) was located and found to contain complete per-option image references for every remaining broken question. The root cause was that the app's original import only ever mapped the question-level "stem" `imageUrl`, never the 4 per-option images the source data always had. No external sourcing or stock-photo substitution was ever needed — every image used is genuine official DVSA artwork extracted from the project's own licensed source archive.

**What got fixed:**
- **2 questions** (`AB2674`, `AB2768`) converted from single-montage-image to real 4-image format by cropping their existing montage assets (Task 9).
- **18 questions** were simply missing an `imageUrl` — turned out to already have correctly-named, unused images sitting in the Supabase bucket; wired up at zero asset cost (Task 10).
- **25 questions** (22 + 3, `AB2294`/`AB2324`/`AB2763` in a follow-up) got full per-option image sets: all 72 unique images extracted from the source archive (EPS via Ghostscript+crop, TIFF via PIL, JPG as-is), uploaded to Supabase, wired in with genuine accessible text labels written after visually inspecting each image (Tasks 11-12).
- Every `correctIndex` was independently verified against the source spreadsheet before touching anything, and left unchanged throughout — no answer-key changes, only image/option-label additions.

**Final validation (Task 14, this pass):**
- `packages/content/src/validateQuestions.ts` regression test: **0 violations** (5/5 tests pass) against the raw per-topic arrays.
- The `hasUsableOptions` stopgap filter in `packages/content/src/index.ts` (added 2026-07-06, commit `6b033fb`, specifically to hide these 27 questions from real users until fixed) has been **removed** — its own comment said it existed "until that pack arrives," and the pack arrived. `allQuestions` is the plain concatenation of all 14 topic arrays again. Measured length before and after removal: **752 in both cases** — the filter had already become a no-op by the time it was removed, confirming no remaining broken questions were being silently excluded.
- Full HTTP check across every unique URL now referenced by the question bank (`imageUrl` + `optionImages` combined): **194 unique URLs, 0 broken** (151 questions with `imageUrl`, 27 with `optionImages`, 1 question — `AB2212` — has both).
- Visual spot-check: regenerated a contact sheet (`docs/audits/2026-07-17-question-image-contact-sheet-resolved.html`) grouping all 27 previously-broken questions with their live images. Spot-checked several by eye (e.g. `AB2294`'s rectangle/triangle/circle sign shapes, `AB2763`'s downward-pointing give-way triangle, `BB1237`'s circular-arrow left-turn arm signal) — all match their question text and accessible labels exactly, with distinct images per option (no shared placeholders).
- `apps/mobile`: `tsc --noEmit` clean against the whole accumulated change set except the pre-existing, unrelated baseline error in `app/_layout.tsx`.

**Net result:** all 27 originally-broken questions are fixed with real official DVSA imagery — not stock photos, not hand-drawn substitutes, not text-only workarounds — and the full 752-question pool is now unfiltered and live for real users.

Note on the contact sheet: the original generator script used to produce `2026-07-16-question-image-contact-sheet.html` was not preserved anywhere in the repo or worktree (only its HTML output survived, as an untracked audit artifact). The 2026-07-17 resolved sheet was produced by a newly-written script in the same visual style, reading directly from `packages/content/src/index.ts`.
