(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const {
    VALUE_WIDE_GRID_LAYOUT,
    VALUE_WIDE_GRID_SCROLL_TILT,
    resolveSceneAssetPayload,
    createScene,
    createStreamSceneRenderer,
    createSceneRenderer,
    resizeSceneRenderer,
    renderStreamSceneRenderer,
    renderSceneRenderer,
    SCENE_LIBRARY,
    aboutRouteScene
  } = homepage;

  const aboutSceneRenderers = [];

  // ── Stream renderer constructors (preserved for future usecase pairing) ──────

  function createValueWideStreamRenderer(canvas, art, sceneId, streamConfig, motionProfile) {
    const streamScene = createScene("value-wide-" + motionProfile + "-" + sceneId, 30, 20, () => ({
      h: 1,
      tone: "base"
    }));

    return createStreamSceneRenderer(canvas, {
      scene: streamScene,
      sceneAsset: {
        view: VALUE_WIDE_GRID_LAYOUT,
        stream: {
          ...(streamConfig || {}),
          surfaceTheme: art.dataset.surfaceTheme || "light"
        }
      },
      scrollElement: art,
      tiltMode: "exit",
      motionProfile,
      scrollTiltOptions: VALUE_WIDE_GRID_SCROLL_TILT,
      flatAtRest: true,
      surfaceTheme: art.dataset.surfaceTheme || null
    });
  }

  function createValueStreamRenderer(art, motionProfile) {
    const sceneId = "save-time-converge-stream";
    const canvas = art.querySelector("canvas");
    const assetPayload = resolveSceneAssetPayload(sceneId);

    if (assetPayload && art.dataset.groundGridStructure === "value-wide") {
      return createValueWideStreamRenderer(
        canvas,
        art,
        sceneId,
        assetPayload.sceneAsset.stream,
        motionProfile
      );
    }

    return createValueWideStreamRenderer(canvas, art, sceneId, null, motionProfile);
  }

  // ── Icon renderer ─────────────────────────────────────────────────────────────

  // Stable off-screen element: getScrollTilt() returns 0 → view stays top-down.
  const FLAT_VIEW_SENTINEL = { getBoundingClientRect: () => ({ top: 99999 }) };

  function createValueIconRenderer(iconEl) {
    const sceneId = iconEl.dataset.groundScene;
    if (!sceneId) return null;

    const canvas = iconEl.querySelector("canvas");
    if (!canvas) return null;

    const payload = resolveSceneAssetPayload(sceneId);
    if (!payload) return null;

    return createSceneRenderer(canvas, {
      palette: "value-icon",
      scene: payload.scene,
      layoutOptions: payload.sceneAsset.view,
      scrollElement: FLAT_VIEW_SENTINEL
    });
  }

  // ── Shared render dispatch ────────────────────────────────────────────────────

  function renderValueRenderer(renderer, now, dtSeconds) {
    if (!renderer) return;

    if (renderer.kind === "stream-grid") {
      renderStreamSceneRenderer(renderer, now, dtSeconds);
      return;
    }

    renderSceneRenderer(renderer, now);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function _doInitIconRenderers() {
    if (aboutSceneRenderers.length) return;
    Array.from(document.querySelectorAll(".value-icon")).forEach((iconEl) => {
      aboutSceneRenderers.push(createValueIconRenderer(iconEl));
    });
    aboutSceneRenderers.forEach((renderer) => resizeSceneRenderer(renderer));
  }

  function initAboutSceneRenderers() {
    if (window.GroundGridAssets) {
      _doInitIconRenderers();
    } else {
      document.addEventListener("ground-grid-ready", _doInitIconRenderers, { once: true });
    }
  }

  homepage.getAboutSceneRenderers = () => aboutSceneRenderers;
  homepage.renderValueRenderer    = renderValueRenderer;
  homepage.initAboutSceneRenderers = initAboutSceneRenderers;

  // Expose stream constructors for future usecase pairing
  homepage.createValueWideStreamRenderer  = createValueWideStreamRenderer;
  homepage.createValueStreamRenderer      = createValueStreamRenderer;
})();
