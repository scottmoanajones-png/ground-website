(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const {
    VALUE_WIDE_GRID_LAYOUT,
    VALUE_WIDE_GRID_SCROLL_TILT,
    createScene,
    createStreamSceneRenderer,
    resizeSceneRenderer,
  } = homepage;

  const usecaseStreamRenderers = [];

  function createUsecaseStreamRenderer(art) {
    const canvas = art.querySelector("canvas");
    if (!canvas) return null;

    const motionProfile = art.dataset.groundStreamMotion || "default";
    const sceneId = "usecase-" + motionProfile;

    const streamScene = createScene(sceneId, 30, 20, () => ({ h: 1, tone: "base" }));

    return createStreamSceneRenderer(canvas, {
      scene: streamScene,
      sceneAsset: {
        view: VALUE_WIDE_GRID_LAYOUT,
        stream: {
          surfaceTheme: art.dataset.surfaceTheme || "light"
        }
      },
      scrollElement: art,
      tiltMode: "exit",
      motionProfile,
      scrollTiltOptions: VALUE_WIDE_GRID_SCROLL_TILT,
      flatAtRest: true,
      surfaceTheme: art.dataset.surfaceTheme || "light"
    });
  }

  function initPlatformScene() {
    if (usecaseStreamRenderers.length) return;

    Array.from(document.querySelectorAll(".usecase-animation")).forEach((art) => {
      usecaseStreamRenderers.push(createUsecaseStreamRenderer(art));
    });

    usecaseStreamRenderers.forEach((r) => resizeSceneRenderer(r));
  }

  homepage.getUsecaseStreamRenderers = () => usecaseStreamRenderers;
  homepage.initPlatformScene = initPlatformScene;
  homepage.setPlatformScene = () => {};
  homepage.getPlatformRenderer = () => null;
})();
