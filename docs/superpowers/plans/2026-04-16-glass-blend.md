# Glass Blend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reveal card and info panel blend into the skin background image using `backdrop-filter`, adapting automatically to every skin's unique colors.

**Architecture:** Pure CSS changes to `hbo-stage-reveal.css` only — no JS, no HTML changes. `backdrop-filter: blur()` composites against whatever pixels are rendered behind an element at runtime, so it auto-adapts to all skin backgrounds (Batman blue, Halloween orange, Harry Potter amber, etc.) without any per-skin configuration.

**Tech Stack:** CSS `backdrop-filter`, CSS `mask-image`

---

## File Structure

- Modify: `visual-design-app/hbo-stage-reveal.css`
  - Task 1: update `.content-card` mask-image values
  - Task 2: add `.content-card::after` rule + `border` to `.content-card`
  - Task 3: update `.reveal-info` rule with glass properties
  - Task 4: update `.hbo-stage .btn-secondary` rule with glass properties

No other files are modified.

---

### Task 1: Widen card edge mask

**Files:**
- Modify: `visual-design-app/hbo-stage-reveal.css` — `.content-card` rule (around line 882)

The card already has a `mask-image` that fades left/right/bottom edges so the skin's scatter icons bleed through. We widen these fade zones so more of the skin background image bleeds into the card perimeter.

- [ ] **Step 1: Find the current mask values**

Read `hbo-stage-reveal.css` and locate `.hbo-stage .content-card`. Note the current `mask-image` and `-webkit-mask-image` values:
```css
-webkit-mask-image:
  linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 88%, transparent 100%);
mask-image:
  linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 88%, transparent 100%);
```

- [ ] **Step 2: Replace with wider fade zones**

Replace both `mask-image` and `-webkit-mask-image` with:
```css
-webkit-mask-image:
  linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
-webkit-mask-composite: source-in;
mask-image:
  linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%),
  linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
mask-composite: intersect;
```

Changes: left/right fade 9% → 16%; bottom fade starts at 88% → 78% (earlier fade = more background showing through at the bottom).

- [ ] **Step 3: Visual verification**

Start the server (`node server.js` from the project root) and open the app. Switch to any themed skin (batman, harry-potter, etc.). The skin's background image should be more visible bleeding through the card's left, right, and bottom edges compared to before. The center of the card (poster area) should be unaffected.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rojha/Documents/Ignite Q2 2026/repo/visual-design-app"
git -c commit.gpgsign=false add hbo-stage-reveal.css
git -c commit.gpgsign=false commit -m "style: widen content-card edge mask for deeper background bleed"
```

---

### Task 2: Subtle glass surface on card

**Files:**
- Modify: `visual-design-app/hbo-stage-reveal.css` — `.content-card` rule (add `border`) and new `.content-card::after` rule

Adds a nearly invisible frosted glass layer over the poster image, giving the card a glass-panel quality. Also adds a hairline glass border to define the card edge.

- [ ] **Step 1: Add `border` to `.hbo-stage .content-card`**

Inside the existing `.hbo-stage .content-card` rule, add one line after `transition: box-shadow 0.8s ease;`:
```css
border: 1px solid rgba(255, 255, 255, 0.08);
```

The full rule should now include:
```css
.hbo-stage .content-card {
  width: var(--card-width);
  aspect-ratio: 16 / 9;
  border-radius: var(--card-radius);
  overflow: hidden;
  position: relative;
  opacity: 0;
  transform: scale(0.95);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(var(--accent-rgb), 0.3),
    0 0 120px rgba(var(--accent-rgb), 0.15);
  transition: box-shadow 0.8s ease;
  border: 1px solid rgba(255, 255, 255, 0.08);   /* ← new */
  /* mask-image rules below (from Task 1) */
  -webkit-mask-image: ...;
  mask-image: ...;
}
```

- [ ] **Step 2: Add `.hbo-stage .content-card::after` rule**

Add this new rule immediately after the `.hbo-stage .content-card` closing brace:
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

**Why `z-index: 10`:** The poster image inside `.card-placeholder` uses `z-index: 1`. The `::after` must sit above it. The `.card-placeholder::after` gradient overlay uses `z-index: 2` — this glass layer at z-index 10 sits above both, but `pointer-events: none` ensures clicks still reach the poster link.

**Why `border-radius: inherit`:** The card has `border-radius: var(--card-radius)` and `overflow: hidden`. `inherit` ensures the glass layer follows the card's corner radius exactly. The `overflow: hidden` on the parent clips this pseudo-element to the card bounds automatically.

- [ ] **Step 3: Visual verification**

Open the app and trigger the reveal (click the start button). The content card should look almost identical to before — the glass layer is very subtle (2.5% white opacity, 1px blur). What to look for: the card surface has a very slight brightening/sheen compared to before, and the hairline border is faintly visible at the card edge. The poster image should remain fully readable.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rojha/Documents/Ignite Q2 2026/repo/visual-design-app"
git -c commit.gpgsign=false add hbo-stage-reveal.css
git -c commit.gpgsign=false commit -m "style: add glass surface layer and hairline border to content-card"
```

---

### Task 3: Glass info panel

**Files:**
- Modify: `visual-design-app/hbo-stage-reveal.css` — `.reveal-info` rule (around line 1001)

Turns the title+description block below the card into a frosted glass panel that automatically picks up the skin background's color via `backdrop-filter`.

- [ ] **Step 1: Find the current `.reveal-info` rule**

Locate `.hbo-stage .reveal-info` in `hbo-stage-reveal.css`. Currently it looks like:
```css
.hbo-stage .reveal-info {
  margin-top: 20px;
  opacity: 0;
  transform: translateY(12px);
}
```

- [ ] **Step 2: Add glass properties**

Replace it with:
```css
.hbo-stage .reveal-info {
  margin-top: 20px;
  opacity: 0;
  transform: translateY(12px);
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 16px 28px 20px;
}
```

Do NOT remove `opacity: 0` and `transform: translateY(12px)` — these are the initial hidden state used by the GSAP animation (`_resetRevealElements` sets these via `gsap.set`, and `_animateRevealElements` animates them to visible). Removing them would break the reveal animation.

- [ ] **Step 3: Visual verification**

Trigger the reveal on each skin (default, batman, halloween, harry-potter). In each case:
- The info panel (show title + description) should appear as a rounded frosted glass chip below the card
- The panel's tint should differ per skin — slightly bluish behind Batman's dark blue background, slightly warm behind Halloween's orange, etc.
- Title and description text must remain legible (white/grey text on the semi-dark glass)
- The panel should animate in correctly during the reveal (same timing as before — it's still driven by the same GSAP timeline)

- [ ] **Step 4: Commit**

```bash
cd "/Users/rojha/Documents/Ignite Q2 2026/repo/visual-design-app"
git -c commit.gpgsign=false add hbo-stage-reveal.css
git -c commit.gpgsign=false commit -m "style: apply backdrop-filter glass to reveal-info panel"
```

---

### Task 4: Glass secondary buttons

**Files:**
- Modify: `visual-design-app/hbo-stage-reveal.css` — `.hbo-stage .btn-secondary` rule (around line 1093)

Gives "Try Another", "Watch Trailer", and "Share" buttons a frosted glass background — consistent with the idle screen's "Start" button (`.btn-start`) which already uses this exact pattern.

- [ ] **Step 1: Find the current `.btn-secondary` rule**

Locate `.hbo-stage .btn-secondary` in `hbo-stage-reveal.css`. Currently:
```css
.hbo-stage .btn-secondary {
  background: transparent;
  color: var(--btn-secondary-color);
  border: 1px solid var(--btn-secondary-border);
  transition: all 0.4s ease;
}
```

- [ ] **Step 2: Replace `background: transparent` with glass properties**

Replace the rule with:
```css
.hbo-stage .btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--btn-secondary-color);
  border: 1px solid var(--btn-secondary-border);
  transition: all 0.4s ease;
}
```

Do NOT change `.btn-secondary:hover` — the hover state already has its own border/color changes which remain correct.

- [ ] **Step 3: Visual verification**

After the reveal, check the action buttons row ("Watch Trailer", "Try Another", "Share"):
- Buttons should have a very subtle frosted glass background rather than being completely transparent
- They should still show the border and text correctly
- On hover they should still highlight (border brightens, scale up) — hover styles are unchanged
- Compare with the idle screen's "Start" button: they should have a similar glass quality

- [ ] **Step 4: Commit**

```bash
cd "/Users/rojha/Documents/Ignite Q2 2026/repo/visual-design-app"
git -c commit.gpgsign=false add hbo-stage-reveal.css
git -c commit.gpgsign=false commit -m "style: apply backdrop-filter glass to secondary action buttons"
```

---

## Self-Review Checklist

After all 4 tasks, do a quick pass:

- [ ] Switch between all 5 skins (default, batman, halloween, harry-potter, game-of-thrones) and verify the glass effect adapts (panel tint changes, not identical across all skins)
- [ ] Verify poster image is still clearly readable through the card glass surface
- [ ] Verify the reveal animation still plays correctly (card scales up, info slides up, buttons fade in)
- [ ] Verify no visual regression on the idle screen (the `.btn-start` was already glass — should look the same or better)
- [ ] Check mobile viewport (if responsive breakpoints exist in CSS — the `reveal-info` panel has a responsive rule at ~line 1550, verify the glass properties don't break it)
