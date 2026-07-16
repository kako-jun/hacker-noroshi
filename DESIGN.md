# DESIGN.md

Hacker Noroshi — Design System

## 1. Visual Theme & Atmosphere

Faithful Hacker News clone. The design is intentionally minimal — a direct reproduction of the original HN aesthetic with Japanese language support. No gradients, no shadows, no decorative elements. Information density and readability are the only goals. The orange header is the sole visual identity.

Inspirations: Hacker News (news.ycombinator.com), early 2000s web forums, plain HTML.

### Core Principle: Visual Fidelity, Modern Implementation

**Match HN visually pixel-by-pixel, but implement with modern CSS** (flex, grid, semantic HTML). Do not reproduce HN's 2007-era table-based layout (`<table id="hnmain">`, nested `<tr.comtr><td.ind>` for comments, etc.). The user-visible result must be indistinguishable; the DOM does not need to be.

Concretely:
- Comment nesting: `padding-left: depth * 40px` on `<div>`, not nested `<table>`.
- Page container: flex/block layout, not `<table id="hnmain">`.
- Forms: HTML `<table>` is acceptable here because forms are small and the table layout actually maps to "label / input" pairs cleanly. This is not legacy — it's the right tool.
- CSS class names: own naming is fine. We do not need to mirror HN's `athing`/`commtext`/`sitebit` etc.

When Issue / CLAUDE.md says "match HN exactly," it refers to the **rendered result**, not the markup.

## 2. Color Palette & Roles

Hardcoded CSS values. No variables, no tokens.

| Color     | Hex       | Usage                              |
| --------- | --------- | ---------------------------------- |
| Orange    | `#ff6600` | Header bg, voted indicator (up/down), hover |
| Cream     | `#f6f6ef` | Centered container (85% / #hnmain) background |
| Black     | `#000000` | Primary text, titles               |
| Gray      | `#828282` | Meta text, timestamps, visited links, faded comments (downvoted) |
| Light gray | `#9a9a9a` | Inactive upvote arrow              |
| Red       | `#ff0000` | Error messages                     |
| White     | `#ffffff` | Header text, logo border, body/outer frame (PC: shown around the 85% container) |

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
| Logo/site name | 10pt | bold   | HN `.pagetop b.hnname` に一致 |
| Body default  | 10pt  | normal |                    |
| Item text     | 9pt   | normal | Line-height: ブラウザ既定 (1.2)。本家 HN news.css も未指定 |
| Form inputs   | 10pt  | normal | Monospace（HN `input` に一致） |
| Buttons/small | 8pt   | normal |                    |
| Metadata      | 7pt   | normal | Timestamps, meta   |

Base font size is `10pt` on html/body. Everything is in `pt`, not `rem` or `px`.

### Locale Labels (Issues #133, #138)

UI labels support English and Japanese without changing routes, behavior, spacing, color, or typography.
The visual system stays HN-faithful; only display strings change.

- English mode renders HN-style labels and keeps Japanese `title` tooltips for discoverability.
- Japanese mode renders the same actions in Japanese and uses English `title` tooltips where useful.
- Label dictionaries live in `src/lib/i18n.ts`. Add stable label keys there instead of hardcoding route-local strings.
- Locale must not fork behavior. English and Japanese labels map to the same routes, actions, and story types.
- Dynamic text such as time-ago remains controlled by its formatter unless that formatter is explicitly localized.

### Assistance Layer — Assist Mode (Issues #139, #140)

Hacker Noroshi adds an operation-assist layer ("assist mode") that Hacker News itself does not have. **Goal: a Japanese user who does not know HN culture can learn the whole flow here until they can operate the real (English) Hacker News.** Copy teaches the culture (not just labels) and is written to graduate the user to the real HN. It must be visually separate from the HN-faithful core and fully removable.

- **Persistent toggle, not a tour.** A switch fixed at the bottom-right (scroll-following) turns assist mode on/off at any time; state persists in an `assist` cookie. No one-time tour, no dismiss-×, no progress tracking. SSR renders the on/off state from the cookie (no flash); the client toggles instantly and re-writes the cookie.
- **"Why this exists" link sits beside the toggle (#160), with meta copy above it (#170).** The bottom-right control is a fixed **column** dock (`.assist-dock`, right-aligned) whose lower row (`.assist-dock-controls`) is a flex pair of a circular info ⓘ link (`.assist-about`, left) and the assist switch (right). The ⓘ link opens the llll-ll article explaining Hacker Noroshi's purpose (a safe Japanese practice ground for HN etiquette before going global) in a new tab; its URL is locale-aware (`https://llll-ll.com/ja/posts/hacker-noroshi/` vs `/posts/hacker-noroshi/`). The ⓘ + switch are **always visible regardless of assist on/off** (not gated by `.assist-on`) and use the same non-orange blue/white assist styling. `.assist-dock` itself is `pointer-events: none` — the meta text and the gap between it and the controls row must never steal clicks from real page content sitting underneath (e.g. a comment's toggle link, when the dock's box happens to overlap it on a short viewport); only `.assist-dock-controls` restores `pointer-events: auto` since that's the one part with real interactive elements (#177).
- **When on**, each screen shows a short top explainer (one or two sentences naming what the screen is), and controls get nearby hints (what to write / what a button does / the HN convention behind it). Details are carried by the control-adjacent hints, not the top explainer. **When off**, the plain HN page is fully restored — assist elements are gated by a `.assist-on` ancestor class and hidden otherwise; nothing else changes.
- **Intro is centralized in the layout, covering every route.** The screen explainer (`.assist-intro`) is a pure function of the current route, so `+layout.svelte` renders it once by looking up `page.route.id` in `assistIntro()` (empty key → not rendered). Routes must NOT each hardcode `<p class="assist-intro">…</p>` — that is the webbed-UI duplication guideline #3 forbids. The `ASSIST_INTRO` dictionary now enumerates **all** route ids (lists, comment, signup, leaders, faq, etc.); adding assist for a new page = add a dictionary key keyed by its route id; no page edit needed.
- **Control hints are one button, one hint, listed below their row (#172).** Each control has its own single-sentence hint keyed per element (e.g. `story.upvote`/`story.hide`/`story.un-hide`/`story.flag`/`story.comments`, `item.upvote`/`item.favorite`/`item.hide`/`item.flag`/`item.edit`/`item.delete`/`item.comment-toggle`/`item.reply`), not one paragraph bundling several concepts under a row. `story.hide` and `story.un-hide` are distinct keys (not one key reused for both directions) — `StoryListItem` picks the key by which action the button actually performs (`onunhide` prop present → un-hide), so the hint text never says the opposite of what the button does. Form fields keep inline `.assist-hint`; row/action controls collect the hint keys that apply to that row/control-group into an array and render them **once, immediately after the row, as an ordinary block-level list** — a `<div class="assist-hint-list">` (flex column, `.assist-on` gated) containing one `.assist-hint` `<div>` per applicable key, in the same left-to-right order the controls appear in the row. This replaced an earlier design (`.assist-anchor` + `.assist-hint-float` position-absolute, with `.assist-stagger-1..4` / `.assist-stagger-below-meta` / `.assist-stagger-below-item-meta` fixed-px offset variants meant to stack same-line hints without overlapping). That design needed a hand-measured px offset per anchor/stack combination and broke repeatedly in self-review — `story.upvote` landing on unrelated rows several lines down, `item.upvote` landing on comment text, and hints overflowing the viewport on narrow screens (#174) — because a fixed offset cannot track the real row height, hint count, or viewport width. Plain document flow has no such failure mode: siblings push each other down instead of overlapping, and block width is bounded by the container, so it never overflows. Hints that would otherwise repeat per row appear once: the story-row hint list renders only on the first *rendered* list row (`StoryList` passes `assistFirst` to the first non-hidden story, so it still shows on page 2, on `/search` where no rank is passed, and after the top row is hidden); the item-meta hint list (which also carries `item.upvote`, even though that button sits above the `.item-meta` row) renders once right after `.item-meta`; the item-comment hint list (`item.comment-toggle`/`item.reply`) renders once right after the first comment row. `item.reply` only joins that list while the first comment is expanded — collapsing it hides the real reply link too, so the hint is dropped along with it rather than pointing at a link that no longer exists (#175). `/comment/[id]` (comment mode) has its own action row (`.comment-head` on the target comment: upvote/edit/flag/vouch), which previously had no hints at all; it now gets the same treatment with dedicated `comment.upvote`/`comment.edit`/`comment.flag`/`comment.vouch` keys (not the `item.*` ones — same "screen.control" keying convention as `story.upvote` vs `item.upvote`) rendered once right after that row (#175).
- **Meta copy (lang / assist / karma) renders at the dock, not the top.** `meta.controls` (+ `meta.karma`, logged-in only) is no longer drawn under the header. It renders as `.assist-meta` **above** the ⓘ + switch in the bottom-right dock, **right-aligned**, only on pages that have an intro (now effectively always, since every route has one) and only while assist is on (`.assist-on .assist-meta`). It teaches the assist switch itself, the ⓘ, the top-right language link, and the `(123)` karma (logged-in only).
- **Visual = FF「初心者の館」message window**: solid blue gradient background, white border, white text, a modest drop shadow. Do NOT use HN orange (`#ff6600`). Do NOT use fake glass / `backdrop-filter` (meaningless over the flat cream page) or AI-cliché colored left-accent bars.
- **Bilingual, practice-oriented copy.** Lead with the localized label the user actually sees, then teach the HN English term in parentheses — e.g. 質問（本家では「Ask」）, 作ったもの（Show）, 新着（new）, カルマ（karma）, and UI verbs the localized buttons show: 非表示（hide）, 通報（flag）, お気に入り（favorite）, 編集（edit）, 削除（delete）, 返信（reply）, 復活（vouch）. English mode already uses the HN terms. Copy lives in `src/lib/assist.ts` (ja/en), keyed by route id for intros and by `screen.control` for hints, same definition-data style as `i18n.ts`.
- This is the explicit exception to the core no-shadow / no-gradient / no-transition rules; the exception applies only to the assist layer.

## 4. Component Stylings

### Header

- Background: `#ff6600`
- Layout: flex, `align-items: center`, `gap: 4px`
- Line-height: `12px` (HN `.pagetop` に一致 — pt統一の例外)
- Logo: `18x18px` WebP image (`/icon-32.webp`) wrapped in `20x20px` container with `1px solid white` border
- Navigation: items separated by `|` with `3px` margins
- All links: `#000000`, no underline

### Story Item

- Layout: flex, baseline alignment
- Rank: `min-width: 30px`, right-aligned, `#828282`
- Upvote: `▲` (Unicode `&#9650;`), `10x10px`, default `#9a9a9a`, hover/voted `#ff6600`
- Title: `10pt`、line-height はブラウザ既定（HN news.css も未指定）。`@media (max-width: 750px)` では `11pt`/`14pt` に拡大（HN mobile @media に一致）
- Meta line height: ブラウザ既定。`@media (max-width: 750px)` では meta も `9pt` に拡大
- Domain tag: `8pt`, `#828282`, `margin-left: 5px`
- Meta line: `7pt`, `#828282`（mobile では `9pt`、HN mobile に一致）

### Comments

- Nesting: `40px` left padding per depth level
- Head: `8pt`, `#828282` (HN `.comhead` に一致)
- Upvote: `▲` (`&#9650;`), `8pt`, default `#9a9a9a`, hover/voted `#ff6600`
- Downvote: `▼` (`&#9660;`), `8pt`, default `#9a9a9a`, hover/voted `#ff6600`（karma >= 500 のみ表示）
- Text: `9pt`, `#000000`, line-height はブラウザ既定（HN news.css も未指定）
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
- Item/comment text inner padding: `18px`
  - 適用クラス: `.item-meta` / `.item-text` / `.comment-text` / `.comment-reply` / `.comment-form` / `.comment-error`
  - 目的: タイトル本文・ストーリー本文・コメント本文の x を揃える（本家 HN の階段パターン）。タイトル行の vote arrow + マージン分の幅に相当
  - これらの class が出る箇所では原則 inline `padding-left` を打たず、CSS 集約に任せる
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

At ≤ 750px, the orange header allows `flex-wrap: wrap` so the navigation drops onto a second line below the site name (matching HN's natural inline-wrap behaviour). The site name itself uses `white-space: nowrap` to prevent mid-word breaks of 「ハッカーのろし」.

At ≤ 750px, fixed-width form inputs (`300px` text, `500px` textarea) and the form's `40px` left padding shrink to fit the viewport (`width: 100%; max-width: <original>` and `padding-left: 10px`) so the page doesn't horizontally overflow on phones. Original desktop widths are preserved for ≥ 750px.

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
- Verdana font, pt-based sizes (10pt body, 7-10pt range)
- `#ff6600` orange is the ONLY accent color
- `#828282` gray for everything secondary
- No CSS framework concepts — raw CSS, table layouts for forms
- SvelteKit + Cloudflare D1 backend
- Japanese language support via system fonts
- Upvote triangle: Unicode `▲` character, not an icon library
- Comment nesting via incremental left padding (40px per level)
- No animations, no transitions, no shadows — instant state changes only
- Single responsive breakpoint at 750px (width switch only)
