/* xAPI: canonical URL id prefix + short-id helper (added for URL-format ids) */
var XAPI_ID_PREFIX = "https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/";
function shortId(u){ return String(u || "").split("/").pop(); }

﻿'use strict';

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_SCREENS = 22;  // S0–S19 + S20 (question) + S21 (video 2), inserted flow-wise after S5

/* ─── Global lomda state ────────────────────────────────────
   Single source of truth that persists across every screen for
   the whole session (single-page app). Future screens read
   window.lomdaState.selectedCharacter. JS-global only for now —
   no localStorage (can be layered in later if the LMS needs it).
   ─────────────────────────────────────────────────────────── */
window.lomdaState = window.lomdaState || {
  selectedCharacter: null
};

/* ═══ COMPONENT — Standard Practice progress state (shared across all practice screens)
   One object, one renderer. Future screens mutate this object and call
   syncStandardPracticeProgressNav() — no new state objects needed.
   ════════════════════════════════════════════════════════════════════ */
var standardPracticeProgress = {
  questions: [
    { number: 1, visited: true,  state: 'current',      screen: 11   },
    { number: 2, visited: false, state: 'not-answered', screen: null },
    { number: 3, visited: false, state: 'not-answered', screen: null },
    { number: 4, visited: false, state: 'not-answered', screen: null },
    { number: 5, visited: false, state: 'not-answered', screen: null }
  ]
};

/* ═══ Onward navigation — score branch at the end of S19 ═══
   The 5 standard-practice questions (S11–S19) decide the route:
   ≥4/5 correct (80%) → skip ahead to part 03; otherwise → part 02.
   Part 02 continues to part 03 on completion; parts 03→04→05 are chained. */
const PART_02_URL = '../methodica-science-mass-measure-01-02/index.html';
const PART_03_URL = '../methodica-science-mass-measure-01-03/index.html';
function standardPracticeScore() {
  return standardPracticeProgress.questions.filter(function (q) { return q.state === 'correct'; }).length;
}
function goToNextPart() {
  try { sendStatement720('completed', 'onlinelesson'); } catch(e) {}
  window.location.href = ((standardPracticeScore() >= 4) ? PART_03_URL : PART_02_URL) + window.location.search;
}

/**
 * updateProgressQuestion(container, state)
 * Generic renderer — works for any question count.
 * Icon  ← q.state  ('not-answered'|'current'|'correct'|'incorrect')
 * Label ← q.visited (Boolean)
 * Click ← q.visited === true && q.screen != null
 * Connector N visited when questions[N-1].state is 'correct'|'incorrect'
 * Connector count = state.questions.length − 1 (never hardcoded).
 */
function updateProgressQuestion(container, state) {
  var questions = state.questions;
  questions.forEach(function(q, i) {
    var n    = i + 1;
    var item = container.querySelector('[data-question="' + n + '"]');
    if (!item) return;
    var icon  = item.querySelector('.progress-question__icon');
    var label = item.querySelector('.progress-question__label');
    icon.classList.remove(
      'progress-question__icon--current',
      'progress-question__icon--correct',
      'progress-question__icon--incorrect'
    );
    if (q.state !== 'not-answered') {
      icon.classList.add('progress-question__icon--' + q.state);
    }
    label.classList.toggle('progress-question__label--visited', q.visited);
    var navigable = q.visited && q.screen != null;
    item.style.cursor = navigable ? 'pointer' : '';
    item.onclick = navigable
      ? (function(s) { return function() { goTo(s); }; })(q.screen)
      : null;
  });
  for (var n = 1; n < questions.length; n++) {
    var conn = container.querySelector('[data-connector="' + n + '"]');
    if (!conn) continue;
    var qState = questions[n - 1].state;
    conn.classList.toggle(
      'progress-question__connector--visited',
      qState === 'correct' || qState === 'incorrect'
    );
  }
}

function syncStandardPracticeProgressNav(container) {
  if (container) updateProgressQuestion(container, standardPracticeProgress);
}

/* ─── S7 TransitionScreen — character video asset map ───────── */
const S7_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Sporty-fix.mp4',
  'character-2': 'assets/video/Character-2-Sporty-fix.mp4',
};

/* Companion videos play once (no loop). Freeze on the last visible frame
   instead of dropping into the player's black "ended" state. */
function freezeVideoOnEnd(vid) {
  if (!vid || vid._freezeWired) return;
  vid._freezeWired = true;
  // Hold on the clean opening frame, not a mid-motion (blurred) or black end frame.
  function showRestFrame() { try { vid.currentTime = 0; } catch (e) {} vid.pause(); }
  vid.addEventListener("timeupdate", function () {
    if (vid.duration && vid.currentTime >= vid.duration - 0.3) showRestFrame();
  });
  vid.addEventListener("ended", showRestFrame);
}

/* ─── State ─────────────────────────────────────────────── */
let currentScreen = 0;

/* ─── Scale App ──────────────────────────────────────────────
   Scale-to-fit the 1280×710 design while EXTENDING the canvas
   to fill the viewport so chrome anchored to canvas edges
   (flag button at top, bottom bars at bottom) reaches the
   actual screen edges instead of letterboxing.
   - scale  = min(viewportW/1280, viewportH/710)  → no distortion
   - canvas = viewport / scale  → in design coords, fills viewport
   ─────────────────────────────────────────────────────────── */
function scaleApp() {
  const app = document.getElementById('app');
  const scale  = Math.min(window.innerWidth / 1280, window.innerHeight / 710);
  const canvasW = window.innerWidth  / scale;
  const canvasH = window.innerHeight / scale;
  app.style.width     = canvasW + 'px';
  app.style.height    = canvasH + 'px';
  app.style.transform = `scale(${scale})`;
  app.style.left      = '0px';
  app.style.top       = '0px';
}
window.addEventListener('resize', scaleApp);
scaleApp();

function openImageZoom(btn) {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal || !stage || !btn) return;
  // Clone the image wrapper (image + name tags) — speech bubbles live outside it,
  // and we strip the zoom button itself.
  const wrapper = btn.closest('.s12q-frame-inner, .scq-img-inner');
  if (!wrapper) return;
  const clone = wrapper.cloneNode(true);
  clone.querySelectorAll('.img-zoom-btn').forEach(b => b.remove());
  clone.classList.add('img-zoom-clone');
  stage.innerHTML = '';
  stage.appendChild(clone);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeImageZoom() {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (stage) stage.innerHTML = '';
}

document.addEventListener('click', function (e) {
  const openBtn = e.target.closest('[data-zoom-src]');
  if (openBtn) { openImageZoom(openBtn); return; }
  if (e.target.closest('[data-zoom-close="true"]')) closeImageZoom();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeImageZoom();
});

/* ═══════════════════════════════════════════════════════════
   Pointer-based drag-and-drop helper.
   Replaces native HTML5 drag so screens work on touch devices
   (tablet, both orientations) without losing mouse support.

   Usage:
     const dnd = createPointerDnd({
       canDrag: (dragId, elem) => boolean,
       onPick:  (dragId, elem) => void,    // pointerdown accepted
       onDrop:  (dragId, targetId) => void,
       onCancel:(dragId) => void,          // dropped outside a target
     });
     dnd.attachSource(elem, dragId);   // safe to call repeatedly
     dnd.attachTarget(elem, targetId);

   Ghost element (a clone of the source) follows the pointer
   in viewport-fixed positioning and is scaled to match the
   #app transform so it visually matches the source.
   ═══════════════════════════════════════════════════════════ */
function createPointerDnd(opts) {
  const targets = new Map(); // elem → targetId
  let active = null;

  function getAppScale() {
    const app = document.getElementById('app');
    const m = app && app.style.transform.match(/scale\(([^)]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }

  function attachSource(elem, dragId) {
    if (!elem || elem.dataset.pdragAttached === '1') {
      if (elem) elem.dataset.pdragId = dragId;
      return;
    }
    elem.dataset.pdragId = dragId;
    elem.dataset.pdragAttached = '1';
    elem.style.touchAction = 'none';
    elem.addEventListener('pointerdown', onSourceDown);
  }

  function attachTarget(elem, targetId) {
    if (!elem) return;
    targets.set(elem, targetId);
  }

  function onSourceDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const src    = e.currentTarget;
    const dragId = src.dataset.pdragId;
    if (!dragId) return;
    if (opts.canDrag && !opts.canDrag(dragId, src)) return;
    e.preventDefault();

    const rect  = src.getBoundingClientRect();
    const scale = getAppScale();

    const ghost = src.cloneNode(true);
    // Strip ids from clone descendants to avoid duplicate ids in DOM
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.style.position       = 'fixed';
    ghost.style.left           = rect.left + 'px';
    ghost.style.top            = rect.top  + 'px';
    // Lock the ghost to the source's rendered size so the dragged card keeps the
    // same width/height (the source is width:100% of its slot; a bare clone would
    // shrink to its text). rect is post-scale, so divide back out the app scale.
    ghost.style.width          = (rect.width  / scale) + 'px';
    ghost.style.height         = (rect.height / scale) + 'px';
    ghost.style.boxSizing      = 'border-box';
    ghost.style.margin         = '0';
    ghost.style.pointerEvents  = 'none';
    ghost.style.zIndex         = '9999';
    ghost.style.opacity        = '0.92';
    ghost.style.transform      = `scale(${scale})`;
    ghost.style.transformOrigin = 'top left';
    ghost.classList.remove('dragging');
    ghost.classList.add('pointer-drag-ghost');
    document.body.appendChild(ghost);

    active = {
      dragId, srcElem: src, ghost,
      pointerId: e.pointerId,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      currentTarget: null,
    };
    src.classList.add('dragging');
    if (opts.onPick) opts.onPick(dragId, src);

    document.addEventListener('pointermove',   onMove,   { passive: false });
    document.addEventListener('pointerup',     onUp);
    document.addEventListener('pointercancel', onUp);
  }

  function findTargetUnder(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    for (const [tElem, tId] of targets) {
      if (tElem === el || tElem.contains(el)) return { elem: tElem, id: tId };
    }
    return null;
  }

  function onMove(e) {
    if (!active) return;
    if (active.pointerId !== undefined && e.pointerId !== active.pointerId) return;
    e.preventDefault();
    active.ghost.style.left = (e.clientX - active.offX) + 'px';
    active.ghost.style.top  = (e.clientY - active.offY) + 'px';

    const hit   = findTargetUnder(e.clientX, e.clientY);
    const hitId = hit ? hit.id : null;
    if (active.currentTarget !== hitId) {
      if (active.currentTarget) {
        for (const [elem, tid] of targets) {
          if (tid === active.currentTarget) elem.classList.remove('drag-over');
        }
      }
      if (hit) hit.elem.classList.add('drag-over');
      active.currentTarget = hitId;
    }
  }

  function onUp(e) {
    if (!active) return;
    if (active.pointerId !== undefined && e && e.pointerId !== undefined &&
        e.pointerId !== active.pointerId) return;

    document.removeEventListener('pointermove',   onMove);
    document.removeEventListener('pointerup',     onUp);
    document.removeEventListener('pointercancel', onUp);

    const dragId   = active.dragId;
    const targetId = active.currentTarget;
    const srcElem  = active.srcElem;
    const ghost    = active.ghost;

    for (const [elem] of targets) elem.classList.remove('drag-over');
    srcElem.classList.remove('dragging');
    ghost.remove();
    active = null;

    if (targetId && opts.onDrop)       opts.onDrop(dragId, targetId);
    else if (opts.onCancel)            opts.onCancel(dragId);
  }

  return { attachSource, attachTarget };
}

/* ─── Navigation ─────────────────────────────────────────── */
/* Screen number → its feedback popup element id, for screens that have one.
   Used to restore a popup the learner left open (not X-closed) — see below. */
const SCREEN_POPUP_ID = {
  1: 'scq-popup', 3: 'ddq-popup', 8: 'mdq-popup', 9: 's9q-popup',
  11: 's11ddq-popup', 12: 's12q-popup', 16: 's16ddq-popup',
  17: 's17q-popup', 18: 's18q-popup', 19: 's19q-popup', 20: 's20q-popup'
};
/* Screen number → whether that screen's question has actually been resolved
   (correct, or final wrong) — same "is this question done" check each screen's
   own resetScreenState() branch already uses to decide fresh-reset vs. resume.
   The popup-reopen below must only fire when this is true: reopening a
   "try again" popup over a board that a *not-done* screen's own reset just
   wiped back to blank would show stale feedback for an empty board. */
const SCREEN_DONE = {
  1: () => scqDone, 3: () => ddqDone, 8: () => !!window.lomdaState.s8?.done,
  9: () => s9qDone, 11: () => s11ddqDone, 12: () => s12qDone, 16: () => s16ddqDone,
  17: () => s17qDone, 18: () => s18qDone, 19: () => s19qDone, 20: () => s20qDone
};
let popupOpenOnExit = {};

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  // Record whether the screen we're leaving still has its own feedback popup
  // visible (i.e. the learner never closed it with the X button) — restored below.
  // Only counts if the question is actually resolved (Done) — see SCREEN_DONE above.
  const leavingPopupId = SCREEN_POPUP_ID[currentScreen];
  if (leavingPopupId) {
    const leavingPopup = document.getElementById(leavingPopupId);
    const leavingDone = SCREEN_DONE[currentScreen] ? SCREEN_DONE[currentScreen]() : false;
    popupOpenOnExit[currentScreen] = leavingDone && !!(leavingPopup && !leavingPopup.classList.contains('hidden'));
  }
  // Every feedback popup / hint overlay belongs to the screen it was opened on.
  // Hide them ALL on any navigation so none carries over to the next screen.
  document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
    .forEach(el => el.classList.add('hidden'));
  if (typeof mdqCloseAllDropdowns === 'function') mdqCloseAllDropdowns();
  const prev = document.querySelector('.screen.active');
  if (prev) prev.classList.remove('active');
  /* Halt the YouTube videos when leaving, so their audio doesn't play on other screens. */
  if (prev && prev.id === 's5'  && typeof pauseS5Video  === 'function') pauseS5Video();
  if (prev && prev.id === 's21' && typeof pauseS21Video === 'function') pauseS21Video();
  currentScreen = n;
  const next = document.getElementById('s' + n);
  if (next) next.classList.add('active');
  resetScreenState(n);
  // Reopen this screen's own feedback popup if it was left open (not X-closed) —
  // resetScreenState() above already restored the locked/answered visual state
  // via the existing *Done resume-state guards; this only restores the popup
  // itself, at its default position, without re-running any check logic.
  const enterPopupId = SCREEN_POPUP_ID[n];
  if (enterPopupId && popupOpenOnExit[n]) {
    const enterPopup = document.getElementById(enterPopupId);
    if (enterPopup) {
      resetPopupPosition(enterPopup);
      enterPopup.classList.remove('hidden');
    }
  }
}

function resetScreenState(n) {
  if (n === 0) {
    // TwoOptionSelection — restore the saved choice (if returning to it)
    const saved = window.lomdaState.selectedCharacter;
    document.querySelectorAll('#s0 .option-card').forEach(card => {
      const isSel = !!saved && card.dataset.value === saved;
      card.classList.toggle('selected', isSel);
      card.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
    const cont = document.getElementById('s0-continue');
    if (cont) cont.disabled = !saved;
  }
  if (n === 1) {
    // SingleChoiceQuestion — keep a completed question completed on return;
    // otherwise restore a clean initial state.
    if (!scqDone) scqResetInitial();
    document.getElementById('scq-hint-overlay')?.classList.add('hidden');
  }
  if (n === 2) {
    frcEnter();
  }
  if (n === 3) {
    ddqEnter();
  }
  if (n === 4) {
    resetS4State();
  }
  if (n === 5) {
    resetS5State();
  }
  if (n === 6) {
    resetS6State();
  }
  if (n === 7) {
    const char = window.lomdaState.selectedCharacter || 'character-1';
    const src  = S7_CHARACTER_VIDEOS[char] || S7_CHARACTER_VIDEOS['character-1'];
    const vid  = document.getElementById('s7-video');
    if (vid) { vid.src = src; vid.load(); vid.play().catch(() => {}); freezeVideoOnEnd(vid); }
  }
  if (n === 8) {
    mdqEnter();
  }
  if (n === 9) {
    if (!s9qDone) s9qResetInitial();
    document.getElementById('s9q-hint-overlay')?.classList.add('hidden');
  }
  if (n === 10) {
    const char = window.lomdaState.selectedCharacter || 'character-1';
    const src  = S10_CHARACTER_VIDEOS[char] || S10_CHARACTER_VIDEOS['character-1'];
    const vid  = document.getElementById('s10-video');
    if (vid) { vid.src = src; vid.load(); vid.play().catch(() => {}); freezeVideoOnEnd(vid); }
  }
  if (n === 11) {
    s11ddqEnter();
  }
  if (n === 12) {
    s12qEnter();
  }
  if (n === 13) {
    s13Enter();
  }
  if (n === 14) {
    s14qEnter();
  }
  if (n === 15) {
    s15frcEnter();
  }
  if (n === 16) {
    s16ddqEnter();
  }
  if (n === 17) {
    s17qEnter();
  }
  if (n === 18) {
    s18qEnter();
  }
  if (n === 19) {
    s19qEnter();
  }
  if (n === 20) {
    // SingleChoiceQuestion (after video 1) — keep completed state on return
    if (!s20qDone) s20qResetInitial();
  }
  if (n === 21) {
    resetS21State();
  }
}

/* ─── Keyboard Navigation ────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
  if (e.key === 'Escape') {
    scqCloseHint();
    ddqClosePopup();
    mdqClosePopup();
    mdqCloseHint();
    mdqCloseAllDropdowns();
    s9qCloseHint();
    s9qClosePopup();
    s11ddqClosePopup();
    s11ddqCloseHint();
    s12qClosePopup();
    s12qCloseHint();
    s17qClosePopup();
    s17qCloseHint();
    s18qClosePopup();
    s18qCloseHint();
    s19qClosePopup();
    s19qCloseHint();
    s20qClosePopup();
  }
});

function goBack() {
  // Flow exceptions — S20/S21 sit numerically at the end but flow-wise after S5
  if (currentScreen === 20) { goTo(5);  return; }
  if (currentScreen === 21) { goTo(20); return; }
  if (currentScreen === 7)  { goBackFromS7(); return; }
  if (currentScreen === 6)  { goTo(4);  return; }  // cards path: back to learning-style choice
  goTo(currentScreen - 1);
}

function advanceScreen() {
  // Flow exceptions — video path: S5 → S20 (question) → S21 (video 2) → S7
  if (currentScreen === 5)  { if (!s5VideoWatched)  return; goTo(20); return; }
  if (currentScreen === 20) { if (!s20qAnswered)    return; goTo(21); return; }
  if (currentScreen === 21) { if (!s21VideoWatched) return; goTo(7);  return; }
  // S19 is the last flow screen (S20/S21 sit after it only numerically) —
  // onward to part 02/03 via the S19 button's score branch, not the keyboard.
  if (currentScreen === 19) return;
  // Screen 01 gate: a character must be selected before advancing
  if (currentScreen === 0 && !window.lomdaState.selectedCharacter) return;
  // Screen 02 gate: must answer before advancing
  if (currentScreen === 1 && !scqAnswered) return;
  // Screen 04 gate: must check before advancing via keyboard
  if (currentScreen === 3 && !ddqChecked) return;
  // Screen 09 gate: must complete question before advancing via keyboard
  if (currentScreen === 8 && !window.lomdaState.s8?.done) return;
  // Screen 10 gate: must answer before advancing
  if (currentScreen === 9 && !s9qAnswered) return;
  // Screen 12 gate: must complete question before advancing via keyboard
  if (currentScreen === 11 && !s11ddqDone) return;
  goTo(currentScreen + 1);
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — TwoOptionSelection (Screen 01)
   Single selection. Selecting a card stores the choice globally
   and enables the Continue button. No modal, no auto-advance.
   ═══════════════════════════════════════════════════════════ */
function selectOption(cardEl) {
  document.querySelectorAll('#s0 .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');

  // Persist globally for the rest of the lomda
  window.lomdaState.selectedCharacter = cardEl.dataset.value;
  try { sendStatement720('selected', 'question', { response: cardEl.dataset.value }, { category: 'learningType' }); } catch(e) {}
  // Persist across parts (read by part 02 via localStorage)
  try { localStorage.setItem('lomda_selectedCharacter', cardEl.dataset.value); } catch (e) {}

  // Enable Continue (visible from the start, disabled until now)
  const cont = document.getElementById('s0-continue');
  if (cont) cont.disabled = false;
}

/* Continue ("בחרתי") → advance. goTo(1) is a no-op until screen 2 exists. */
function advanceFromS0() {
  if (!window.lomdaState.selectedCharacter) return;
  goTo(1);
}

/* ── Screen 05 (S4) — TwoOptionSelection: learning style choice ─────────── */
let s4Selected = null;

function updateS4Characters() {
  const ch = window.lomdaState.selectedCharacter || 'character-1';
  const imgCards  = document.getElementById('s4-img-cards');
  const imgListen = document.getElementById('s4-img-listen');
  if (imgCards)  imgCards.src  = `assets/img/${ch}-cards.png`;
  if (imgListen) imgListen.src = `assets/img/${ch}-Watching-Video.png`;
  const s4El = document.getElementById('s4');
  if (s4El) s4El.dataset.character = ch;
}

function selectOptionS4(cardEl) {
  s4Selected = cardEl.dataset.value;
  window.lomdaState.selectedLearningStyle = s4Selected;
  try { sendStatement720('selected', 'question', { response: s4Selected }, { category: 'learningType' }); } catch(e) {}
  document.querySelectorAll('#s4 .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  const btn = document.getElementById('s4-continue');
  if (btn) btn.disabled = false;
}

function advanceFromS4() {
  if (!s4Selected) return;
  s6ReturnVideoScreen = 5;   // fresh entry into the branch — video tab means video 1
  if (s4Selected === 'listening') goTo(5);
  if (s4Selected === 'cards')     goTo(6);
}

function resetS4State() {
  s4Selected = window.lomdaState.selectedLearningStyle || null;
  document.querySelectorAll('#s4 .option-card').forEach(c => {
    const isSelected = c.dataset.value === s4Selected;
    c.classList.toggle('selected', isSelected);
    c.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });
  const btn = document.getElementById('s4-continue');
  if (btn) btn.disabled = !s4Selected;
  updateS4Characters();
}

/* Keyboard activation for S4 cards (Enter / Space) */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('#s4 .option-card');
  if (!card) return;
  e.preventDefault();
  selectOptionS4(card);
});

/* Keyboard activation for the radio cards (Enter / Space) */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('#s0 .option-card');
  if (!card) return;
  e.preventDefault();
  selectOption(card);
});


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — SingleChoiceQuestion (Screen 02)
   One screen, multiple states driven by JS. Single selection,
   2 attempts, hint modal, correct/incorrect feedback, tooltip.
   Question data lives in a clean config object for reuse.
   ═══════════════════════════════════════════════════════════ */
const SCQ = {
  correctId: 'b',      // "האוויר שבתוך הבלון המנופח מעלה את המסה שלו"
  maxAttempts: 2
};

let scqSelected = null;   // currently selected option id
let scqAttempts = 0;      // number of check attempts made
let scqAnswered = false;  // true once resolved (correct or final wrong)
let scqDone     = false;  // resume-state lock (survives navigation)

/* Select an option (single selection) */
function scqSelect(id) {
  if (scqAnswered) return;
  scqSelected = id;
  // If a "try again" panel is showing from a previous wrong attempt,
  // clear it so the learner gets a fresh check.
  if (scqAttempts > 0) {
    document.getElementById('scq-feedbox')?.classList.add('hidden');
    document.querySelectorAll('#s1 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s1 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  scqUpdateBar();
}

/* Check / advance — the main bottom-bar button */
function scqCheck() {
  if (scqAnswered) { advanceScreen(); return; }   // label is "שנמשיך?" → go next (safe no-op)
  if (!scqSelected) return;

  scqAttempts++;
  const isCorrect = scqSelected === SCQ.correctId;

  try {
    var _ans = document.querySelector('#s1 .scq-opt[data-id="' + scqSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : scqSelected;
    var _row = isCorrect ? 'answered.last' : (scqAttempts >= SCQ.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-001/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    scqMark(SCQ.correctId, 'correct');
    scqShowPopup('correct');
    scqFinish();
  } else if (scqAttempts >= SCQ.maxAttempts) {
    // Second wrong → reveal correct (green) + mark chosen wrong (red)
    scqMark(SCQ.correctId, 'correct');
    scqMark(scqSelected, 'wrong');
    scqShowPopup('wrong2');
    scqFinish();
  } else {
    // First wrong → "try again", mark chosen wrong, correct NOT revealed
    scqMark(scqSelected, 'wrong');
    scqShowPopup('retry');
  }
}

function scqMark(id, cls) {
  const opt = document.querySelector('#s1 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

const SCQ_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'התשובה אינה נכונה.',
    body: ['לא נורא, גם מטעויות לומדים.', 'ננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'נכון.',
    body: ['האוויר בבלון מעלה את המסה של הבלון.', 'איך נמדוד מסה בצורה מהימנה?', 'בואו נלמד יחד!']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'תשובתך אינה נכונה.',
    body: [
      'התשובה הנכונה מסומנת.',
      'האוויר בבלון מעלה את המסה של הבלון.',
      'איך נמדוד מסה בצורה מהימנה?',
      'בואו נלמד יחד!'
    ]
  }
};

/* ── resetPopupPosition — STANDARD for all draggable feedback popups ────────
   Every feedback popup must reset to its CSS-defined default position each
   time it opens, even if the learner previously dragged it elsewhere.
   Rule: call resetPopupPosition(popup) at the top of every *ShowPopup()
   function before revealing the element. Never hardcode a position in the
   show function instead of calling this helper.
   ─────────────────────────────────────────────────────────────────────── */
function resetPopupPosition(popup) {
  popup.style.left   = '2px';
  popup.style.top    = 'auto';
  popup.style.bottom = '76px';
}

function scqShowPopup(type) {
  const popup = document.getElementById('scq-popup');
  if (!popup) return;
  const cfg = SCQ_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('scq-popup-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const bodyEl = document.getElementById('scq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function scqClosePopup() {
  document.getElementById('scq-popup')?.classList.add('hidden');
}

function scqShowFeedbox(type) {
  const box = document.getElementById('scq-feedbox');
  if (!box) return;
  box.classList.remove('hidden', 'is-correct', 'is-wrong', 'collapsed');
  box.classList.add(type === 'correct' ? 'is-correct' : 'is-wrong');
  box.querySelectorAll('.scq-fb').forEach(f => f.classList.add('hidden'));
  box.querySelector('.scq-fb[data-fb="' + type + '"]')?.classList.remove('hidden');
}

/* Lock the question after it is resolved */
function scqFinish() {
  scqAnswered = true;
  scqDone = true;
  document.querySelectorAll('#s1 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('scq-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById('scq-hint');
  if (hint) hint.style.visibility = 'hidden';
}

/* Enable/disable bar buttons based on current (unanswered) state */
function scqUpdateBar() {
  if (scqAnswered) return;
  const chk = document.getElementById('scq-check');
  if (chk) chk.disabled = !scqSelected;
  // Hint stays available through both attempts; scqFinish() hides it once done.
}

/* Collapse / expand the feedback panel body */
function scqToggleFeedbox() {
  document.getElementById('scq-feedbox')?.classList.toggle('collapsed');
}

/* Hint modal */
function scqOpenHint() {
  if (scqAnswered) return;
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('scq-hint-overlay')?.classList.remove('hidden');
}
function scqCloseHint() {
  const overlay = document.getElementById('scq-hint-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
}
function scqCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 'scq-hint-overlay') scqCloseHint();
}

/* Restore the clean initial state (used on first entry / unfinished return) */
function scqResetInitial() {
  scqSelected = null;
  scqAttempts = 0;
  scqAnswered = false;
  document.querySelectorAll('#s1 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('scq-feedbox')?.classList.add('hidden');
  const chk = document.getElementById('scq-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById('scq-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = ''; }
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — FlipCardsReveal (Screen 03)
   One-way reveal: clicking a card flips it permanently to show
   text. Additional clicks do nothing. Continue unlocks only after
   both cards have been revealed at least once.
   ═══════════════════════════════════════════════════════════ */
let frcRevealed = [false, false];
let frcFlipped = [false, false];
let frcDone = false;

function frcFlip(cardEl) {
  const idx = parseInt(cardEl.dataset.index, 10);
  frcFlipped[idx] = !frcFlipped[idx];
  if (frcFlipped[idx]) frcRevealed[idx] = true;

  cardEl.classList.toggle('is-flipped', frcFlipped[idx]);
  cardEl.setAttribute('aria-expanded', frcFlipped[idx] ? 'true' : 'false');

  const baseLabel = cardEl.dataset.baseLabel || cardEl.getAttribute('aria-label');
  cardEl.setAttribute('aria-label',
    baseLabel.replace(/\.?\s*לחצו להפוך$/, frcFlipped[idx] ? 'לחצו כדי להפוך בחזרה' : 'לחצו להפוך'));

  const front = cardEl.querySelector('.frc-card-front');
  const back  = cardEl.querySelector('.frc-card-back');
  if (front) front.setAttribute('aria-hidden', frcFlipped[idx] ? 'true' : 'false');
  if (back)  back.setAttribute('aria-hidden', frcFlipped[idx] ? 'false' : 'true');

  frcCheckUnlock();
}

function frcCheckUnlock() {
  if (frcRevealed.every(Boolean)) {
    const btn = document.getElementById('s2-continue');
    if (btn) btn.disabled = false;
    frcDone = true;
  }
}

function advanceFromS2() {
  goTo(3);
}

function frcEnter() {
  // Restore visual state (cards can flip back/forth across navigation)
  document.querySelectorAll('#s2 .frc-card').forEach((cardEl, idx) => {
    cardEl.classList.toggle('is-flipped', frcFlipped[idx]);
    cardEl.setAttribute('aria-expanded', frcFlipped[idx] ? 'true' : 'false');
    const front = cardEl.querySelector('.frc-card-front');
    const back  = cardEl.querySelector('.frc-card-back');
    if (front) front.setAttribute('aria-hidden', frcFlipped[idx] ? 'true' : 'false');
    if (back)  back.setAttribute('aria-hidden', frcFlipped[idx] ? 'false' : 'true');
  });
  const btn = document.getElementById('s2-continue');
  if (btn) btn.disabled = !frcDone;
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — DragAndDropQuestion (Screen 04)
   Learner drags images from source tray into labeled drop targets.
   Check button enables when ALL required targets are filled —
   not when all draggables are placed (distractor may stay in source).

   Config object DDQ is the reuse surface for future screens:
   ─ correctMap  { targetId: 'draggableId' }  strict 1-to-1
   ─ revealMap   { targetId: 'draggableId' }  shown on incorrect feedback
   ─ feedbackText { correct/incorrect: { title, titleColor, bg, body[] } }

   Extension points for future screens:
   ─ Multiple valid items per target → change correctMap value to an
     array and update ddqCheck() with Array.isArray() + .includes().
   ─ Two attempts → add attempt counter; show inline message on attempt 1.
   ─ Hint button  → add DDQ.hint = { text: '...' } and a hint <button>.
   ─ Different draggable/target counts → adjust ddqPlacement keys and HTML.
   ═══════════════════════════════════════════════════════════ */

const DDQ = {
  correctMap: {
    'target-analog':  'drag-analog',    // AnalogWeights  → מאזני כפות
    'target-digital': 'drag-digital'    // DigitalWeights → מאזניים דיגיטליים
    // drag-human is the distractor — no correct target exists for it
  },
  revealMap: {
    'target-analog':  'drag-analog',
    'target-digital': 'drag-digital'
    // HumanWeight is never shown as a correct answer
  },
  maxAttempts: 1,
  hint: false,
  feedbackText: {
    correct: {
      title:      'התשובה נכונה!',
      titleColor: '#222222',
      bg:         '#edf8ed',
      body: [
        'מאזני כפות ומאזניים דיגיטליים הם כלי מדידה מדעיים מדויקים המשמשים במעבדה.',
        'מאזני משקל גוף מיועדים למדידה גסה של משקל הגוף בלבד ואינם מדויקים מספיק למדידה מדעית.'
      ]
    },
    incorrect: {
      title:      'זוהי טעות, התשובה הנכונה מוצגת.',
      titleColor: '#303030',
      bg:         '#ffdbdc',
      body: [
        'מאזני כפות ומאזניים דיגיטליים הם כלי מדידה מדעיים מדויקים המשמשים במעבדה.',
        'מאזני משקל גוף מיועדים למדידה גסה של משקל הגוף בלבד ואינם מדויקים מספיק למדידה מדעית.'
      ]
    }
  }
};

/* ddqPlacement: maps each draggable ID → current location
   ('source'  = in the source tray slot
    targetId  = placed inside that drop target)             */
const ddqPlacement = {
  'drag-analog':  'source',
  'drag-human':   'source',
  'drag-digital': 'source'
};

/* Image metadata used when rendering the placed thumbnail in a target */
const ddqImages = {
  'drag-analog':  { src: 'assets/img/AnalogWeights.jpg',  alt: 'מאזני כפות' },
  'drag-human':   { src: 'assets/img/HumanWeight.jpeg',    alt: 'מאזני משקל גוף' },
  'drag-digital': { src: 'assets/img/DigitalWeights.jpeg', alt: 'מאזניים דיגיטליים' }
};

let ddqChecked     = false;   // true once ddqCheck() has run
let ddqDone        = false;   // resume-state lock (survives back-navigation)
let ddqDnd         = null;    // pointer-drag controller (lazily initialised)

/* ── Render — single state object → DOM ──────────────────── */
function ddqRender() {
  ddqInitDnd();

  // Source slots: derive IDs from ddqPlacement (no hardcoded list)
  Object.keys(ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const inSource = (ddqPlacement[id] === 'source');
    card.classList.toggle('ghost', !inSource);
  });

  // Targets: all required targets + any currently occupied targets
  const _targetIds = [...new Set([
    ...Object.keys(DDQ.correctMap),
    ...Object.values(ddqPlacement).filter(v => v !== 'source')
  ])];
  _targetIds.forEach(targetId => {
    const zone = document.getElementById(targetId);
    if (!zone) return;

    // Which draggable is here?
    const dragId = Object.keys(ddqPlacement)
      .find(k => ddqPlacement[k] === targetId) || null;

    // Remove old placed card (badge div is left intact)
    zone.querySelector('.ddq-placed-card')?.remove();

    if (dragId) {
      // Inject the same visual component as the source card — white frame + image.
      // Copy the item-composition class (ddq-item--X) so image-sizing rules
      // defined on .ddq-item--X .ddq-card-img fire in every container equally.
      const itemClass = document.getElementById(dragId)?.classList
        .toString().split(' ').find(c => c.startsWith('ddq-item--')) || '';
      const card = document.createElement('div');
      card.className = ('ddq-placed-card ' + itemClass).trim();
      const img = document.createElement('img');
      img.src       = ddqImages[dragId].src;
      img.alt       = ddqImages[dragId].alt;
      img.className = 'ddq-card-img';
      img.draggable = false;
      card.appendChild(img);
      // Allow dragging placed items back out (disabled after check) via pointer DnD
      if (!ddqChecked) ddqDnd.attachSource(card, dragId);
      zone.appendChild(card);
      zone.classList.add('occupied');
      if (ddqChecked) zone.classList.add('correct');
    } else {
      zone.classList.remove('occupied', 'correct');
    }
  });

  ddqUpdateCheck();
}

/* ── Pointer DnD setup — runs once, idempotent ───────────── */
function ddqInitDnd() {
  if (ddqDnd) return;
  ddqDnd = createPointerDnd({
    canDrag: (dragId, elem) => {
      if (ddqChecked) return false;
      // Source-tray card (id matches dragId): only draggable from 'source'
      if (elem.id === dragId) return ddqPlacement[dragId] === 'source';
      // Placed card (no id, inside a target): always draggable
      return true;
    },
    onPick: (dragId) => {
      // Remove from current placement so target slot empties immediately.
      // ddqRender re-renders the source tray with .dragging on the tray card.
      if (ddqPlacement[dragId] !== 'source') {
        ddqPlacement[dragId] = 'source';
        ddqRender();
      }
      // Re-apply .dragging to the source tray card (render clears classes)
      document.getElementById(dragId)?.classList.add('dragging');
    },
    onDrop: (dragId, targetId) => {
      // Evict existing occupant back to source
      const evicted = Object.keys(ddqPlacement).find(k => ddqPlacement[k] === targetId);
      if (evicted && evicted !== dragId) ddqPlacement[evicted] = 'source';
      ddqPlacement[dragId] = targetId;
      ddqRender();
    },
    onCancel: () => {
      // No state change — onPick already moved item back to source.
      ddqRender();
    },
  });
  // Attach persistent source tray cards
  Object.keys(ddqPlacement).forEach(id => {
    const el = document.getElementById(id);
    if (el) ddqDnd.attachSource(el, id);
  });
  // Attach drop targets
  document.querySelectorAll('#s3 .ddq-target').forEach(el => {
    ddqDnd.attachTarget(el, el.id);
  });
}

/* ── Enable / disable check button ───────────────────────── */
function ddqUpdateCheck() {
  if (ddqChecked) return;
  // All REQUIRED targets (keys of correctMap) must have an item placed
  const allFilled = Object.keys(DDQ.correctMap).every(tId =>
    Object.keys(ddqPlacement).some(dId => ddqPlacement[dId] === tId)
  );
  const btn = document.getElementById('ddq-check');
  if (btn) btn.disabled = !allFilled;
}

/* Drag/drop is handled entirely by the pointer DnD controller (ddqInitDnd). */

/* ── Check answers ───────────────────────────────────────── */
function ddqCheck() {
  if (ddqChecked) {
    goTo(4);   // safe no-op until screen 5 is added
    return;
  }

  // Strict equality: each required target must hold exactly its correct item
  const allCorrect = Object.keys(DDQ.correctMap).every(
    tId => ddqPlacement[DDQ.correctMap[tId]] === tId
  );

  try {
    var _ans = Object.keys(DDQ.correctMap).map(function(tId){
      var d = Object.keys(ddqPlacement).find(function(k){ return ddqPlacement[k] === tId; });
      return (d && ddqImages[d]) ? ddqImages[d].alt : '—';
    }).join(' | ');
    sendStatement720('answered.last', 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-002/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  ddqChecked = true;
  ddqDone    = true;
  ddqLock();

  const btn = document.getElementById('ddq-check');
  if (btn) { btn.textContent = 'להמשיך?'; btn.disabled = false; }

  if (allCorrect) {
    ddqRender();             // applies .correct class (ddqChecked is now true)
    ddqMarkTargetsCorrect();
    ddqShowPopup('correct');
  } else {
    ddqRevealCorrect();      // overrides placements, then renders
    ddqShowPopup('incorrect');
  }
}

/* ── Lock all dragging after check ───────────────────────── */
function ddqLock() {
  Object.keys(ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.draggable = false;
    card.classList.add('locked');
  });
}

/* ── Add green badges to all required targets ────────────── */
function ddqMarkTargetsCorrect() {
  Object.keys(DDQ.correctMap).forEach(tId => {
    const zone = document.getElementById(tId);
    if (!zone) return;
    zone.classList.add('correct');
    zone.classList.remove('occupied');
    if (!zone.querySelector('.ddq-target-badge')) {
      const badge = document.createElement('div');
      badge.className = 'ddq-target-badge';
      zone.appendChild(badge);
    }
  });
}

/* ── Reveal correct answer for incorrect feedback ────────── */
function ddqRevealCorrect() {
  // Place each correct item in its required target
  Object.keys(DDQ.revealMap).forEach(tId => {
    ddqPlacement[DDQ.revealMap[tId]] = tId;
  });
  // Any item NOT assigned by revealMap (distractors) returns to source
  const assigned = new Set(Object.values(DDQ.revealMap));
  Object.keys(ddqPlacement).forEach(id => {
    if (!assigned.has(id)) ddqPlacement[id] = 'source';
  });
  ddqRender();
  ddqMarkTargetsCorrect();
}

/* ── Show feedback popup ─────────────────────────────────── */
function ddqShowPopup(type) {
  const popup = document.getElementById('ddq-popup');
  if (!popup) return;
  const cfg = DDQ.feedbackText[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('ddq-popup-title');
  if (titleEl) { titleEl.textContent = cfg.title; titleEl.style.color = cfg.titleColor; }
  const bodyEl = document.getElementById('ddq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => `<p>${p}</p>`).join('');
  popup.classList.remove('hidden');
}

/* ── Close feedback popup ────────────────────────────────── */
function ddqClosePopup() {
  document.getElementById('ddq-popup')?.classList.add('hidden');
}

/* ── Popup dragging (mouse) ──────────────────────────────── */
let scqPopupDragging = false;
let scqPopupOffX = 0, scqPopupOffY = 0;

function scqPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  scqPopupDragging = true;
  const popup = document.getElementById('scq-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx = parseFloat(popup.style.top);
  const popupTop = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = popupTop + 'px';
  popup.style.bottom = 'auto';
  scqPopupOffX  = canvasX - (parseFloat(popup.style.left) || 2);
  scqPopupOffY  = canvasY - popupTop;
  e.preventDefault();
}

let ddqPopupDragging = false;
let ddqPopupOffX = 0, ddqPopupOffY = 0;

let mdqPopupDragging = false;
let mdqPopupOffX = 0, mdqPopupOffY = 0;

let s9qPopupDragging = false;
let s9qPopupOffX = 0, s9qPopupOffY = 0;

let s11ddqPopupDragging = false;
let s11ddqPopupOffX = 0, s11ddqPopupOffY = 0;

let s16ddqPopupDragging = false;
let s16ddqPopupOffX = 0, s16ddqPopupOffY = 0;

let s20qPopupDragging = false;
let s20qPopupOffX = 0, s20qPopupOffY = 0;

function ddqPopupMouseDown(e) {
  if (e.target.closest('.ddq-popup-close')) return;
  ddqPopupDragging = true;
  const popup = document.getElementById('ddq-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const ddqTopPx = parseFloat(popup.style.top);
  const ddqTop = isNaN(ddqTopPx) ? popup.offsetTop : ddqTopPx;
  popup.style.top    = ddqTop + 'px';
  popup.style.bottom = 'auto';
  ddqPopupOffX  = canvasX - (parseFloat(popup.style.left) || 2);
  ddqPopupOffY  = canvasY - ddqTop;
  e.preventDefault();
}

window.addEventListener('pointermove', e => {
  const app = document.getElementById('app');
  if (!app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;

  if (scqPopupDragging) {
    const popup = document.getElementById('scq-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - scqPopupOffX;
      const newY = (e.clientY - appTop)  / scale - scqPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (ddqPopupDragging) {
    const popup = document.getElementById('ddq-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - ddqPopupOffX;
      const newY = (e.clientY - appTop)  / scale - ddqPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (mdqPopupDragging) {
    const popup = document.getElementById('mdq-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - mdqPopupOffX;
      const newY = (e.clientY - appTop)  / scale - mdqPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s9qPopupDragging) {
    const popup = document.getElementById('s9q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s9qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s9qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s11ddqPopupDragging) {
    const popup = document.getElementById('s11ddq-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s11ddqPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s11ddqPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s12qPopupDragging) {
    const popup = document.getElementById('s12q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s12qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s12qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s16ddqPopupDragging) {
    const popup = document.getElementById('s16ddq-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s16ddqPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s16ddqPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s17qPopupDragging) {
    const popup = document.getElementById('s17q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s17qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s17qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s18qPopupDragging) {
    const popup = document.getElementById('s18q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s18qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s18qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s19qPopupDragging) {
    const popup = document.getElementById('s19q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s19qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s19qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }

  if (s20qPopupDragging) {
    const popup = document.getElementById('s20q-popup');
    if (popup) {
      const newX = (e.clientX - appLeft) / scale - s20qPopupOffX;
      const newY = (e.clientY - appTop)  / scale - s20qPopupOffY;
      popup.style.left = Math.max(0, Math.min(newX, app.offsetWidth - popup.offsetWidth))  + 'px';
      popup.style.top  = Math.max(0, Math.min(newY, app.offsetHeight - 74 - popup.offsetHeight)) + 'px';
    }
  }
});

window.addEventListener('pointerup', () => {
  ddqPopupDragging = false;
  scqPopupDragging = false;
  mdqPopupDragging = false;
  s9qPopupDragging = false;
  s11ddqPopupDragging = false;
  s12qPopupDragging = false;
  s16ddqPopupDragging = false;
  s17qPopupDragging = false;
  s18qPopupDragging = false;
  s19qPopupDragging = false;
  s20qPopupDragging = false;
});
window.addEventListener('pointercancel', () => {
  ddqPopupDragging = false;
  scqPopupDragging = false;
  mdqPopupDragging = false;
  s9qPopupDragging = false;
  s11ddqPopupDragging = false;
  s12qPopupDragging = false;
  s16ddqPopupDragging = false;
  s17qPopupDragging = false;
  s18qPopupDragging = false;
  s19qPopupDragging = false;
  s20qPopupDragging = false;
});

/* ── Enter / reset screen state ──────────────────────────── */
function ddqEnter() {
  if (ddqDone) {
    // Restore the locked, answered state on back-navigation return
    ddqRender();
    ddqLock();
    ddqMarkTargetsCorrect();
    const btn = document.getElementById('ddq-check');
    if (btn) { btn.textContent = 'להמשיך?'; btn.disabled = false; }
    document.getElementById('ddq-popup')?.classList.add('hidden');
    return;
  }
  // ── Full reset for fresh entry ──
  ddqChecked     = false;
  Object.keys(ddqPlacement).forEach(id => { ddqPlacement[id] = 'source'; });

  // Clear target visual state — derive IDs from correctMap
  Object.keys(DDQ.correctMap).forEach(tId => {
    const zone = document.getElementById(tId);
    if (!zone) return;
    zone.classList.remove('correct', 'occupied', 'drag-over');
    zone.querySelector('.ddq-target-badge')?.remove();
    zone.querySelector('.ddq-placed-card')?.remove();
  });

  // Reset check button
  const btn = document.getElementById('ddq-check');
  if (btn) { btn.textContent = 'צדקתי?'; btn.disabled = true; }

  // Unlock all source cards — derive from ddqPlacement
  Object.keys(ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('ghost', 'dragging', 'locked');
  });

  document.getElementById('ddq-popup')?.classList.add('hidden');

  // Hook up pointer DnD (idempotent — safe on every entry)
  ddqRender();
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — VideoWatchAndContinue (Screen 06 / S5)
   Source: Figma dpY9DTl41tzW8SKvcPWU0C nodes 2199:4655 / 2199:4670
   Learner must watch the YouTube video to the end to unlock Continue.
   State: default (continue disabled) → vpv-ended class on #s5 (continue enabled).

   S5 YouTube video — https://www.youtube.com/watch?v=vCb8nZt_Pts
   Uses the YouTube IFrame Player API: the API script is loaded lazily on first
   entry to S5, replaces #vpv-youtube-player with the player iframe, and fires
   onStateChange(ENDED) → vpvOnVideoEnded() to enable Continue. Requires internet.
   ═══════════════════════════════════════════════════════════ */

const S5_YT_VIDEO_ID = 'vCb8nZt_Pts';
let s5VideoWatched = false;
let s5YtPlayer     = null;      // YT.Player instance (created once, reused)
let s5YtApiLoading = false;

/* Load the IFrame API script once; run cb when YT.Player is available. */
function loadYouTubeApi(cb) {
  if (window.YT && window.YT.Player) { cb(); return; }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof prev === 'function') prev();
    cb();
  };
  if (!s5YtApiLoading) {
    s5YtApiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

/* Shared playerVars for all YouTube embeds. YouTube rejects embeds whose
   origin/referrer signals are broken with player error 153 ("configuration
   error"): over file:// window.location.origin is "null" (an invalid origin
   param) and no Referer is sent — so pass origin/widget_referrer only when
   actually served over http(s). Videos may still refuse to play from
   file:// (YouTube requires a Referer); test over http(s). */
function ytEmbedPlayerVars() {
  const vars = { rel: 0, modestbranding: 1, playsinline: 1, hl: 'iw', cc_lang_pref: 'iw', cc_load_policy: 1 };
  if (/^https?:$/.test(window.location.protocol)) {
    vars.origin = window.location.origin;
    vars.widget_referrer = window.location.href;
  }
  return vars;
}

/* Create the player once. Continue unlocks when the video reaches its end. */
function initS5Player() {
  if (s5YtPlayer) return;
  loadYouTubeApi(function () {
    if (s5YtPlayer) return;
    s5YtPlayer = new YT.Player('vpv-youtube-player', {
      videoId: S5_YT_VIDEO_ID,
      /* youtube-nocookie.com = privacy-enhanced mode; works even when the browser's
         tracking prevention (e.g. Edge) blocks YouTube cookies/storage. */
      host: 'https://www.youtube-nocookie.com',
      playerVars: ytEmbedPlayerVars(),
      events: {
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) vpvOnVideoEnded();
        },
        /* Player failed (blocked network, embed error, file:// preview…) —
           don't strand the learner behind the watch gate. */
        onError: function () { vpvOnVideoEnded(); }
      }
    });
  });
}

function pauseS5Video() {
  if (s5YtPlayer && typeof s5YtPlayer.pauseVideo === 'function') s5YtPlayer.pauseVideo();
}

function vpvOnVideoEnded() {
  s5VideoWatched = true;

  const s5 = document.getElementById('s5');
  if (s5) s5.classList.add('vpv-ended');

  const btn = document.getElementById('s5-continue');
  if (btn) btn.disabled = false;
}

function initTogglePill(toggleEl) {
  const pill = toggleEl?.querySelector('.vpv-toggle-pill');
  const btn  = toggleEl?.querySelector('.vpv-toggle-btn--active');
  if (!pill || !btn) return;
  pill.style.transition = 'none';
  pill.style.left   = btn.offsetLeft   + 'px';
  pill.style.top    = btn.offsetTop    + 'px';
  pill.style.width  = btn.offsetWidth  + 'px';
  pill.style.height = btn.offsetHeight + 'px';
  pill.offsetWidth;
  pill.style.transition = '';
}

/* Which video screen S6's "לצפות בסרטון" tab returns to: 5 (video 1,
   default — also when arriving at S6 straight from S4) or 21 (video 2,
   when the cards tab was clicked on S21's toggle). */
let s6ReturnVideoScreen = 5;

function vpvSwitchTab(tab) {
  if (tab === 'cards') {
    s6ReturnVideoScreen = 5;
    goTo(6);
    return;
  }
  /* 'listen' — already on this screen; keep/restore active state */
  document.getElementById('vpv-tab-listen')?.classList.add('vpv-toggle-btn--active');
  document.getElementById('vpv-tab-listen')?.setAttribute('aria-selected', 'true');
  document.getElementById('vpv-tab-cards')?.classList.remove('vpv-toggle-btn--active');
  document.getElementById('vpv-tab-cards')?.setAttribute('aria-selected', 'false');
}

function advanceFromS5() {
  // Video path continues to the S20 question (then S21 video 2, then S7)
  goTo(20);
}

function resetS5State() {
  const btn = document.getElementById('s5-continue');

  /* Completed end state persists: once the video was watched to the end,
     returning to this screen keeps Continue unlocked (no forced re-watch). */
  if (s5VideoWatched) {
    if (btn) btn.disabled = false;
  } else {
    document.getElementById('s5')?.classList.remove('vpv-ended');
    if (btn) btn.disabled = true;
    /* Create the player on first entry; on later (incomplete) entries rewind
       + halt it so the learner watches to the end to unlock Continue. */
    if (s5YtPlayer && typeof s5YtPlayer.stopVideo === 'function') {
      s5YtPlayer.stopVideo();
    } else {
      initS5Player();
    }
  }

  /* Reset toggle to listening (default arrival path from S4) */
  document.getElementById('vpv-tab-listen')?.classList.add('vpv-toggle-btn--active');
  document.getElementById('vpv-tab-listen')?.setAttribute('aria-selected', 'true');
  document.getElementById('vpv-tab-cards')?.classList.remove('vpv-toggle-btn--active');
  document.getElementById('vpv-tab-cards')?.setAttribute('aria-selected', 'false');
  initTogglePill(document.querySelector('#s5 .vpv-toggle'));
}


/* ═══════════════════════════════════════════════════════════
   S21 — VideoWatchAndContinue (second video)
   S21 YouTube video — https://www.youtube.com/watch?v=YvJEfU7egRc
   Same IFrame-API pattern as S5 (shared loadYouTubeApi). Continue
   ("שנמשיך?") unlocks on ENDED, then advances to S7.
   ═══════════════════════════════════════════════════════════ */

const S21_YT_VIDEO_ID = 'YvJEfU7egRc';
let s21VideoWatched = false;
let s21YtPlayer     = null;

function initS21Player() {
  if (s21YtPlayer) return;
  loadYouTubeApi(function () {
    if (s21YtPlayer) return;
    s21YtPlayer = new YT.Player('vpv2-youtube-player', {
      videoId: S21_YT_VIDEO_ID,
      host: 'https://www.youtube-nocookie.com',
      playerVars: ytEmbedPlayerVars(),
      events: {
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) s21OnVideoEnded();
        },
        /* Player failed — don't strand the learner behind the watch gate. */
        onError: function () { s21OnVideoEnded(); }
      }
    });
  });
}

function pauseS21Video() {
  if (s21YtPlayer && typeof s21YtPlayer.pauseVideo === 'function') s21YtPlayer.pauseVideo();
}

function s21OnVideoEnded() {
  s21VideoWatched = true;
  const btn = document.getElementById('s21-continue');
  if (btn) btn.disabled = false;
}

function advanceFromS21() {
  s7ReturnScreen = 21;
  goTo(7);
}

function s21SwitchTab(tab) {
  if (tab === 'cards') {
    s6ReturnVideoScreen = 21;
    goTo(6);
    return;
  }
  /* 'listen' — already on this screen; keep/restore active state */
  document.getElementById('vpv2-tab-listen')?.classList.add('vpv-toggle-btn--active');
  document.getElementById('vpv2-tab-listen')?.setAttribute('aria-selected', 'true');
  document.getElementById('vpv2-tab-cards')?.classList.remove('vpv-toggle-btn--active');
  document.getElementById('vpv2-tab-cards')?.setAttribute('aria-selected', 'false');
}

function resetS21State() {
  const btn = document.getElementById('s21-continue');

  /* Completed end state persists (same rule as S5). */
  if (s21VideoWatched) {
    if (btn) btn.disabled = false;
  } else {
    if (btn) btn.disabled = true;
    if (s21YtPlayer && typeof s21YtPlayer.stopVideo === 'function') {
      s21YtPlayer.stopVideo();
    } else {
      initS21Player();
    }
  }
  /* Reset toggle to listening */
  document.getElementById('vpv2-tab-listen')?.classList.add('vpv-toggle-btn--active');
  document.getElementById('vpv2-tab-listen')?.setAttribute('aria-selected', 'true');
  document.getElementById('vpv2-tab-cards')?.classList.remove('vpv-toggle-btn--active');
  document.getElementById('vpv2-tab-cards')?.setAttribute('aria-selected', 'false');
  initTogglePill(document.querySelector('#s21 .vpv-toggle'));
}


/* ═══════════════════════════════════════════════════════════
   S20 — SingleChoiceQuestion "רגע לפני שנמשיך לצפות בסרטון"
   Source: producer PPT "שקף לקלוד1.pptx". Mirrors the s9q* pattern.
   No hint (producer: "אין רמז"). Single attempt (maxAttempts: 1):
   a wrong first answer reveals the correct one and locks the question;
   the check button then reads "שנמשיך?" and advances to S21 (video 2).
   ═══════════════════════════════════════════════════════════ */
const S20Q = {
  correctId: 'c',
  maxAttempts: 1
};

let s20qSelected = null;
let s20qAttempts = 0;
let s20qAnswered = false;
let s20qDone     = false;

function s20qSelect(id) {
  if (s20qAnswered) return;
  s20qSelected = id;
  document.querySelectorAll('#s20 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const chk = document.getElementById('s20q-check');
  if (chk) chk.disabled = !s20qSelected;
}

function s20qCheck() {
  if (s20qAnswered) { goTo(21); return; }
  if (!s20qSelected) return;

  s20qAttempts++;
  const isCorrect = s20qSelected === S20Q.correctId;

  try {
    var _ans = document.querySelector('#s20 .scq-opt[data-id="' + s20qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s20qSelected;
    sendStatement720('answered.last', 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-003/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s20qMark(S20Q.correctId, 'correct');
    s20qShowPopup('correct');
  } else {
    /* Single attempt — reveal the correct answer immediately */
    s20qMark(S20Q.correctId, 'correct');
    s20qMark(s20qSelected, 'wrong');
    s20qShowPopup('wrong2');
  }
  s20qFinish();
}

function s20qMark(id, cls) {
  const opt = document.querySelector('#s20 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

/* Feedback texts from the producer PPT — correct and wrong share the
   same explanation body; only the title block differs. */
const S20Q_POPUP_CFG = {
  correct: {
    bg: '#edf8ed',
    title: 'בדיוק!',
    body: ['מספר בלי יחידה הוא חסר משמעות.',
           'בסרטון הבא נלמד עוד 3 כללים חשובים שיבטיחו מדידות מהימנות.']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'אופס, זו טעות...',
    body: ['<strong>התשובה הנכונה מסומנת.</strong>',
           'מספר בלי יחידה הוא חסר משמעות.',
           'בסרטון הבא נלמד עוד 3 כללים חשובים שיבטיחו מדידות מהימנות.']
  }
};

function s20qShowPopup(type) {
  const popup = document.getElementById('s20q-popup');
  if (!popup) return;
  const cfg = S20Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s20q-popup-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const bodyEl = document.getElementById('s20q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s20qClosePopup() {
  document.getElementById('s20q-popup')?.classList.add('hidden');
}

function s20qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s20qPopupDragging = true;
  const popup = document.getElementById('s20q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx = parseFloat(popup.style.top);
  const top   = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = top + 'px';
  popup.style.bottom = 'auto';
  s20qPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s20qPopupOffY = canvasY - top;
  e.preventDefault();
}

function s20qFinish() {
  s20qAnswered = true;
  s20qDone = true;
  document.querySelectorAll('#s20 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s20q-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
}

function s20qResetInitial() {
  s20qSelected = null;
  s20qAttempts = 0;
  s20qAnswered = false;
  document.querySelectorAll('#s20 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s20q-popup')?.classList.add('hidden');
  const chk = document.getElementById('s20q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — FlipCards learning path (Screen 07 / S6)
   Source: Figma dpY9DTl41tzW8SKvcPWU0C nodes 2199:4640 / 2199:4625
   4 cards. Track which have been revealed (at least once).
   Continue unlocks when all 4 have been revealed.
   ═══════════════════════════════════════════════════════════ */

const s6Revealed = new Set();

function fpcFlip(cardEl, idx) {
  const flipped = !cardEl.classList.contains('fpc-flipped');
  cardEl.classList.toggle('fpc-flipped', flipped);
  cardEl.setAttribute('aria-expanded', flipped ? 'true' : 'false');
  const front = cardEl.querySelector('.fpc-front');
  const back = cardEl.querySelector('.fpc-back');
  if (front) front.setAttribute('aria-hidden', flipped ? 'true' : 'false');
  if (back) back.setAttribute('aria-hidden', flipped ? 'false' : 'true');
  if (!s6Revealed.has(idx)) {
    s6Revealed.add(idx);
    if (s6Revealed.size === 4) {
      const btn = document.getElementById('s6-continue');
      if (btn) btn.disabled = false;
    }
  }
}

function fpcSwitchTab(tab) {
  if (tab === 'listen') {
    goTo(s6ReturnVideoScreen);
    return;
  }
  /* 'cards' — already on this screen; no-op */
}

function advanceFromS6() {
  s7ReturnScreen = 6;
  goTo(7);
}

function resetS6State() {
  /* Completed end state persists: all 4 cards revealed → keep them flipped
     (their DOM state is untouched) and keep Continue unlocked. */
  if (s6Revealed.size === 4) {
    const doneBtn = document.getElementById('s6-continue');
    if (doneBtn) doneBtn.disabled = false;
    initTogglePill(document.querySelector('#s6 .vpv-toggle'));
    return;
  }

  s6Revealed.clear();
  document.querySelectorAll('#s6 .fpc-card').forEach(c => {
    c.classList.remove('fpc-flipped');
    c.setAttribute('aria-expanded', 'false');
    const front = c.querySelector('.fpc-front');
    const back = c.querySelector('.fpc-back');
    if (front) front.setAttribute('aria-hidden', 'false');
    if (back) back.setAttribute('aria-hidden', 'true');
  });
  const btn = document.getElementById('s6-continue');
  if (btn) btn.disabled = true;
  initTogglePill(document.querySelector('#s6 .vpv-toggle'));
}


/* ─── S7 TransitionScreen navigation ────────────────────────── */
// Back from S7 returns to the screen the learner actually arrived from
// (S6 cards or S21 video 2), restored in its completed end state.
// Fallback (e.g. dev-jump straight to S7): derive from selectedLearningStyle.
let s7ReturnScreen = null;

function goBackFromS7() {
  if (s7ReturnScreen !== null) { goTo(s7ReturnScreen); return; }
  const style = window.lomdaState.selectedLearningStyle;
  goTo(style === 'listening' ? 21 : 6);
}

function advanceFromS7() {
  goTo(8);
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — DropdownQuestion Multiple Blanks (Screen 09 / S8)
   Figma: dpY9DTl41tzW8SKvcPWU0C nodes 2226:1640 – 2226:1826
   3 fill-in-the-blank custom dropdowns. Max 2 attempts.
   Shared answer pool — same options in every dropdown.
   State stored in window.lomdaState.s8 (single source of truth).
   Popup/drag/hint reuse existing shared infrastructure.
   ═══════════════════════════════════════════════════════════ */

const MDQ_CORRECT = ['גרם', 'קילוגרם', 'מיליגרם'];  // blank 1, 2, 3

const MDQ_POPUP_CFG = {
  retry: {
    bg:    '#ffdbdc',
    title: 'התשובה אינה נכונה במלואה.',
    body:  ['שננסה שוב?']
  },
  correct: {
    bg:    '#edf8ed',
    title: 'תשובה נכונה. כל הכבוד!',
    body:  []
  },
  wrong2: {
    bg:    '#ffdbdc',
    title: 'זוהי טעות, התשובה הנכונה מוצגת.',
    body:  []
  }
};

/* Checkmark SVG shown inside a correct dropdown button */
const MDQ_CHECK_SVG =
  '<svg class="mdq-check-ico" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M2.5 8L6.5 12L13.5 4" stroke="#609e12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/* Click-outside listener registered once */
let mdqListenerRegistered = false;

/* ── Entry / reset ─────────────────────────────────────────── */
function mdqEnter() {
  /* Lazy-init state — survives back-navigation within the session */
  window.lomdaState.s8 = window.lomdaState.s8 || {
    attempts:   0,
    done:       false,
    selections: { 1: null, 2: null, 3: null },
    locked:     { 1: false, 2: false, 3: false }
  };

  document.getElementById('mdq-popup')?.classList.add('hidden');
  mdqCloseAllDropdowns();

  if (window.lomdaState.s8.done) {
    mdqRestoreDone();
    return;
  }

  /* Restore in-progress state — neutral selected state, no marks */
  const st = window.lomdaState.s8;
  [1, 2, 3].forEach(n => {
    const btn = document.getElementById('mdq-btn-' + n);
    const sel = document.getElementById('mdq-selected-' + n);
    if (!btn || !sel) return;

    btn.classList.remove('mdq-correct', 'mdq-wrong');
    btn.querySelector('.mdq-check-ico')?.remove();
    const chevron = btn.querySelector('.mdq-chevron');
    if (chevron) chevron.style.display = '';
    btn.disabled = false;

    if (st.selections[n] !== null) {
      sel.textContent = st.selections[n];
      btn.removeAttribute('data-empty');
    } else {
      sel.textContent = 'בחרו תשובה';
      btn.setAttribute('data-empty', 'true');
    }
  });

  /* Submit button */
  const chk = document.getElementById('mdq-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = false; }
  mdqUpdateBar();

  /* Hint button — always enabled (unlimited use) */
  const hint = document.getElementById('mdq-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = ''; }

  /* Register click-outside listener once */
  if (!mdqListenerRegistered) {
    document.addEventListener('click', mdqOutsideClick);
    mdqListenerRegistered = true;
  }
}

function mdqRestoreDone() {
  const st = window.lomdaState.s8;
  [1, 2, 3].forEach(n => {
    const btn = document.getElementById('mdq-btn-' + n);
    const sel = document.getElementById('mdq-selected-' + n);
    if (!btn || !sel) return;
    btn.classList.remove('mdq-wrong');
    btn.querySelector('.mdq-check-ico')?.remove();
    const chevron = btn.querySelector('.mdq-chevron');
    const value = st.selections[n] || MDQ_CORRECT[n - 1];
    sel.textContent = value;
    btn.removeAttribute('data-empty');
    btn.classList.add('mdq-correct');
    btn.disabled = true;
    if (chevron) chevron.style.display = 'none';
    btn.insertAdjacentHTML('afterbegin', MDQ_CHECK_SVG);
  });
  const chk = document.getElementById('mdq-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById('mdq-hint');
  if (hint) hint.style.visibility = 'hidden';
}

/* ── Dropdown open / close ─────────────────────────────────── */
function mdqToggle(n) {
  const btn  = document.getElementById('mdq-btn-' + n);
  const list = document.getElementById('mdq-list-' + n);
  if (!btn || !list || btn.disabled) return;

  const isOpen = !list.classList.contains('hidden');
  mdqCloseAllDropdowns();
  if (!isOpen) {
    list.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function mdqCloseAllDropdowns(exceptN) {
  [1, 2, 3].forEach(n => {
    if (n === exceptN) return;
    document.getElementById('mdq-list-' + n)?.classList.add('hidden');
    document.getElementById('mdq-btn-'  + n)?.setAttribute('aria-expanded', 'false');
  });
}

function mdqOutsideClick(e) {
  if (currentScreen !== 8) return;
  if (!e.target.closest('.mdq-dropdown-wrap')) mdqCloseAllDropdowns();
}

/* ── Select an option ──────────────────────────────────────── */
function mdqSelect(n, value) {
  const st = window.lomdaState.s8;
  if (!st || st.locked[n]) return;

  st.selections[n] = value;

  const sel = document.getElementById('mdq-selected-' + n);
  if (sel) sel.textContent = value;
  const btn = document.getElementById('mdq-btn-' + n);
  if (btn) btn.removeAttribute('data-empty');

  mdqCloseAllDropdowns();
  mdqUpdateBar();
}

/* ── Enable / disable submit button ───────────────────────── */
function mdqUpdateBar() {
  const st = window.lomdaState.s8;
  if (!st || st.done) return;
  const chk = document.getElementById('mdq-check');
  if (!chk || chk.textContent === 'שנמשיך?') return;
  /* Button enabled only when every non-locked blank has a selection */
  const allFilled = [1, 2, 3].every(n => st.locked[n] || st.selections[n] !== null);
  chk.disabled = !allFilled;
}

/* ── Submit / check ────────────────────────────────────────── */
function mdqCheck() {
  const st = window.lomdaState.s8;
  if (!st) return;

  /* Already done — advance */
  if (st.done) { goTo(9); return; }

  st.attempts++;

  const results = [1, 2, 3].map(n => ({
    n,
    correct: st.selections[n] === MDQ_CORRECT[n - 1]
  }));

  const allCorrect = results.every(r => r.correct);

  try {
    var _ans = [1, 2, 3].map(function(n){ return st.selections[n]; }).join(', ');
    var _row = allCorrect ? 'answered.last' : (st.attempts >= 2 ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-004/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (allCorrect) {
    results.forEach(r => mdqMarkBlank(r.n, 'correct'));
    mdqShowPopup('correct');
    mdqFinish();
    return;
  }

  if (st.attempts === 1) {
    /* Attempt 1 failure — no per-blank marking; all remain neutral/selectable */
    mdqShowPopup('retry');
    const chk = document.getElementById('mdq-check');
    if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = false; }
    return;
  }

  /* Attempt 2 failure — mark all correct/revealed, lock, finish */
  results.forEach(r => {
    if (r.correct) {
      mdqMarkBlank(r.n, 'correct');
    } else {
      mdqMarkBlank(r.n, 'revealed');
    }
  });
  mdqShowPopup('wrong2');
  mdqFinish();
}

/* ── Mark a blank with a visual state ─────────────────────── */
function mdqMarkBlank(n, state) {
  const btn     = document.getElementById('mdq-btn-' + n);
  const sel     = document.getElementById('mdq-selected-' + n);
  const chevron = btn?.querySelector('.mdq-chevron');
  if (!btn || !sel) return;

  btn.classList.remove('mdq-correct', 'mdq-wrong');
  btn.querySelector('.mdq-check-ico')?.remove();

  if (state === 'correct') {
    btn.classList.add('mdq-correct');
    btn.disabled = true;
    if (chevron) chevron.style.display = 'none';
    btn.insertAdjacentHTML('afterbegin', MDQ_CHECK_SVG);

  } else if (state === 'wrong') {
    btn.classList.add('mdq-wrong');
    btn.disabled = false;
    if (chevron) chevron.style.display = '';

  } else if (state === 'revealed') {
    sel.textContent = MDQ_CORRECT[n - 1];
    btn.removeAttribute('data-empty');
    btn.classList.add('mdq-correct');
    btn.disabled = true;
    if (chevron) chevron.style.display = 'none';
    btn.insertAdjacentHTML('afterbegin', MDQ_CHECK_SVG);
    /* Update selections so back-navigation restores correctly */
    window.lomdaState.s8.selections[n] = MDQ_CORRECT[n - 1];
  }
}

/* ── Finish — lock the question ────────────────────────────── */
function mdqFinish() {
  const st = window.lomdaState.s8;
  if (st) st.done = true;
  [1, 2, 3].forEach(n => {
    const btn = document.getElementById('mdq-btn-' + n);
    if (btn) btn.disabled = true;
  });
  const chk = document.getElementById('mdq-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById('mdq-hint');
  if (hint) hint.style.visibility = 'hidden';
}

/* ── Feedback popup (reuses .scq-popup CSS + resetPopupPosition) */
function mdqShowPopup(type) {
  const popup = document.getElementById('mdq-popup');
  if (!popup) return;
  mdqCloseAllDropdowns();
  const cfg = MDQ_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('mdq-popup-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const bodyEl = document.getElementById('mdq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function mdqClosePopup() {
  document.getElementById('mdq-popup')?.classList.add('hidden');
}

/* ── Popup drag (extends shared mousemove/mouseup infrastructure) */
function mdqPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  mdqPopupDragging = true;
  const popup = document.getElementById('mdq-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const mdqTopPx = parseFloat(popup.style.top);
  const mdqTop = isNaN(mdqTopPx) ? popup.offsetTop : mdqTopPx;
  popup.style.top    = mdqTop + 'px';
  popup.style.bottom = 'auto';
  mdqPopupOffX  = canvasX - (parseFloat(popup.style.left) || 2);
  mdqPopupOffY  = canvasY - mdqTop;
  e.preventDefault();
}

/* ── Hint modal (unlimited use — no disable-after-use) ────── */
function mdqOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('mdq-hint-overlay')?.classList.remove('hidden');
}
function mdqCloseHint() {
  document.getElementById('mdq-hint-overlay')?.classList.add('hidden');
}
function mdqCloseHintOnBackdrop(e) {
  if (e.target?.id === 'mdq-hint-overlay') mdqCloseHint();
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — TransitionScreen (Screen 11 / S10)
   "תרגול סטנדרטי" intro — mirrors S7 pattern exactly.
   ═══════════════════════════════════════════════════════════ */
const S10_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Read.mp4',
  'character-2': 'assets/video/Character-2-Read.mp4',
};

const S18_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Remember.mp4',
  'character-2': 'assets/video/Character-2-Remember.mp4',
};

function advanceFromS10() {
  goTo(currentScreen + 1);
}

function goBackFromS10() {
  goTo(9);  // back to last "תרגול בסיסי" screen (S9)
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — SingleChoiceQuestionImage (Screen 10 / S9)
   Question image (left) + title + body text + 4 single-choice
   options (right). Bottom bar: צדקתי? / אפשר רמז? / חזרה.
   Mirrors S1 (scq*) pattern but uses s9q* prefix throughout.
   ═══════════════════════════════════════════════════════════ */
const S9Q = {
  correctId: 'b',
  maxAttempts: 2
};

let s9qSelected = null;
let s9qAttempts = 0;
let s9qAnswered = false;
let s9qHintUsed = false;
let s9qDone     = false;

function s9qSelect(id) {
  if (s9qAnswered) return;
  s9qSelected = id;
  if (s9qAttempts > 0) {
    document.getElementById('s9q-popup')?.classList.add('hidden');
    document.querySelectorAll('#s9 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s9 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  s9qUpdateBar();
}

function s9qCheck() {
  if (s9qAnswered) { advanceScreen(); return; }
  if (!s9qSelected) return;

  s9qAttempts++;
  const isCorrect = s9qSelected === S9Q.correctId;

  try {
    var _ans = document.querySelector('#s9 .scq-opt[data-id="' + s9qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s9qSelected;
    var _row = isCorrect ? 'answered.last' : (s9qAttempts >= S9Q.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-005/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s9qMark(S9Q.correctId, 'correct');
    s9qShowPopup('correct');
    s9qFinish();
  } else if (s9qAttempts >= S9Q.maxAttempts) {
    s9qMark(S9Q.correctId, 'correct');
    s9qMark(s9qSelected, 'wrong');
    s9qShowPopup('wrong2');
    s9qFinish();
  } else {
    s9qMark(s9qSelected, 'wrong');
    s9qShowPopup('retry');
  }
}

function s9qMark(id, cls) {
  const opt = document.querySelector('#s9 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

const S9Q_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'התשובה אינה נכונה במלואה.',
    body: ['שננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'תשובה נכונה. כל הכבוד!',
    body: ['פעולת האיפוס מנטרלת את השפעת משקל כלי הקיבול, ומאפשרת למדוד רק את המסה של הנוזל בתוך הכלי.']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'לא מדויק. התשובה הנכונה מסומנת.',
    body: ['פעולת האיפוס מנטרלת את השפעת משקל כלי הקיבול, ומאפשרת למדוד רק את המסה של הנוזל בתוך הכלי.']
  }
};

function s9qShowPopup(type) {
  const popup = document.getElementById('s9q-popup');
  if (!popup) return;
  const cfg = S9Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s9q-popup-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const bodyEl = document.getElementById('s9q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s9qClosePopup() {
  document.getElementById('s9q-popup')?.classList.add('hidden');
}

function s9qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s9qPopupDragging = true;
  const popup = document.getElementById('s9q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const s9qTopPx = parseFloat(popup.style.top);
  const s9qTop = isNaN(s9qTopPx) ? popup.offsetTop : s9qTopPx;
  popup.style.top    = s9qTop + 'px';
  popup.style.bottom = 'auto';
  s9qPopupOffX  = canvasX - (parseFloat(popup.style.left) || 2);
  s9qPopupOffY  = canvasY - s9qTop;
  e.preventDefault();
}

function s9qFinish() {
  s9qAnswered = true;
  s9qDone = true;
  document.querySelectorAll('#s9 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s9q-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById('s9q-hint');
  if (hint) hint.style.visibility = 'hidden';
}

function s9qUpdateBar() {
  if (s9qAnswered) return;
  const chk = document.getElementById('s9q-check');
  if (chk) chk.disabled = !s9qSelected;
  const hint = document.getElementById('s9q-hint');
  if (hint) hint.disabled = s9qHintUsed;
}

function s9qOpenHint() {
  if (s9qHintUsed || s9qAnswered) return;
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s9q-hint-overlay')?.classList.remove('hidden');
}
function s9qCloseHint() {
  const overlay = document.getElementById('s9q-hint-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  s9qHintUsed = true;
  s9qUpdateBar();
}
function s9qCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's9q-hint-overlay') s9qCloseHint();
}

function s9qResetInitial() {
  s9qSelected = null;
  s9qAttempts = 0;
  s9qAnswered = false;
  s9qHintUsed = false;
  document.querySelectorAll('#s9 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s9q-popup')?.classList.add('hidden');
  const chk = document.getElementById('s9q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById('s9q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = ''; }
}


/* ═══════════════════════════════════════════════════════════
   TEMPLATE — DragAndDropQuestion (Screen 12 / S11)
   "תרגול סטנדרטי" Q1 — order 4 steps of solid-body mass measurement.
   Sequencing variant (text items, not images). 2 attempts.
   Hint: hidden → visible after attempt 1 → hidden on completion.
   All ddq* vars/funcs namespaced s11ddq* to avoid collision with S3.
   ═══════════════════════════════════════════════════════════ */

const S11DDQ = {
  correctMap: {
    'target-s11-1': 'drag-s11-bdika',
    'target-s11-2': 'drag-s11-hanaha',
    'target-s11-3': 'drag-s11-kriat',
    'target-s11-4': 'drag-s11-hasarat'
  },
  revealMap: {
    'target-s11-1': 'drag-s11-bdika',
    'target-s11-2': 'drag-s11-hanaha',
    'target-s11-3': 'drag-s11-kriat',
    'target-s11-4': 'drag-s11-hasarat'
  },
  maxAttempts: 2,
  feedbackText: {
    retry: {
      bg: '#ffdbdc', titleColor: '#303030',
      title: 'התשובה אינה נכונה.',
      body: ['שננסה שוב?']
    },
    correct: {
      bg: '#edf8ed', titleColor: '#222222',
      title: 'תשובה נכונה. כל הכבוד!',
      body: ['זהו <strong>פרוטוקול מדידה.</strong> עבודה שיטתית לפי השלבים הללו מונעת הטיות במדידה.']
    },
    wrong2: {
      bg: '#ffdbdc', titleColor: '#303030',
      title: 'לא מדויק. התשובה הנכונה מוצגת.',
      body: ['זהו <strong>פרוטוקול מדידה.</strong> עבודה שיטתית לפי השלבים הללו מונעת הטיות במדידה.']
    }
  }
};

const s11ddqPlacement = {
  'drag-s11-hasarat': 'source',
  'drag-s11-bdika':   'source',
  'drag-s11-kriat':   'source',
  'drag-s11-hanaha':  'source'
};
let s11ddqChecked     = false;
let s11ddqDone        = false;
let s11ddqAttempts    = 0;
let s11ddqShowFeedback = false;
let s11ddqDnd         = null;  // pointer-drag controller

/* ── Render ───────────────────────────────────────────────── */
function s11ddqRender() {
  s11ddqInitDnd();

  // Source tray: leave a solid grey frame in the slot for every card that was
  // dragged out (slot stays visible; the card shows as an empty placeholder).
  Object.keys(s11ddqPlacement).forEach(dragId => {
    const card = document.getElementById(dragId);
    if (!card) return;
    const placed = s11ddqPlacement[dragId] !== 'source';
    const slot = card.closest('.s11ddq-source-slot');
    if (slot) slot.style.display = '';
    card.classList.toggle('ghost', placed);
  });

  // Drop targets
  const targetIds = [...new Set([
    ...Object.keys(S11DDQ.correctMap),
    ...Object.values(s11ddqPlacement).filter(v => v !== 'source')
  ])];

  targetIds.forEach(targetId => {
    const zone = document.getElementById(targetId);
    if (!zone) return;
    zone.querySelector('.s11ddq-placed-card')?.remove();

    const dragId = Object.keys(s11ddqPlacement).find(k => s11ddqPlacement[k] === targetId);

    if (dragId) {
      const placedCard = document.createElement('div');
      placedCard.className = 's11ddq-placed-card';
      const textEl = document.createElement('span');
      textEl.className = 's11ddq-card-text';
      textEl.textContent = document.getElementById(dragId)
        ?.querySelector('.s11ddq-card-text')?.textContent || '';
      placedCard.appendChild(textEl);
      if (!s11ddqChecked) s11ddqDnd.attachSource(placedCard, dragId);
      zone.appendChild(placedCard);
      if (s11ddqChecked) {
        zone.classList.remove('occupied');
        zone.classList.add('s11ddq-correct');
      } else {
        zone.classList.add('occupied');
      }
    } else {
      zone.classList.remove('occupied', 'drag-over');
    }
  });

  s11ddqUpdateCheck();
}

/* ── Pointer DnD setup — runs once, idempotent ───────────── */
function s11ddqInitDnd() {
  if (s11ddqDnd) return;
  s11ddqDnd = createPointerDnd({
    canDrag: (dragId, elem) => {
      if (s11ddqChecked) return false;
      if (elem.id === dragId) return s11ddqPlacement[dragId] === 'source';
      return true; // placed card
    },
    onPick: (dragId) => {
      s11ddqClearAttemptFeedback();
      if (s11ddqPlacement[dragId] !== 'source') {
        s11ddqPlacement[dragId] = 'source';
        s11ddqRender();
      }
      document.getElementById(dragId)?.classList.add('dragging');
    },
    onDrop: (dragId, targetId) => {
      const evicted = Object.keys(s11ddqPlacement).find(k => s11ddqPlacement[k] === targetId);
      if (evicted && evicted !== dragId) s11ddqPlacement[evicted] = 'source';
      s11ddqPlacement[dragId] = targetId;
      s11ddqRender();
    },
    onCancel: () => {
      s11ddqRender();
    },
  });
  Object.keys(s11ddqPlacement).forEach(id => {
    const el = document.getElementById(id);
    if (el) s11ddqDnd.attachSource(el, id);
  });
  document.querySelectorAll('#s11 .s11ddq-target').forEach(el => {
    s11ddqDnd.attachTarget(el, el.id);
  });
}

/* ── Check gate ───────────────────────────────────────────── */
function s11ddqAllFilled() {
  return Object.keys(S11DDQ.correctMap).every(tId =>
    Object.keys(s11ddqPlacement).some(dId => s11ddqPlacement[dId] === tId)
  );
}

function s11ddqUpdateCheck() {
  if (s11ddqChecked) return;
  const btn = document.getElementById('s11ddq-check');
  if (btn) btn.disabled = !s11ddqAllFilled();
}

/* Drag/drop is handled entirely by the pointer DnD controller (s11ddqInitDnd). */

/* ── Check answers ────────────────────────────────────────── */
function s11ddqCheck() {
  if (s11ddqDone) { goTo(12); return; }
  if (!s11ddqAllFilled()) return;

  s11ddqClearAttemptFeedback();
  s11ddqAttempts++;

  const allCorrect = Object.keys(S11DDQ.correctMap).every(
    tId => s11ddqPlacement[S11DDQ.correctMap[tId]] === tId
  );

  try {
    var _ans = Object.keys(S11DDQ.correctMap).map(function(tId){
      var d = Object.keys(s11ddqPlacement).find(function(k){ return s11ddqPlacement[k] === tId; });
      var el = d ? document.getElementById(d) : null;
      var t  = el ? el.querySelector('.s11ddq-card-text') : null;
      return t ? t.textContent.trim() : (d || '—');
    }).join(' | ');
    var _row = allCorrect ? 'answered.last' : (s11ddqAttempts >= S11DDQ.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-006/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (allCorrect) {
    s11ddqChecked = true;
    s11ddqDone    = true;
    s11ddqRender();
    s11ddqLock();
    s11ddqShowFeedbackIcons(true);
    s11ddqShowPopup('correct');
    standardPracticeProgress.questions[0].state = 'correct';
    s11ddqFinish();
  } else if (s11ddqAttempts >= S11DDQ.maxAttempts) {
    s11ddqChecked = true;
    s11ddqDone    = true;
    s11ddqRevealCorrect();
    s11ddqLock();
    s11ddqShowFeedbackIcons(true);
    s11ddqShowPopup('wrong2');
    standardPracticeProgress.questions[0].state = 'incorrect';
    s11ddqFinish();
  } else {
    // First wrong attempt — show per-zone feedback, allow retry
    s11ddqShowFeedback = true;
    s11ddqShowFeedbackIcons(false);
    s11ddqShowPopup('retry');
    document.getElementById('s11ddq-hint').style.visibility = 'visible';
  }
}

/* ── Lock dragging after final check ─────────────────────── */
function s11ddqLock() {
  Object.keys(s11ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.draggable = false;
    card.classList.add('locked');
  });
  document.querySelectorAll('#s11 .s11ddq-placed-card').forEach(c => {
    c.draggable = false;
  });
}

/* ── Reveal correct answer ────────────────────────────────── */
function s11ddqRevealCorrect() {
  Object.keys(S11DDQ.revealMap).forEach(tId => {
    s11ddqPlacement[S11DDQ.revealMap[tId]] = tId;
  });
  const assigned = new Set(Object.values(S11DDQ.revealMap));
  Object.keys(s11ddqPlacement).forEach(id => {
    if (!assigned.has(id)) s11ddqPlacement[id] = 'source';
  });
  s11ddqRender();
}

/* ── Finish — update CTA, hide hint ──────────────────────── */
function s11ddqFinish() {
  const btn = document.getElementById('s11ddq-check');
  if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
  document.getElementById('s11ddq-hint').style.visibility = 'hidden';
  document.getElementById('s11ddq-hint-overlay')?.classList.add('hidden');
  syncStandardPracticeProgressNav(document.querySelector('#s11 .progress-question'));
}

/* ── Feedback icons (26px colored circles per zone) ─────── */
function s11ddqShowFeedbackIcons(allGreen) {
  [1, 2, 3, 4].forEach(i => {
    const tId  = 'target-s11-' + i;
    const zone = document.getElementById(tId);
    if (!zone) return;
    const isCorrect = allGreen ||
      (s11ddqPlacement[S11DDQ.correctMap[tId]] === tId);
    const placedCard = zone.querySelector('.s11ddq-placed-card');
    if (placedCard) {
      placedCard.querySelector('.s11ddq-placed-ficon')?.remove();
      const iconEl = document.createElement('div');
      iconEl.className = 's11ddq-placed-ficon ' +
        (isCorrect ? 's11ddq-placed-ficon--correct' : 's11ddq-placed-ficon--wrong');
      placedCard.appendChild(iconEl);
    }
    zone.classList.remove('s11ddq-correct', 's11ddq-wrong');
    zone.classList.add(isCorrect ? 's11ddq-correct' : 's11ddq-wrong');
  });
}

function s11ddqClearAttemptFeedback() {
  if (!s11ddqShowFeedback) return;
  s11ddqShowFeedback = false;
  [1, 2, 3, 4].forEach(i => {
    const zone = document.getElementById('target-s11-' + i);
    if (!zone) return;
    zone.querySelector('.s11ddq-placed-ficon')?.remove();
    zone.classList.remove('s11ddq-correct', 's11ddq-wrong');
  });
}

/* ── Feedback popup ───────────────────────────────────────── */
function s11ddqShowPopup(type) {
  const popup = document.getElementById('s11ddq-popup');
  if (!popup) return;
  const cfg = S11DDQ.feedbackText[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s11ddq-popup-title');
  if (titleEl) { titleEl.textContent = cfg.title; titleEl.style.color = cfg.titleColor; }
  const bodyEl = document.getElementById('s11ddq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => `<p>${p}</p>`).join('');
  popup.classList.remove('hidden');
}

function s11ddqClosePopup() {
  document.getElementById('s11ddq-popup')?.classList.add('hidden');
}

function s11ddqPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s11ddqPopupDragging = true;
  const popup = document.getElementById('s11ddq-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const s11TopPx = parseFloat(popup.style.top);
  const popupTop = isNaN(s11TopPx) ? popup.offsetTop : s11TopPx;
  popup.style.top    = popupTop + 'px';
  popup.style.bottom = 'auto';
  s11ddqPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s11ddqPopupOffY = canvasY - popupTop;
  e.preventDefault();
}

/* ── Hint overlay ─────────────────────────────────────────── */
function s11ddqOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s11ddq-hint-overlay')?.classList.remove('hidden');
}
function s11ddqCloseHint() {
  document.getElementById('s11ddq-hint-overlay')?.classList.add('hidden');
}
function s11ddqCloseHintOnBackdrop(e) {
  if (e.target?.id === 's11ddq-hint-overlay') s11ddqCloseHint();
}

/* ── Enter / reset screen state ──────────────────────────── */
function s11ddqEnter() {
  if (s11ddqDone) {
    s11ddqRender();
    s11ddqLock();
    s11ddqShowFeedbackIcons(true);
    const btn = document.getElementById('s11ddq-check');
    if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
    document.getElementById('s11ddq-hint').style.visibility = 'hidden';
    document.getElementById('s11ddq-popup')?.classList.add('hidden');
    syncStandardPracticeProgressNav(document.querySelector('#s11 .progress-question'));
    return;
  }

  // Full reset for fresh entry
  s11ddqChecked      = false;
  s11ddqAttempts     = 0;
  s11ddqShowFeedback = false;
  Object.keys(s11ddqPlacement).forEach(id => { s11ddqPlacement[id] = 'source'; });

  Object.keys(S11DDQ.correctMap).forEach(tId => {
    const zone = document.getElementById(tId);
    if (!zone) return;
    zone.classList.remove('s11ddq-correct', 's11ddq-wrong', 'occupied', 'drag-over');
    zone.querySelector('.s11ddq-placed-card')?.remove();
  });

  // placed-card removal above (line 1977) already cleans up any internal ficons

  Object.keys(s11ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('ghost', 'dragging', 'locked');
    const slot = card.closest('.s11ddq-source-slot');
    if (slot) slot.style.display = '';
  });

  const btn = document.getElementById('s11ddq-check');
  if (btn) { btn.textContent = 'צדקתי?'; btn.disabled = true; }

  const hint = document.getElementById('s11ddq-hint');
  if (hint) { hint.style.visibility = 'hidden'; hint.disabled = false; }

  document.getElementById('s11ddq-popup')?.classList.add('hidden');
  document.getElementById('s11ddq-hint-overlay')?.classList.add('hidden');
  standardPracticeProgress.questions[0].state = 'current';
  syncStandardPracticeProgressNav(document.querySelector('#s11 .progress-question'));

  // Hook up pointer DnD (idempotent — safe on every entry)
  s11ddqRender();
}


/* ═══════════════════════════════════════════════════════════
   S12 — Question 2 — SingleChoiceQuestion with Speech Bubbles
   "יושרה מדעית" — 3 options, 2 attempts, shared progress nav.
   ═══════════════════════════════════════════════════════════ */

const S12Q = { correctId: 'a', maxAttempts: 2 };
const S12Q_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'לא מדויק. התשובה אינה נכונה.',
    body: ['שננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'כל הכבוד. התשובה נכונה.',
    body: ['במדע לא נבדוק רק האם קיימת תוצאה חריגה, אלא גם האם הבדלים בין מדידות עלולים להשפיע על איכות המסקנה. לכן, חשוב לבדוק את הנתונים, ורק אז להחליט כיצד לחשב ולדווח את התוצאות.']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'לא מדויק. התשובה הנכונה מסומנת.',
    body: ['במדע לא נבדק רק האם קיימת תוצאה חריגה, אלא גם האם ההבדלים בין מדידות עלולים להשפיע על איכות המסקנה. לכן, חשוב לבדוק את הנתונים, ורק אז להחליט כיצד לחשב ולדווח את התוצאות.']
  }
};

let s12qSelected  = null;
let s12qAttempts  = 0;
let s12qAnswered  = false;
let s12qDone      = false;
let s12qPopupDragging = false;
let s12qPopupOffX = 0, s12qPopupOffY = 0;

function s12qSelect(id) {
  if (s12qAnswered) return;
  s12qSelected = id;
  if (s12qAttempts > 0) {
    document.getElementById('s12q-popup')?.classList.add('hidden');
    document.querySelectorAll('#s12 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s12 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  s12qUpdateBar();
}

function s12qCheck() {
  if (s12qAnswered) { advanceScreen(); return; }
  if (!s12qSelected) return;

  s12qAttempts++;
  const isCorrect = s12qSelected === S12Q.correctId;

  try {
    var _ans = document.querySelector('#s12 .scq-opt[data-id="' + s12qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s12qSelected;
    var _row = isCorrect ? 'answered.last' : (s12qAttempts >= S12Q.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-007/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s12qMark(S12Q.correctId, 'correct');
    s12qShowPopup('correct');
    standardPracticeProgress.questions[1].state = 'correct';
    s12qFinish();
  } else if (s12qAttempts >= S12Q.maxAttempts) {
    s12qMark(S12Q.correctId, 'correct');
    s12qMark(s12qSelected, 'wrong');
    s12qShowPopup('wrong2');
    standardPracticeProgress.questions[1].state = 'incorrect';
    s12qFinish();
  } else {
    s12qMark(s12qSelected, 'wrong');
    s12qShowPopup('retry');
    document.getElementById('s12q-hint').style.visibility = 'visible';
  }
}

function s12qMark(id, cls) {
  const opt = document.querySelector('#s12 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function s12qShowPopup(type) {
  const popup = document.getElementById('s12q-popup');
  if (!popup) return;
  const cfg = S12Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s12q-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById('s12q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s12qClosePopup() {
  document.getElementById('s12q-popup')?.classList.add('hidden');
}

function s12qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s12qPopupDragging = true;
  const popup = document.getElementById('s12q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left)  || 0;
  const appTop  = parseFloat(app.style.top)   || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx   = parseFloat(popup.style.top);
  const top     = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = top + 'px';
  popup.style.bottom = 'auto';
  s12qPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s12qPopupOffY = canvasY - top;
  e.preventDefault();
}

function s12qFinish() {
  s12qAnswered = true;
  s12qDone     = true;
  document.querySelectorAll('#s12 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s12q-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById('s12q-hint');
  if (hint) hint.style.visibility = 'hidden';
  syncStandardPracticeProgressNav(document.querySelector('#s12 .progress-question'));
}

function s12qUpdateBar() {
  if (s12qAnswered) return;
  const chk = document.getElementById('s12q-check');
  if (chk) chk.disabled = !s12qSelected;
}

function s12qOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s12q-hint-overlay')?.classList.remove('hidden');
}

function s12qCloseHint() {
  document.getElementById('s12q-hint-overlay')?.classList.add('hidden');
}

function s12qCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's12q-hint-overlay') s12qCloseHint();
}

function s12qResetInitial() {
  s12qSelected = null;
  s12qAttempts = 0;
  s12qAnswered = false;
  document.querySelectorAll('#s12 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s12q-popup')?.classList.add('hidden');
  const chk = document.getElementById('s12q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById('s12q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function s12qEnter() {
  if (s12qDone) {
    syncStandardPracticeProgressNav(document.querySelector('#s12 .progress-question'));
    return;
  }
  // Q1 state preserved from S11 hooks — do NOT overwrite
  standardPracticeProgress.questions[1].visited = true;
  standardPracticeProgress.questions[1].state   = 'current';
  standardPracticeProgress.questions[1].screen  = 12;
  syncStandardPracticeProgressNav(document.querySelector('#s12 .progress-question'));
}


/* ═══ S13 — Question 3 Practice — MeasurementWidget ═══════════════
   Learner drags a weight token onto the scale 3 times, reads the
   displayed value, types it manually, then presses Reset each time.
   Q3 progress stays 'current' throughout — answered on a later screen.
   ═════════════════════════════════════════════════════════════════ */
const S13_MEASUREMENTS = [13, 10, 12];
let s13Idx       = 0;       // which slot is active (0–2)
let s13SlotState = 'idle';  // 'idle' | 'weighing' | 'validated' | 'wrong'
let s13Done      = false;
let s13Zeroed    = false;   // scale starts drifted at 00.02; must be zeroed before the first drag

function s13Enter() {
  // Restore DOM from JS state — preserves progress across back/forward navigation.
  // Locked slots (already completed and reset)
  for (let i = 1; i <= s13Idx; i++) {
    const inp = document.getElementById('s13-input-' + i);
    if (!inp) continue;
    inp.disabled = false;
    inp.setAttribute('readonly', '');
    inp.classList.remove('active', 'error');
    inp.classList.add('locked');
  }
  // Remaining (future) slots — always fully disabled
  for (let i = s13Idx + 2; i <= 3; i++) {
    const inp = document.getElementById('s13-input-' + i);
    if (!inp) continue;
    inp.disabled = true;
    inp.removeAttribute('readonly');
    inp.classList.remove('active', 'error', 'locked');
  }
  // Active slot
  const activeInp = s13Idx < 3 ? document.getElementById('s13-input-' + (s13Idx + 1)) : null;
  if (activeInp) {
    activeInp.classList.remove('active', 'error', 'locked');
    activeInp.removeAttribute('readonly');
    if (s13SlotState === 'idle') {
      activeInp.disabled = true;
    } else if (s13SlotState === 'weighing') {
      activeInp.disabled = false;
      activeInp.classList.add('active');
    } else if (s13SlotState === 'wrong') {
      activeInp.disabled = false;
      activeInp.classList.add('error');
    } else if (s13SlotState === 'validated') {
      activeInp.disabled = false;
      activeInp.setAttribute('readonly', '');
    }
  }
  // Scale display — drifted at 00.02 until the initial zeroing, then normal
  const display = document.getElementById('s13-display');
  if (display) {
    display.textContent = !s13Zeroed
      ? '00.02'
      : (s13SlotState !== 'idle' && s13Idx < 3)
        ? S13_MEASUREMENTS[s13Idx] + '.00'
        : '00.00';
  }
  // Reset button — active for the initial zeroing, and after a validated (non-final) entry
  const resetBtn = document.getElementById('s13-reset-btn');
  if (resetBtn) resetBtn.disabled = !( !s13Zeroed || (s13SlotState === 'validated' && !s13Done) );
  // Continue button
  const cont = document.getElementById('s13-continue');
  if (cont) cont.classList.toggle('disabled', !s13Done);
  // Weight position
  const weight = document.getElementById('s13-weight');
  const tray   = document.getElementById('s13-tray');
  const col    = document.getElementById('s13-scale-col');
  if (weight) {
    const onScale = s13Zeroed && s13SlotState !== 'idle';
    if (onScale && col) {
      weight.style.position = 'absolute';
      weight.style.top = '88px';
      weight.style.left = '174px';
      weight.style.cursor = 'default';
      col.appendChild(weight);
    } else if (tray) {
      weight.style.position = '';
      weight.style.top = '';
      weight.style.left = '';
      weight.style.cursor = (s13Zeroed && !s13Done) ? 'grab' : 'default';
      tray.appendChild(weight);
    }
  }
  // Progress nav — Q3 always stays 'current' on S13
  standardPracticeProgress.questions[2].visited = true;
  standardPracticeProgress.questions[2].state   = 'current';
  standardPracticeProgress.questions[2].screen  = 13;
  syncStandardPracticeProgressNav(document.querySelector('#s13 .progress-question'));
}

function s13ResetInitial() {
  s13Idx = 0; s13SlotState = 'idle'; s13Done = false; s13Zeroed = false;
  const display = document.getElementById('s13-display');
  if (display) display.textContent = '00.02';
  for (let i = 1; i <= 3; i++) {
    const inp = document.getElementById('s13-input-' + i);
    if (!inp) continue;
    inp.value = '';
    inp.removeAttribute('readonly');
    inp.disabled = true;
    inp.classList.remove('active', 'error', 'locked');
  }
  const weight = document.getElementById('s13-weight');
  const tray   = document.getElementById('s13-tray');
  if (weight && tray) {
    weight.style.position = '';
    weight.style.top      = '';
    weight.style.left     = '';
    weight.style.cursor   = 'default';   // not draggable until the scale is zeroed
    tray.appendChild(weight);
  }
  const resetBtn = document.getElementById('s13-reset-btn');
  if (resetBtn) resetBtn.disabled = false;   // enabled for the initial zeroing
  const cont = document.getElementById('s13-continue');
  if (cont) cont.classList.add('disabled');
}

function s13WeightDragStart(e) {
  if (!s13Zeroed || s13SlotState !== 'idle' || s13Idx >= 3) { e.preventDefault(); return; }
  e.dataTransfer.setData('text/plain', 'weight');
  e.dataTransfer.effectAllowed = 'move';
}

function s13ScaleDragOver(e) {
  if (s13Zeroed && s13SlotState === 'idle' && s13Idx < 3) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
}

function s13ScaleDrop(e) {
  e.preventDefault();
  if (!s13Zeroed || s13SlotState !== 'idle' || s13Idx >= 3) return;
  if (e.dataTransfer.getData('text/plain') !== 'weight') return;
  s13SlotState = 'weighing';
  const val = S13_MEASUREMENTS[s13Idx];
  const display = document.getElementById('s13-display');
  if (display) display.textContent = val + '.00';
  const inp = document.getElementById('s13-input-' + (s13Idx + 1));
  if (inp) { inp.disabled = false; inp.classList.add('active'); inp.focus(); }
  const weight = document.getElementById('s13-weight');
  const col    = document.getElementById('s13-scale-col');
  if (weight && col) {
    weight.style.position = 'absolute';
    weight.style.top      = '88px';
    weight.style.left     = '174px';
    weight.style.cursor   = 'default';
    col.appendChild(weight);
  }
}

function s13InputChange(idx) {
  if (s13Idx !== idx - 1 || s13SlotState === 'idle') return;
  const inp = document.getElementById('s13-input-' + idx);
  const val = inp ? inp.value.trim() : '';
  const resetBtn = document.getElementById('s13-reset-btn');
  if (val === '') {
    inp.classList.remove('error');
    inp.classList.add('active');
    s13SlotState = 'weighing';
    if (resetBtn) resetBtn.disabled = true;
  } else if (Number(val) === S13_MEASUREMENTS[s13Idx]) {
    inp.classList.remove('error', 'active');
    inp.setAttribute('readonly', '');
    s13SlotState = 'validated';
    if (s13Idx >= 2) {
      // Final measurement — no reset step; Continue becomes active directly.
      inp.classList.add('locked');
      s13Done = true;
      if (resetBtn) resetBtn.disabled = true;
      const cont = document.getElementById('s13-continue');
      if (cont) cont.classList.remove('disabled');
    } else if (resetBtn) {
      resetBtn.disabled = false;
    }
  } else {
    inp.classList.remove('active');
    inp.classList.add('error');
    s13SlotState = 'wrong';
    if (resetBtn) resetBtn.disabled = true;
  }
}

function s13Reset() {
  // Initial zeroing: scale drifts at 00.02 — pressing reset zeroes it and unlocks the weight.
  if (!s13Zeroed) {
    s13Zeroed = true;
    const display = document.getElementById('s13-display');
    if (display) display.textContent = '00.00';
    const weight = document.getElementById('s13-weight');
    if (weight) weight.style.cursor = 'grab';
    const resetBtn = document.getElementById('s13-reset-btn');
    if (resetBtn) resetBtn.disabled = true;
    return;
  }
  if (s13SlotState !== 'validated' || s13Done) return;
  const inp = document.getElementById('s13-input-' + (s13Idx + 1));
  if (inp) inp.classList.add('locked');
  const display = document.getElementById('s13-display');
  if (display) display.textContent = '00.00';
  const weight = document.getElementById('s13-weight');
  const tray   = document.getElementById('s13-tray');
  if (weight && tray) {
    weight.style.position = '';
    weight.style.top      = '';
    weight.style.left     = '';
    tray.appendChild(weight);
  }
  const resetBtn = document.getElementById('s13-reset-btn');
  if (resetBtn) resetBtn.disabled = true;
  s13Idx++;
  s13SlotState = 'idle';
  if (s13Idx >= 3) {
    s13Done = true;
    if (weight) weight.style.cursor = 'default';
    const cont = document.getElementById('s13-continue');
    if (cont) cont.classList.remove('disabled');
    // Q3 stays 'current' — will be answered on a later screen
  } else {
    if (weight) weight.style.cursor = 'grab';
  }
}

/* ═══ S14 — Q3 Practice — SingleChoice (1 attempt, no scoring) ════════
   Text-only SCQ practice screen. Q3 stays 'current' throughout —
   will be scored on a later screen.
   ════════════════════════════════════════════════════════════════════ */
let s14qSelected = null;
let s14qDone     = false;

const S14Q_CORRECT = 'a';  // ← replace with actual correct option when content arrives

function s14qEnter() {
  if (s14qDone) {
    syncStandardPracticeProgressNav(document.querySelector('#s14 .progress-question'));
    return;
  }
  standardPracticeProgress.questions[2].visited = true;
  standardPracticeProgress.questions[2].state   = 'current';
  standardPracticeProgress.questions[2].screen  = 13;  // clicking Q3 nav goes back to S13
  syncStandardPracticeProgressNav(document.querySelector('#s14 .progress-question'));
}

function s14qSelect(id) {
  if (s14qDone) return;
  s14qSelected = id;
  document.querySelectorAll('#s14 .scq-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.id === id);
    o.setAttribute('aria-checked', o.dataset.id === id ? 'true' : 'false');
  });
  const chk = document.getElementById('s14q-check');
  if (chk) chk.disabled = false;
}

function s14qCheck() {
  if (!s14qSelected || s14qDone) return;
  s14qDone = true;
  document.querySelectorAll('#s14 .scq-opt').forEach(o => {
    o.disabled = true;
    if (o.dataset.id === S14Q_CORRECT) o.classList.add('correct');
    if (o.dataset.id === s14qSelected && s14qSelected !== S14Q_CORRECT)
      o.classList.add('wrong');
  });
  const chk = document.getElementById('s14q-check');
  if (chk) {
    chk.textContent = 'שנמשיך?';
    chk.disabled    = false;
    chk.onclick      = () => goTo(15);
  }
  // Q3 stays 'current' — do NOT set to correct/incorrect
  syncStandardPracticeProgressNav(document.querySelector('#s14 .progress-question'));
}

function s14qResetInitial() {
  s14qSelected = null;
  s14qDone     = false;
  document.querySelectorAll('#s14 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  const chk = document.getElementById('s14q-check');
  if (chk) {
    chk.textContent = 'מה זה אומר?';
    chk.disabled    = true;
    chk.onclick      = s14qCheck;
  }
}

/* ═══════════════════════════════════════════════════════════
   S15 — Q3 Practice — FlipCardsReveal (clone of S2 pattern)
   Two flip cards; Continue unlocks after both are revealed.
   Q3 stays 'current' throughout — never set to correct/incorrect.
   ═══════════════════════════════════════════════════════════ */
let s15frcRevealed = [false, false];
let s15frcFlipped = [false, false];
let s15frcDone = false;

function s15frcFlip(cardEl) {
  const idx = parseInt(cardEl.dataset.index, 10);
  s15frcFlipped[idx] = !s15frcFlipped[idx];
  if (s15frcFlipped[idx]) s15frcRevealed[idx] = true;

  cardEl.classList.toggle('is-flipped', s15frcFlipped[idx]);
  cardEl.setAttribute('aria-expanded', s15frcFlipped[idx] ? 'true' : 'false');

  const baseLabel = cardEl.dataset.baseLabel || cardEl.getAttribute('aria-label');
  cardEl.setAttribute('aria-label',
    baseLabel.replace(/\.?\s*לחצו להפוך$/, s15frcFlipped[idx] ? 'לחצו כדי להפוך בחזרה' : 'לחצו להפוך'));

  const front = cardEl.querySelector('.frc-card-front');
  const back  = cardEl.querySelector('.frc-card-back');
  if (front) front.setAttribute('aria-hidden', s15frcFlipped[idx] ? 'true' : 'false');
  if (back)  back.setAttribute('aria-hidden', s15frcFlipped[idx] ? 'false' : 'true');

  s15frcCheckUnlock();
}

function s15frcCheckUnlock() {
  if (s15frcRevealed.every(Boolean)) {
    const btn = document.getElementById('s15-continue');
    if (btn) btn.disabled = false;
    s15frcDone = true;
  }
}

function advanceFromS15() {
  goTo(16);
}

function s15frcEnter() {
  // Restore current visual state on re-entry
  document.querySelectorAll('#s15 .frc-card').forEach((cardEl, idx) => {
    cardEl.classList.toggle('is-flipped', s15frcFlipped[idx]);
    cardEl.setAttribute('aria-expanded', s15frcFlipped[idx] ? 'true' : 'false');
    const front = cardEl.querySelector('.frc-card-front');
    const back  = cardEl.querySelector('.frc-card-back');
    if (front) front.setAttribute('aria-hidden', s15frcFlipped[idx] ? 'true' : 'false');
    if (back)  back.setAttribute('aria-hidden', s15frcFlipped[idx] ? 'false' : 'true');
  });
  const btn = document.getElementById('s15-continue');
  if (btn) btn.disabled = !s15frcDone;

  // Q3 always 'current' — unconditional
  standardPracticeProgress.questions[2].visited = true;
  standardPracticeProgress.questions[2].state   = 'current';
  standardPracticeProgress.questions[2].screen  = 13;
  syncStandardPracticeProgressNav(document.querySelector('#s15 .progress-question'));
}

function s15frcResetInitial() {
  s15frcRevealed = [false, false];
  s15frcFlipped = [false, false];
  s15frcDone = false;
  document.querySelectorAll('#s15 .frc-card').forEach(cardEl => {
    cardEl.classList.remove('is-flipped');
    cardEl.setAttribute('aria-expanded', 'false');
  });
  const btn = document.getElementById('s15-continue');
  if (btn) btn.disabled = true;
}


/* ═══════════════════════════════════════════════════════════
   S16 — SCORED Question 3 — DragAndDropQuestion (image variant)
   Based on S3 (image DDQ rendering) + S11 (2-attempt scoring,
   progress-question integration). 4 image draggables → 4 targets.
   Strict 1:1 correctMap. On completion, marks Q3 (questions[2])
   correct/incorrect; the connector after Q3 updates via the shared
   renderer rule (connector N visited when questions[N-1] decided).
   Namespaced s16ddq* — S3 and S11 untouched.
   ═══════════════════════════════════════════════════════════ */

const S16DDQ = {
  // Answer key — each target image ↔ its matching description.
  //   target-s16-1 (arrows near center, scattered)      → "מדויק אך לא מהימן" (drag-s16-4)
  //   target-s16-2 (arrows scattered all over)           → "לא מדויק ולא מהימן" (drag-s16-1)
  //   target-s16-3 (tight group, off-center)             → "מהימן אך לא מדויק" (drag-s16-3)
  //   target-s16-4 (tight group, bullseye)               → "גם מדויק וגם מהימן" (drag-s16-2)
  correctMap: {
    'target-s16-1': 'drag-s16-4',
    'target-s16-2': 'drag-s16-1',
    'target-s16-3': 'drag-s16-3',
    'target-s16-4': 'drag-s16-2'
  },
  revealMap: {
    'target-s16-1': 'drag-s16-4',
    'target-s16-2': 'drag-s16-1',
    'target-s16-3': 'drag-s16-3',
    'target-s16-4': 'drag-s16-2'
  },
  maxAttempts: 2,
  feedbackText: {
    retry: {
      bg: '#ffdbdc', titleColor: '#303030',
      title: 'התשובה אינה נכונה.',
      body: ['שננסה שוב?']
    },
    correct: {
      bg: '#edf8ed', titleColor: '#222222',
      title: 'התשובה נכונה.',
      body: ['מהימנות פירושה שהחיצים צמודים זה לזה - המדידות עקביות וחוזרות על עצמן. דיוק פירושו שהחיצים פגעו במרכז - המדידות קרובות לערך האמיתי.']
    },
    wrong2: {
      bg: '#ffdbdc', titleColor: '#303030',
      title: 'לא מדויק. התשובה הנכונה מוצגת.',
      body: ['מהימנות פירושה שהחיצים צמודים זה לזה - המדידות עקביות וחוזרות על עצמן. דיוק פירושו שהחיצים פגעו במרכז - המדידות קרובות לערך האמיתי.']
    }
  }
};

/* Draggable text labels — used when rendering the placed card in a target. */
const s16ddqTexts = {
  'drag-s16-1': 'לא מדויק ולא מהימן',
  'drag-s16-2': 'גם מדויק וגם מהימן',
  'drag-s16-3': 'מהימן אך לא מדויק',
  'drag-s16-4': 'מדויק אך לא מהימן'
};

const s16ddqPlacement = {
  'drag-s16-1': 'source',
  'drag-s16-2': 'source',
  'drag-s16-3': 'source',
  'drag-s16-4': 'source'
};
let s16ddqChecked      = false;
let s16ddqDone         = false;
let s16ddqAttempts     = 0;
let s16ddqShowFeedback = false;
let s16ddqResult       = null;   // 'correct' | 'incorrect' — the final scored verdict
let s16ddqDnd          = null;   // pointer-DnD controller (touch-compatible, like S3/S11)

/* ── Render — single state object → DOM ──────────────────── */
function s16ddqRender() {
  // Source slots: ghost when placed
  Object.keys(s16ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const inSource = (s16ddqPlacement[id] === 'source');
    card.classList.toggle('ghost', !inSource);
  });

  const targetIds = [...new Set([
    ...Object.keys(S16DDQ.correctMap),
    ...Object.values(s16ddqPlacement).filter(v => v !== 'source')
  ])];

  targetIds.forEach(targetId => {
    const zone = document.getElementById(targetId);
    if (!zone) return;
    zone.querySelector('.s16ddq-placed-card')?.remove();

    const dragId = Object.keys(s16ddqPlacement)
      .find(k => s16ddqPlacement[k] === targetId) || null;

    if (dragId) {
      const card = document.createElement('div');
      card.className = 's16ddq-placed-card';
      const txt = document.createElement('span');
      txt.className = 's16ddq-card-text';
      txt.textContent = s16ddqTexts[dragId];
      card.appendChild(txt);
      if (!s16ddqChecked && s16ddqDnd) s16ddqDnd.attachSource(card, dragId);
      zone.appendChild(card);
      zone.classList.add('occupied');
    } else {
      zone.classList.remove('occupied', 'drag-over');
    }
  });

  s16ddqUpdateCheck();
}

/* ── Check gate: all 4 required targets filled ───────────── */
function s16ddqAllFilled() {
  return Object.keys(S16DDQ.correctMap).every(tId =>
    Object.keys(s16ddqPlacement).some(dId => s16ddqPlacement[dId] === tId)
  );
}

function s16ddqUpdateCheck() {
  if (s16ddqChecked) return;
  const btn = document.getElementById('s16ddq-check');
  if (btn) btn.disabled = !s16ddqAllFilled();
}

/* ── Pointer DnD setup — runs once, idempotent (touch-compatible) ── */
function s16ddqInitDnd() {
  if (s16ddqDnd) return;
  s16ddqDnd = createPointerDnd({
    canDrag: (dragId, elem) => {
      if (s16ddqChecked) return false;
      if (elem.id === dragId) return s16ddqPlacement[dragId] === 'source';
      return true; // placed card
    },
    onPick: (dragId) => {
      s16ddqClearAttemptFeedback();
      if (s16ddqPlacement[dragId] !== 'source') {
        s16ddqPlacement[dragId] = 'source';
        s16ddqRender();
      }
      document.getElementById(dragId)?.classList.add('dragging');
    },
    onDrop: (dragId, targetId) => {
      const evicted = Object.keys(s16ddqPlacement).find(k => s16ddqPlacement[k] === targetId);
      if (evicted && evicted !== dragId) s16ddqPlacement[evicted] = 'source';
      s16ddqPlacement[dragId] = targetId;
      s16ddqRender();
    },
    onCancel: () => {
      s16ddqRender();
    },
  });
  Object.keys(s16ddqPlacement).forEach(id => {
    const el = document.getElementById(id);
    if (el) s16ddqDnd.attachSource(el, id);
  });
  document.querySelectorAll('#s16 .s16ddq-target').forEach(el => {
    s16ddqDnd.attachTarget(el, el.id);
  });
}

/* ── Check answers ───────────────────────────────────────── */
function s16ddqCheck() {
  if (s16ddqDone) { goTo(17); return; }   // no-op until S17 exists
  if (!s16ddqAllFilled()) return;

  s16ddqClearAttemptFeedback();
  s16ddqAttempts++;

  const allCorrect = Object.keys(S16DDQ.correctMap).every(
    tId => s16ddqPlacement[S16DDQ.correctMap[tId]] === tId
  );

  try {
    var _ans = Object.keys(S16DDQ.correctMap).map(function(tId){
      var d = Object.keys(s16ddqPlacement).find(function(k){ return s16ddqPlacement[k] === tId; });
      return d ? (s16ddqTexts[d] || d) : '—';
    }).join(' | ');
    var _row = allCorrect ? 'answered.last' : (s16ddqAttempts >= S16DDQ.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-008/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (allCorrect) {
    s16ddqChecked = true;
    s16ddqDone    = true;
    s16ddqRender();
    s16ddqLock();
    s16ddqShowFeedbackIcons(true);
    s16ddqShowPopup('correct');
    s16ddqResult = 'correct';
    standardPracticeProgress.questions[2].state = 'correct';
    s16ddqFinish();
  } else if (s16ddqAttempts >= S16DDQ.maxAttempts) {
    s16ddqChecked = true;
    s16ddqDone    = true;
    s16ddqRevealCorrect();
    s16ddqLock();
    s16ddqShowFeedbackIcons(true);
    s16ddqShowPopup('wrong2');
    s16ddqResult = 'incorrect';
    standardPracticeProgress.questions[2].state = 'incorrect';
    s16ddqFinish();
  } else {
    // First wrong attempt — per-zone feedback icons, allow retry, reveal the hint button
    s16ddqShowFeedback = true;
    s16ddqShowFeedbackIcons(false);
    s16ddqShowPopup('retry');
    const hint = document.getElementById('s16ddq-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

/* ── Lock dragging after final check ─────────────────────── */
function s16ddqLock() {
  Object.keys(s16ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.draggable = false;
    card.classList.add('locked');
  });
  document.querySelectorAll('#s16 .s16ddq-placed-card').forEach(c => {
    c.draggable = false;
  });
}

/* ── Reveal correct answer (final wrong) ─────────────────── */
function s16ddqRevealCorrect() {
  Object.keys(S16DDQ.revealMap).forEach(tId => {
    s16ddqPlacement[S16DDQ.revealMap[tId]] = tId;
  });
  const assigned = new Set(Object.values(S16DDQ.revealMap));
  Object.keys(s16ddqPlacement).forEach(id => {
    if (!assigned.has(id)) s16ddqPlacement[id] = 'source';
  });
  s16ddqRender();
}

/* ── Finish — update CTA, hide hint, sync progress nav ───── */
function s16ddqFinish() {
  const btn = document.getElementById('s16ddq-check');
  if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
  const hint = document.getElementById('s16ddq-hint');
  if (hint) hint.style.visibility = 'hidden';
  document.getElementById('s16ddq-hint-overlay')?.classList.add('hidden');
  syncStandardPracticeProgressNav(document.querySelector('#s16 .progress-question'));
}

/* ── Hint overlay open/close (appears after first wrong answer) ── */
function s16ddqOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s16ddq-hint-overlay')?.classList.remove('hidden');
}
function s16ddqCloseHint() {
  document.getElementById('s16ddq-hint-overlay')?.classList.add('hidden');
}
function s16ddqCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's16ddq-hint-overlay') s16ddqCloseHint();
}

/* ── Per-zone feedback icons (✓/✕ in corner of each target) ── */
function s16ddqShowFeedbackIcons(allGreen) {
  [1, 2, 3, 4].forEach(i => {
    const tId  = 'target-s16-' + i;
    const zone = document.getElementById(tId);
    if (!zone) return;
    const isCorrect = allGreen ||
      (s16ddqPlacement[S16DDQ.correctMap[tId]] === tId);
    const placedCard = zone.querySelector('.s16ddq-placed-card');
    if (placedCard) {
      placedCard.querySelector('.s16ddq-placed-ficon')?.remove();
      const iconEl = document.createElement('div');
      iconEl.className = 's16ddq-placed-ficon ' +
        (isCorrect ? 's16ddq-placed-ficon--correct' : 's16ddq-placed-ficon--wrong');
      placedCard.appendChild(iconEl);
    }
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong');
    zone.classList.add(isCorrect ? 's16ddq-correct' : 's16ddq-wrong');
  });
}

function s16ddqClearAttemptFeedback() {
  if (!s16ddqShowFeedback) return;
  s16ddqShowFeedback = false;
  [1, 2, 3, 4].forEach(i => {
    const zone = document.getElementById('target-s16-' + i);
    if (!zone) return;
    zone.querySelector('.s16ddq-placed-ficon')?.remove();
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong');
  });
}

/* ── Feedback popup ──────────────────────────────────────── */
function s16ddqShowPopup(type) {
  const popup = document.getElementById('s16ddq-popup');
  if (!popup) return;
  const cfg = S16DDQ.feedbackText[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s16ddq-popup-title');
  if (titleEl) { titleEl.textContent = cfg.title; titleEl.style.color = cfg.titleColor; }
  const bodyEl = document.getElementById('s16ddq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => `<p>${p}</p>`).join('');
  popup.classList.remove('hidden');
}

function s16ddqClosePopup() {
  document.getElementById('s16ddq-popup')?.classList.add('hidden');
}

function s16ddqPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s16ddqPopupDragging = true;
  const popup = document.getElementById('s16ddq-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const s16TopPx = parseFloat(popup.style.top);
  const popupTop = isNaN(s16TopPx) ? popup.offsetTop : s16TopPx;
  popup.style.top    = popupTop + 'px';
  popup.style.bottom = 'auto';
  s16ddqPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s16ddqPopupOffY = canvasY - popupTop;
  e.preventDefault();
}

/* ── Enter / reset screen state ──────────────────────────── */
function s16ddqEnter() {
  s16ddqInitDnd();
  if (s16ddqDone) {
    // Restore the locked, answered state on back-navigation return
    s16ddqRender();
    s16ddqLock();
    s16ddqShowFeedbackIcons(true);
    const btn = document.getElementById('s16ddq-check');
    if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
    const hint = document.getElementById('s16ddq-hint');
    if (hint) hint.style.visibility = 'hidden';
    document.getElementById('s16ddq-popup')?.classList.add('hidden');
    document.getElementById('s16ddq-hint-overlay')?.classList.add('hidden');
    // Re-assert the scored verdict — a practice screen (e.g. S15) may have
    // reset Q3 to 'current' on its own enter; the scored result wins on return.
    if (s16ddqResult) standardPracticeProgress.questions[2].state = s16ddqResult;
    syncStandardPracticeProgressNav(document.querySelector('#s16 .progress-question'));
    return;
  }

  // Full reset for fresh entry
  s16ddqChecked      = false;
  s16ddqResult       = null;
  s16ddqAttempts     = 0;
  s16ddqShowFeedback = false;
  Object.keys(s16ddqPlacement).forEach(id => { s16ddqPlacement[id] = 'source'; });

  Object.keys(S16DDQ.correctMap).forEach(tId => {
    const zone = document.getElementById(tId);
    if (!zone) return;
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong', 'occupied', 'drag-over');
    zone.querySelector('.s16ddq-placed-card')?.remove();
  });

  Object.keys(s16ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('ghost', 'dragging', 'locked');
  });

  const btn = document.getElementById('s16ddq-check');
  if (btn) { btn.textContent = 'צדקתי?'; btn.disabled = true; }
  const hint = document.getElementById('s16ddq-hint');
  if (hint) hint.style.visibility = 'hidden';

  document.getElementById('s16ddq-popup')?.classList.add('hidden');
  document.getElementById('s16ddq-hint-overlay')?.classList.add('hidden');

  // Q3 is current while answering this scored screen
  standardPracticeProgress.questions[2].visited = true;
  standardPracticeProgress.questions[2].state   = 'current';
  standardPracticeProgress.questions[2].screen  = 16;
  s16ddqRender();
  syncStandardPracticeProgressNav(document.querySelector('#s16 .progress-question'));
}


/* ═══════════════════════════════════════════════════════════
   S17 — Q4 — Scale recap + SingleChoiceQuestion
   Disabled scale widget + read-only measurements + 4 radio options.
   Correct answer = first option ('a'). 2 attempts; hint appears after
   the first wrong answer and is hidden once the question is done.
   ═══════════════════════════════════════════════════════════ */
const S17Q = { correctId: 'a', maxAttempts: 2 };
const S17Q_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'התשובה אינה נכונה.',
    body: ['שננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'התשובה נכונה! כל הכבוד!',
    body: ['המדידות דומות זו לזו — ולכן הן מהימנות. אך הן אינן קרובות לערך האמיתי של 10 גרם ולכן אינן מדויקות.']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'זוהי טעות. התשובה הנכונה מסומנת.',
    body: ['המדידות דומות זו לזו — ולכן הן מהימנות. אך הן אינן קרובות לערך האמיתי של 10 גרם ולכן אינן מדויקות.']
  }
};

let s17qSelected  = null;
let s17qAttempts  = 0;
let s17qAnswered  = false;
let s17qDone      = false;
let s17qPopupDragging = false;
let s17qPopupOffX = 0, s17qPopupOffY = 0;

function s17qSelect(id) {
  if (s17qAnswered) return;
  s17qSelected = id;
  if (s17qAttempts > 0) {
    document.getElementById('s17q-popup')?.classList.add('hidden');
    document.querySelectorAll('#s17 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s17 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  s17qUpdateBar();
}

function s17qCheck() {
  if (s17qAnswered) { advanceScreen(); return; }
  if (!s17qSelected) return;

  s17qAttempts++;
  const isCorrect = s17qSelected === S17Q.correctId;

  try {
    var _ans = document.querySelector('#s17 .scq-opt[data-id="' + s17qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s17qSelected;
    var _row = isCorrect ? 'answered.last' : (s17qAttempts >= S17Q.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-009/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s17qMark(S17Q.correctId, 'correct');
    s17qShowPopup('correct');
    standardPracticeProgress.questions[3].state = 'correct';
    s17qFinish();
  } else if (s17qAttempts >= S17Q.maxAttempts) {
    s17qMark(S17Q.correctId, 'correct');
    s17qMark(s17qSelected, 'wrong');
    s17qShowPopup('wrong2');
    standardPracticeProgress.questions[3].state = 'incorrect';
    s17qFinish();
  } else {
    s17qMark(s17qSelected, 'wrong');
    s17qShowPopup('retry');
    const hint = document.getElementById('s17q-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function s17qMark(id, cls) {
  const opt = document.querySelector('#s17 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function s17qShowPopup(type) {
  const popup = document.getElementById('s17q-popup');
  if (!popup) return;
  const cfg = S17Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s17q-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById('s17q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s17qClosePopup() {
  document.getElementById('s17q-popup')?.classList.add('hidden');
}

function s17qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s17qPopupDragging = true;
  const popup = document.getElementById('s17q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx   = parseFloat(popup.style.top);
  const top     = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = top + 'px';
  popup.style.bottom = 'auto';
  s17qPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s17qPopupOffY = canvasY - top;
  e.preventDefault();
}

function s17qFinish() {
  s17qAnswered = true;
  s17qDone     = true;
  document.querySelectorAll('#s17 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s17q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = false; }
  const hint = document.getElementById('s17q-hint');
  if (hint) hint.style.visibility = 'hidden';
  document.getElementById('s17q-hint-overlay')?.classList.add('hidden');
  syncStandardPracticeProgressNav(document.querySelector('#s17 .progress-question'));
}

function s17qUpdateBar() {
  if (s17qAnswered) return;
  const chk = document.getElementById('s17q-check');
  if (chk) chk.disabled = !s17qSelected;
}

function s17qOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s17q-hint-overlay')?.classList.remove('hidden');
}
function s17qCloseHint() {
  document.getElementById('s17q-hint-overlay')?.classList.add('hidden');
}
function s17qCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's17q-hint-overlay') s17qCloseHint();
}

function s17qResetInitial() {
  s17qSelected = null;
  s17qAttempts = 0;
  s17qAnswered = false;
  document.querySelectorAll('#s17 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s17q-popup')?.classList.add('hidden');
  document.getElementById('s17q-hint-overlay')?.classList.add('hidden');
  const chk = document.getElementById('s17q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById('s17q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function s17qEnter() {
  if (s17qDone) {
    syncStandardPracticeProgressNav(document.querySelector('#s17 .progress-question'));
    return;
  }
  standardPracticeProgress.questions[3].visited = true;
  standardPracticeProgress.questions[3].state   = 'current';
  standardPracticeProgress.questions[3].screen  = 17;
  syncStandardPracticeProgressNav(document.querySelector('#s17 .progress-question'));
}


/* ═══════════════════════════════════════════════════════════
   S18 — Q5 — SingleChoiceQuestion ("ממוצע מדידות")
   4 options; correct = second option ('b' = 50.0 גרם, the class average).
   2 attempts; hint appears after the first wrong answer, hidden when done.
   CTA label is "מה זה אומר?" (per Figma) rather than "צדקתי?".
   ═══════════════════════════════════════════════════════════ */
const S18Q = { correctId: 'b', maxAttempts: 2, ctaLabel: 'צדקתי?' };
const S18Q_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'התשובה אינה נכונה.',
    body: ['שננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'התשובה נכונה! כל הכבוד!',
    body: ['ממוצע של מדידות חוזרות עוזר לנו להתקרב לערך האמיתי של המדידה. במדידה אחת יכולה להיות סטייה קטנה. <strong>ממוצע מקטין טעויות אקראיות ומקרב אותנו לערך האמיתי.</strong>']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'זוהי טעות. התשובה הנכונה מסומנת.',
    body: ['ממוצע של מדידות חוזרות עוזר לנו להתקרב לערך האמיתי של המדידה. במדידה אחת יכולה להיות סטייה קטנה. <strong>ממוצע מקטין טעויות אקראיות ומקרב אותנו לערך האמיתי.</strong>']
  }
};

let s18qSelected  = null;
let s18qAttempts  = 0;
let s18qAnswered  = false;
let s18qDone      = false;
let s18qResult    = null;   // Q5 section a result; dot 5 decided at S19 (a AND b)
let s18qPopupDragging = false;
let s18qPopupOffX = 0, s18qPopupOffY = 0;

function s18qSelect(id) {
  if (s18qAnswered) return;
  s18qSelected = id;
  if (s18qAttempts > 0) {
    document.getElementById('s18q-popup')?.classList.add('hidden');
    document.querySelectorAll('#s18 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s18 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  s18qUpdateBar();
}

function s18qCheck() {
  if (s18qAnswered) { advanceScreen(); return; }
  if (!s18qSelected) return;

  s18qAttempts++;
  const isCorrect = s18qSelected === S18Q.correctId;

  try {
    var _ans = document.querySelector('#s18 .scq-opt[data-id="' + s18qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s18qSelected;
    var _row = isCorrect ? 'answered.last' : (s18qAttempts >= S18Q.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-010/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s18qMark(S18Q.correctId, 'correct');
    s18qShowPopup('correct');
    s18qResult = 'correct';
    s18qFinish();
  } else if (s18qAttempts >= S18Q.maxAttempts) {
    s18qMark(S18Q.correctId, 'correct');
    s18qMark(s18qSelected, 'wrong');
    s18qShowPopup('wrong2');
    s18qResult = 'incorrect';
    s18qFinish();
  } else {
    s18qMark(s18qSelected, 'wrong');
    s18qShowPopup('retry');
    const hint = document.getElementById('s18q-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function s18qMark(id, cls) {
  const opt = document.querySelector('#s18 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function s18qShowPopup(type) {
  const popup = document.getElementById('s18q-popup');
  if (!popup) return;
  const cfg = S18Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s18q-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById('s18q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s18qClosePopup() {
  document.getElementById('s18q-popup')?.classList.add('hidden');
}

function s18qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s18qPopupDragging = true;
  const popup = document.getElementById('s18q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx   = parseFloat(popup.style.top);
  const top     = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = top + 'px';
  popup.style.bottom = 'auto';
  s18qPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s18qPopupOffY = canvasY - top;
  e.preventDefault();
}

function s18qFinish() {
  s18qAnswered = true;
  s18qDone     = true;
  document.querySelectorAll('#s18 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s18q-check');
  if (chk) { chk.textContent = S18Q.ctaLabel; chk.disabled = false; }
  const hint = document.getElementById('s18q-hint');
  if (hint) hint.style.visibility = 'hidden';
  document.getElementById('s18q-hint-overlay')?.classList.add('hidden');
  s18qShowRememberVideo();
  syncStandardPracticeProgressNav(document.querySelector('#s18 .progress-question'));
}

function s18qUpdateBar() {
  if (s18qAnswered) return;
  const chk = document.getElementById('s18q-check');
  if (chk) chk.disabled = !s18qSelected;
}

function s18qOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s18q-hint-overlay')?.classList.remove('hidden');
}
function s18qCloseHint() {
  document.getElementById('s18q-hint-overlay')?.classList.add('hidden');
}
function s18qCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's18q-hint-overlay') s18qCloseHint();
}

function s18qHideRememberVideo() {
  const wrap = document.getElementById('s18-remember-video-wrap');
  const vid = document.getElementById('s18-remember-video');
  if (vid) {
    try { vid.pause(); } catch (e) {}
    vid.removeAttribute('src');
    vid.load();
  }
  if (wrap) wrap.classList.add('hidden');
  document.getElementById('s18-remember-bubble')?.classList.add('hidden');
}

function s18qShowRememberVideo() {
  const wrap = document.getElementById('s18-remember-video-wrap');
  const vid = document.getElementById('s18-remember-video');
  if (!wrap || !vid) return;
  const char = window.lomdaState.selectedCharacter || 'character-1';
  const src = S18_CHARACTER_VIDEOS[char] || S18_CHARACTER_VIDEOS['character-1'];
  vid.src = src;
  vid.load();
  wrap.classList.remove('hidden');
  document.getElementById('s18-remember-bubble')?.classList.remove('hidden');
  vid.play().catch(() => {});
  freezeVideoOnEnd(vid);
}

function s18qResetInitial() {
  s18qSelected = null;
  s18qAttempts = 0;
  s18qAnswered = false;
  document.querySelectorAll('#s18 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s18q-popup')?.classList.add('hidden');
  document.getElementById('s18q-hint-overlay')?.classList.add('hidden');
  s18qHideRememberVideo();
  document.getElementById('s18-remember-bubble')?.classList.add('hidden');
  const chk = document.getElementById('s18q-check');
  if (chk) { chk.textContent = S18Q.ctaLabel; chk.disabled = true; }
  const hint = document.getElementById('s18q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function s18qEnter() {
  if (s18qDone) {
    s18qShowRememberVideo();
    syncStandardPracticeProgressNav(document.querySelector('#s18 .progress-question'));
    return;
  }
  s18qHideRememberVideo();
  document.getElementById('s18-remember-bubble')?.classList.add('hidden');
  standardPracticeProgress.questions[4].visited = true;
  standardPracticeProgress.questions[4].state   = 'current';
  standardPracticeProgress.questions[4].screen  = 18;
  syncStandardPracticeProgressNav(document.querySelector('#s18 .progress-question'));
}


/* ═══════════════════════════════════════════════════════════
   S19 — Q5 (section ב) — SingleChoiceQuestion ("ממוצע מדידות")
   Conclusion question; correct = option 'c' ("המדידות היו מהימנות
   ומדויקות"). Clone of S18 (5a). 2 attempts; hint after first wrong.
   Scores the SAME progress question as 5a — Q5 (questions[4]) —
   check only if BOTH 5a (S18) and 5b (S19) are correct (any attempt).
   CTA "צדקתי?" → "שנמשיך?" once answered.
   ═══════════════════════════════════════════════════════════ */
const S19Q = { correctId: 'c', maxAttempts: 2, checkLabel: 'צדקתי?', doneLabel: 'שנמשיך?' };
const S19Q_POPUP_CFG = {
  retry: {
    bg: '#ffdbdc',
    title: 'התשובה אינה נכונה.',
    body: ['שננסה שוב?']
  },
  correct: {
    bg: '#edf8ed',
    title: 'התשובה נכונה.',
    body: ['כאשר מדידות חוזרות נותנות תוצאות דומות מאוד וקרובות לערך האמיתי, הדבר מחזק את הביטחון בכך שהמדידה מהימנה ומדויקת.']
  },
  wrong2: {
    bg: '#ffdbdc',
    title: 'לא מדויק. התשובה הנכונה מסומנת.',
    body: ['כאשר מדידות חוזרות נותנות תוצאות דומות מאוד וקרובות לערך האמיתי, הדבר מחזק את הביטחון בכך שהמדידה מהימנה ומדויקת.']
  }
};

let s19qSelected  = null;
let s19qAttempts  = 0;
let s19qAnswered  = false;
let s19qDone      = false;
let s19qResult    = null;   // 'correct' | 'incorrect' — final scored verdict
let s19qPopupDragging = false;
let s19qPopupOffX = 0, s19qPopupOffY = 0;

function s19qSelect(id) {
  if (s19qAnswered) return;
  s19qSelected = id;
  if (s19qAttempts > 0) {
    document.getElementById('s19q-popup')?.classList.add('hidden');
    document.querySelectorAll('#s19 .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#s19 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  s19qUpdateBar();
}

function s19qCheck() {
  if (s19qAnswered) { goToNextPart(); return; }   // last flow screen — score branch to part 02/03
  if (!s19qSelected) return;

  s19qAttempts++;
  const isCorrect = s19qSelected === S19Q.correctId;

  try {
    var _ans = document.querySelector('#s19 .scq-opt[data-id="' + s19qSelected + '"] .scq-opt-text');
    _ans = _ans ? _ans.textContent.trim() : s19qSelected;
    var _row = isCorrect ? 'answered.last' : (s19qAttempts >= S19Q.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-01-010/q2' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    s19qMark(S19Q.correctId, 'correct');
    s19qShowPopup('correct');
    // Dot 5 verdict = section a (S18) AND section b (S19) both correct (any attempt)
    s19qResult = (s18qResult === 'correct') ? 'correct' : 'incorrect';
    standardPracticeProgress.questions[4].state = s19qResult;
    s19qFinish();
  } else if (s19qAttempts >= S19Q.maxAttempts) {
    s19qMark(S19Q.correctId, 'correct');
    s19qMark(s19qSelected, 'wrong');
    s19qShowPopup('wrong2');
    s19qResult = 'incorrect';
    standardPracticeProgress.questions[4].state = 'incorrect';
    s19qFinish();
  } else {
    s19qMark(s19qSelected, 'wrong');
    s19qShowPopup('retry');
    const hint = document.getElementById('s19q-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function s19qMark(id, cls) {
  const opt = document.querySelector('#s19 .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function s19qShowPopup(type) {
  const popup = document.getElementById('s19q-popup');
  if (!popup) return;
  const cfg = S19Q_POPUP_CFG[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s19q-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById('s19q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function s19qClosePopup() {
  document.getElementById('s19q-popup')?.classList.add('hidden');
}

function s19qPopupMouseDown(e) {
  if (e.target.closest('.scq-popup-close')) return;
  s19qPopupDragging = true;
  const popup = document.getElementById('s19q-popup');
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const scaleM  = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = scaleM ? parseFloat(scaleM[1]) : 1;
  const canvasX = (e.clientX - appLeft) / scale;
  const canvasY = (e.clientY - appTop)  / scale;
  const topPx   = parseFloat(popup.style.top);
  const top     = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = top + 'px';
  popup.style.bottom = 'auto';
  s19qPopupOffX = canvasX - (parseFloat(popup.style.left) || 2);
  s19qPopupOffY = canvasY - top;
  e.preventDefault();
}

function s19qFinish() {
  s19qAnswered = true;
  s19qDone     = true;
  document.querySelectorAll('#s19 .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById('s19q-check');
  if (chk) { chk.textContent = S19Q.doneLabel; chk.disabled = false; }
  const hint = document.getElementById('s19q-hint');
  if (hint) hint.style.visibility = 'hidden';
  document.getElementById('s19q-hint-overlay')?.classList.add('hidden');
  syncStandardPracticeProgressNav(document.querySelector('#s19 .progress-question'));
}

function s19qUpdateBar() {
  if (s19qAnswered) return;
  const chk = document.getElementById('s19q-check');
  if (chk) chk.disabled = !s19qSelected;
}

function s19qOpenHint() {
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
  document.getElementById('s19q-hint-overlay')?.classList.remove('hidden');
}
function s19qCloseHint() {
  document.getElementById('s19q-hint-overlay')?.classList.add('hidden');
}
function s19qCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's19q-hint-overlay') s19qCloseHint();
}

function s19qResetInitial() {
  s19qSelected = null;
  s19qAttempts = 0;
  s19qAnswered = false;
  s19qResult   = null;
  document.querySelectorAll('#s19 .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById('s19q-popup')?.classList.add('hidden');
  document.getElementById('s19q-hint-overlay')?.classList.add('hidden');
  const chk = document.getElementById('s19q-check');
  if (chk) { chk.textContent = S19Q.checkLabel; chk.disabled = true; }
  const hint = document.getElementById('s19q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function s19qEnter() {
  if (s19qDone) {
    // Re-assert the scored verdict in case another screen reset Q5 meanwhile
    if (s19qResult) standardPracticeProgress.questions[4].state = s19qResult;
    syncStandardPracticeProgressNav(document.querySelector('#s19 .progress-question'));
    return;
  }
  standardPracticeProgress.questions[4].visited = true;
  standardPracticeProgress.questions[4].state   = 'current';
  standardPracticeProgress.questions[4].screen  = 19;
  syncStandardPracticeProgressNav(document.querySelector('#s19 .progress-question'));
}


/* ═══════════════════════════════════════════════════════════
   Dev mode: postMessage bridge (used by index_dev.html)
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'DEV_GOTO') return;
  const n = parseInt(e.data.screen, 10);
  if (!isNaN(n)) goTo(n);
});

if (window.parent !== window) {
  const count = document.querySelectorAll('.screen').length;
  window.parent.postMessage({ type: 'DEV_READY', total: count }, '*');
}




// ============================================================
//  REPORT MODAL  (BLOCK E)
// ============================================================
function openReportModal() {
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}
function tryCloseReportModal() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  if (typeVal || textVal) {
    document.getElementById('report-modal').setAttribute('hidden', '');
    document.getElementById('report-confirm-modal').removeAttribute('hidden');
  } else { forceCloseReportModal(); }
}
function forceCloseReportModal() {
  document.getElementById('report-modal').setAttribute('hidden', '');
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  resetReportForm();
}
function backToReportForm() {
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}

var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse';

// screen -> [subContent suffix, page-in-item] ; null = no matching subContent
var SCREEN_TO_SUBCONTENT = { 0:null, 1:['001',1], 2:['002',1], 3:['002',2], 4:null, 5:null, 20:['003',1], 21:null, 6:null, 7:null, 8:['004',1], 9:['005',1], 10:null, 11:['006',1], 12:['007',1], 13:['008',1], 14:['008',2], 15:['008',3], 16:['008',4], 17:['009',1], 18:['010',1], 19:['010',2] };

function submitReport() {
  var typeSel = document.getElementById('report-type');
  var textVal = document.getElementById('report-text').value.trim();
  var errEl   = document.getElementById('report-error');
  if (!typeSel.value || !textVal) {
    if (errEl) errEl.removeAttribute('hidden');
    (typeSel.value ? document.getElementById('report-text') : typeSel).focus();
    return;
  }
  if (errEl) errEl.setAttribute('hidden', '');
  var now  = new Date();
  var meta = window.METADATA || {};
  var body = new URLSearchParams();
  body.append('entry.301404029_year',  now.getFullYear());
  body.append('entry.301404029_month', now.getMonth() + 1);
  body.append('entry.301404029_day',   now.getDate());
  body.append('entry.2066097581_hour',   now.getHours());
  body.append('entry.2066097581_minute', now.getMinutes());
  body.append('entry.1933069481', shortId(meta.learningUnitId));
  body.append('entry.2070680092', shortId(meta.id));
  var mapEntry = SCREEN_TO_SUBCONTENT[currentScreen];
  var itemId   = mapEntry ? (shortId(meta.id)) + '-' + mapEntry[0] : '';
  var itemPage = mapEntry ? String(mapEntry[1]) : String(currentScreen);
  body.append('entry.1555704258', itemId);
  body.append('entry.1671046914', itemPage);
  body.append('entry.1179822443', typeSel.options[typeSel.selectedIndex].text);
  body.append('entry.806447525',  textVal);
  fetch(REPORT_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
    .catch(function(e) { console.error('[Report] send failed', e); });
  console.log('[Report Issue] sent');
  showReportThanks();
}
function showReportThanks() {
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.setAttribute('hidden', ''); });
  var t = document.getElementById('report-thanks');
  if (t) t.removeAttribute('hidden');
}
function resetReportForm() {
  document.getElementById('report-type').value = '';
  document.getElementById('report-text').value = '';
  document.getElementById('report-char-count').textContent = '0 / 250';
  var errEl = document.getElementById('report-error');
  if (errEl) errEl.setAttribute('hidden', '');
  var t = document.getElementById('report-thanks');
  if (t) t.setAttribute('hidden', '');
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.removeAttribute('hidden'); });
}
// Wire the existing flag button + char counter + Esc-to-close
(function wireReport() {
  var flagBtn = document.getElementById('flag-btn');
  if (flagBtn) flagBtn.addEventListener('click', openReportModal);
  var reportTextarea = document.getElementById('report-text');
  var reportCounter  = document.getElementById('report-char-count');
  if (reportTextarea && reportCounter) {
    reportTextarea.addEventListener('input', function() {
      reportCounter.textContent = reportTextarea.value.length + ' / 250';
    });
  }
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    var confirmModal = document.getElementById('report-confirm-modal');
    var reportModal  = document.getElementById('report-modal');
    if (confirmModal && !confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
    if (reportModal && !reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
  });
})();

/* ═══════════════════ xAPI (BLOCK A — PART 01) ═══════════════════ */
(function initXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-01.json';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function() { console.error('[xAPI] failed to load', src); cb(); };
    document.head.appendChild(s);
  }
  function pollMetadataReady(cb) {
    if (window.jsXAPI_MetadataReady) { cb(); }
    else { setTimeout(function() { pollMetadataReady(cb); }, 200); }
  }
  loadScript(CDN + 'xapiwrapper.min.js', function() {
    loadScript(CDN + 'xapi-720-f.js', function() {
      try {
        getXAPIParameters(METADATA_FILE);
        pollMetadataReady(function() {
          try {
            ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth });
            sendStatement720('initialized', 'onlinelesson');
            loadUnitMetadata('../metadata/methodica-science-mass-measure-01_unit.json', function() {
              try { sendStatement720('initialized', 'onlinelesson', null, { scope: 'unit' }); } catch(e) {}
            });
          } catch(e) { console.error('[xAPI] init', e); }
        });
      } catch(e) { console.error('[xAPI] load', e); }
    });
  });
})();
