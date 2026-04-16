# DESIGN.md

Hacker Noroshi — Design System

## 1. Visual Theme & Atmosphere

Faithful Hacker News clone. The design is intentionally minimal — a direct reproduction of the original HN aesthetic with Japanese language support. No gradients, no shadows, no decorative elements. Information density and readability are the only goals. The orange header is the sole visual identity.

Inspirations: Hacker News (news.ycombinator.com), early 2000s web forums, plain HTML.

## 2. Color Palette & Roles

Hardcoded CSS values. No variables, no tokens.

| Color     | Hex       | Usage                              |
| --------- | --------- | ---------------------------------- |
| Orange    | `#ff6600` | Header bg, voted indicator (up/down), hover |
| Cream     | `#f6f6ef` | Page background                    |
| Black     | `#000000` | Primary text, titles               |
| Gray      | `#828282` | Meta text, timestamps, visited links, faded comments (downvoted) |
| Light gray | `#9a9a9a` | Inactive upvote arrow              |
| Red       | `#ff0000` | Error messages                     |
| White     | `#ffffff` | Header text, logo border           |

Links: `#000000` (unvisited), `#828282` (visited). Hover: underline only.

## 3. Typography Rules

### Font Family

| Context    | Family                              |
| ---------- | ----------------------------------- |
| UI/body    | `Verdana, Geneva, sans-serif`       |
| Forms/code | `monospace`                         |

### Type Scale (in pt)

| Element       | Size  | Weight | Notes              |
| ------------- | ----- | ------ | ------------------ |
| Logo/site name | 11pt | bold   |                    |
| Body default  | 10pt  | normal |                    |
| Item text     | 9pt   | normal | Line-height 14pt   |
| Form inputs   | 9pt   | normal | Monospace           |
| Buttons/small | 8pt   | normal |                    |
| Metadata      | 7pt   | normal | Timestamps, meta   |

Base font size is `10pt` on html/body. Everything is in `pt`, not `rem` or `px`.

## 4. Component Stylings

### Header

- Background: `#ff6600`
- Layout: flex, `align-items: center`, `gap: 4px`
- Line-height: `12pt`
- Logo: `18x18px` WebP image (`/icon-32.webp`) wrapped in `20x20px` container with `1px solid white` border
- Navigation: items separated by `|` with `3px` margins
- All links: `#000000`, no underline

### Story Item

- Layout: flex, baseline alignment
- Rank: `min-width: 30px`, right-aligned, `#828282`
- Upvote: `▲` (Unicode `&#9650;`), `10x10px`, default `#9a9a9a`, hover/voted `#ff6600`
- Title: `10pt`, line-height `14pt`
- Domain tag: `8pt`, `#828282`, `margin-left: 5px`
- Meta line: `7pt`, `#828282`

### Comments

- Nesting: `40px` left padding per depth level
- Head: `7pt`, `#828282`
- Upvote: `▲` (`&#9650;`), `8pt`, default `#9a9a9a`, hover/voted `#ff6600`
- Downvote: `▼` (`&#9660;`), `8pt`, default `#9a9a9a`, hover/voted `#ff6600`（karma >= 500 のみ表示）
- Text: `9pt`, `#000000`, line-height `14pt`
- Faded text: `#828282`（points < 1 のコメント）
- Reply link: `7pt`, `#828282`, underline

### Forms

- Container: `padding: 10px 0 10px 40px`
- Table layout with `border-spacing: 0`
- Labels: right-aligned, `#828282`
- Text input: `300px` width, monospace
- Textarea: `500px` or `60%` width, monospace
- Buttons: `8pt`, Verdana, browser defaults

### Footer

- `text-align: center`, `padding: 20px 0`
- `border-top: 2px solid #ff6600`
- `8pt`, `#828282`

## 5. Layout Principles

### Container

- Width: `85%` centered
- Mobile (< 750px): `100%`

### Spacing

Minimal, functional:
- Story items: `5px 0` padding
- First item: `10px 0`
- Comment nesting: `40px` per level
- Form indent: `40px` left padding
- Footer: `margin-top: 10px`

## 6. Depth & Elevation

None. Completely flat design.

- No shadows
- No gradients
- No border-radius
- No backdrop effects
- Z-index: not used

## 7. Do's and Don'ts

### Do

- Use `pt` units for font sizes (not px, not rem)
- Keep all text in Verdana
- Use `#ff6600` orange exclusively for header and voted state
- Apply `#828282` gray for all secondary/meta information
- Use table layout for forms (traditional HTML pattern)
- Indent comments by `40px` per nesting level
- Keep the design information-dense — minimal spacing

### Don't

- Add shadows, gradients, or decorative effects
- Use border-radius on any element
- Add custom font imports
- Apply hover effects beyond underline on links and color change on upvote
- Use transitions or animations
- Add responsive breakpoints beyond the single 750px width switch

### Transitions

None. All state changes are instantaneous.

## 8. Responsive Behavior

### Breakpoints

Single breakpoint:

| Width    | Layout      |
| -------- | ----------- |
| > 750px  | `85%` width |
| ≤ 750px  | `100%` width |

No other responsive adaptations. Form inputs keep fixed widths.

## 9. Agent Prompt Guide

### Color Quick Reference

```
Orange header:  #ff6600
Page bg:        #f6f6ef
Text:           #000000
Meta/gray:      #828282
Upvote idle:    #9a9a9a
Error:          #ff0000
```

### When generating UI for this project

- This is a Hacker News clone. Match HN's design exactly
- Verdana font, pt-based sizes (10pt body, 7-11pt range)
- `#ff6600` orange is the ONLY accent color
- `#828282` gray for everything secondary
- No CSS framework concepts — raw CSS, table layouts for forms
- SvelteKit + Cloudflare D1 backend
- Japanese language support via system fonts
- Upvote triangle: Unicode `▲` character, not an icon library
- Comment nesting via incremental left padding (40px per level)
- No animations, no transitions, no shadows — instant state changes only
- Single responsive breakpoint at 750px (width switch only)
