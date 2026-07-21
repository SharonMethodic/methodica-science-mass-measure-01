# Reporting — What Was Added

This document summarizes the **xAPI (720) reporting** and **problem-reporting**
code added to `methodica-science-mass-measure-01`, ported from
`methodica-math-scale-01`. It records the exact blocks inserted, where they live,
and the per-part instrumentation so the work can be maintained or re-applied.

- **Unit** = the whole לומדה (all 5 parts).
- **Component / Part** = each `methodica-science-mass-measure-01-0{1..5}` folder.
- Each part is self-contained: `index.html`, `js/main.js`, `css/style.css`.
- The xAPI library is loaded at runtime from the gov.il CDN (no local library files).
- All `sendStatement720(...)` calls are wrapped in `try/catch` so a reporting
  failure never interrupts the learner.

> **UPDATE — canonical URL IDs.** The metadata IDs are now full canonical URLs and the
> parts load a forked library `xapi-720-f.js`. See **§7** for the details; the sections
> below describe the original short-id implementation and remain accurate except where
> §7 amends them (metadata id format, the `-f` loader, URL `questionId`s, and the
> report form's `shortId()`).

---

## 1. New files — metadata (read-only at runtime)

Both features read component/unit metadata via `window.METADATA` / `window.UNIT_METADATA`.
Authored fresh (the project had none), in a new repo-root `metadata/` folder:

```
metadata/methodica-science-mass-measure-01_unit.json   (unit: id, title, subTopic, learningObjective, targets)
metadata/methodica-science-mass-measure-01-01.json     (10 subContent items)
metadata/methodica-science-mass-measure-01-02.json     (4 subContent items)
metadata/methodica-science-mass-measure-01-03.json     (1 subContent item — transition)
metadata/methodica-science-mass-measure-01-04.json     (5 subContent items)
metadata/methodica-science-mass-measure-01-05.json     (1 subContent item — שאלת השיא, 4 sub-questions)
```

Each component file carries `id`, `title`,
`learningUnitId: "methodica-science-mass-measure-01"`, and a `subContent[]` array
whose graded items hold `questions[]` (`q1`, `q2`, …). The
`<subContentId>/<qN>` strings are the xAPI `questionId`s **and** the
`SCREEN_TO_SUBCONTENT` targets — authored once, used by both features.

> The code only **reads** these files. Never write to them at runtime.

---

## 2. xAPI reporting

### 2.1 Init block (appended to the end of every `js/main.js`)

An `initXAPI()` IIFE that loads the two CDN scripts in order, reads the `slxapi`
URL parameter, waits for metadata, configures the LRS endpoint, and fires the
component `initialized`:

```js
/* ═══════════════════ xAPI ═══════════════════ */
(function initXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-0X.json'; // per part
  function loadScript(src, cb) { /* creates <script>, cb on load/error */ }
  function pollMetadataReady(cb) { /* waits for window.jsXAPI_MetadataReady */ }
  loadScript(CDN + 'xapiwrapper.min.js', function() {
    loadScript(CDN + 'xapi-720-e.js', function() {
      try {
        getXAPIParameters(METADATA_FILE);
        pollMetadataReady(function() {
          ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth });
          sendStatement720('initialized', 'onlinelesson');
          /* PART 01 / PART 05 extras — see below */
        });
      } catch(e) { console.error('[xAPI] load', e); }
    });
  });
})();
```

Per-part differences (only `METADATA_FILE` + the unit hooks change):

| Part | `METADATA_FILE` | Extra in init block |
|---|---|---|
| 01 | `…-01.json` | **Unit `initialized`** — `loadUnitMetadata('…_unit.json', () => sendStatement720('initialized','onlinelesson',null,{scope:'unit'}))` |
| 02 | `…-02.json` | — |
| 03 | `…-03.json` | — |
| 04 | `…-04.json` | — |
| 05 | `…-05.json` | `loadUnitMetadata('…_unit.json', ()=>{})` — loads unit metadata so the unit `completed` in `finishLomda` has it ready |

### 2.2 The single entry point

```js
sendStatement720(sttmRowType, sttmUnitType, sttmResult = null, sttmContext = null)
```
- `sttmRowType` — verb: `initialized`, `answered`, `answered.last`, `selected`,
  `requested.N`, `completed`.
- `sttmUnitType` — `'onlinelesson'` (unit-level events) or `'question'` (per-question).
- `sttmResult` — `{ success, score:{scaled}, extensions:{student_answer} }` for answers.
- `sttmContext` — `{ questionId }` for answers, `{ category }` for selections,
  `{ scope:'unit' }` for unit-level statements.

### 2.3 Statement patterns used

- **Graded question (2-attempt rule).** At the point correctness is known and the
  answer is still available:
  - correct (any attempt) → `answered.last`, `success:true`, `scaled:1`
  - wrong, attempts < max → `answered`, `success:false`, `scaled:0` (interim)
  - wrong, attempts ≥ max → `answered.last`, `success:false`, `scaled:0`
  - single-attempt questions always emit `answered.last`.
  ```js
  sendStatement720(row, 'question',
    { success: !!isCorrect, score:{scaled: isCorrect?1:0}, extensions:{student_answer:[answerStr]} },
    { questionId: '<subContentId>/qN' });
  ```
- **Non-graded selection** → `sendStatement720('selected','question',{response:value},{category:'learningType'})`
- **Hint opened** (only when the popup actually opens) → `sendStatement720('requested.1','question')`
- **Component completed** (final screen of each part) → `sendStatement720('completed','onlinelesson')`
- **Unit completed** (part 05 only) → `sendStatement720('completed','onlinelesson',null,{scope:'unit'})`

The library builds `object.id` as
`<origin>/<part-path>/questions/<subContentId>/qN` and auto-aggregates
`answered.last` outcomes into the component `completed` score.

### 2.4 `?slxapi` propagation

The `slxapi` parameter (learner identity + LRS endpoint/auth) arrives only on
part 01's URL and is now carried across every cross-part navigation:

- Root `index.html` — `toFirstComponent()` appends `window.location.search`.
- Part 01 `goToNextPart` — `((standardPracticeScore()>=4)?PART_03_URL:PART_02_URL) + window.location.search`
- Parts 02/03/04 `goToNextPart` — `NEXT_PART_URL + window.location.search`
- Part 05 — last part; no navigation.

### 2.5 Per-part instrumentation map

Statement counts and the `questionId` per graded screen:

**Part 01** (25 `sendStatement720` calls) — component + **unit** `initialized`; `selected`
on S0 (character) & S4 (learning style); `requested.1` on 9 hint openers; `completed`
in `goToNextPart`; `answered` on:

| Screen | check fn | questionId |
|---|---|---|
| S1 | `scqCheck` | `…-01-001/q1` |
| S3 | `ddqCheck` | `…-01-002/q1` |
| S20 | `s20qCheck` | `…-01-003/q1` |
| S8 | `mdqCheck` | `…-01-004/q1` |
| S9 | `s9qCheck` | `…-01-005/q1` |
| S11 | `s11ddqCheck` | `…-01-006/q1` |
| S12 | `s12qCheck` | `…-01-007/q1` |
| S16 | `s16ddqCheck` | `…-01-008/q1` |
| S17 | `s17qCheck` | `…-01-009/q1` |
| S18 | `s18qCheck` | `…-01-010/q1` |
| S19 | `s19qCheck` | `…-01-010/q2` |

*(S13 widget and S14 non-scored practice are intentionally not tracked.)*

**Part 02** (8 calls) — `completed` in `goToNextPart`; `requested.1` on 3 hints; `answered` on:
S1 `scqCheck('s1')` → `…-02-002/q1`, S2 `scqCheck('s2')` → `…-02-002/q2`,
S3 `s3ddqCheck` → `…-02-003/q1`, S4 `s4vCheck` → `…-02-004/q1`.

**Part 03** (2 calls) — transition part: component `initialized` + `completed` in
`goToNextPart`. No graded questions/hints.

**Part 04** (6 calls) — `completed` in `goToNextPart`; `requested.1` on hints (s2/s5, s7);
`answered` on: S2 → `…-04-002/q1`, S5 → `…-04-003/q1`, S6 → `…-04-004/q1`,
S7 `s7ddqCheck` → `…-04-004/q2`. *(S1/S3/S4 practice widgets not tracked.)*

**Part 05** (6 calls) — `requested.1` on hints (s1/s2/s4); `answered` on:
S1 → `…-05-001/q1`, S2 → `…-05-001/q2`, S3 `s3Check` → `…-05-001/q3`,
S4 → `…-05-001/q4`; **`finishLomda()`** (was an empty no-op) now emits both the
component `completed` and the **unit** `completed` (`{scope:'unit'}`).

---

## 3. Problem-reporting ("מצאתם בעיה?")

The flag button `#flag-btn` already existed in every part's markup but had no
behavior. Now wired to a full report modal that posts to a Google Form.

### 3.1 Markup (each `index.html`)

Two overlay `<div>`s inserted immediately before the `</div>` that closes `#app`
(right before `<script src="js/main.js">`):
- `#report-modal` — type `<select>` (technical / unclear / other), free-text
  `<textarea maxlength="250">`, char counter, inline error line, שליחה/ביטול
  buttons, and a thank-you block.
- `#report-confirm-modal` — "discard unsent report?" confirmation.

The pre-existing `#flag-btn` was left untouched.

### 3.2 CSS (each `css/style.css`)

The `.report-*` block appended (`.report-modal-overlay`, `.report-modal-box`,
`.report-confirm-box`, `.report-close-btn`, `.report-modal-title/-body`,
`.report-field`, `.report-label`, `.required-star`, `.report-select`,
`.report-textarea`, `.report-char-count`, `.report-actions`, `.report-error`,
`.report-thanks`, `.report-submit-btn`, `.report-cancel-btn`). Existing `.flag-btn`
styles were not duplicated.

### 3.3 JS (each `js/main.js`)

Report block appended (before the xAPI init IIFE):
`openReportModal`, `tryCloseReportModal`, `forceCloseReportModal`,
`backToReportForm`, `submitReport`, `showReportThanks`, `resetReportForm`, plus a
`wireReport()` IIFE that binds the flag button, the char counter, and Esc-to-close.

```js
document.getElementById('flag-btn').addEventListener('click', openReportModal);
```

### 3.4 Google Form target

`submitReport()` POSTs (`fetch`, `method:'POST'`, `mode:'no-cors'`) to the
**reused** math-scale form:

```
REPORT_FORM_ACTION =
  'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse'
```

8 fields (same `entry.*` IDs as math-scale):

| Field | Source | Entry ID |
|---|---|---|
| date | `new Date()` | `entry.301404029_year/_month/_day` |
| time | `new Date()` | `entry.2066097581_hour/_minute` |
| unit ID | `METADATA.learningUnitId` | `entry.1933069481` |
| component ID | `METADATA.id` | `entry.2070680092` |
| item ID | `SCREEN_TO_SUBCONTENT[currentScreen]` → `<compId>-<suffix>` | `entry.1555704258` |
| page-in-item | same lookup, or absolute `currentScreen` if unmapped | `entry.1671046914` |
| problem type | selected option's Hebrew label | `entry.1179822443` |
| free text | `#report-text` value | `entry.806447525` |

> ⚠️ **Reused form.** Reports currently land in the math-scale form's responses
> sheet. To route science reports to their own sheet, create a dedicated Google
> Form and replace `REPORT_FORM_ACTION` + the 8 `entry.*` IDs in all 5 parts.

### 3.5 `SCREEN_TO_SUBCONTENT` (per part)

Maps `currentScreen` → `[subContentSuffix, pageInItem]` (`null` for
intro/transition/selection/video screens). `submitReport` reads `window.METADATA`
(populated by the xAPI loader) for unit/component IDs; unmapped screens send an
empty item ID and fall back to the absolute screen number for page-in-item.

```js
// Part 01
{ 0:null, 1:['001',1], 2:['002',1], 3:['002',2], 4:null, 5:null, 20:['003',1], 21:null,
  6:null, 7:null, 8:['004',1], 9:['005',1], 10:null, 11:['006',1], 12:['007',1],
  13:['008',1], 14:['008',2], 15:['008',3], 16:['008',4], 17:['009',1], 18:['010',1], 19:['010',2] }
// Part 02
{ 0:null, 1:['002',1], 2:['002',2], 3:['003',1], 4:['004',1] }
// Part 03
{ 0:null, 1:['001',1] }
// Part 04
{ 0:null, 1:['002',1], 2:['002',2], 3:['003',1], 4:['003',2], 5:['003',3], 6:['004',1], 7:['004',2], 8:null }
// Part 05
{ 0:null, 1:['001',1], 2:['001',2], 3:['001',3], 4:['001',4], 5:null, 6:null }
```

---

## 4. Files touched

**New (7):** `metadata/` ×6 JSON + this doc. Plus `.claude/launch.json`
(static server on :8100 for local testing — dev convenience, not shipped content).

**Modified (per part × 5):**
- `methodica-science-mass-measure-01-0X/js/main.js` — xAPI init block, statement
  calls, `?slxapi` propagation, flag-button wiring, report JS + `SCREEN_TO_SUBCONTENT`.
- `methodica-science-mass-measure-01-0X/index.html` — two report-modal blocks.
- `methodica-science-mass-measure-01-0X/css/style.css` — `.report-*` CSS block.
- `index.html` (root) — forward `window.location.search` on redirect.

No local xAPI library files (CDN reused).

---

## 5. Verification (performed)

Served locally and opened part 01 with a test
`?slxapi={"actor":{"account":{"name":"student_test_1",…}},"endpoint":"https://example.com/xapi/","auth":"Basic …"}`:

- ✅ `[XAPI Parameters] Ready` with the real actor; metadata loaded; component +
  unit `initialized` sent.
- ✅ Correct answer on S1 → `answered.last`, `object.id` ending
  `/questions/methodica-science-mass-measure-01-01-001/q1`, `success:true`, `scaled:1`.
- ✅ Report modal opens, POSTs `no-cors` to `…/formResponse` with all 8 fields;
  mapped screen 9 → item `…-01-005`, page `1`; unmapped screen 0 → empty item,
  absolute-screen fallback.
- ✅ All 6 metadata JSON parse; all 5 `js/main.js` pass `node --check`.
- The only console errors are the **dummy** `example.com` LRS rejecting the POST
  (expected with a fake endpoint; caught by `try/catch`, no learner-facing break).

### How to test against a real LRS

Open any part with a valid `slxapi` parameter pointing at a real endpoint/auth;
confirm in DevTools → Network that statements POST with 2xx, and that the report
lands as a new row in the Google Form's responses sheet.

---

## 6. Known notes

- **Reused Google Form** — see §3.4; swap for a dedicated science form when ready.
- **`result.response` text** — for some choice questions the captured answer
  string may include inline tooltip text from the option. Cosmetic only: the
  `questionId`, `success`, and `score` are unaffected.
- **Client-side unit scoring** — each part is a separate page load, so the unit
  `completed` reports completion + duration only, not a unit-wide score
  (aggregate LRS-side). This matches the math-scale reference behavior.

_Reference guides this port is based on live in the math-scale repo:
`ADD-XAPI.md`, `ADD-PROBLEM-REPORT.md`, `XAPI-MANUAL-TESTING.md`._

---

## 7. Canonical URL IDs + `xapi-720-f.js` fork (later change)

The metadata IDs were changed from short slugs to **full canonical URLs**, so that xAPI
`object.id`s are stable and host-independent (not derived from the dev/test URL). Prefix:

```
https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/
```

### 7.1 Forked library `xapi-720-f.js`

The stock library `xapi-720-e.js` builds `object.id` as
`window.location.origin + <parent-path> + id` — it never treats the id as absolute, so a
URL id would produce a broken double-URL. Rather than edit the shared `-e` (used by
math-scale), a fork **`xapi-720-f.js`** was created and placed in the **same CDN
`common/` folder** as `-e`
(`https://lomdot.education.gov.il/metodica/720active/common/xapi-720-f.js`; deployable
source kept beside `-e` at `…/methodica-math-scale-01/XAPI-Demo/common/xapi-720-f.js`).
All function names are unchanged. Two **backward-compatible** patches (a short id keeps
the legacy behavior, so `-f` is safe for any unit):

1. **Component/unit object id** — if `idSeg` (`METADATA.id` / `UNIT_METADATA.id` /
   `learningUnitId`) is an absolute URL, use it verbatim as `baseId`; else
   `origin + path + id` as before.
2. **Question / hint object id** — an absolute-URL `questionId` becomes the question
   object id verbatim (no `/questions/` prefixing); the hints branch uses the absolute
   component id verbatim for `…/hints/hN`.

Each part's init block loads `CDN + 'xapi-720-f.js'` instead of `'xapi-720-e.js'`
(one-token change; `xapiwrapper.min.js` still from the CDN).

> Used by mass-measure only for now. Because `-f` lives on the CDN, opening a part live
> before it is deployed will 404 on the library (report modal still works; METADATA-derived
> ids are empty until it loads).

### 7.2 Metadata IDs → URLs (all 6 JSON)

`id`, `learningUnitId`, and **every** `subContent[].id` are now `PREFIX + <old id>`, e.g.
unit `…/01/methodica-science-mass-measure-01`, component `…/methodica-science-mass-measure-01-01`,
subContent `…/methodica-science-mass-measure-01-01-001`. All other fields unchanged.

### 7.3 `questionId`s → URLs (`js/main.js`, parts 01/02/04/05)

Each part defines `var XAPI_ID_PREFIX = '<prefix>'` and every `questionId` passed to
`sendStatement720` is `XAPI_ID_PREFIX + '<oldSubContentId>/qN'`. With patch #2 the
resulting `answered` `object.id` is the clean question IRI
`…/methodica-science-mass-measure-01-01-001/q1`.

### 7.4 Report form keeps SHORT ids

`submitReport` still sends compact ids to the Google Form via a helper
`function shortId(u){ return String(u||'').split('/').pop(); }`:
```js
body.append('entry.1933069481', shortId(meta.learningUnitId));  // e.g. methodica-science-mass-measure-01
body.append('entry.2070680092', shortId(meta.id));              // e.g. methodica-science-mass-measure-01-01
var itemId = mapEntry ? shortId(meta.id) + '-' + mapEntry[0] : ''; // e.g. …-01-005
```
`SCREEN_TO_SUBCONTENT` and page-in-item are unchanged.

### 7.5 Resulting object.id examples

| Event | `object.id` |
|---|---|
| component `initialized`/`completed` | `…/01/methodica-science-mass-measure-01-01` |
| unit `initialized`/`completed` | `…/01/methodica-science-mass-measure-01` |
| `answered` | `…/01/methodica-science-mass-measure-01-01-001/q1` |
| hint `requested` | `…/01/methodica-science-mass-measure-01-01/hints/h1` |

### 7.6 Verification (performed)

- **Object-id logic harness** against `xapi-720-f.js` (mocked `window`/`ADL`): component,
  unit, answered (URL questionId → clean IRI), hint, and unit-completed ids all equal the
  canonical URLs; short-id inputs still yield the legacy `origin+path/id` shape — **7/7 pass**.
- **Real-file consistency check:** all 6 metadata ids are URLs; `shortId()` round-trips
  to the expected slugs; every code `questionId` resolves to a real subContent URL in that
  part's metadata; all parts load `-f`; report uses `shortId` — **71/71 pass**.
- `node --check` on `xapi-720-f.js` + all 5 `main.js`; all 6 JSON parse.
- Full live browser check runs once `-f` is deployed to the CDN (per the layered plan).
