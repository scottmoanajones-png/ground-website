(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  homepage.initUsecaseShimmer?.();
  homepage.initAboutSceneRenderers?.();
  homepage.initPlatformScene?.();
  homepage.initHeroGrid?.();
  homepage.initFooterShimmer?.();
  homepage.initCTAStream?.();
})();
