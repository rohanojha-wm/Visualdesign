# GSAP UI Audit — Design Spec
**Date:** 2026-04-16
**Project:** `visual-design-app` (vanilla JS ES module, Express static server)
**File:** `hbo-stage-reveal.js` + `hbo-stage-reveal.css` + `index.html`

---

## Goal

Replace CSS class-toggling animations and a raw `requestAnimationFrame` scatter loop with GSAP timelines and tweens to achieve:
1. Cinematic, precisely sequenced reveal and swap animations.
2. Eliminated layout thrashing from the scatter logo loop (move from `left`/`top` to GPU-composited `x`/`y` transforms).
3. Proper cleanup — active tweens killed on `destroy()`, no ghost animations after teardown.
4. `prefers-reduced-motion` support via `gsap.matchMedia()`.

---

## How GSAP is loaded

No bundler exists in this project. GSAP is imported as an ESM at the top of `hbo-stage-reveal.js`:

```js
import { gsap } from 'https://esm.sh/gsap@3.13.0';
```

No changes to `package.json`, `index.html`, or `server.js`. The existing `<script type="module">` import in `index.html` already supports ESM.

---

## Changes

### 1. Scatter logo loop — `_spawnScatterLogos()`

**Current:** Raw `requestAnimationFrame` loop sets `style.left`, `style.top`, `style.transform` on every frame for every icon (16–32 elements × 2 instances = up to 64 elements). `left`/`top` trigger browser layout recalculation every frame.

**New:** Replace rAF loop with GSAP `gsap.to()` repeating tweens using `x`, `y`, `rotation` (GPU-composited transforms only). Each icon gets its own looping tween with `yoyo: true`, `repeat: -1`, seeded with random duration and phase. No manual `requestAnimationFrame` call; GSAP's shared ticker handles all icons across both instances in one pass.

`cancelAnimationFrame(this.scatterAnimFrame)` in `destroy()` is replaced with `gsap.killTweensOf(icons)`.

**Performance impact:** Removes layout recalculation on every frame. Scatter icons promoted to compositor layer via `will-change: transform` in CSS.

---

### 2. Reveal sequence — `_animateRevealElements()`

**Current:** Fires 8 `classList.add('animate')` calls simultaneously; CSS `animation-delay` on each element provides loose sequencing. No coordination between elements.

**New:** Single GSAP timeline with labelled stages:

```
t=0.00  stage-glow fades in (autoAlpha 0→1, 0.6s)
t=0.10  spotlight-cone--bright sweeps in (scaleY 0→1 + autoAlpha, 0.7s, power3.out)
t=0.20  spotlight-cone--accent sweeps in (0.6s, power2.out) — overlaps bright
t=0.35  spotlight-flare blooms (scale 0→1 + autoAlpha, 0.4s, back.out(1.7))
t=0.40  content-card rises (y: 40→0 + autoAlpha, 0.75s, power3.out)
t=0.55  reveal-info fades up (y: 20→0 + autoAlpha, 0.5s, power2.out)
t=0.65  pickers-row fades up (y: 16→0 + autoAlpha, 0.4s, power2.out)
t=0.70  reveal-actions fades up (y: 16→0 + autoAlpha, 0.4s, power2.out)
t=0.80  skin-heroes animate in (staggered, 0.35s each)
```

`_resetRevealElements()` replaces direct `style.opacity = '0'` / `style.transform = '...'` with `gsap.set()` calls so GSAP owns the state.

---

### 3. "Try another" card swap — `_tryAnother()`

**Current:** CSS class-based 3D flip-out (`swap-out`), raw `wait(350)`, `forceReflow()` trick to reset `.swap-flash`, CSS class-based flip-in (`swap-in`).

**New:** GSAP timeline:

```
spotlight flicker → gsap.to(spotBright/Accent, { autoAlpha: 0.4, duration: 0.15, yoyo: true, repeat: 3 })
card flip-out     → gsap.to(card+info, { rotationY: 90, autoAlpha: 0, duration: 0.3, ease: "power2.in" })
flash burst       → gsap.fromTo(flash, { autoAlpha: 0.8, scale: 1.2 }, { autoAlpha: 0, scale: 1, duration: 0.25 })
[apply new show data here]
card flip-in      → gsap.fromTo(card+info, { rotationY: -90, autoAlpha: 0 }, { rotationY: 0, autoAlpha: 1, duration: 0.45, ease: "power2.out" })
spotlight restore → gsap.to(spotBright/Accent, { autoAlpha: 1, duration: 0.3 })
```

Eliminates all `wait()` calls and the `forceReflow()` hack.

---

### 4. Idle screen re-entrance — `_goHome()`

**Current:** Sets `el.style.animation = 'fadeUp 0.8s ease 0.1s forwards'` and `el.style.opacity = '0'` by string assignment. Breaks on rapid repeated calls (CSS animation doesn't restart).

**New:**

```js
gsap.killTweensOf([title, btn]);
gsap.fromTo(title, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 0.1 });
gsap.fromTo(btn,   { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 0.3 });
```

The `fadeUp` CSS keyframe on these elements is removed (GSAP owns the animation). `killTweensOf` ensures clean restarts every call.

---

### 5. Loading overlay dismiss — `_dismissLoadingOverlay()`

**Current:** Adds CSS class `fade-out` and after 800ms adds `hidden`.

**New:**

```js
gsap.to(overlay, { autoAlpha: 0, duration: 0.8, onComplete: () => overlay.classList.add('hidden') });
```

---

### 6. Skin/theme flash transition — `_switchSkin()` / `_onGenreChange()`

**Current:** `overlay.classList.remove('fire'); forceReflow(overlay); overlay.classList.add('fire')` — relies on a browser reflow hack to restart a CSS keyframe animation.

**New:**

```js
gsap.fromTo(overlay, { autoAlpha: 0.85 }, { autoAlpha: 0, duration: 0.6, ease: "power2.inOut" });
```

The `.fire` CSS keyframe on `.theme-transition` is removed; GSAP drives the flash directly.

---

### 7. Spotlight dim (transition frame) — `_afterVideoEnds()`

**Current:** `spotlightDim.classList.add('animate')` for a CSS-driven sweep, then `classList.remove('animate')` + `style.opacity = '0'`.

**New:** GSAP timeline nested into the reveal sequence — `gsap.fromTo(spotlightDim, { scaleY: 0, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: 0.8, ease: "power3.out" })` then reversed out.

---

## `prefers-reduced-motion`

A module-level `gsap.matchMedia()` instance checks the OS setting once. All animation helper functions accept a `reducedMotion` boolean from this context and pass `duration: 0` to every tween when it is true. This means animations still run (state changes still apply) but are instant — no visual motion.

```js
// top of hbo-stage-reveal.js, module scope
const _mm = gsap.matchMedia();
let _reducedMotion = false;
_mm.add(
  { reduceMotion: '(prefers-reduced-motion: reduce)' },
  (ctx) => { _reducedMotion = ctx.conditions.reduceMotion; }
);
```

Each timeline/tween uses `duration: _reducedMotion ? 0 : <value>`. No per-instance cleanup needed since this is module-level.

---

## Cleanup in `destroy()`

```js
destroy() {
  gsap.killTweensOf(this.root.querySelectorAll('*')); // kill all tweens scoped to this instance
  // ... existing cleanup
}
```

Because two instances run simultaneously, each instance's tweens target elements inside its own `this.root` — no cross-instance interference.

---

## What Does Not Change

- CSS keyframe animations for: particle drift (`.particle`), ambient `grain-overlay` shift, skin-hero `.animate` class transitions — these are simple, performant, and add no overhead.
- All GQL/data-fetching, skin loading, audio, YouTube player logic.
- `styles.css` (page-level demo layout).
- `server.js`.

---

## CSS changes

- Remove `fadeUp` keyframe from `hbo-stage-reveal.css` (replaced by GSAP in `_goHome()`).
- Remove `.swap-out` / `.swap-in` / `.swap-flicker` animation rules (replaced by GSAP in `_tryAnother()`).
- Remove `.fire` keyframe on `.theme-transition` (replaced by GSAP fade).
- Add `will-change: transform` to `.scatter-icon` in CSS.
- Keep all other CSS (spotlight, glow, particle, hero, frame transitions).

---

## Success Criteria

- Scatter logos float smoothly with zero layout recalculation (verified via Chrome DevTools Performance panel — no purple "Layout" bars during scatter drift).
- Reveal sequence elements animate in with precise staggered timing matching the timeline above.
- "Try another" card flips cleanly without `forceReflow` hacks.
- `_goHome()` reliably restarts the idle entrance on every call.
- `destroy()` leaves no dangling tweens (verified by checking `gsap.globalTimeline.getChildren()` count before and after).
- `prefers-reduced-motion: reduce` makes all animations instant.
- No regressions: skin switching, genre/vibe picking, ambient audio, YouTube player, share card all work as before.
