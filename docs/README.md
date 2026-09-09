# Handoff: Min Journal

## Overview
Min Journal is a single-user trading journal built around **CRT (Candle Range Theory)**. Every trade is logged against a higher-timeframe candle's range, in the order the method is actually read: HTF pairing → range (high/low) → sweep (purge) of one side → expansion toward the other side → execution → result. The app turns those logs into performance stats (by model, session, sweep side), a daily P&L heatmap calendar, and a weekly review.

Scope agreed with the design owner:
- Trade entry with automatic R calculation from entry/stop/target
- Dashboard metrics that recompute from the log
- Calendar with month navigation and per-day tooltips/detail
- Trade detail screen
- Chart-screenshot attachments (storage)
- Trade log with working filters and sorting
- CSV import/export
- Weekly review screen
- Capital tab: starting capital, deposits/withdrawals ledger, and a 1R value that scales with the balance
- Responsive: one codebase serving desktop and mobile

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, copy, and behavior. They are **not production code to copy directly**. The task is to recreate these designs in the target codebase's existing environment (React, Vue, SwiftUI, native, etc.) using its established component library, routing, and state patterns. If no codebase exists yet, pick the framework most appropriate for the project (a React + TypeScript SPA with local-first storage is a reasonable default for this app) and implement the designs there.

`CRT Journal.dc.html` is a design canvas: four labelled option cards (1a–1d) sitting side by side on one page. It is **not** an app shell — do not port the canvas chrome (`.dv-turn`, `.dv-card`, id badges, the intro paragraphs, the phone bezels). Port only what is inside each mock.

## Fidelity
**High-fidelity.** Colors, typography, radii, spacing, and copy are final. Recreate the UI closely, substituting the codebase's own primitives where they already exist (buttons, inputs, segmented controls, cards). Where a value below is given as a hex or px, it is intentional.

Language: desktop screens (1a–1c) are in **English**; the mobile screens (1d) are in **Korean**. The product is intended to be localized — treat all copy as translatable strings (ko + en), not hardcoded text.

## Screens / Views

### 1. Dashboard (design ref: card `1a`, desktop, authored at 1200px wide)
**Purpose** — the month at a glance: cumulative R, hit rate, what's working, what to stop doing.

**Layout** — page background `#f4f5f7`. A white top bar (`#fff`, 20px 32px padding) spans full width. Content below it is a single 32px-padded column of stacked white cards with 16px gaps:
1. **Hero card** — radius 24, padding 32/36. Two columns: `340px` fixed (headline number) + `1fr` (equity curve), 40px gap, vertically centered.
2. **Stat row** — 4 equal columns, 16px gap. Each card radius 20, padding 22/24.
3. **Two-up row** — `1fr 1fr`, 16px gap: "Performance by model" and "Session · sweep side".
4. **Recent trades card** — radius 24, padding 26/28/12.

**Components**
- *Top bar*: wordmark "Min Journal" — 800 17px, `#191f28`, letter-spacing −.03em. Nav items 600 14px; active item has `#f2f4f6` fill, radius 10, padding 8/14, ink `#191f28`; inactive `#8b95a1` with no fill. Right side: month label ("September 2026", 600 13px `#8b95a1`) and primary button "New trade" — `#3182f6` fill, `#fff` 700 14px, padding 11/18, radius 12.
- *Hero*: label "Month to date" (600 14px `#8b95a1`); value "+18.4R" — 800 56px/1.1, letter-spacing −.04em, colored by sign (see P&L colors). Below it three pill chips (600 12px `#4e5968`, `#f2f4f6` fill, radius 8, padding 6/10, 8px gap): trade count, win rate, expectancy.
- *Equity curve*: inline SVG, 720×180 viewBox, `preserveAspectRatio="none"`, height 180px. 3px stroke in the P&L color, round joins/caps, plus a same-color area fill fading to 0 opacity (top stop 16%). End point marked with an r=5 dot. Axis captions below: 500 11px `#b0b8c1`, left = period start, center = max drawdown, right = period end. Recreate with the codebase's chart library if it can match this treatment (no gridlines, no axes, no tooltip in the mock — a hover tooltip showing date + cumulative R is a welcome addition).
- *Stat cards*: label 600 13px `#8b95a1`; value 800 30px, letter-spacing −.03em, 6px above-gap. Four metrics: Avg win, Avg loss, Win streak, Rule adherence.
- *Performance by model*: title 700 16px `#191f28`, letter-spacing −.02em. Rows (18px gap): name + signed R on one line (600 14px `#333d4b`, R colored by sign); progress bar below — 8px tall track `#f2f4f6`, radius 99px, fill in the sign color, width = share of best model's absolute R; sub-caption 500 11.5px `#b0b8c1` ("24 trades · 62% win rate"). Off-plan rows carry an extra note ("· off-plan entries").
- *Session · sweep side*: three tiles in a 3-col grid, 12px gap — `#f9fafb` fill, radius 16, padding 18: session name (600 12px `#8b95a1`), signed R (800 22px, sign color), trade count (500 11px `#b0b8c1`). Below a 1px `#f2f4f6` divider (24px margins), three neutral win-rate bars (same bar spec, fill `#191f28`; a weak row uses `#d1d6db`).
- *Recent trades*: header row with title + text link "View all 61" (600 13px `#3182f6`). Rows are a CSS grid `64px 1fr 150px 130px 110px 90px`, 16px gap, 16px vertical padding, 1px `#f2f4f6` bottom border (last row none). Cells: date (700 13px `#8b95a1`), instrument + direction (700 15px `#191f28`) with sub-line "H4 → M15 · low purged" (500 12px `#8b95a1`), model tag (600 13px `#4e5968` on `#f2f4f6`, radius 8, padding 6/10; off-plan variant is `#3182f6` on `#e8f3ff`), session (500 13px `#8b95a1`), planned R (same), result R right-aligned 800 17px in the sign color.

### 2. New trade (design ref: card `1b`, authored at 1000px wide)
**Purpose** — log a trade in CRT order; the form should read like the method.

**Layout** — white header (close ✕ + "New trade" 700 17px + "Draft saved · 12:41" 500 13px `#b0b8c1`), then a 32px-padded column of white cards (radius 24, padding 28/32), 16px gaps, ending in an action row.

**Sections** — each headed by a numbered chip: 24px circle, `#191f28` fill, `#fff` 700 12px, 10px gap, section title 700 16px `#191f28`.
1. **Context** — Instrument, Date (2-col); Session (3-option segmented) and HTF bias (2-option segmented: Long/Short) in a second 2-col row.
2. **Range & sweep** — HTF pairing (select), Range high, Range low (3-col). Below, a `#f9fafb` radius-20 panel (padding 26/28/20) holding the **range diagram**: a 64px-tall `#eef1f4` bar, radius 12, with 2px `#d1d6db` rules pinned top and bottom (range high/low), a 1px `#dde1e6` midline (50% equilibrium), a 4px blue marker (`#3182f6`, radius 99) hanging below the low edge labelled "Sweep" (700 11px `#3182f6`), and a 4px red marker (`#f04452`) above the high edge labelled "Target". Captions under: low price / 50% price / high price (500 11.5px `#b0b8c1`). Right-hand 180px column, separated by a 1px `#eef1f4` left border: "Range size" (800 22px) and "Sweep side" (800 18px), both derived, not typed.
3. **Execution** — Entry, Stop, Target, Size (4-col). Below, the **derived R:R callout**: `#e8f3ff` fill, radius 16, padding 16/20, label "Auto-calculated R:R" (600 14px `#1b64da`) left, value "1 : 5.2R" (800 20px `#1b64da`) right. Then Entry model (select) and Result (3-option segmented: Win / Loss / Break-even; the selected Win state is `#f04452` on `#fdeced`).
4. **Chart & notes** — 2-col. Left: dropzone, 2px dashed `#dde1e6`, radius 20, height 210, `#fbfcfd` fill, centered stack: "Drag chart screenshots here" (700 14px `#4e5968`), hint "Two shots recommended: HTF range + entry timeframe" (500 12px `#b0b8c1`), and a "Choose file" button (600 13px `#333d4b` on `#f2f4f6`, radius 10, padding 9/14). Right: notes textarea styled as `#f2f4f6` radius 20, height 210, padding 18/20, 500 14px/1.6, placeholder in `#8b95a1` with an example line in `#b0b8c1`. Under it a wrapping row of emotion/behavior tags (radius 99, `#f2f4f6`, padding 8/14, 600 12.5px `#4e5968`): On plan, Impatient, Chased entry, Early exit — multi-select toggles.
5. **Actions** — a flex row, 12px gap: "Save draft" (flex 1, `#f2f4f6`, 700 16px `#4e5968`, radius 16, padding 17 vertical) and "Log trade" (flex 2, `#3182f6`, `#fff`).

**Field styling (all inputs)** — label 600 13px `#8b95a1`, 8px below-gap; control `#f2f4f6` fill, radius 14, padding 14/16, value 600 15px `#191f28`; selects show a `▾` in `#b0b8c1` at the right edge. Segmented options: equal flex, radius 12, 12px vertical padding, 8px gap; unselected `#f2f4f6` with 600 14px `#8b95a1`, selected `#e8f3ff` with 700 14px `#3182f6`.

### 3. Calendar (design ref: card `1c`, authored at 900px wide)
**Purpose** — see the shape of the month: which days made money, which days were overtraded.

**Layout** — white header: month stepper (‹ 18px `#b0b8c1` · "September 2026" 700 18px · ›) left; Week/Month toggle right (inactive `#f2f4f6`/`#8b95a1`, active `#191f28` fill with `#fff` 700 13px, radius 10, padding 8/14). Body 24/28/28 padding: a white radius-24 card with the grid, then a 4-up summary row (radius 20 cards, padding 22/24).

**Grid** — 7 columns, 8px gap. Weekday header row 600 12px `#b0b8c1`, centered. Day cells: height 78, radius 14, padding 10/12; day number 600 11.5px `#b0b8c1` (`#d1d6db` for future days); when the day has trades, signed R 800 16px in the heat color and a trade count 500 11px in a muted tint of it. Empty/no-trade days are `#fafbfc`. Today gets a 2px `#191f28` outline. Below the grid, a legend: "Loss" then five 26×12 radius-99 swatches (`#3182f6`, `#e8f3ff`, `#f2f4f6`, `#fdeced`, `#f04452`) then "Gain", 500 11.5px `#b0b8c1`.

**Heat scale** — bucket the day's net R into five steps and map to fill/text pairs:
| Bucket | Cell fill | Value color |
| --- | --- | --- |
| ≥ +4R | `#f7c5c9` | `#d63a48` |
| +2R … +4R | `#fbd5d8` | `#e03e4c` |
| > 0 … +2R | `#fdeced` | `#f04452` |
| 0 / no trades | `#fafbfc` | — |
| < 0 | `#e8f3ff` | `#3182f6` |
(Deep-loss step `#3182f6` fill with white text is reserved for the legend's extreme; extend the scale symmetrically if you want a −4R bucket.)

**Interactions to add** — hover tooltip per day (net R, trade count, best/worst trade), click to open the day's trade list, ‹ › month navigation (keyboard arrows too).

**Summary row** — Trading days, Green days (value in gain color), Best day, Worst day; label 600 13px `#8b95a1`, value 800 26px.

### 4. Mobile: Home / Quick log / Calendar (design ref: card `1d`, 375×760 screens, Korean copy)
Shown in 375px phone frames with a 34px inner radius — **the bezel is presentation only**.

- **Home** — status bar, header "9월 기록" (800 20px) + 34px avatar circle `#e5e8eb`; hero card (radius 22, padding 24) with "이번 달 누적", "+18.4R" at 800 44px/1.1, two chips, and a 300×70 sparkline (3px stroke, no fill); "잘 되는 모델" card with three 7px-tall bars; "오늘" card listing today's trades with a "전체보기" link; a full-width primary CTA "기록하기" (`#3182f6`, radius 18, padding 16, 700 16px `#fff`).
- **Quick log** — a 4-step wizard on white. Header: ✕ left, "2 / 4" right (600 13px `#b0b8c1`); 4px progress track `#f2f4f6` with `#3182f6` fill at 50%. Question as a display line (800 24px/1.35, letter-spacing −.03em) with the range values beneath (500 13.5px `#8b95a1`). A mini range diagram (88px tall, radius 16, `#f4f5f7`) previews the sweep marker. Four tappable option rows: radius 16, padding 18/20, 2px transparent border, `#f4f5f7` fill, 600 15.5px `#4e5968`; selected = `#e8f3ff` fill, 2px `#3182f6` border, 700 `#1b64da` text, trailing ✓. Footer buttons pinned to the bottom of the screen (spacer flexes): "이전" (flex 1, neutral) and "다음" (flex 2, primary), radius 16, padding 17.
- **Calendar** — same heat scale at 42px cell height with abbreviated values (700 11px), 6px gaps, radius 12; below it a day-detail card ("9월 9일 · 4건 · +5.4R") listing that day's trades with 1px `#f2f4f6` dividers.

**Responsive rules** (the agreed target is one responsive build)
- ≥1200px: dashboard as authored (2-col hero, 4-up stats, 2-up analysis).
- 900–1199px: stats to 2×2, analysis cards stack, trade rows keep the grid but drop the "planned R" column.
- <900px: single column; trade rows become the mobile two-line list (instrument + sub-line left, R right); dashboard hero becomes the mobile hero card; form sections go 1-col; the calendar keeps 7 columns and shrinks cells to 42px with abbreviated values.
- Touch targets: minimum 44px. Primary CTA becomes sticky at the bottom on small screens.

### 5. Trade log (design ref: card `2a`, desktop, 1200px)
**Purpose** — find any trade, and see the stats of whatever subset is currently filtered.

**Layout** — same top bar as the dashboard with "Trades" active. Two white cards: a filter card (radius 24, padding 22/28) and a table card (radius 24, padding 8/28/16).

**Filter card** — one wrapping flex row, 10px gap, of control pills (radius 12, padding 11/14, 600 13.5px): a date-range pill (ink `#191f28` when set), unset dropdowns in `#8b95a1`, and **applied** filters as accent chips (`#e8f3ff` fill, 700 `#1b64da`, trailing ✕ to clear). A checkbox pill ("Off-plan only") uses a 16px `#3182f6` square with a white ✓. A "Reset" text link (600 13px `#3182f6`) follows; "Export CSV" and "Import" sit right-aligned (600 13px `#4e5968` on `#f2f4f6`, radius 10, padding 10/14). Below a 1px `#f2f4f6` top border (18px margins), a **result summary row**: Matching / Net / Win rate / Avg hold — label 600 12.5px `#8b95a1` with value 800 15px 8px to its right, 22px gaps. Every number here reflects the filter, not the month.

**Table** — grid `76px 1fr 150px 118px 120px 96px 96px 40px`, 16px gap. Header row: 700 11.5px `#8b95a1`, letter-spacing .02em, the active sort column in `#191f28` with a ↓/↑ affordance; clicking a header sorts, clicking again reverses. Rows: 15px vertical padding, 1px `#f2f4f6` bottom border, hover fill `#fbfcfd` with the trailing chevron darkening to `#8b95a1`; whole row is the link to trade detail. Cells as on the dashboard, plus a sub-line carrying HTF pairing and size. Footer: "Showing 5 of 18" (500 12.5px `#b0b8c1`) left, pager right (radius 8, padding 8/12; current page `#191f28` fill with white 700 13px).

**Behavior** — filter state lives in the URL; multi-select for instrument/session/model; the summary row and pager recompute on change; CSV export writes the filtered set; Import opens the column-mapping step.

### 6. Trade detail (design ref: card `2b`, 1000px)
**Purpose** — review one trade as the CRT sequence, not as a row of fields.

**Layout** — white header: back ‹, "NQ · Long · Sep 9, 2026" (700 17px), a model tag, and Edit / Delete buttons right. Then four white cards, 16px gaps.
1. **Result card** (padding 28/32, grid `220px 1fr`, 36px gap): "Realized" label, "+2.8R" at 800 48px/1.1 in the sign color, sub-line "Planned 3.0R · 93% captured" (500 12.5px `#b0b8c1`). Right: four `#f9fafb` radius-16 tiles (padding 16/18) — Entry, Stop, Exit, Hold — label 600 12px `#8b95a1`, value 800 17px.
2. **CRT sequence card**: title, then a wrapping row of read-only chips (radius 99, `#f2f4f6`, 600 12.5px `#4e5968`; the plan-status chip is `#e8f3ff`/`#1b64da`). Below, the range diagram in a `#f9fafb` radius-20 panel (padding 30/28/22, grid `1fr 190px`): 76px `#eef1f4` bar with the same rules and markers as the form, **plus** a 3px `#f04452` horizontal segment showing the expansion leg and where the exit landed (labelled "Expansion · exit at 59%"), and a neutral `#d1d6db` marker for the untouched target. Right column (1px `#eef1f4` left border): Range size, Risk, Exit reason.
3. **Charts card** (half width): title with an "Add" link; each attachment is a 150px-tall radius-16 slot. In the mock they are diagonal-stripe placeholders (`repeating-linear-gradient(135deg,#f4f5f7 0 8px,#eef1f4 8px 16px)`) with a monospace caption naming what belongs there — in the app these are the user's uploaded screenshots, click to open a lightbox, hover to reveal remove.
4. **Notes card** (half width): body 400 14px/1.7 `#333d4b`; 1px `#f2f4f6` dividers (20px margins) before Tags (read-only pills) and a footer line "Logged … / Edited …" (500 12.5px `#b0b8c1`).

### 7. Weekly review (design ref: card `2c`, 1000px)
**Purpose** — close the week: what the numbers say, what you decide to change.

**Layout** — header: ‹ "Week 37 · Sep 7 — Sep 13" › stepper, and "Copy last week's notes" right. Body: a 4-up stat row (Net, Win rate, Rule adherence, Vs. 4-week avg — each with a 500 11.5px `#b0b8c1` sub-line), then a `1fr 380px` two-up, then a full-width review card.
- **Day by day** — 7 equal columns, 8px gap, 150px tall, bars bottom-aligned: height is the share of the week's largest absolute R, fill in the sign color, radius 8, weekday caption 600 11px `#b0b8c1` below. No-trade days get a 4px `#e5e8eb` stub and a `#d1d6db` caption. Below a divider, Best trade / Worst trade tiles (`#f9fafb`, radius 16, padding 18/20): instrument 700 15px, context 500 12px, R 800 20px in the sign color.
- **Tag frequency** — the standard 7px bar rows; counts right-aligned; low-frequency rows use `#d1d6db` instead of `#191f28`.
- **Focus for next week** — checklist rows: 18px radius-6 box (checked = `#3182f6` with white ✓, unchecked = `#f2f4f6`), text 500 13.5px/1.5 `#4e5968`. Items carry over to the next week's review until unchecked.
- **Review card** — three equal columns: What worked / What didn't / One change. Each is a textarea styled as `#f2f4f6`, radius 16, padding 16/18, min-height 110, 400 13.5px/1.6; placeholder in `#8b95a1`. Primary "Save review" button bottom-right (radius 14, padding 14/22, 700 15px).

### 8. Playbook (design ref: card `2d`, 900px)
**Purpose** — the models being traded, their entry rules, and whether they earn their place.

**Layout** — header "Playbook" + "New model" primary button. First card is the **expanded** model (radius 24, padding 26/28, grid `1fr 260px`, 28px gap): name 700 17px + status chip ("Active" = `#e8f3ff`/`#1b64da`), description 400 13.5px/1.7 `#4e5968`, then a numbered rule list (18px radius-6 `#f2f4f6` badges with 700 10px `#8b95a1` numerals, text 500 13.5px/1.5 `#333d4b`). Right column: a 104px reference-setup image slot (same stripe placeholder) and a 2×2 stat grid (`#f9fafb`, radius 14, padding 14/16 — Net, Win rate, Trades, Avg R).
**Collapsed rows** — remaining models as radius-24 cards, padding 24/28, name + status + one-line description left; Net and Win rate right-aligned with a chevron. A **retired** model keeps its row at 72% opacity with a neutral "Retired" chip, and its description explains that new entries matching it are flagged off-plan.

**Behavior** — click a row to expand (one open at a time); rule lists are editable in place; retiring a model keeps historical trades intact but marks future matches off-plan; the dashboard's model breakdown reads its order from here.

### 9. Capital (design ref: cards `3a` desktop 1200px, `3b` modal 520px + mobile 375px)
**Purpose** — the money behind the R numbers: what was deposited, what was withdrawn, what trading earned, and how much one R is worth today.

**The core idea** — risk per trade is a percentage of the balance, so **the currency value of 1R rises as the account grows and falls after a withdrawal**. R-denominated performance is unaffected by this, so every surface that shows money also shows R, and vice versa. A trade stores the 1R value that applied on its log date; changing the risk setting or recording cash never rewrites historical trades.

**3a layout** — top bar with a fifth nav item "Capital" and a primary "Deposit / Withdraw" button. Body: hero card, 4-up stat row, then a `1fr 380px` two-up (ledger | risk & guard).
- **Hero** (radius 24, padding 32/36, grid `300px 1fr`, 40px gap): "Account balance" label, "$32,180" at 800 52px/1.1 in ink (not a P&L color — balance is neutral), and three chips: deposited total, trading P&L (gain-tinted `#fdeced`/`#f04452`), withdrawn total. Right: a dual-line chart, 720×170 viewBox — **balance** as a 3px `#191f28` line with a 10%→0 area fill, **1R value** as a 2.5px `#3182f6` line on the same time axis (its own scale, no axis drawn). Deposit and withdrawal events are step discontinuities in the balance line, each marked with an r=4 ink dot and named in the caption row (500 11px `#b0b8c1`). Legend top-right: 14×3 radius-99 swatches with 600 11.5px `#4e5968` labels.
- **Stat row** — Starting capital, Net deposits, Trading P&L (in the gain/loss color), Return on capital (time-weighted, so deposits don't inflate it). Each has a 500 11.5px `#b0b8c1` sub-line.
- **Ledger card** — segmented text filter (All / Cash only / Trades only) top-right. Grid `74px 1fr 116px 104px 108px`, 14px gap, header 700 11.5px `#8b95a1`, rows 14px padding with 1px `#f2f4f6` borders. Entry cell = a type tag + description: Trade tags are neutral (`#f2f4f6`/`#4e5968`), Deposit is accent (`#e8f3ff`/`#1b64da`), Withdrawal neutral; **cash rows carry a `#fbfcfd` row tint** so they read as a different kind of event. Amount 800 14.5px (trades in the P&L color, cash in ink), R column 600 13px `#8b95a1` with an em-dash `#d1d6db` for cash rows, running balance 600 13px `#4e5968`. Footer: count left, "Export CSV" link right. Rows are chronological descending, and the balance column is the running total after that row.
- **Risk per trade card** — "$322" 800 34px with "= 1R today" beside it (600 14px `#8b95a1`); a 4-option segmented row (0.5% / 1% / 2% / Fixed) in the standard segmented styling; an explanatory caption (500 12.5px/1.6 `#b0b8c1`); then, under a divider, the **1R history** — one row per milestone: "Mar · $15,000" (600 13px `#4e5968`) with "$150 / R" right-aligned in ink.
- **Drawdown guard card** — "From peak $32,180" with the current drawdown 800 20px, an 8px progress bar (`#3182f6` fill = share of the limit consumed), and captions "Limit −10%" / "Stop trading at −$3,218". The limit is user-set; crossing it should surface a warning on the dashboard and in the trade form.

**3b — cash movement modal** (520px, white, radius 24, padding 32/34/30): title + ✕; a 2-option segmented Deposit / Withdrawal; Amount field styled larger (800 22px value, currency in 600 13px `#b0b8c1` on the right); Date and Account in a 2-col row (Account = a select, so multi-account support drops in here later); a Note field; then a `#f9fafb` radius-16 **preview panel** showing "Balance after" and "**1R moves to** $316 *from $266*" plus the caption "Only trades logged after this date use the new 1R." Actions: Cancel (flex 1, neutral) / Record deposit (flex 2, primary), radius 14.

**3b — mobile capital** (375×760, Korean copy): header "자산" with an "입출금" link; balance hero card (800 40px) with principal / P&L chips and a balance sparkline; a **1R card** showing today's value, the rule ("잔고의 1% · 3월 $150에서 시작"), and a two-tone 8px bar (grey = starting portion `#d1d6db`, accent = growth `#3182f6`) captioned start / % change / now; then a recent-activity list where each row's right column carries the amount over either the R value (trades) or the 1R shift (cash).

**Data model additions**
- `CashMovement` — id, date, type (deposit|withdrawal), amount, currency, accountId, note, createdAt.
- `Account` — id, name, currency, startingCapital, startedAt, riskMode (percent|fixed), riskPercent, fixedRiskAmount, drawdownLimitPercent.
- `Trade` gains: `accountId`, `rValueAtEntry` (the currency value of 1R when logged, frozen), `pnlAmount` (derived: realizedR × rValueAtEntry).
- Derived: balance series (starting capital + cash movements + trade P&L, ordered by date), 1R series (balance × riskPercent at each point), net deposits, trading P&L, time-weighted return, peak balance and current drawdown.
- The ledger is a merged, date-sorted view over `CashMovement` and `Trade`; keep it as a selector, not a stored table.

**Behavior** — recording cash recomputes the balance series forward from that date but never touches `rValueAtEntry` on existing trades; changing the risk % applies to future trades only (warn on change); a withdrawal that would exceed the balance is blocked; the drawdown guard warns in the trade form when the account is within 2% of the limit. Multi-account is not designed but the model reserves `accountId` everywhere.

## Interactions & Behavior
- **Nav** — Dashboard / Trades / Calendar / Playbook as routes. "New trade" opens the form (full page on desktop, full-screen sheet on mobile).
- **Trade entry** — derived fields recompute on every keystroke: range size = high − low; sweep side inferred from which extreme was purged (or explicitly chosen in the mobile wizard); risk = |entry − stop|; planned R = |target − entry| / risk; realized R = (exit − entry) / risk, sign-flipped for shorts. Show "Off-plan" automatically when sweep side = none or entry sits mid-range.
- **Validation** — instrument, date, entry, stop required; stop ≠ entry; range high > range low; target on the opposite side of entry from stop (warn, don't block); numeric fields accept thousands separators and paste from a broker.
- **Draft** — autosave the in-progress form every few seconds; header shows "Draft saved · HH:mm". Restore the draft on return.
- **Attachments** — drag-drop and file picker, multiple images, thumbnail previews with remove; validate type/size; open full size in a lightbox from trade detail.
- **Trade log** — filters (date range, instrument, session, model, sweep side, result, off-plan only) and sortable columns; filters reflected in the URL so a view can be bookmarked.
- **Calendar** — month navigation, per-day hover tooltip, click-through to the day's trades; Week/Month toggle.
- **Trade detail** — the full CRT sequence rendered read-only using the same range diagram, chart screenshots, notes, tags, planned vs realized R, and edit/delete.
- **Weekly review** — week picker; net R, adherence, best/worst trade, tag frequency, and a free-text review saved per week.
- **CSV** — export the filtered set; import with a column mapping step and a preview of rejected rows.
- **Empty states** — every stat surface needs a zero-data variant (no trades yet → prompt to log the first trade). Not drawn in the mocks; design them from the same card vocabulary.
- **Motion** — keep it light: 150–200ms ease-out on hover/press tints and sheet transitions, no entrance animations on data cards.
- **States** — hover: neutral fills go one step darker (`#f2f4f6` → `#e8ebee`), primary `#3182f6` → `#1b64da`. Focus-visible: 2px `#3182f6` ring, 2px offset. Disabled: 40% opacity, no pointer.

## State Management
Entities:
- `Trade` — id, date, instrument, direction (long|short), session (asia|london|ny_am|ny_pm), htfPairing (e.g. "H4→M15"), rangeHigh, rangeLow, sweepSide (low|high|both|none), entry, stop, target, exit, size, entryModel, confirmation, result (win|loss|be), plannedR (derived), realizedR (derived), offPlan (derived), tags[], notes, attachments[], createdAt, updatedAt.
- `Attachment` — id, tradeId, blob/objectKey, width, height, caption.
- `WeeklyReview` — isoWeek, netR, adherence, text, createdAt.
- `Draft` — a single in-progress trade.
- `Settings` — locale (ko|en), P&L color convention, default instrument/session, R display precision.

Derived selectors (pure functions over the trade list, memoized): month net R, win rate, expectancy, avg win, avg loss, streaks, rule adherence, by-model aggregate, by-session aggregate, by-sweep-side win rate, daily net R map for the calendar, equity curve series.

Storage: **local-first**. Persist to IndexedDB (trades + attachment blobs; localStorage is too small for images) behind a repository interface so a remote backend can be swapped in later. The design owner's answer on cross-device sync was unclear — treat sync as out of scope for v1 but keep the repository boundary and give every record a stable id + `updatedAt` so sync can be added without a migration.

## Design Tokens
Colors
- Background `#f4f5f7`; surface `#fff`; subtle surface `#f9fafb` / `#fafbfc`
- Ink `#191f28`; body `#333d4b`; secondary `#4e5968`; muted `#8b95a1`; faint `#b0b8c1`; disabled `#d1d6db`
- Divider `#f2f4f6`; border `#dde1e6`; panel `#eef1f4`
- Accent (actions, selection only) `#3182f6`; accent pressed `#1b64da`; accent tint `#e8f3ff`
- P&L — gain `#f04452` (tints `#fdeced`, `#fbd5d8`, `#f7c5c9`; deeper text `#e03e4c`, `#d63a48`), loss `#3182f6` (tint `#e8f3ff`). This is the Korean market convention (red up / blue down). It is deliberately the same hue as the accent for losses — keep the accent limited to buttons and selected states so the two readings don't collide. If the app is localized for Western markets, expose the convention as a setting (green gain / red loss) rather than hardcoding.

Typography — Pretendard (loaded from the jsDelivr CDN in the mock; vendor it or use a licensed webfont in production), fallback `-apple-system, system-ui, sans-serif`. Weights used: 500 (captions), 600 (labels, values), 700 (titles, buttons), 800 (display numbers). Scale: 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 15.5 / 16 / 17 / 18 / 20 / 22 / 24 / 26 / 30 / 44 / 56px. Display numbers carry letter-spacing −.03em to −.04em; card titles −.02em. Body line-height 1.6; display 1.1–1.35.

Spacing — 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 26 / 28 / 32 / 40px. Card gap 16; card padding 22–32; field label gap 8.

Radius — 8 (small tags) / 10 / 12 / 14 (fields) / 16 / 18 / 20 / 22 / 24 (cards) / 99 (pills, bars) / 34–44 (phone bezel, presentation only).

Elevation — the design is nearly flat: only the canvas cards carry `0 2px 12px rgba(0,0,0,.06)`. Inside the app, separate surfaces with fill and radius, not shadow. Sheets/modals may use `0 6px 24px rgba(0,0,0,.12)`.

## Assets
- No image assets. Chart screenshots are user-uploaded at runtime.
- No icon set was used in the mocks: ✕, ‹, ›, ▾, ✓ are text glyphs standing in for icons. Replace them with the codebase's icon library (Lucide or equivalent) at 16–20px.
- Charts are hand-authored inline SVG (equity curve, sparkline, range diagram). The range diagram is layout, not a chart — build it from divs; the curves can move to a chart library.
- Font: Pretendard (open source, SIL OFL).

## Files
- `Min Journal.dc.html` — the design canvas holding all ten mocks in three turns. Turn 3 (top): 3a capital overview + ledger, 3b cash-movement modal + mobile capital. Turn 2: 2a trade log, 2b trade detail, 2c weekly review, 2d playbook. Turn 1 (bottom): 1a dashboard, 1b new trade, 1c calendar, 1d mobile trio. Open it in a browser; pan/zoom to inspect. Read the inline styles for exact values.

## Open questions for the design owner
1. Cross-device sync — needed in v1, or local-only?
2. P&L color convention — keep red-gain/blue-loss globally, or switch by locale?
3. Still undesigned: empty states, settings, multi-account switching, and mobile versions of screens 5–8. Specified in behavior only — ask for mocks before implementing if visual fidelity matters.
