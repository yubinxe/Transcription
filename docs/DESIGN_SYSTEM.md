# Design System

**Editorial Minimalism × Contemporary Typography × Quiet Luxury.** The page should read like a well-set humanities book, operate like precise productivity software.

## Tokens (`src/app/globals.css`)
| Token | Value | Role |
|---|---|---|
| canvas | #F8F7F3 | page |
| surface | #FFFFFF | inputs, hover rows |
| ink | #252924 | text, structural rules |
| muted | #6B6E67 | secondary text (darkened from #777A73 for ≥4.5:1 on canvas) |
| forest | #315747 | primary action, selected/active state only |
| sage / sage-soft | #DCE5DC / #EAF0EA | selection, current spoken sentence |
| gold | #AA8660 | quotations, edited marks, numerals — meaning only |
| border / rule | #E7E5DF / #D9D6CE | hairlines |

## Type
- MaruBuri (Naver, OFL) — titles, reading surface, quotations. Self-hosted, split into a KS X 1001 core subset (~200 KB) + extended Hangul loaded only when needed (`scripts/subset-maruburi.py`).
- Pretendard Variable (OFL) — UI, dynamic-subset woff2.
- Reading: 15–24 px (default 18), line-height 1.65/1.8/2.0, measure 36/44/60 rem. `word-break: keep-all` for Korean.

## Composition
- 12-column grid, max 1320 px, 20 px mobile gutter / 40 px desktop.
- Sections open with a 1 px ink rule; lists separated by hairlines — no card stacks.
- One focal point per section (hero headline; Day numerals; the reading column).

## Motion
120–240 ms, `cubic-bezier(.2,.7,.2,1)`. Fade + 3 px rise only. `prefers-reduced-motion` honoured globally.

## Do not
Gradients, glass, glow, 3D objects, decorative religious imagery, large radii, shadow stacks, fake stats.
