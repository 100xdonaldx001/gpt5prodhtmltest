const state = {
  fallbackActive: false,
  isActive: false,
  mouseEnabled: false,
  worldSeed: 1,
  mountainAmp: 240,
  valleyAmp: 20,
  terrainType: 'terragen',
};

// Update the global seed used for terrain and chunk generation.
function setWorldSeed(seed) {
  state.worldSeed = seed >>> 0;
}

// Update terrain amplification factors for mountains and valleys.
function setTerrainAmps(mountain, valley) {
  state.mountainAmp = mountain;
  state.valleyAmp = valley;
}

// Select the terrain generation algorithm.
function setTerrainType(type) {
  state.terrainType = type;
}

export { state, setWorldSeed, setTerrainAmps, setTerrainType };
