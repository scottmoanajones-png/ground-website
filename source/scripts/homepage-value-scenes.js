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

    function createValueSceneRenderer(art) {
      const sceneId = art.dataset.groundScene;
      const canvas = art.querySelector("canvas");
      const assetPayload = resolveSceneAssetPayload(sceneId);

      if (assetPayload) {
        art.dataset.groundRenderer = assetPayload.sceneAsset.renderer;
        art.dataset.surfaceTheme =
          art.dataset.surfaceTheme ||
          (
            assetPayload.sceneAsset.stream && assetPayload.sceneAsset.stream.surfaceTheme
              ? assetPayload.sceneAsset.stream.surfaceTheme
              : "auto"
          );

        if (assetPayload.sceneAsset.renderer === "stream-grid") {
          if (art.dataset.groundGridStructure === "value-wide") {
            return createValueWideStreamRenderer(
              canvas,
              art,
              sceneId,
              assetPayload.sceneAsset.stream,
              art.dataset.groundStreamMotion || "default"
            );
          }

          return createStreamSceneRenderer(canvas, {
            scene: assetPayload.scene,
            sceneAsset: assetPayload.sceneAsset,
            shapeAsset: assetPayload.shapeAsset,
            scrollElement: art,
            motionProfile: art.dataset.groundStreamMotion || null,
            surfaceTheme: art.dataset.surfaceTheme || null
          });
        }

        return createSceneRenderer(canvas, {
          palette: "about",
          scene: assetPayload.scene,
          scrollElement: art,
          layoutOptions: assetPayload.sceneAsset.view
        });
      }

      if (art.dataset.groundRenderer === "stream-grid") {
        if (art.dataset.groundGridStructure === "value-wide") {
          return createValueWideStreamRenderer(
            canvas,
            art,
            sceneId,
            null,
            art.dataset.groundStreamMotion || "default"
          );
        }

        const streamScene = createScene("stream-" + sceneId, 30, 20, () => ({ h: 1, tone: "base" }));
        return createStreamSceneRenderer(canvas, {
          scene: streamScene,
          sceneAsset: {
            view: { scale: 1.9, cameraT: 0.02, padding: 4 },
            stream: { surfaceTheme: art.dataset.surfaceTheme || "light" }
          },
          scrollElement: art,
          tiltMode: "exit",
          motionProfile: art.dataset.groundStreamMotion || null,
          surfaceTheme: art.dataset.surfaceTheme || null
        });
      }

      return createSceneRenderer(canvas, {
        palette: "about",
        scene: SCENE_LIBRARY[sceneId] || aboutRouteScene,
        scrollElement: art
      });
    }

    function renderValueRenderer(renderer, now, dtSeconds) {
      if (!renderer) {
        return;
      }

      if (renderer.kind === "stream-grid") {
        renderStreamSceneRenderer(renderer, now, dtSeconds);
        return;
      }

      renderSceneRenderer(renderer, now);
    }


  function initAboutSceneRenderers() {
    if (aboutSceneRenderers.length) return;
    Array.from(document.querySelectorAll(".value-art")).forEach((art) => {
      aboutSceneRenderers.push(createValueSceneRenderer(art));
    });
    aboutSceneRenderers.forEach((renderer) => resizeSceneRenderer(renderer));
  }

  homepage.getAboutSceneRenderers = () => aboutSceneRenderers;
  homepage.renderValueRenderer = renderValueRenderer;
  homepage.initAboutSceneRenderers = initAboutSceneRenderers;
})();
