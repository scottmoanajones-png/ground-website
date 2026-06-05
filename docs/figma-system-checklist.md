# Homepage system checklist

Use this as the shared cleanup list between the HTML source and the `Storyboards` page in Figma.

## Current read on the file

- `Storyboards` is a page-composition surface, not yet a component library.
- `Home Page` is already organized as a vertical stack of sections.
- The file currently has no local variable collections, no local text or paint styles, and no local component sets driving the homepage.

## Variables to create in Figma first

- Color:
  `paper (#ECF1F0)`,
  `paper-soft (#F2F6F5)`,
  `paper-strong (#E3EAE8)`,
  `dark-base (#19211D)`,
  `dark-surface (#253932)`,
  `text-secondary (#5A625F)`,
  `text-tertiary (#8B918E)`,
  `border-subtle (#D1D9D8)`,
  `brand (#0B8A4D)`,
  `brand-bright (#2EA866)`,
  `success (#16693A)`,
  `warning (#B88219)`,
  `error (#B23A34)`,
  `info (#2F628F)`,
  `signal-deep (#4BC380)`,
  `signal-mid (#73BE8E)`,
  `signal-bright (#91E1AC)`,
  `glow-soft (#BAE6CD)`
- Type: display serif, body sans, mono label styles
  Official working set:
  `label-xs 12`,
  `ui-base 16`,
  `reading-base 21`,
  `title-s 28`,
  `title-m 37`,
  `section 50`,
  `hero 67`,
  `display-xl 89`,
  `display-xxl 118 (rare extension)`
- Spacing: `8`, `10`, `12`, `14`, `16`, `18`, `20`, `24`, `28`, `30`, `34`, `42`, `56`, `76`, `132`
- Layout: shell width, section spacing, hero height
- Effects: soft panel shadow, large atmospheric shadow

## Palette rule

- Use the official color set above as the default working system in Figma.
- Keep the official local paint styles under the `Ground/V1/...` prefix so the locked palette reads consistently in the file.
- Treat `success`, `warning`, `error`, and `info` as the only official semantic status hues unless the product surface proves a real need for more.
- Keep `success` visually related to the Ground green family, but distinct enough from `brand` that operational state and primary CTA are not the same token.
- Do not recreate separate `about`, `platform`, and `stream` animation palettes as first-class design tokens.
- Treat animation colors as one shared family:
  dark/light surfaces can change by context,
  but the signal range should come from the same `signal-deep`, `signal-mid`, `signal-bright`, and `glow-soft` tokens.
- If a live renderer still uses an extra implementation-only color, document it as a reference value before promoting it into the official set.

## Type rule

- Treat the type system as role-based, not tag-based.
- `21px` is the default reading base for prose and lead copy.
- `16px` is the compact UI/legal base for forms, utility text, and dense supporting content.
- Do not name or organize type tokens around `h1`, `h2`, `h3`, etc. Use semantic HTML tags for document structure, then map them onto the right type role per context.

## Shape rule

- Ground is a square brand.
- Default corners should be `0px` across cards, frames, panels, and containers.
- If a corner needs easing, keep it to `1px` or `2px` maximum.
- Before adding any larger radius, assume it is off-brand and justify it explicitly.

## Components to formalize

- Header / nav
- Primary button
- Secondary button
- Eyebrow label
- Proof chip
- Value card
- Platform group
- Platform chip
- Use-case card
- Footer column

## Variants worth defining

- Button: `light`, `outline`
- Nav: `desktop`, `mobile-open`, `mobile-closed`
- Value card: `default`, `stream-light`
- Platform group: `default`, `active`
- Use-case card: `default`, `featured`

## Page-building rule

- Keep `Storyboards/Home Page` for composed screens.
- Create a separate page for reusable components and variables before tightening the other wireframes.
- Rebuild each storyboard section from components after the component patterns feel stable.

## Code mirror

- Tokens live in [tokens.css](/Users/scottjones/Documents/Codex/Ground/01-Current/website/source/styles/tokens.css:1).
- Shared primitives live in [components.css](/Users/scottjones/Documents/Codex/Ground/01-Current/website/source/styles/components.css:1).
- Section-specific styling lives in [styles/sections](/Users/scottjones/Documents/Codex/Ground/01-Current/website/source/styles/sections).
