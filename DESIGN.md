---
name: App
description: shadcn/ui (new-york) + Tailwind v4 + next-themes. Tokens here mirror src/app/globals.css (light values; dark theme lives there too).
colors:
  primary: "#cbff1e"
  primary-foreground: "#0b0b0b"
  background: "#f1f0ef"
  foreground: "#0b0b0b"
  secondary: "#0b0b0b"
  muted: "#e3e2e1"
  accent: "#eaf3c9"
  destructive: "#aa3333"
  success: "oklch(0.58 0.13 134)"
  success-strong: "#3f6b1a"
  warning: "oklch(0.758 0.152 80.1)"
  warning-strong: "#8a6416"
  info: "oklch(0.635 0.089 195.1)"
  chart-1: "#cbff1e"
  chart-2: "oklch(0.758 0.152 80.1)"
  chart-2-strong: "#8a6416"
  chart-3: "oklch(0.635 0.089 195.1)"
  chart-3-strong: "oklch(0.483 0.089 195.1)"
  chart-4: "oklch(0.628 0.183 327.5)"
  chart-5: "oklch(0.554 0.16 287.7)"
typography:
  heading:
    fontFamily: Poppins
    fontWeight: 700
  body:
    fontFamily: Roboto
    fontWeight: 400
  quote:
    fontFamily: Pacifico
    fontWeight: 400
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  "2xl": 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
  text-foreground:
    typography: "{typography.body}"
    textColor: "{colors.foreground}"
  badge-muted:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  hover-accent:
    backgroundColor: "{colors.accent}"
  status-success:
    textColor: "{colors.success-strong}"
    backgroundColor: "{colors.success}"
  status-warning:
    textColor: "{colors.warning-strong}"
    backgroundColor: "{colors.warning}"
  status-info:
    backgroundColor: "{colors.info}"
  chart-1:
    backgroundColor: "{colors.chart-1}"
  chart-2:
    backgroundColor: "{colors.chart-2}"
    textColor: "{colors.chart-2-strong}"
  chart-3:
    backgroundColor: "{colors.chart-3}"
    textColor: "{colors.chart-3-strong}"
  chart-4:
    backgroundColor: "{colors.chart-4}"
  chart-5:
    backgroundColor: "{colors.chart-5}"
---

## Overview

Velocity Bedrock / Signal / Voltage applied through a shadcn/ui (new-york)
system on Tailwind v4 + next-themes. The normative palette, radii, and fonts
live in `src/app/globals.css` (OKLCH, light + dark); if this file and the code
disagree, the code wins and this file should be updated. Every UI change must
use tokens — a hardcoded color in a component is a defect.

## Colors

Brand core: Voltage `#cbff1e` (primary fill, accent, chart-1), Bedrock
`#0b0b0b` (foreground, secondary, dark background), Signal `#f1f0ef` (light
background). Status semantics: `success` olive (hue near Voltage), `warning`
amber (hue = chart-2), `info` teal (hue = chart-3), `destructive` brick.

Named brand tokens `bedrock`, `signal`, and `voltage` are also on the
Tailwind theme for direct use (logos, cinematic surfaces). Chrome gradient
is logo-only and is not a semantic UI token.

Rules:

- Semantic tokens only; never hardcoded hex/oklch in components.
- Voltage is a **surface/accent** in light mode (~1:1 on Signal) — never
  body text on a light surface. Buttons use Voltage fill with Bedrock text.
  Light-mode focus rings use Bedrock; dark-mode rings use Voltage.
- Surface tones (`success`, `warning`, chart-2/3) are **not text-safe** in
  light mode — for text use the darkened `-strong` variants
  (`success-strong`, `warning-strong`, `chart-2-strong`, `chart-3-strong`).
  In practice the strong text sits on `/10` tinted backgrounds (where it
  clears AA ~5:1), not on the full-saturation token — the linter's
  contrast warnings on `status-*` / `chart-*` pairs reflect that out-of-
  context pairing, not a real usage.
- Chart hues 1–5 are categorical; keep one hue → one meaning per page.
- Every change must work in both `:root` (light) and `.dark`.

## Typography

Poppins 700 for all headings (`h1`–`h6`, `font-heading`); Roboto
(`font-body`, the default) for body and UI; Pacifico (`font-quote`) only for
decorative brand moments. All webfonts load with `latin-ext` so Czech
diacritics render. Tiptap content has its own scale (see `.tiptap` in
globals.css) — don't override.

## Layout

Spacing follows the 4px scale (`sm`–`xl` above). List pages use the shared
`PageHeader` (`title`, `description`, `count`, `action`) inside `PageShell`.
Content width is max-w constrained; pages stay single-column on mobile.

## Elevation & Depth

Flat surfaces with 1px `border`; cards use `bg-card`/`border` + `rounded-lg`.
No heavy shadows. Hover = `accent` tint (`hover:bg-accent`).

## Shapes

Radii come from the `--radius: 0.5rem` scale (see `rounded` tokens).
`rounded-lg` for cards/dialogs, `rounded-md` for inputs/buttons — consistent
per surface type.

## Components

shadcn/ui (new-york), icons from lucide-react. Add primitives with
`npx shadcn add <component>` — never hand-roll or fork one.

| Need | Use |
|---|---|
| Buttons / links as buttons | `Button` variants |
| Destructive confirmation | responsive `AlertDialog` — never `window.confirm()` |
| Dialogs on mobile | `ResponsiveDialog` (sheet on small screens) |
| Empty states | `Empty`, `EmptyTitle`, `EmptyDescription`, … (`ui/empty.tsx`) |
| Page header / shell | `PageHeader` + `PageShell` |
| Toasts | sonner `Toaster` — one per mutating action |
| Focus ring | `focus-ring` utility / `ring-ring/50` |
| Icons | lucide-react, size-4/5, no emoji |
| Scrolling strips | `.no-scrollbar` utility |

## Do's and Don'ts

- **Do** use semantic tokens, shared primitives, `focus-ring`, both themes,
  `prefers-reduced-motion` guards on new animations.
- **Don't** hardcode colors, raw `<button>`, native `confirm()`, bespoke
  empty states, emoji-as-icons, or hardcoded dark-mode-unaware colors.

## Czech Cop
Language: `cs`. **NO generic masculine.** Apply these rules in strict order:

1. **NEUTRAL FIRST:** Always attempt neutral phrasing before gendering. Use present tense, direct address, common nouns (`osoba`, `lidé`), or participles (`studující`). *(e.g., "Čekáme na schválení", not "Čekáme na adminy").*
2. **SEPARATOR IS STRICTLY `:`**: If gendering is unavoidable (past tense, specific roles), use **only** a colon (`autor:ka`, `přidal:a`, `koučů:ek`). **NEVER** use `/`, `*`, `_`, or `()`. 
3. **ROLES:** Always `Student:ka`, `Mentor:ka`, `Kouč:ka`.
4. **EXCEPTIONS (Do not alter):** Names, quotes, titles, data-bound fields (e.g., `Autor`), and 1st-person plural (`Odeslali jsme`).deslali jsme", and data-bound labels (book `Autor` field).
