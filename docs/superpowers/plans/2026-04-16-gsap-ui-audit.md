# GSAP UI Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all CSS class-toggling animations and the raw `requestAnimationFrame` scatter loop in `visual-design-app` to GSAP timelines and tweens for better visual quality and performance.

**Architecture:** GSAP is imported as an ESM from `esm.sh` at the top of `hbo-stage-reveal.js`. A module-level `gsap.matchMedia()` flag handles `prefers-reduced-motion`. Each animation sequence is replaced task-by-task; the app runs and is visually verified after each task.

**Tech Stack:** Vanilla JS (ES modules), GSAP 3.13, Express static server (no bundler)

**Spec:** `docs/superpowers/specs/2026-04-16-gsap-ui-audit-design.md`

---

> **Note on testing:** This project has no automated test framework. Each task's verification step is a manual browser check. Open `http://localhost:3000` (or whatever port the Express server runs on) after each task and exercise the feature described.

---

## File Structure

| File | Change |
|---|---|
| `hbo-stage-reveal.js` | Primary: add GSAP import, replace all animation methods |
| `hbo-stage-reveal.css` | Remove CSS keyframes/classes replaced by GSAP; add `will-change` |

No new files created.

---

## Task 1: Add GSAP import and `prefers-reduced-motion` flag

**Files:**
- Modify: `hbo-stage-reveal.js` — top of file (before any other code)

- [ ] **Step 1: Add the GSAP ESM import and reduced-motion setup at the very top of `hbo-stage-reveal.js`**

The file currently starts with several `const` declarations. Add these two lines as the very first lines of the file:

```js
import { gsap } from 'https://esm.sh/gsap@3.13.0';

// Module-level reduced-motion flag — read by every tween helper below
const _mm = gsap.matchMedia();
let _reducedMotion = false;
_mm.add(
  { reduceMotion: '(prefers-reduced-motion: reduce)' },
  (ctx) => { _reducedMotion = ctx.conditions.reduceMotion; },
);
```

- [ ] **Step 2: Verify GSAP loads**

Start the server (`node server.js` in `visual-design-app/`) and open the app in a browser. Open DevTools console. Run:

```js
gsap.version
```

Expected: `"3.13.0"` (or similar). If you see `ReferenceError: gsap is not defined`, the ESM import failed — check network tab for the esm.sh fetch.

- [ ] **Step 3: Commit**

```bash
cd visual-design-app
git add hbo-stage-reveal.js
git commit -m "feat: add GSAP ESM import and prefers-reduced-motion flag"
```

---

## Task 2: Replace scatter logo loop with GSAP tweens

**Files:**
- Modify: `hbo-stage-reveal.js` — `_spawnScatterLogos()` method
- Modify: `hbo-stage-reveal.css` — add `will-change: transform` to `.scatter-icon`

**Context:** `_spawnScatterLogos()` currently runs a manual `requestAnimationFrame` loop that sets `style.left`, `style.top`, `style.transform` on every icon every frame — triggering layout recalculation each time. We replace this with GSAP repeating tweens using `x`, `y`, `rotation` (compositor-only properties).

- [ ] **Step 1: Add `will-change: transform` to `.scatter-icon` in `hbo-stage-reveal.css`**

Find the `.scatter-icon` rule and add the property:

```css
.scatter-icon {
  /* existing rules... */
  will-change: transform;
}
```

- [ ] **Step 2: Replace the `_spawnScatterLogos()` method body in `hbo-stage-reveal.js`**

Find `_spawnScatterLogos(skinId, manifest)` and replace the entire method body (from `const container = ...` to the closing `}`) with:

```js
_spawnScatterLogos(skinId, manifest) {
  const container = this.$('.skin-scatter');
  container.innerHTML = '';

  // Kill any tweens from a previous skin's scatter icons
  if (this._scatterTweens) {
    this._scatterTweens.forEach(t => t.kill());
  }
  this._scatterTweens = [];

  const logos = manifest.scatterFiles;
  if (!logos || logos.length === 0) return;

  const count = manifest.scatterCount || 16;

  for (let i = 0; i < count; i++) {
    const src = 'skins/' + skinId + '/' + logos[i % logos.length];
    const size = 28 + Math.random() * 50;
    const el = document.createElement('div');
    el.className = 'scatter-icon';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    // Position with transforms (not left/top) so GSAP can own them
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    el.appendChild(img);
    container.appendChild(el);

    const baseX = Math.random() * (container.offsetWidth || window.innerWidth);
    const baseY = Math.random() * (container.offsetHeight || window.innerHeight);
    const driftX = 12 + Math.random() * 18;
    const driftY = 8 + Math.random() * 14;
    const duration = 5.5 + Math.random() * 6;
    const baseRot = Math.random() * 40 - 20;
    const rotRange = 8 + Math.random() * 10;
    const opacity = 0.08 + Math.random() * 0.12;
    const delay = i * 0.08;

    // Set starting position
    gsap.set(el, { x: baseX, y: baseY, rotation: baseRot, autoAlpha: 0 });

    // Fade in with stagger
    gsap.to(el, { autoAlpha: opacity, duration: 0.6, delay });

    // Horizontal drift loop
    const tx = gsap.to(el, {
      x: baseX + driftX,
      duration: duration * 0.6,
      delay,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Vertical drift loop (different period for organic feel)
    const ty = gsap.to(el, {
      y: baseY + driftY,
      duration: duration,
      delay,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Rotation loop
    const tr = gsap.to(el, {
      rotation: baseRot + rotRange,
      duration: duration * 1.3,
      delay,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    this._scatterTweens.push(tx, ty, tr);
  }
}
```

- [ ] **Step 3: Remove the old `scatterAnimFrame` property references**

In the `constructor`, find `this.scatterAnimFrame = null;` and replace with `this._scatterTweens = [];`.

Find every use of `this.scatterAnimFrame` in the class (there are two: in `_spawnScatterLogos` itself — now gone — and in `destroy()`). In `destroy()`, replace:

```js
if (this.scatterAnimFrame) cancelAnimationFrame(this.scatterAnimFrame);
```

with:

```js
if (this._scatterTweens) this._scatterTweens.forEach(t => t.kill());
```

- [ ] **Step 4: Verify scatter icons**

Reload the app. The scatter icons (e.g. batman logo on the batman skin) should float smoothly. Open Chrome DevTools → Performance → Record for 3 seconds while scatter is running. Confirm there are no purple "Layout" bars during the scatter animation (previously there would be many).

- [ ] **Step 5: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "perf: replace scatter rAF loop with GSAP tweens using x/y transforms"
```

---

## Task 3: Replace `_resetRevealElements()` with `gsap.set()`

**Files:**
- Modify: `hbo-stage-reveal.js` — `_resetRevealElements()` method

**Context:** This method sets initial hidden states for reveal elements before the sequence runs. Currently uses direct `style.opacity` and `style.transform` assignments. Replacing with `gsap.set()` means GSAP owns the state, preventing conflicts when tweens run.

- [ ] **Step 1: Replace `_resetRevealElements()` body**

```js
_resetRevealElements() {
  const card      = this.$('.content-card');
  const info      = this.$('.reveal-info');
  const actions   = this.$('.reveal-actions');
  const pickersRow = this.$('.pickers-row');
  const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
  const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');
  const flare     = this.$('.spotlight-flare');
  const glow      = this.$('.stage-glow');
  const flash     = this.$('.swap-flash');
  const watchBtn  = this.$('.btn-watch');

  // Kill any in-progress reveal tweens
  gsap.killTweensOf([card, info, actions, pickersRow, spotBright, spotAccent, flare, glow, flash]);

  // Remove legacy CSS animation classes
  [card, info, actions, pickersRow, spotBright, spotAccent, flare, glow].forEach(el => {
    if (!el) return;
    el.classList.remove('animate', 'swap-out', 'swap-in', 'swap-flicker', 'fire');
  });
  if (flash) flash.classList.remove('fire');
  if (watchBtn) watchBtn.classList.remove('reveal-pulse');
  this._resetSkinHeroes();

  // Set hidden initial states via GSAP
  gsap.set(card,      { autoAlpha: 0, y: 40, scale: 0.95, clearProps: 'none' });
  gsap.set(info,      { autoAlpha: 0, y: 20 });
  if (pickersRow) gsap.set(pickersRow, { autoAlpha: 0, y: 16 });
  gsap.set(actions,   { autoAlpha: 0, y: 16 });
  gsap.set(spotBright, { autoAlpha: 0, scaleY: 0 });
  gsap.set(spotAccent, { autoAlpha: 0, scaleY: 0 });
  gsap.set(flare,     { autoAlpha: 0, scale: 0 });
  gsap.set(glow,      { autoAlpha: 0 });
}
```

- [ ] **Step 2: Verify no visual regression**

Start the sequence (click "Start the Show"). The reveal should still play. If elements flash or appear incorrectly, check that `gsap.set()` calls above are present and that no CSS overrides `autoAlpha` (opacity/visibility).

- [ ] **Step 3: Commit**

```bash
git add hbo-stage-reveal.js
git commit -m "refactor: replace _resetRevealElements direct style writes with gsap.set()"
```

---

## Task 4: Replace `_animateRevealElements()` with GSAP timeline

**Files:**
- Modify: `hbo-stage-reveal.js` — `_animateRevealElements()` method
- Modify: `hbo-stage-reveal.css` — remove `.spotlight-cone--bright.animate`, `.spotlight-cone--accent.animate`, `.spotlight-flare.animate`, `.stage-glow.animate`, `.content-card.animate`, `.reveal-info.animate`, `.reveal-actions.animate`, `.pickers-row.animate` animation rules (keep any non-animation styles on these selectors)

**Context:** Currently 8 simultaneous `classList.add('animate')` calls with CSS `animation-delay` providing loose ordering. A GSAP timeline gives exact, readable sequencing.

- [ ] **Step 1: Replace `_animateRevealElements()` body**

```js
_animateRevealElements() {
  const card       = this.$('.content-card');
  const info       = this.$('.reveal-info');
  const actions    = this.$('.reveal-actions');
  const pickersRow = this.$('.pickers-row');
  const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
  const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');
  const flare      = this.$('.spotlight-flare');
  const glow       = this.$('.stage-glow');

  const d = _reducedMotion ? 0 : 1; // global duration multiplier

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
  });

  tl.to(glow,       { autoAlpha: 1, duration: 0.6 * d }, 0)
    .to(spotBright,  { autoAlpha: 1, scaleY: 1, duration: 0.7 * d, ease: 'power3.out' }, 0.1 * d)
    .to(spotAccent,  { autoAlpha: 1, scaleY: 1, duration: 0.6 * d, ease: 'power2.out' }, 0.2 * d)
    .to(flare,       { autoAlpha: 1, scale: 1,  duration: 0.4 * d, ease: 'back.out(1.7)' }, 0.35 * d)
    .to(card,        { autoAlpha: 1, y: 0, scale: 1, duration: 0.75 * d }, 0.4 * d)
    .to(info,        { autoAlpha: 1, y: 0, duration: 0.5 * d }, 0.55 * d)
    .to(pickersRow || [],  { autoAlpha: 1, y: 0, duration: 0.4 * d }, 0.65 * d)
    .to(actions,     { autoAlpha: 1, y: 0, duration: 0.4 * d }, 0.7 * d);

  // Skin heroes animate in after card
  const heroDelay = _reducedMotion ? 0 : 0.8;
  gsap.delayedCall(heroDelay, () => this._animateSkinHeroes());

  // Watch button pulse — keep as CSS class (it's a simple loop, no conflict)
  const watchBtn = this.$('.btn-watch');
  if (watchBtn) {
    const pulseDelay = _reducedMotion ? 0 : 1;
    gsap.delayedCall(pulseDelay, () => {
      watchBtn.classList.remove('reveal-pulse');
      void watchBtn.offsetWidth;
      watchBtn.classList.add('reveal-pulse');
    });
  }
}
```

- [ ] **Step 2: Remove the replaced CSS animation rules from `hbo-stage-reveal.css`**

Search for and remove (or comment out) CSS rules that apply animations when these selectors have `.animate` class. Keep any non-animation rules (colours, positioning, etc). Specifically remove the `animation:` declarations from:
- `.spotlight-cone--bright.animate`
- `.spotlight-cone--accent.animate`
- `.spotlight-flare.animate`
- `.stage-glow.animate`
- `.content-card.animate`
- `.reveal-info.animate`
- `.reveal-actions.animate`
- `.pickers-row.animate`

Leave the base styles (e.g. `opacity: 0` initial states if any, `transform-origin`, etc) intact if they exist — only remove `animation:` and `transition:` declarations that conflict with GSAP.

- [ ] **Step 3: Verify the full reveal sequence**

Click "Start the Show". After the YouTube video ends, the reveal frame should appear with:
- Glow fading in first
- Spotlights sweeping up shortly after
- Spotlight flare blooming with a slight overshoot
- Content card rising into view
- Info and actions fading up in sequence
- Everything smoother and more cinematic than before

- [ ] **Step 4: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace _animateRevealElements with GSAP timeline"
```

---

## Task 5: Replace `_tryAnother()` card swap with GSAP timeline

**Files:**
- Modify: `hbo-stage-reveal.js` — `_tryAnother()` method
- Modify: `hbo-stage-reveal.css` — remove `.swap-out`, `.swap-in`, `.swap-flicker`, `.swap-flash.fire` animation rules

**Context:** Current implementation uses CSS class-based 3D flip with `forceReflow()` hack to restart the flash animation. GSAP timeline eliminates both.

- [ ] **Step 1: Replace `_tryAnother()` method body**

```js
async _tryAnother() {
  if (this.isAnimating) return;
  this.isAnimating = true;

  const card      = this.$('.content-card');
  const info      = this.$('.reveal-info');
  const flash     = this.$('.swap-flash');
  const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
  const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');

  const d = _reducedMotion ? 0 : 1;

  // Kill any lingering reveal tweens on these elements
  gsap.killTweensOf([card, info, spotBright, spotAccent, flash]);

  await new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    // Spotlight flicker
    tl.to([spotBright, spotAccent], {
      autoAlpha: 0.35,
      duration: 0.08 * d,
      ease: 'none',
      yoyo: true,
      repeat: 5,
    }, 0);

    // Card + info flip out
    tl.to([card, info], {
      rotationY: 90,
      autoAlpha: 0,
      duration: 0.3 * d,
      ease: 'power2.in',
    }, 0);

    // Flash burst at the swap moment
    tl.fromTo(flash,
      { autoAlpha: 0.8, scale: 1.2 },
      { autoAlpha: 0, scale: 1, duration: 0.25 * d, ease: 'power2.out' },
      0.3 * d,
    );
  });

  // Apply new show data at the exact midpoint (card hidden)
  const show = await this._fetchRandomShow();
  if (!show) { this.isAnimating = false; return; }
  this._applyShow(show);
  if (this.config.onReveal) this.config.onReveal(show);
  this._createParticles(this.$('.particles-reveal'), 25);

  // Reset rotationY before flipping back in
  gsap.set([card, info], { rotationY: -90 });

  await new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    // Card + info flip in
    tl.to([card, info], {
      rotationY: 0,
      autoAlpha: 1,
      duration: 0.45 * d,
      ease: 'power2.out',
    }, 0);

    // Restore spotlights
    tl.to([spotBright, spotAccent], {
      autoAlpha: 1,
      duration: 0.3 * d,
      ease: 'power2.out',
    }, 0.1 * d);
  });

  this.isAnimating = false;
}
```

- [ ] **Step 2: Remove replaced CSS rules from `hbo-stage-reveal.css`**

Remove the `animation:` or `transform:`/`opacity:` rules from these selectors (keep any other styles on the selectors):
- `.content-card.swap-out`
- `.content-card.swap-in`
- `.reveal-info.swap-out`
- `.reveal-info.swap-in`
- `.spotlight-cone.swap-flicker`
- `.swap-flash.fire`

- [ ] **Step 3: Verify "Try Another"**

On the reveal screen, click "Try Another". The card should:
1. Spotlight flickers briefly
2. Card flips out (rotateY to 90°) while fading
3. Flash burst appears
4. New card flips in from the other side
5. Spotlights restore

- [ ] **Step 4: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace _tryAnother card swap with GSAP flip timeline"
```

---

## Task 6: Replace `_goHome()` idle entrance with GSAP

**Files:**
- Modify: `hbo-stage-reveal.js` — `_goHome()` method
- Modify: `hbo-stage-reveal.css` — remove `@keyframes fadeUp` and the `animation: fadeUp` rules on `.idle-title` and `.btn-start`

**Context:** Currently sets `el.style.animation = 'fadeUp 0.8s ease ...'` by string, which breaks on rapid repeated calls. GSAP `fromTo()` with `killTweensOf` handles restarts cleanly.

- [ ] **Step 1: Replace the animation portion of `_goHome()` (keep all other logic)**

Find the block in `_goHome()` that starts with `const title = this.$('.idle-title');` and ends with the last `btn.style.transform = 'translateY(20px)';`. Replace it with:

```js
const title = this.$('.idle-title');
const btn   = this.$('.btn-start');

gsap.killTweensOf([title, btn]);

const d = _reducedMotion ? 0 : 1;

gsap.fromTo(title,
  { autoAlpha: 0, y: 20 },
  { autoAlpha: 1, y: 0, duration: 0.8 * d, ease: 'power2.out', delay: 0.1 * d },
);
gsap.fromTo(btn,
  { autoAlpha: 0, y: 20 },
  { autoAlpha: 1, y: 0, duration: 0.8 * d, ease: 'power2.out', delay: 0.3 * d },
);
```

- [ ] **Step 2: Remove the `fadeUp` keyframe and its usages from `hbo-stage-reveal.css`**

Remove:
- The `@keyframes fadeUp { ... }` block
- Any `animation: fadeUp` declaration on `.idle-title` or `.btn-start`

If `.idle-title` has `opacity: 0` as a default (for the CSS animation to start from), remove it — GSAP will set `autoAlpha: 0` at animation start via `fromTo`.

- [ ] **Step 3: Verify idle re-entrance**

After a reveal, click the "Watch Now" (or equivalent) button to go home. The title and button should fade up smoothly. Click it multiple times rapidly — each return should restart the animation cleanly without it getting stuck.

- [ ] **Step 4: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace _goHome inline style animation with GSAP fromTo"
```

---

## Task 7: Replace loading overlay dismiss with GSAP

**Files:**
- Modify: `hbo-stage-reveal.js` — `_dismissLoadingOverlay()` method
- Modify: `hbo-stage-reveal.css` — remove `.hbo-loading-overlay.fade-out` animation rule

- [ ] **Step 1: Replace `_dismissLoadingOverlay()` body**

```js
_dismissLoadingOverlay() {
  const overlay = this.$('.hbo-loading-overlay');
  if (!overlay) return;
  const d = _reducedMotion ? 0 : 0.8;
  gsap.to(overlay, {
    autoAlpha: 0,
    duration: d,
    ease: 'power2.inOut',
    onComplete: () => overlay.classList.add('hidden'),
  });
}
```

- [ ] **Step 2: Remove `.hbo-loading-overlay.fade-out` CSS animation rule**

Find and remove (or comment out) any `animation:` or `transition:` on `.hbo-loading-overlay.fade-out` in `hbo-stage-reveal.css`. Keep the `.hbo-loading-overlay.hidden { display: none }` rule — it's still used by the `onComplete` callback.

- [ ] **Step 3: Verify loading dismissal**

Reload the app. The "HBO" loading screen should fade out smoothly on init. It should not flash or disappear abruptly.

- [ ] **Step 4: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace loading overlay CSS fade with GSAP autoAlpha tween"
```

---

## Task 8: Replace skin/theme flash transitions with GSAP

**Files:**
- Modify: `hbo-stage-reveal.js` — `_switchSkin()` and `_onGenreChange()` methods
- Modify: `hbo-stage-reveal.css` — remove `.theme-transition.fire` keyframe animation

**Context:** Both methods use `overlay.classList.remove('fire'); forceReflow(overlay); overlay.classList.add('fire')` to restart a CSS keyframe. GSAP replaces this entirely.

- [ ] **Step 1: Create a helper method `_flashThemeOverlay()` in the class**

Add this method to the `HBOStageReveal` class (anywhere before `_switchSkin`):

```js
_flashThemeOverlay() {
  const overlay = this.$('.theme-transition');
  if (!overlay) return Promise.resolve();
  const d = _reducedMotion ? 0 : 1;
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .fromTo(overlay,
        { autoAlpha: 0.85 },
        { autoAlpha: 0, duration: 0.6 * d, ease: 'power2.inOut' },
      );
  });
}
```

- [ ] **Step 2: Replace the flash trigger in `_switchSkin()`**

Find:

```js
const overlay = this.$('.theme-transition');
overlay.classList.remove('fire');
forceReflow(overlay);
overlay.classList.add('fire');

await wait(300);
```

Replace with:

```js
this._flashThemeOverlay(); // fire and forget — runs concurrently with skin load
await wait(300);
```

- [ ] **Step 3: Replace the flash trigger in `_onGenreChange()`**

Find (there are two separate blocks — one for the genre/theme flash, one for the swap flash):

```js
const themeOverlay = this.$('.theme-transition');
themeOverlay.classList.remove('fire');
forceReflow(themeOverlay);
themeOverlay.classList.add('fire');

await wait(200);
```

Replace with:

```js
this._flashThemeOverlay();
await wait(200);
```

- [ ] **Step 4: Remove `.theme-transition.fire` CSS animation from `hbo-stage-reveal.css`**

Find and remove the `@keyframes` and `animation:` declaration used by `.theme-transition.fire`. Keep the base `.theme-transition` positioning rules (it should remain `position: absolute; inset: 0; pointer-events: none; z-index: ...`).

- [ ] **Step 5: Verify skin and genre switching**

Switch between skins using the dropdown. A brief white/light flash should appear over the stage as the new skin loads. Switch genres/vibes on the reveal screen — the same flash should appear. No `forceReflow` hack needed.

- [ ] **Step 6: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace theme flash forceReflow CSS hack with GSAP timeline"
```

---

## Task 9: Replace spotlight dim sequence with GSAP

**Files:**
- Modify: `hbo-stage-reveal.js` — `_afterVideoEnds()` method
- Modify: `hbo-stage-reveal.css` — remove `.spotlight-cone--dim.animate` animation rule

**Context:** `_afterVideoEnds()` uses `spotlightDim.classList.add('animate')` and `classList.remove('animate') + style.opacity = '0'` around the transition. Replace with GSAP in/out tweens.

- [ ] **Step 1: Replace the spotlight dim animation within `_afterVideoEnds()`**

Find the section (after `spinner.classList.add('visible')`):

```js
await wait(200);
spotlightDim.classList.add('animate');
await wait(800);
spinner.classList.remove('visible');
await wait(200);

this._switchFrame(frameTransition, frameReveal);
spotlightDim.classList.remove('animate');
spotlightDim.style.opacity = '0';
await wait(100);
this._animateRevealElements();
```

Replace with:

```js
const d = _reducedMotion ? 0 : 1;

// Spotlight sweeps up during loading
await new Promise(resolve => {
  gsap.fromTo(spotlightDim,
    { autoAlpha: 0, scaleY: 0 },
    { autoAlpha: 1, scaleY: 1, duration: 0.8 * d, ease: 'power3.out', onComplete: resolve },
  );
});

await wait(_reducedMotion ? 0 : 800);
spinner.classList.remove('visible');
await wait(_reducedMotion ? 0 : 200);

this._switchFrame(frameTransition, frameReveal);

// Spotlight sweeps back down as reveal frame appears
gsap.to(spotlightDim, { autoAlpha: 0, scaleY: 0, duration: 0.4 * d, ease: 'power2.in' });

await wait(_reducedMotion ? 0 : 100);
this._animateRevealElements();
```

- [ ] **Step 2: Remove `.spotlight-cone--dim.animate` CSS animation rule**

Find and remove the `animation:` declaration from `.spotlight-cone--dim.animate` in `hbo-stage-reveal.css`. Keep the `.spotlight-cone--dim` base styles (positioning, gradient, `transform-origin`).

- [ ] **Step 3: Verify the full end-to-end flow**

Click "Start the Show". Watch all 4 phases:
1. Credits (YouTube video)
2. Transition (spotlight sweeps up, spinner appears)
3. Spotlight reverses as reveal frame comes in
4. Reveal elements animate in (Task 4 timeline)

All transitions should feel smooth and cinematic.

- [ ] **Step 4: Commit**

```bash
git add hbo-stage-reveal.js hbo-stage-reveal.css
git commit -m "feat: replace spotlight dim CSS animation with GSAP timeline"
```

---

## Task 10: Update `destroy()` for GSAP cleanup

**Files:**
- Modify: `hbo-stage-reveal.js` — `destroy()` method

**Context:** GSAP tweens targeting elements inside a destroyed instance must be killed to prevent ghost animation callbacks running after the DOM is cleared.

- [ ] **Step 1: Add GSAP cleanup at the start of `destroy()`**

Find `destroy()` and add these two lines as the very first lines of the method body:

```js
destroy() {
  gsap.killTweensOf(this.root.querySelectorAll('*'));
  if (this._scatterTweens) this._scatterTweens.forEach(t => t.kill());
  // ... rest of existing destroy() code unchanged
```

- [ ] **Step 2: Verify no errors on destroy**

In the browser console, run:

```js
// Assuming stage1 and stage2 are the two instances from index.html
stage1.destroy();
// Wait 2 seconds, then check for errors in console
```

Expected: no uncaught errors, no animation callbacks firing after destroy.

- [ ] **Step 3: Commit**

```bash
git add hbo-stage-reveal.js
git commit -m "fix: kill GSAP tweens on destroy() to prevent ghost animations"
```

---

## Task 11: Final CSS cleanup

**Files:**
- Modify: `hbo-stage-reveal.css`

**Context:** Remove any remaining animation rules made redundant by GSAP across all tasks, and verify no leftover `.animate`, `.swap-*`, `.fire` animation blocks that could conflict.

- [ ] **Step 1: Search for remaining animation conflicts**

In `hbo-stage-reveal.css`, search for `animation:` declarations on selectors that include `.animate`, `.swap-out`, `.swap-in`, `.swap-flicker`, `.fire`. Remove any found that were not already removed in Tasks 4–9.

Keep:
- `.particle` animation (CSS drift — stays as-is)
- `.grain-overlay` animation
- `.skin-hero.animate` animation (skin hero entrance is still CSS-class based — `_animateSkinHeroes()` was not changed)
- `.reveal-pulse` animation on the watch button
- `.hbo-loading-overlay` keyframe for the loading bar fill animation
- `.transition-spinner` animation
- `.loading-bar-fill` animation

- [ ] **Step 2: Full end-to-end smoke test**

Exercise the complete flow with both instances:
1. Page loads — loading overlay fades out ✓
2. Click "Start the Show" — video plays ✓
3. Video ends — transition spotlight sweeps, reveal appears ✓
4. Reveal elements animate in cinematic sequence ✓
5. Click "Try Another" — card flips, new show appears ✓
6. Switch skin — flash transition, icons drift with GSAP ✓
7. Switch vibe/genre — flash transition, new content appears ✓
8. Click "Watch Now" — goes home, title/button fade up ✓
9. Repeat with second instance — no cross-instance interference ✓

- [ ] **Step 3: Final commit**

```bash
git add hbo-stage-reveal.css
git commit -m "chore: final CSS cleanup — remove all animation rules replaced by GSAP"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| GSAP ESM import | Task 1 |
| `prefers-reduced-motion` via `matchMedia` | Task 1 |
| Scatter loop: rAF + left/top → GSAP x/y tweens | Task 2 |
| `will-change: transform` on scatter icons | Task 2 |
| `_resetRevealElements` → `gsap.set()` | Task 3 |
| `_animateRevealElements` → GSAP timeline | Task 4 |
| Remove `.animate` CSS animations from reveal elements | Task 4 |
| `_tryAnother` → GSAP flip timeline | Task 5 |
| Remove `.swap-*` CSS rules | Task 5 |
| `_goHome` → GSAP `fromTo` | Task 6 |
| Remove `fadeUp` keyframe | Task 6 |
| `_dismissLoadingOverlay` → GSAP | Task 7 |
| Theme/skin flash → GSAP | Task 8 |
| Remove `.fire` keyframe | Task 8 |
| Spotlight dim → GSAP | Task 9 |
| `destroy()` kills tweens | Task 10 |
| Final CSS cleanup | Task 11 |

All spec requirements covered. No placeholders.
