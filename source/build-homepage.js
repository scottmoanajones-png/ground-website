const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");

const sourceDir = __dirname;
const stylesDir = path.join(sourceDir, "styles");
const scriptsDir = path.join(sourceDir, "scripts");
const homepageDir = path.resolve(sourceDir, "..");
const rootDir = path.resolve(sourceDir, "..");
const siteOrigin = "https://groundtech.co";
const basePath = process.env.BASE_PATH || "";
const ogSourceFile = path.join(rootDir, "assets", "Ground-og-image.jpg");
const ogOutputFile = path.join(homepageDir, "og-image.jpg");
const socialImage = `${siteOrigin}/og-image.jpg`;

function renderTemplate(relativePath, replacements = {}) {
  let template = fs.readFileSync(path.join(sourceDir, relativePath), "utf8").trim();
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return template;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(sourceDir, relativePath), "utf8"));
}

function hashContent(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

function cleanArtifacts() {
  const patterns = [
    { dir: stylesDir, re: /\.bundle\.css$/ },
    { dir: scriptsDir, re: /\.min\.js(\.map)?$/ },
  ];
  for (const { dir, re } of patterns) {
    for (const name of fs.readdirSync(dir)) {
      if (re.test(name)) fs.unlinkSync(path.join(dir, name));
    }
  }
}

cleanArtifacts();

function copyStaticAssets() {
  fs.copyFileSync(ogSourceFile, ogOutputFile);
}

copyStaticAssets();

function bundleCss(entryFiles) {
  const visited = new Set();
  const importRe = /@import\s+(?:url\()?["']([^"']+)["']\)?\s*;?/g;

  function walk(absPath) {
    const normalized = path.resolve(absPath);
    if (visited.has(normalized)) return "";
    visited.add(normalized);

    const css = fs.readFileSync(normalized, "utf8");
    const dir = path.dirname(normalized);
    return css.replace(importRe, (match, target) => {
      if (/^https?:/i.test(target)) return match;
      return walk(path.resolve(dir, target)) + "\n";
    });
  }

  return entryFiles.map((entryFile) => walk(path.join(stylesDir, entryFile))).join("\n");
}

function writeBundle(entryFiles, bundleName) {
  const bundled = bundleCss(entryFiles);
  const result = esbuild.transformSync(bundled, {
    loader: "css",
    minify: true,
  });
  const hash = hashContent(result.code);
  const outName = `${bundleName}.${hash}.bundle.css`;
  fs.writeFileSync(path.join(stylesDir, outName), result.code);
  return outName;
}

function minifyJs(entryFileName) {
  const inPath = path.join(scriptsDir, entryFileName);
  const base = entryFileName.replace(/\.js$/, "");
  const result = esbuild.transformSync(fs.readFileSync(inPath, "utf8"), {
    loader: "js",
    minify: true,
    sourcemap: "external",
    sourcefile: entryFileName,
    legalComments: "none",
  });
  const hash = hashContent(result.code);
  const outName = `${base}.${hash}.min.js`;
  const outPath = path.join(scriptsDir, outName);
  fs.writeFileSync(outPath, result.code + `\n//# sourceMappingURL=${outName}.map\n`);
  fs.writeFileSync(outPath + ".map", result.map);
  return outName;
}

function buildSocialMeta({ title, description, canonicalUrl }) {
  return `  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ground">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${socialImage}">
  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@ground_onchain">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${socialImage}">`;
}

function pageHead({ title, description, styleEntries, bundleName, canonicalUrl, socialMeta }) {
  const bundledCss = writeBundle(styleEntries, bundleName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/favicon-180.svg">
${socialMeta}
  <link rel="preload" as="font" type="font/woff2" href="../../assets/fonts/IBMPlexSerif-400.woff2" crossorigin>
  <script>document.documentElement.classList.add("js");</script>
  <link rel="stylesheet" href="source/styles/${bundledCss}">
</head>`;
}

function renderScripts(scripts) {
  return scripts.map((script) => `  <script src="source/scripts/${script}" defer></script>`).join("\n");
}

function renderBackerItems(backers, className) {
  return backers.map((b) => `          <span class="${className}">${b.name}</span>`).join("\n");
}

function renderProofItems(backers, variant = "light") {
  return backers.map((b, i) => `          <a class="proof-chip" href="${b.url}" target="_blank" rel="noopener" aria-label="${b.name}" data-reveal style="--delay: ${i * 80}ms;">
            <img src="../../assets/Logos/Investors/${b.logo}-${variant}.svg" alt="${b.name}" loading="lazy" decoding="async">
          </a>`).join("\n");
}

const commonScript = minifyJs("common.js");
const homepageFoundationScript = minifyJs("homepage-foundation.js");
const homepageValueScenesScript = minifyJs("homepage-value-scenes.js");
const homepagePlatformSceneScript = minifyJs("homepage-platform-scene.js");
const homepageHeroGridScript = minifyJs("homepage-hero-grid.js");
const homepageFooterShimmerScript = minifyJs("homepage-footer-shimmer.js");
const homepageUsecaseShimmerScript = minifyJs("homepage-usecase-shimmer.js");
const homepageCTAStreamScript = minifyJs("homepage-cta-stream.js");
const lazyGridScript = minifyJs("lazy-grid.js");
const homepageScript = minifyJs("homepage.js");
const error404SceneScript = minifyJs("404-scene.js");
const homepageScripts = [
  commonScript,
  homepageFoundationScript,
  homepageValueScenesScript,
  homepagePlatformSceneScript,
  homepageHeroGridScript,
  homepageFooterShimmerScript,
  homepageUsecaseShimmerScript,
  homepageCTAStreamScript,
  lazyGridScript,
  homepageScript,
];
const header = renderTemplate("sections/header.html");
const footer = renderTemplate("sections/footer.html");
const backers = readJson("content/backers.json");
const proofStrip = renderTemplate("sections/home/proof-strip.html", {
  BACKERS_PROOF_ITEMS: renderProofItems(backers),
});
const aboutBackers = renderTemplate("sections/about/backers.html", {
  BACKERS_PROOF_ITEMS: renderProofItems(backers, "dark"),
});

function renderPage({
  outputFile,
  title,
  description,
  styleEntries,
  bundleName,
  canonicalPath,
  sections,
  scripts,
}) {
  const canonicalUrl = canonicalPath ? `${siteOrigin}/${canonicalPath}` : siteOrigin;
  const html = `${pageHead({
    title,
    description,
    styleEntries,
    bundleName,
    canonicalUrl,
    socialMeta: buildSocialMeta({ title, description, canonicalUrl }),
  })}
<body id="top">
  <!-- Built from source/sections, source/styles, and source/scripts. -->
  <!-- Run: node source/build-homepage.js -->
  ${header}

  <main>
    ${sections.join("\n\n    ")}
  </main>

  ${footer}

${renderScripts(scripts)}
</body>
</html>
`;

  fs.writeFileSync(path.join(homepageDir, outputFile), html);
  console.log(`Built ${outputFile}`);
}

renderPage({
  outputFile: "index.html",
  title: "Ground — The Money Infrastructure Company",
  description: "Ground’s infrastructure supercharges any stablecoin or cash on your platform, transforming it into a high yield balance. Noncustodial, institutional-grade, API-first.",
  styleEntries: ["homepage.css"],
  bundleName: "homepage",
  canonicalPath: "",
  sections: [
    renderTemplate("sections/home/hero.html"),
    proofStrip,
    renderTemplate("sections/home/value.html"),
    renderTemplate("sections/home/platforms.html"),
    renderTemplate("sections/home/usecases.html"),
  ],
  scripts: homepageScripts,
});

renderPage({
  outputFile: "404.html",
  title: "404 — Ground",
  description: "The page you're looking for isn't here.",
  styleEntries: ["404.css"],
  bundleName: "404",
  canonicalPath: "404.html",
  sections: [renderTemplate("sections/404/main.html")],
  scripts: [commonScript, homepageFoundationScript, error404SceneScript],
});

renderPage({
  outputFile: "about.html",
  title: "About — Ground",
  description: "We're building the infrastructure to supercharge every balance. Ground moves liquidity, lending and leverage on-chain.",
  styleEntries: ["page-base.css", "sections/proof.css", "sections/about.css"],
  bundleName: "about",
  canonicalPath: "about.html",
  sections: [
    renderTemplate("sections/about/hero.html"),
    renderTemplate("sections/about/founders.html"),
    aboutBackers,
  ],
  scripts: [commonScript],
});

renderPage({
  outputFile: "contact.html",
  title: "Contact — Ground",
  description: "Get in touch with the Ground team. Build on solid Ground.",
  styleEntries: ["page-base.css", "sections/contact.css"],
  bundleName: "contact",
  canonicalPath: "contact.html",
  sections: [renderTemplate("sections/contact/main.html")],
  scripts: [commonScript],
});

renderPage({
  outputFile: "faq.html",
  title: "FAQ — Ground",
  description: "Frequently asked questions about Ground's on-chain yield infrastructure.",
  styleEntries: ["page-base.css", "sections/faq.css"],
  bundleName: "faq",
  canonicalPath: "faq.html",
  sections: [renderTemplate("sections/faq/main.html")],
  scripts: [commonScript],
});

renderPage({
  outputFile: "privacy.html",
  title: "Privacy Policy — Ground",
  description: "Ground Inc. Privacy Policy. Learn how we collect, use, and protect your personal information.",
  styleEntries: ["legal.css"],
  bundleName: "legal",
  canonicalPath: "privacy.html",
  sections: [renderTemplate("sections/legal/privacy.html")],
  scripts: [commonScript],
});

renderPage({
  outputFile: "terms.html",
  title: "Terms of Use — Ground",
  description: "Ground Inc. Terms of Use. The legally binding terms and conditions governing your use of the Ground Platform.",
  styleEntries: ["legal.css"],
  bundleName: "legal",
  canonicalPath: "terms.html",
  sections: [renderTemplate("sections/legal/terms.html")],
  scripts: [commonScript],
});

// ─── DIST BUILD ────────────────────────────────────────────────────────────────
// Produces a self-contained dist/ folder suitable for GitHub Pages or any static
// host. All assets are copied in; all paths are root-relative (/css/, /js/, etc.)
// so the folder can be served from any origin without "works on my machine" risk.

(function buildDist() {
  const distDir = path.join(homepageDir, "dist");

  // Clean and recreate dist/
  if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
  for (const d of [
    "css", "js",
    "assets/fonts",
    "assets/grid/generated",
    "assets/logos/investors",
    "assets/photos",
  ]) {
    fs.mkdirSync(path.join(distDir, d), { recursive: true });
  }

  // Copy fonts
  const fontsDir = path.join(rootDir, "assets", "fonts");
  for (const f of fs.readdirSync(fontsDir)) {
    fs.copyFileSync(path.join(fontsDir, f), path.join(distDir, "assets/fonts", f));
  }

  // Copy grid library
  const gridDir = path.join(rootDir, "assets", "grid");
  fs.copyFileSync(
    path.join(gridDir, "grid-library.js"),
    path.join(distDir, "assets/grid/grid-library.js"),
  );
  fs.copyFileSync(
    path.join(gridDir, "generated", "library.generated.js"),
    path.join(distDir, "assets/grid/generated/library.generated.js"),
  );

  // Copy investor logos
  const investorLogosDir = path.join(rootDir, "assets", "Logos", "Investors");
  for (const f of fs.readdirSync(investorLogosDir)) {
    fs.copyFileSync(
      path.join(investorLogosDir, f),
      path.join(distDir, "assets/logos/investors", f),
    );
  }

  // Copy wordmark
  fs.copyFileSync(
    path.join(rootDir, "assets", "Logos", "ground-wordmark.svg"),
    path.join(distDir, "assets/logos/ground-wordmark.svg"),
  );

  // Copy founder photos
  const photosDir = path.join(rootDir, "assets", "photos");
  for (const f of fs.readdirSync(photosDir)) {
    fs.copyFileSync(path.join(photosDir, f), path.join(distDir, "assets/photos", f));
  }

  // Copy root assets
  fs.copyFileSync(ogOutputFile, path.join(distDir, "og-image.jpg"));
  fs.copyFileSync(path.join(homepageDir, "favicon.svg"), path.join(distDir, "favicon.svg"));
  fs.copyFileSync(path.join(homepageDir, "favicon-180.svg"), path.join(distDir, "favicon-180.svg"));

  // ── CSS: bundle with font paths rewritten to root-relative ──────────────────
  function bundleCssForDist(entryFiles) {
    const raw = bundleCss(entryFiles);
    // fonts.css uses ../../../../assets/fonts/ relative to source/styles/
    return raw.replace(/url\(["']?(?:\.\.\/)*assets\/fonts\//g, 'url("/assets/fonts/');
  }

  function writeBundleForDist(entryFiles, bundleName) {
    const bundled = bundleCssForDist(entryFiles);
    const result = esbuild.transformSync(bundled, { loader: "css", minify: true });
    const hash = hashContent(result.code);
    const outName = `${bundleName}.${hash}.bundle.css`;
    fs.writeFileSync(path.join(distDir, "css", outName), result.code);
    return outName;
  }

  // ── JS: minify with grid paths rewritten to root-relative ───────────────────
  function minifyJsForDist(entryFileName) {
    const inPath = path.join(scriptsDir, entryFileName);
    let source = fs.readFileSync(inPath, "utf8");

    // lazy-grid.js loads grid assets relative to the page; rewrite for dist
    source = source
      .replace(
        /["']\.\.\/\.\.\/assets\/grid\/generated\/library\.generated\.js["']/,
        '"/assets/grid/generated/library.generated.js"',
      )
      .replace(
        /["']\.\.\/\.\.\/assets\/grid\/grid-library\.js["']/,
        '"/assets/grid/grid-library.js"',
      );

    const base = entryFileName.replace(/\.js$/, "");
    const result = esbuild.transformSync(source, {
      loader: "js",
      minify: true,
      legalComments: "none",
    });
    const hash = hashContent(result.code);
    const outName = `${base}.${hash}.min.js`;
    fs.writeFileSync(path.join(distDir, "js", outName), result.code);
    return outName;
  }

  // ── Build all dist JS ────────────────────────────────────────────────────────
  const dCommon              = minifyJsForDist("common.js");
  const dFoundation          = minifyJsForDist("homepage-foundation.js");
  const dValueScenes         = minifyJsForDist("homepage-value-scenes.js");
  const dPlatformScene       = minifyJsForDist("homepage-platform-scene.js");
  const dHeroGrid            = minifyJsForDist("homepage-hero-grid.js");
  const dFooterShimmer       = minifyJsForDist("homepage-footer-shimmer.js");
  const dUsecaseShimmer      = minifyJsForDist("homepage-usecase-shimmer.js");
  const dCtaStream           = minifyJsForDist("homepage-cta-stream.js");
  const dLazyGrid            = minifyJsForDist("lazy-grid.js");
  const dHomepage            = minifyJsForDist("homepage.js");
  const d404Scene            = minifyJsForDist("404-scene.js");

  const dHomepageScripts = [
    dCommon, dFoundation, dValueScenes, dPlatformScene,
    dHeroGrid, dFooterShimmer, dUsecaseShimmer, dCtaStream, dLazyGrid, dHomepage,
  ];

  // ── HTML helpers for dist ────────────────────────────────────────────────────
  function distPageHead({ title, description, styleEntries, bundleName, canonicalUrl, socialMeta }) {
    const bundledCss = writeBundleForDist(styleEntries, bundleName);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${basePath ? `<base href="${basePath}">` : ""}
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/favicon-180.svg">
${socialMeta}
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/IBMPlexSerif-400.woff2" crossorigin>
  <script>document.documentElement.classList.add("js");</script>
  <link rel="stylesheet" href="/css/${bundledCss}">
</head>`;
  }

  function distRenderScripts(scripts) {
    return scripts.map((s) => `  <script src="/js/${s}" defer></script>`).join("\n");
  }

  // Rewrite all relative asset paths in rendered HTML to root-relative dist paths
  function distFixAssetPaths(html) {
    return html
      .replace(/src="\.\.\/\.\.\/assets\/Logos\/Investors\//g, 'src="/assets/logos/investors/')
      .replace(/src="\.\.\/\.\.\/assets\/Logos\/ground-wordmark\.svg"/g, 'src="/assets/logos/ground-wordmark.svg"')
      .replace(/src="\.\.\/\.\.\/assets\/photos\//g, 'src="/assets/photos/');
  }

  function distRenderPage({
    outputFile, title, description, styleEntries, bundleName, canonicalPath, sections, scripts,
  }) {
    const canonicalUrl = canonicalPath ? `${siteOrigin}/${canonicalPath}` : siteOrigin;
    const html = distFixAssetPaths(`${distPageHead({
      title, description, styleEntries, bundleName, canonicalUrl,
      socialMeta: buildSocialMeta({ title, description, canonicalUrl }),
    })}
<body id="top">
  ${header}

  <main>
    ${sections.join("\n\n    ")}
  </main>

  ${footer}

${distRenderScripts(scripts)}
</body>
</html>
`);
    fs.writeFileSync(path.join(distDir, outputFile), html);
    console.log(`dist: ${outputFile}`);
  }

  // ── Render all pages ─────────────────────────────────────────────────────────
  distRenderPage({
    outputFile: "index.html",
    title: "Ground — The Money Infrastructure Company",
    description: "Ground's infrastructure supercharges any stablecoin or cash on your platform, transforming it into a high yield balance. Noncustodial, institutional-grade, API-first.",
    styleEntries: ["homepage.css"],
    bundleName: "homepage",
    canonicalPath: "",
    sections: [
      renderTemplate("sections/home/hero.html"),
      proofStrip,
      renderTemplate("sections/home/value.html"),
      renderTemplate("sections/home/platforms.html"),
      renderTemplate("sections/home/usecases.html"),
    ],
    scripts: dHomepageScripts,
  });

  distRenderPage({
    outputFile: "404.html",
    title: "404 — Ground",
    description: "The page you're looking for isn't here.",
    styleEntries: ["404.css"],
    bundleName: "404",
    canonicalPath: "404.html",
    sections: [renderTemplate("sections/404/main.html")],
    scripts: [dCommon, dFoundation, d404Scene],
  });

  distRenderPage({
    outputFile: "about.html",
    title: "About — Ground",
    description: "We're building the infrastructure to supercharge every balance. Ground moves liquidity, lending and leverage on-chain.",
    styleEntries: ["page-base.css", "sections/proof.css", "sections/about.css"],
    bundleName: "about",
    canonicalPath: "about.html",
    sections: [
      renderTemplate("sections/about/hero.html"),
      renderTemplate("sections/about/founders.html"),
      aboutBackers,
    ],
    scripts: [dCommon],
  });

  distRenderPage({
    outputFile: "contact.html",
    title: "Contact — Ground",
    description: "Get in touch with the Ground team. Build on solid Ground.",
    styleEntries: ["page-base.css", "sections/contact.css"],
    bundleName: "contact",
    canonicalPath: "contact.html",
    sections: [renderTemplate("sections/contact/main.html")],
    scripts: [dCommon],
  });

  distRenderPage({
    outputFile: "faq.html",
    title: "FAQ — Ground",
    description: "Frequently asked questions about Ground's on-chain yield infrastructure.",
    styleEntries: ["page-base.css", "sections/faq.css"],
    bundleName: "faq",
    canonicalPath: "faq.html",
    sections: [renderTemplate("sections/faq/main.html")],
    scripts: [dCommon],
  });

  distRenderPage({
    outputFile: "privacy.html",
    title: "Privacy Policy — Ground",
    description: "Ground Inc. Privacy Policy. Learn how we collect, use, and protect your personal information.",
    styleEntries: ["legal.css"],
    bundleName: "legal",
    canonicalPath: "privacy.html",
    sections: [renderTemplate("sections/legal/privacy.html")],
    scripts: [dCommon],
  });

  distRenderPage({
    outputFile: "terms.html",
    title: "Terms of Use — Ground",
    description: "Ground Inc. Terms of Use. The legally binding terms and conditions governing your use of the Ground Platform.",
    styleEntries: ["legal.css"],
    bundleName: "legal",
    canonicalPath: "terms.html",
    sections: [renderTemplate("sections/legal/terms.html")],
    scripts: [dCommon],
  });

  // ── Hosting essentials ───────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(distDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`,
  );

  const sitemapPages = ["", "about.html", "contact.html", "faq.html", "privacy.html", "terms.html"];
  fs.writeFileSync(
    path.join(distDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      sitemapPages
        .map((p) => `  <url><loc>${siteOrigin}/${p}</loc></url>`)
        .join("\n")
    }\n</urlset>\n`,
  );

  console.log(`dist/ ready — ${path.relative(process.cwd(), distDir)}`);
}());
