const state = {
  fallbackActive: false,
  isActive: false,
  mouseEnabled: false,
  worldSeed: 1,
};

// Update the global seed used for terrain and chunk generation.
function setWorldSeed(seed) {
  state.worldSeed = seed >>> 0;
}

export { state, setWorldSeed };
