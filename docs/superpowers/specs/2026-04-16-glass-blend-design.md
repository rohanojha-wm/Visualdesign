# Glass Blend Design Spec
**Date:** 2026-04-16
**Project:** visual-design-app
**Feature:** Adaptive glass blend — content blends into skin background

---

## Problem

The content card and info panel render as hard-edged elements floating over the skin background image. Each skin has a distinct full-screen background (`background.avif`/`.jpg`) with unique colors and atmosphere (Batman's dark blue cityscape, Halloween's orange glow, Harry Potter's warm amber, etc.), but the card ignores that context — it looks identical regardless of which skin is active.

The goal is to make the reveal stage feel like one unified scene: the card and info panel blend into the background so that the whole experience feels immersive and skin-aware.

---

## Approach

Pure CSS using `backdrop-filter: blur()`. No JS, no canvas color extraction, no per-skin configuration. `backdrop-filter` composites against whatever pixels are rendered behind an element in real time — so it automatically picks up the skin background's colors. Batman background → blue-tinted glass. Halloween → orange-tinted. Harry Potter → amber. Zero maintenance.

---

## Changes

All changes are in `hbo-stage-reveal.css` only. No JS changes, no new HTML.

### 1. Wider card edge mask

Extends the existing `mask-image` fade zones on `.content-card` so more of the skin's background image bleeds through around the card perimeter.

**Current values:**
```css
mask-image:
  linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 88%, transparent 100%);
```

**New values:**
```css
mask-image:
  linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
```

Side fade: 9% → 16%. Bottom fade starts at 88% → 78% (fades earlier, exposing more background).

**Effect:** Batman's city and Harry Potter's castle visually bleed into the card edges, making the card feel embedded in the scene rather than placed on top of it.

---

### 2. Subtle glass surface on card

Adds a `::after` pseudo-element on `.content-card` — an almost invisible frosted glass layer that sits above the poster image.

```css
.hbo-stage .content-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  pointer-events: none;
  border-radius: inherit;
}
```

Also adds a hairline glass border to the card rule:
```css
border: 1px solid rgba(255, 255, 255, 0.08);
```

**Effect:** The poster stays fully readable. The card surface gets a barely-perceptible glass sheen — enough to distinguish it as a glass panel rather than a flat solid box. The border defines the glass edge cleanly.

**Note:** The `z-index: 10` ensures the glass layer sits above the poster image (`z-index: 1`) but remains `pointer-events: none` so clicks pass through to the poster link.

---

### 3. Glass info panel

`.reveal-info` (the title + description block below the card) currently has no background. Adding `backdrop-filter` turns it into a frosted glass panel that automatically matches the skin's color.

```css
.hbo-stage .reveal-info {
  /* existing: margin-top, opacity, transform preserved */
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 16px 28px 20px;
}
```

**Effect:** The info panel becomes a frosted glass chip. Behind Batman's blue background → blue-tinted. Behind Halloween's orange → warm-tinted. Text remains fully readable (white on semi-dark glass). No per-skin rules needed.

---

### 4. Glass secondary buttons

`.btn-secondary` (Try Another, Watch Trailer, Share) already has `background: transparent`. Adding `backdrop-filter` gives them the same frosted glass style as `.btn-start` on the idle screen, which already uses this pattern.

**Add to `.hbo-stage .btn-secondary`:**
```css
background: rgba(255, 255, 255, 0.06);
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
```

**Effect:** Buttons feel like glass chips floating over the scene rather than flat transparent outlines. Consistent with the idle screen's start button.

---

## What Is NOT Changing

- No changes to `.btn-primary` (Watch Now) — it uses the skin's accent color intentionally
- No changes to `skin.json`, `skin.css`, or any per-skin files
- No changes to `hbo-stage-reveal.js`
- No changes to the card's HTML structure
- No new GSAP animations (existing reveal timeline is unaffected)
- The existing `box-shadow` glow on the card is preserved

---

## Browser Compatibility

`backdrop-filter` is supported in all modern browsers (Chrome 76+, Safari 9+, Firefox 103+, Edge 79+). The `-webkit-` prefix covers Safari. No fallback needed for this app's target audience.

---

## Success Criteria

- On any skin switch, the info panel and card edges visually pick up the background image color without any per-skin code
- Poster image remains clearly readable through the glass card surface
- Info panel text (title, description) is legible over the frosted glass background
- Buttons feel consistent with the idle screen's glass style
- No visual regression on the default skin (dark background)
