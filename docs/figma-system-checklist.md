# Homepage system checklist

Use this as the shared cleanup list between the HTML source and the `Storyboards` page in Figma.

## Current read on the file

- `Storyboards` is a page-composition surface, not yet a component library.
- `Home Page` is already organized as a vertical stack of sections.
- The file currently has no local variable collections, no local text or paint styles, and no local component sets driving the homepage.

## Variables to create in Figma first

- Color: `paper`, `paper-soft`, `ink`, `ink-soft`, `ink-rule`, `yield`, `yield-soft`
- Type: display serif, body sans, mono label styles
- Spacing: `8`, `10`, `12`, `14`, `16`, `18`, `20`, `24`, `28`, `30`, `34`, `42`, `56`, `76`, `132`
- Layout: shell width, section spacing, hero height
- Effects: soft panel shadow, large atmospheric shadow

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
- Value card: `default`, `stream-dark`, `stream-light`
- Platform group: `default`, `active`
- Use-case card: `default`, `featured`

## Page-building rule

- Keep `Storyboards/Home Page` for composed screens.
- Create a separate page for reusable components and variables before tightening the other wireframes.
- Rebuild each storyboard section from components after the component patterns feel stable.

## Code mirror

- Tokens live in [tokens.css](/Users/scottjones/Documents/Codex/Ground/01-Current/homepage/source/styles/tokens.css:1).
- Shared primitives live in [components.css](/Users/scottjones/Documents/Codex/Ground/01-Current/homepage/source/styles/components.css:1).
- Section-specific styling lives in [styles/sections](/Users/scottjones/Documents/Codex/Ground/01-Current/homepage/source/styles/sections).
