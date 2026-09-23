---
name: SCRmod
description: The ROUNDS menu, outside the game. A browser companion for Sid's Competitive Rounds.
colors:
  band-orange: "#f08c17"
  band-orange-deep: "#e57a0c"
  band-orange-bright: "#f59a2c"
  band-orange-end: "#e98311"
  band-ink: "#0a1c22"
  ember-ink: "#f7a64d"
  ember-ink-mist: "#9a4d05"
  abyss-teal: "#082830"
  menu-teal: "#0c3440"
  shard-teal: "#104250"
  bar-teal: "#0b303a"
  smoked-glass: "rgba(4, 22, 28, 0.55)"
  solid-glass: "#09272f"
  inset-shade: "rgba(0, 0, 0, 0.18)"
  hover-wash: "rgba(255, 255, 255, 0.06)"
  hairline: "rgba(255, 255, 255, 0.09)"
  frost-ink: "#eef6f7"
  seaglass-ink: "#b6cdd2"
  tide-ink: "#9dbcc3"
  mist: "#dfeaec"
  mist-glow: "#eef5f6"
  mist-shade: "#d1e0e3"
  frosted-pane: "rgba(255, 255, 255, 0.82)"
  frosted-pane-solid: "#f9fbfc"
  mist-hairline: "rgba(12, 52, 64, 0.12)"
  mist-inset: "rgba(12, 52, 64, 0.05)"
  mist-wash: "rgba(12, 52, 64, 0.06)"
  deep-teal-ink: "#0b2a33"
  slate-teal-ink: "#3f5d65"
  harbor-ink: "#4b6870"
  win-green: "#6ee35c"
  win-green-mist: "#136b2c"
  loss-coral: "#ff968a"
  loss-coral-mist: "#c21f2b"
  on-air-red: "#c92a2a"
  on-air-red-mist: "#cf222e"
  on-air-ink: "#ffffff"
  signal-blue: "#92baff"
  signal-blue-mist: "#0b5cbd"
  rare-violet: "#d3a4f8"
  rare-violet-mist: "#7e36c4"
  medal-gold: "#ffd25a"
  medal-gold-mist: "#8a5d00"
  medal-silver: "#c9d6db"
  medal-silver-mist: "#56606e"
  medal-bronze: "#eca872"
  medal-bronze-mist: "#8f4e1c"
typography:
  display:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 300
    lineHeight: 1.15
    letterSpacing: "0.16em"
  stat:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 300
    lineHeight: 1.15
    fontFeature: "'tnum'"
  title:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.5
  body:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  section:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  menu:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.1em"
  meta:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.14em"
  tab-bar:
    fontFamily: "'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  sm: "2px"
  chip: "3px"
  dot: "50%"
spacing:
  3xs: "2px"
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  top-bar:
    backgroundColor: "{colors.bar-teal}"
    textColor: "{colors.frost-ink}"
    height: "56px"
  nav-item:
    textColor: "{colors.seaglass-ink}"
    padding: "0 16px"
    height: "56px"
  nav-item-active:
    backgroundColor: "{colors.band-orange}"
    textColor: "{colors.band-ink}"
  button:
    backgroundColor: "{colors.inset-shade}"
    textColor: "{colors.frost-ink}"
    typography: "{typography.menu}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-hover:
    backgroundColor: "{colors.hover-wash}"
  button-accent:
    backgroundColor: "{colors.band-orange}"
    textColor: "{colors.band-ink}"
    typography: "{typography.menu}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.inset-shade}"
    textColor: "{colors.frost-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.frost-ink}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  chip-live:
    backgroundColor: "{colors.on-air-red}"
    textColor: "{colors.on-air-ink}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.smoked-glass}"
    textColor: "{colors.frost-ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  panel:
    backgroundColor: "{colors.inset-shade}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  stat-tile:
    backgroundColor: "{colors.smoked-glass}"
    typography: "{typography.stat}"
    padding: "12px 16px"
  tab:
    textColor: "{colors.seaglass-ink}"
    padding: "0 14px"
    height: "40px"
  tab-selected:
    textColor: "{colors.frost-ink}"
  row-you:
    backgroundColor: "{colors.band-orange}"
    textColor: "{colors.band-ink}"
---

# Design System: SCRmod

## Overview

**Creative North Star: "The Menu Outside the Game"**

SCRmod is the ROUNDS menu carried into the browser. A player who knows the game should recognize it on sight: the same deep teal with faint low-poly shards behind everything, the same thin capitals tracked wide, and the same single orange band that marks where you are. The site exists to be checked quickly, often on a phone between matches, so it stays calm: surfaces are quiet, numbers are exact and line up, and nothing competes with the data.

The mood is calm, exact and game-native. It belongs to ROUNDS rather than to a generic stats dashboard. Identity comes from a few precise commitments (the teal, the capitals, the band, the outlined wordmark with the game's crowned face standing in for the O) and never from decoration. Dark is the home look, and the site follows the visitor's system setting unless they pick the other theme. "Mist" is the same world in daylight: surfaces and ink invert, the orange darkens into ink for legibility, and the bars stay game-teal.

Density is that of a scoreboard: tables and lists carry most pages, stat tiles lead only where a single number is the point, and expandable rows hold the detail. Every text pair is checked at 4.5:1 or better on the panel, backdrop and hover surfaces, in both themes.

**Key Characteristics:**
- A deep teal world with a fixed, faint low-poly shard backdrop; content scrolls over it like the game's menu.
- Light, uppercase, widely tracked Montserrat for everything that labels; player names keep their own casing.
- One orange band, always meaning "you are here", always carrying dark ink.
- Translucent teal glass panels instead of shadows; near-square 2px corners.
- Tabular figures for every number that lines up with another.

## Colors

A cold, deep teal field with a single warm orange, plus a small set of signal colors that only ever mean one thing each.

### Primary
- **Menu Selection Orange** (band-orange, #f08c17): the fill of the "you are here" band: the current page in the menus, the pressed filter, your own row in a list or table, the selected search result, the one call-to-action (sign in with Discord). Also the wordmark's color. As a band it is a 100° gradient from Band Edge Orange (#e57a0c) through Menu Selection Orange and Band Sheen Orange (#f59a2c) to #e98311; inside table rows it is flat Menu Selection Orange, because a gradient would restart in every cell.
- **Band Ink** (#0a1c22): the only ink allowed on the band (7:1).
- **Ember Ink** (#f7a64d; Mist: Burnt Ember #9a4d05): orange used as text or line on a surface: the selected tab's underline, focus rings, the text caret, earned-achievement rings, the 1v1 line of the rating chart.

### Neutral
- **Abyss Teal** (#082830): the page base and the backdrop's darkest corner.
- **ROUNDS Menu Teal** (#0c3440) and **Shard Light Teal** (#104250): the backdrop's radial gradient (lit from the top left), under three shard tints: light (white at 4%), dark (black at 10%), cyan (rgb(120 220 235) at 3.5%).
- **Bar Teal** (#0b303a; Mist uses Menu Teal): the top bar and the phone tab bar, teal in both themes. The browser's own chrome (the mobile address bar) takes Menu Teal.
- **Smoked Glass** (rgba(4, 22, 28, 0.55)) and **Solid Glass** (#09272f): cards and tiles, translucent over the backdrop; the solid version for anything that sits over scrolling content (pinned table cells, the identity panel).
- **Inset Shade** (black at 18%) and **Hover Wash** (white at 6%): nested surfaces (a panel inside a card, buttons, inputs) and the hover or press state.
- **Hairline** (white at 9%): every divider and control border.
- **Frost Ink** (#eef6f7), **Sea-Glass Ink** (#b6cdd2), **Tide Ink** (#9dbcc3): primary, muted and faint text.
- **Mist equivalents:** Mist (#dfeaec) base, lit by a backdrop gradient from Mist Glow (#eef5f6) to Mist Shade (#d1e0e3), Frosted Pane (white at 82%) and Solid Frosted Pane (#f9fbfc) panels, Mist Inset (rgb(12 52 64) at 5%) and Mist Wash (at 6%) for nested and hover surfaces, Mist Hairline (at 12%), Deep Teal Ink (#0b2a33), Slate Teal Ink (#3f5d65), Harbor Ink (#4b6870).

### Signal
Each signal color has one meaning, and each has a darker Mist twin (listed in the tokens).
- **Win Green** (#6ee35c): wins, positive rating change, online dots, good card win rates (55% and up).
- **Loss Coral** (#ff968a): losses, negative change, poor win rates (45% and under), errors.
- **On-Air Red** (#c92a2a) with **On-Air Ink** (#ffffff): the LIVE pill and a running tournament. Nothing else.
- **Signal Blue** (#92baff): ranked-game chips, uncommon cards, the FFA line on the rating chart, the one explicit "go to profile" link inside an expanded row.
- **Rare Violet** (#d3a4f8): rare cards.
- **Medal Gold, Silver, Bronze** (#ffd25a, #c9d6db, #eca872): the podium ranks 1 to 3 on leaderboards.

### Named Rules
**The One Band Rule.** Orange fills one thing per context: where you are. It never decorates, never marks a link, never highlights a number.

**The Dark Ink Rule.** Anything on the band is Band Ink. White on this orange is under 3:1.

**The Held Hue Rule.** Colors that come from the game (rank tiers, titles) keep their hue but have their lightness held to the theme's legible band (OKLCH lightness 0.74 to 1 on dark, 0 to 0.46 on Mist).

## Typography

**Display Font:** Montserrat Variable (self-hosted, weights 100 to 900), with a metric-matched Arial fallback so the swap doesn't shift the layout
**Body Font:** Montserrat Variable, same stack
**Label/Mono Font:** ui-monospace for code only

**Character:** One geometric sans in many weights, doing the game menu's voice: light capitals tracked wide for everything that labels, sturdy bold for the names and numbers that matter.

### Hierarchy
- **Display** (300, 1.75rem, 1.15): page titles, uppercase, tracked 0.16em.
- **Stat** (300, 1.625rem, 1.15, tabular): the number a tile or scoreboard exists to show.
- **Title** (800, 1.125rem): the player names on a live scoreboard.
- **Body** (400, 1rem, 1.5): default reading size. Prose never runs past 64ch.
- **Data** (400, 0.9375rem, tabular): dense tables.
- **Section** (500, 0.8125rem, tracked 0.14em, uppercase): section headings inside cards, in Sea-Glass Ink; the same size at 400 for the top menu entries.
- **Menu** (600, 0.8125rem, tracked 0.1em, uppercase): buttons, tabs and filters.
- **Meta** (400, 0.8125rem): timestamps, subtitles, the footer, "as of" lines.
- **Label** (500, 0.75rem, tracked 0.14em, uppercase): tile labels, table headers, sub-section headings; chips use the same size at 700.
- **Tab bar** (500, 0.6875rem, tracked 0.08em, uppercase): under-icon labels in the phone tab bar only.

All sizes are in rem, so the reader's browser text size is honored. Headings balance their lines; paragraphs and list items wrap "pretty".

### Named Rules
**The Menu Voice Rule.** Headings, buttons, tabs, filters and labels speak in the menu voice: uppercase, tracked 0.08 to 0.16em. Chips don't, because they carry names, titles and card names; a chip that names a category (LIVE, RANKED, CASUAL) is written in capitals. Player names never do: they keep their own casing and normal tracking (0.01em as a page heading), at weight 600 (800 when it's you or on the scoreboard).

**The Tabular Rule.** Every number that lines up with another (ratings, scores, deltas, counts in tables) uses tabular figures.

## Layout

A single centered column (max 1100px) with a 16px gutter that grows into the safe-area insets on notched phones. The page is at least one screen tall below the top bar, so the footer always starts out of view and arriving data never pushes it around.

Spacing follows one scale (2, 4, 8, 12, 16, 24, 32, 48px). Inside a group the steps stay small: 2px tile seams, 4px under a primary line, 8px between siblings and from a heading to its content, 12px from controls to the data they act on. Between groups the step is 24px: card to card, tile strip to the next section, a sub-section heading to what came before it. Cards pad 16px; the page ends with 48px.

- **Pairs:** equivalent cards (sync and async tournaments, top and worst cards) sit side by side from 760px and stretch to equal heights; unequal neighbors (live games beside who's on) keep their own heights.
- **Tiles:** as many across as fit (at least 8.5rem each; 11rem for achievements), stretched to fill, so three tiles are thirds rather than three quarters and a gap.
- **Navigation:** from 840px the menu lives in the top bar; below it, a six-entry tab bar sits at the bottom within thumb reach. On a short landscape phone the top bar scrolls away and the tab bar slims to one 44px line.
- **Tables** scroll sideways inside their card, never the page. Below 840px the rank and name columns (or the card name) stay pinned while the numbers scroll under them, and a player's title chip moves under the name to keep the pinned column narrow.
- **The results feed** stacks each game onto two lines when its card is under 34rem wide.
- **Long lists** open with their first few (5 recently-online players, 20 cards, 20 series) and a "Show all" that also folds them away again.
- **Touch:** every control reaches 44px on coarse pointers, including player names in lists and tables.

### Named Rules
**The Group Step Rule.** The space between two groups (24px) is always larger than any space inside one (12px at most). If a heading sits as close to the section before it as to its own content, the spacing is wrong.

**The Wide Band Rule.** A row that is you runs the full width of its card, edge to edge, like the game's menu selection.

## Elevation & Depth

Flat and tonal. Depth comes from translucency over the fixed shard backdrop: cards are smoked glass, nested surfaces are a shade darker (Inset Shade), and hover or press adds a white wash. Cards have no border and no shadow. There is no backdrop blur.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45)`; Mist `rgba(12, 52, 64, 0.18)`): the identity panel, the one surface that floats over the page.
- **Earned Ring** (`box-shadow: inset 0 0 0 1px` Ember Ink at 45%): an unlocked achievement tile, over a 14% orange tint.
- **Online Halo** (`box-shadow: 0 0 0 3px` Win Green at 25%): the dot beside a player who is online.

### Named Rules
**The Glass, Not Shadow Rule.** Panels separate from the backdrop by tone, never by a drop shadow. A shadow means the surface floats over content.

## Shapes

Near-square. Panels, buttons, inputs, tiles and filter tracks all have 2px corners, the game menu's barely-softened rectangle. Chips are 3px. Circles are reserved for status dots. Dividers are 1px hairlines: lists and expandable rows are divided, not boxed, and stat tiles sit in a strip with 2px seams rather than as separate cards.

### Named Rules
**The Near-Square Rule.** No pills, no large radii. A rounder corner would read as a different game.

## Components

Every control is a menu entry: flat, square, uppercase and tracked. Selection is a full-width orange band, never a raised or glowing button.

### Buttons
- **Shape:** near-square (2px), 40px tall (44px on touch), 16px side padding, a hairline border.
- **Default:** Inset Shade with Frost Ink, in the Menu voice.
- **Accent:** the band with Band Ink and no visible border, for the one call to action in a view (today, signing in with Discord).
- **On the bar:** transparent, with a 24%-white border and light ink in both themes.
- **Icon button:** 40px square (44px on touch); the small variant is 32px tall (44px on touch).
- **Hover / Press:** Hover Wash, on hover-capable devices only; touch devices get the same wash while pressed.
- **Focus:** a 2px Ember Ink outline 2px outside. On the teal bars it stays light in both themes; inside the band it switches to Band Ink; on full-height bar entries and in scrolling tab strips it is drawn inside the control.
- **Unavailable:** 60% opacity with a not-allowed cursor. A control that ran out (the last page, a retry in flight) stays focusable and says so with aria-disabled.

### Chips
- **Style:** 12px bold on a Hover Wash, 2px 8px, 3px corners; they don't wrap, and inside a row they end in an ellipsis rather than overflow.
- **Tones:** the tone as ink on a 14% wash of itself (Signal Blue for ranked, Win Green, Loss Coral, Ember Ink).
- **Live pill:** On-Air Red with white ink.
- **Rank chip:** the tier's own color, held to the theme's lightness band, with a 1px border in the same color.
- **Title tag:** the title's own color on a 14% wash of itself.
- **Rolled pick:** transparent with a hairline outline, muted ink, and the word "rolled", not a fade.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** Smoked Glass (Frosted Pane in Mist); Solid Glass wherever it sits over scrolling content.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 16px; 24px between cards.
- **Header:** a Section heading with optional meta or a link on the right, 12px above the content.
- **Panels** (an item inside a card, such as a live game): Inset Shade, 12px by 16px, 8px apart.

### Stat Tiles
- A strip with 2px seams. The label is in the Label voice in Sea-Glass Ink, the value in Stat (light, tabular), and the note below in Meta, muted. Inside a card they take Inset Shade.
- On a player's page the header carries the four ranked numbers (rating, standing, record, streak) and the recent-form strip above the tabs; the tab's own tiles are grouped under labels (Other modes, Career).

### Inputs / Fields
- **Style:** Inset Shade, hairline border, 2px corners, 40px tall (44px on touch), 12px side padding. The text is never under 16px, which keeps iOS from zooming into the field.
- **Focus:** the Ember Ink ring; the caret is Ember Ink too.
- **Checkboxes and radios:** the native control in the accent color; on touch their label row is a 44px target.

### Navigation
- **Top bar:** Bar Teal, 56px, sticky. The wordmark is on the left and the six menu entries follow: 13px capitals tracked 0.14em at weight 400, in Sea-Glass Ink. The current entry is a full-height band with Band Ink at 600. The identity button and the theme toggle sit on the right.
- **Phone tab bar:** Bar Teal, fixed to the bottom, 58px plus the safe-area inset, with a 22px icon over the Tab bar label. The current entry wears the band.
- **Tabs** (a page's sections, the leaderboard modes): 13px capitals tracked 0.1em at weight 500, in Sea-Glass Ink. The selected tab turns Frost Ink at 700 over a 2px Ember Ink underline. The strip scrolls sideways and keeps the selected tab in view.
- **Segmented filter** (All, Ranked, Casual): an Inset Shade track with 3px of padding; the pressed segment wears the band.

### Tables
- Data size, tabular figures, 8px cells, hairline row dividers, headers in the Label voice. Hover rows take the Hover Wash. Your row wears flat Menu Selection Orange with Band Ink throughout, including game colors and muted text. Podium ranks 1 to 3 take medal ink at 800.

### The Live Scoreboard
- Two names hold their sides at any width, in Title weight with the rating under each. The series score sits in the center in Stat (light, tabular), and a faint line below gives the format, the current game and the odds. It sits in a panel inside the live games card, under a LIVE pill.

### Recent Form
- One 22px tile per game, newest first: the letter W or L in its signal color on a 14% wash of that color, so it reads without color too.

### Rating Chart
- Lines in Ember Ink (1v1) and Signal Blue (FFA), 2px, over hairline grid lines, with axis labels in the site's face. The lines are named in a key under the plot (a short swatch and its label, in the Label voice), never in a legend table; the chart's text summary speaks for it to screen readers.

### Wordmark and Icons
- **Wordmark:** "SCRMOD" in Fredoka Bold, outlined to paths so no display font downloads, with the game's crowned face standing in for the O. It is drawn in Menu Selection Orange, 28px tall (22px under 480px).
- **Icons:** one stroke set on a 24px grid, 1.75 stroke with round caps and joins, drawn in the current text color.

### Motion
- Minimal, and only as feedback. Chevrons on expandable rows rotate in 0.15s ease-out. Loading placeholders sweep once every 1.2s.
- Under reduced motion the chevrons snap and the placeholder stays but stops sweeping.

## Do's and Don'ts

### Do:
- **Do** use the tokens and the spacing scale (2, 4, 8, 12, 16, 24, 32, 48px); a value off the scale needs a reason.
- **Do** keep the space between groups (24px) larger than any space inside one.
- **Do** mark "you are here" with the band and Band Ink, running full width in lists and tables.
- **Do** check every new text pair at 4.5:1 or better on the panel, backdrop and hover surfaces, in both themes, including game-supplied colors held to their lightness band.
- **Do** isolate player names in running text so a right-to-left name can't reorder what's around it, and let a 32-character unbroken name break rather than widen the page.
- **Do** give every control a 44px target on touch, and keep an exhausted control focusable (aria-disabled) instead of disabling it.
- **Do** say meaning in words as well as color: W or L letters, "won", "rolled", "online".

### Don't:
- **Don't** put white text on the orange band.
- **Don't** use orange for decoration, links, or emphasis on numbers.
- **Don't** add drop shadows to cards or tiles, or blur behind them.
- **Don't** use gradients anywhere but the band, the backdrop and the loading placeholder's sweep.
- **Don't** raise, glow or enlarge a selected control; selection is the band.
- **Don't** uppercase or track player names.
- **Don't** dim meaning-bearing text with opacity; use a muted ink that still passes contrast.
- **Don't** put information only in a hover tooltip; touch users never see it.
- **Don't** round corners past 3px, except status dots.
