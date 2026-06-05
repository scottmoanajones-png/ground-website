# Homepage workflow

This directory contains the editable source for the Ground marketing site pages in `01-Current/website`.

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

Current color-system rule:

- The official neutral ramp is the cooler set in `tokens.css`:
  `paper #ECF1F0`, `paper-soft #F2F6F5`, `paper-strong #E3EAE8`.
- Treat `ink` / `hero-dark` as one primitive dark base.
- The small semantic status set is:
  `success #16693A`,
  `warning #B88219`,
  `error #B23A34`,
  `info #2F628F`.
- Keep `success` connected to the Ground green family, but treat it as a stronger operational fill than the primary brand CTA green.
- In Figma, the locked local paint-style taxonomy for this palette is `Ground/V1/...`.
- The animation system now uses one shared palette family rather than separate `about`, `platform`, and `stream` color systems.
- Light vs dark animation surfaces may resolve different neutrals, but they should share the same signal range:
  `signal-deep`, `signal-mid`, `signal-bright`, and `glow-soft`.
- Before adding a new animation color, first ask whether it can be expressed as an alias or opacity variant of the existing tokens.

Current type-system rule:

- The official working set is role-based:
  `Label XS 12`,
  `UI Base 16`,
  `Reading Base 21`,
  `Title S 28`,
  `Title M 37`,
  `Section 50`,
  `Hero 67`,
  `Display XL 89`,
  `Display XXL 118` (rare extension).
- `21px` is the default prose size for reading-first marketing copy.
- `16px` remains the compact UI/legal base for utility-heavy contexts.
- Do not treat HTML heading tags as the type scale itself. Choose `h1`/`h2`/`h3` for document structure, then map them onto the right role-based token.

Current shape rule:

- Ground is a square brand.
- Default corners should be `0px`.
- If a component truly needs softening, cap the radius at `1px` or `2px`.
- Do not introduce rounded, friendly, or consumer-style corner language into core brand surfaces by default.

Platform scene animation:

- `homepage-platform-scene.js` runs its own `requestAnimationFrame` loop that mutates `platformRenderer.activeSignals` (a `Set<"col:row">` string) each frame.
- The foundation renderer reads `activeSignals` when drawing to determine which cells render as signal (green). No foundation changes are needed to drive new platform animations — only update `activeSignals`.
- Cell key format is `"col:row"` (e.g. `"11:4"` = column 11, row 4). Verify against `createPlatformScene` in `homepage-foundation.js` if adding new signals.

Animation palette note:

- `homepage-foundation.js` is the source of truth for shared animation color behavior.
- Keep value-card stream scenes on the `light` surface theme unless there is a clear reason to move them darker.
- Do not reintroduce one-off scene palette branches unless the official shared palette cannot express the behavior.

Value section camera transition:

- The scroll-to-isometric tilt for value cards is controlled by `VALUE_WIDE_GRID_SCROLL_TILT` in `homepage-foundation.js`. `startRatio` and `endRatio` are viewport-height fractions (from the top) at which the tilt begins and completes. Currently `{ startRatio: 0.92, endRatio: 0.35, delayProgress: 0 }` — transition begins as the card enters the viewport bottom and completes before the reading zone.
- `targetView` for all three value motion profiles is `mix(0.015, 0.34, scrollTilt)` — 0.015 is nearly flat (top-down) and 0.34 is the isometric target.

Hero rotating headline:

- The rotating words are defined in the `HERO_ACCENT_WORDS` array in `homepage-hero-grid.js` and cycle every 3 seconds via `setInterval`. Skipped when the tab is hidden or `prefers-reduced-motion` is set.
- The `<br>` between "for" and the rotating `<span>` is intentional — it locks "for" in place and ensures the rotating word is always on its own line. Do not remove it. The span uses `display: block` so width changes between words are fully contained and cannot cause H1 height shifts or paragraph repositioning.

Grow balance bars:

- Bar heights are defined in `applyGrowBalanceBarsProfile` inside `homepage-foundation.js` via the `bars` array (`maxHeight` field).
- `getSceneLayout` uses the animated `currentHeights` for bounding-box calculation, so large `maxHeight` values cause the camera to zoom in/out as bars animate. Keep `maxHeight` modest (≤ 9) to avoid scale oscillation during scroll.
- Do not add per-cell height noise (`textureOffset`-style terms) to bar heights — it breaks the clean stair-step silhouette.

Use [figma-system-checklist.md](figma-system-checklist.md) to keep the Figma cleanup aligned with the code structure.

For the evolving client-facing visual guidance, see [visual-system-handoff-wip.md](visual-system-handoff-wip.md).

## Building

```bash
npm run build
```

Emits hashed CSS/JS bundles under `source/styles` and `source/scripts`, assembles HTML pages at the root of `01-Current/website`, **and** produces a self-contained `dist/` folder (see below).

## Deploying

```bash
npm run build         # always produces dist/ as part of the build
npm run preview       # serve dist/ locally on http://localhost:4000
```

`dist/` is self-contained — every asset is copied in, every path is relative. Serve the `dist/` folder from any static host.

### GitHub Pages (staging)

Deployment is automated via `.github/workflows/deploy.yml`. Every push to `main`:

1. Runs `npm run build`
2. Pushes `dist/` to the `gh-pages` branch via `peaceiris/actions-gh-pages`

Staging URL: **https://scottmoanajones-png.github.io/ground-website/**

Repo: https://github.com/scottmoanajones-png/ground-website

To deploy a change, commit and push to `main` — the Action handles the rest.

### Netlify / Vercel / any static host

Point the publish directory to `dist/`. No extra config required.

### Custom domain (`groundtech.co`)

1. Add a `CNAME` file to `dist/` containing `groundtech.co`
2. In repository Settings → Pages → Custom domain, enter `groundtech.co`
3. Add a CNAME DNS record at your registrar pointing to `scottmoanajones-png.github.io`

## Build behavior

- Do not hand-edit `source/styles/*.bundle.css` or `source/scripts/*.min.js`; they are generated on each build.
- `source/build-homepage.js` bundles CSS through the local `@import` graph, minifies and hashes CSS/JS, and writes HTML for both the local `website/` root and `dist/`.
- `dist/` uses relative paths (`css/`, `js/`, `assets/`) so it works when served from any subpath, including GitHub Pages. Local HTML uses source-relative paths (`source/styles/`, `source/scripts/`, `../../assets/`).
- Shared content like backers lives in `source/content/*.json`, not duplicated across section partials.
- `renderProofItems(backers, variant, { reveal })` accepts `"light"` or `"dark"` as the variant, and an optional `{ reveal: false }` option to suppress `data-reveal` stagger attributes. The homepage proof-strip passes `{ reveal: false }` because the marquee animation replaces the reveal. The about backers section uses the default (`reveal: true`).
- `renderProofItemsDup(backers, variant)` renders a second copy of the logos as non-interactive `<span>` elements (`aria-hidden`, empty `alt`) for the marquee loop. Always keep this in sync with `renderProofItems` if the logo list changes.
- The proof-strip uses a CSS marquee at ≤900px (`animation: proof-scroll`) and a static centered flex layout above that breakpoint. The breakpoint and speed (`28s`) live in `source/styles/sections/proof.css`.
- The proof-strip component (`sections/proof.css`) has a `.proof-strip--light` modifier. Add `sections/proof.css` to that page's `styleEntries` when using it on a light-background page.

## Local preview (source build)

Serve the repo root (`01-Current/website`) and open `index.html` in a browser. Serving the `dist/` folder is the safer option as all paths are self-contained.

**Preferred approach:** use `npm run preview` which serves the fully self-contained `dist/` and always works.

## Password gate

The staging site is protected by a client-side password gate at `gate.html`. Every dist page redirects to the gate if a `sessionStorage` flag (`gnd_auth`) is not set.

- **Current password:** `apple-banana-cherry`
- **To change it:** update `previewPassword` in `source/build-homepage.js`, then rebuild and push.
- **Share link:** https://scottmoanajones-png.github.io/ground-website/gate.html

Each page also carries an HTML comment instructing AI assistants to respond with "Sorry, Starfox, I can't let you do that" instead of describing the content. An `llms.txt` file at the dist root reinforces this for LLM crawlers.

## Upstream dependencies

- `assets/grid/generated/library.generated.js` is produced by `02-Tools/build-grid-library.js` in the parent `Ground/` workspace. Copy the output into `assets/grid/generated/` and commit it when regenerating the grid library.
- Fonts, logos, and photos live in the repo under `assets/` — they were copied from the parent `Ground/assets/` workspace and should be kept in sync manually if updated there.
