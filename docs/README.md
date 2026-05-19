# Homepage workflow

This directory contains the editable source for the Ground marketing site pages in `/Users/scottjones/Documents/Codex/Ground/01-Current/homepage`.

Edit the homepage in these places:

- `source/sections/*.html` for page structure, copy, and section markup
- `source/content/*.json` for shared content such as backers
- `source/styles/tokens.css` for shared design tokens
- `source/styles/components.css` for page-wide primitives and reusable patterns
- `source/styles/sections/*.css` for section-specific styling
- `source/styles/homepage.css` as the homepage stylesheet entry
- `source/scripts/common.js` for shared page interactions
- `source/scripts/homepage.js` as the tiny homepage bootstrap

Homepage script ownership:

- `source/scripts/homepage-foundation.js` for shared math helpers, scene construction, and the base renderers
- `source/scripts/homepage-value-scenes.js` for the value-card scene setup
- `source/scripts/homepage-platform-scene.js` for the platform callout scene and control state
- `source/scripts/homepage-hero-grid.js` for the hero canvas, logo animation, and shared frame loop
- `source/scripts/homepage-footer-shimmer.js` for the footer shimmer effect
- `source/scripts/homepage-usecase-shimmer.js` for the usecase-card shimmer behavior
- `source/scripts/homepage-cta-stream.js` for the CTA card canvas animation (standalone — no foundation dependency)
- `source/scripts/lazy-grid.js` for deferred loading of the grid asset library

Working rule for edits:

- If the change affects scene math, projection, palettes, or shared renderer behavior, start in `homepage-foundation.js`.
- If the change is isolated to one homepage section, work in that section's module first and only pull shared code down into `homepage-foundation.js` when two or more modules need it.
- Keep cross-module exports on `window.GroundHomepage` so the bootstrap and build order stay predictable.

Platform scene animation:

- `homepage-platform-scene.js` runs its own `requestAnimationFrame` loop that mutates `platformRenderer.activeSignals` (a `Set<"col:row">` string) each frame.
- The foundation renderer reads `activeSignals` when drawing to determine which cells render as signal (green). No foundation changes are needed to drive new platform animations — only update `activeSignals`.
- Cell key format is `"col:row"` (e.g. `"11:4"` = column 11, row 4). Verify against `createPlatformScene` in `homepage-foundation.js` if adding new signals.

Grow balance bars:

- Bar heights are defined in `applyGrowBalanceBarsProfile` inside `homepage-foundation.js` via the `bars` array (`maxHeight` field).
- `getSceneLayout` uses the animated `currentHeights` for bounding-box calculation, so large `maxHeight` values cause the camera to zoom in/out as bars animate. Keep `maxHeight` modest (≤ 9) to avoid scale oscillation during scroll.
- Do not add per-cell height noise (`textureOffset`-style terms) to bar heights — it breaks the clean stair-step silhouette.

Use [figma-system-checklist.md](/Users/scottjones/Documents/Codex/Ground/01-Current/homepage/docs/figma-system-checklist.md:1) to keep the Figma cleanup aligned with the code structure.

## Building

```bash
npm run build
```

Emits hashed CSS/JS bundles under `source/styles` and `source/scripts`, assembles HTML pages at the root of `01-Current/homepage`, **and** produces a self-contained `dist/` folder (see below).

## Deploying

```bash
npm run build         # always produces dist/ as part of the build
npm run preview       # serve dist/ locally on http://localhost:4000
```

`dist/` is self-contained — every asset is copied in, every path is root-relative. Serve the `dist/` folder from any static host.

### GitHub Pages

1. Push the `dist/` folder to your deploy branch (or use a GitHub Action).
2. In repository Settings → Pages, set source to the `dist/` folder.
3. Add a custom domain if needed (`groundtech.co`).

### Netlify / Vercel / any static host

Point the publish directory to `dist/`. No extra config required.

### Webflow (client handoff)

For a Webflow-hosted site, the cleanest handoff is to share the `dist/` folder as a zip — the client's developer can import the HTML/CSS/JS manually, or use it as a reference for recreation in the Webflow canvas.

## Build behavior

- Do not hand-edit `source/styles/*.bundle.css` or `source/scripts/*.min.js`; they are generated on each build.
- `source/build-homepage.js` bundles CSS through the local `@import` graph, minifies and hashes CSS/JS, and writes HTML for both the local `homepage/` and `dist/`.
- `dist/` gets root-relative paths (`/css/`, `/js/`, `/assets/`). Local `homepage/` HTML uses relative paths (`source/styles/`, `source/scripts/`, `../../assets/`).
- Shared content like backers lives in `source/content/*.json`, not duplicated across section partials.
- `renderProofItems(backers, variant)` accepts `"light"` (dark backgrounds) or `"dark"` (light backgrounds). The proof-strip uses `-light.svg`; the about backers section uses `-dark.svg`.
- The proof-strip component (`sections/proof.css`) has a `.proof-strip--light` modifier. Add `sections/proof.css` to that page's `styleEntries` when using it on a light-background page.

## Local preview (source build)

Serve the repo root (`01-Current/homepage/../../..`) and open `01-Current/homepage/index.html` in a browser. Serving only `01-Current/homepage` will break the relative `../../assets/` paths for fonts, logos, and photos.

**Preferred approach:** use `npm run preview` which serves the fully self-contained `dist/` and always works.

## Upstream dependencies

- `assets/grid/generated/library.generated.js` is produced by `02-Tools/build-grid-library.js`.
- Homepage fonts and shared logos live under `Codex/Ground/assets`; the build copies them into `dist/assets/` automatically.
