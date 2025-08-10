import {
  seedInp,
  regenBtn,
  mountainAmpInp,
  valleyAmpInp,
  rebuildGround,
  rebuildAABBs,
  updateChunks,
  resetChunks,
  procToggle,
  toggleProcgen,
  setWorldSeed,
  setTerrainAmps,
  controls,
  heightAt,
  SEA_LEVEL,
} from './core/index.js';

// Generate a random 32-bit seed.
function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

// Align the player with the terrain at their current position.
function alignPlayerToGround() {
  const obj = controls.getObject();
  const terrainY = heightAt(obj.position.x, obj.position.z);
  // Keep the player above water if terrain is below sea level.
  const groundY = Math.max(terrainY, SEA_LEVEL) + 2;
  if (obj.position.y < groundY) {
    obj.position.y = groundY;
  }
}

// Apply seed and rebuild world when the regenerate button is pressed.
regenBtn.addEventListener('click', () => {
  let seed = parseInt(seedInp.value);
  if (!Number.isFinite(seed)) {
    seed = randomSeed();
    seedInp.value = seed;
  }
  setWorldSeed(seed);
  // Validate and apply mountain/valley amplification factors.
  let mAmp = parseFloat(mountainAmpInp.value);
  if (!Number.isFinite(mAmp)) {
    mAmp = 240;
    mountainAmpInp.value = mAmp;
  }
  let vAmp = parseFloat(valleyAmpInp.value);
  if (!Number.isFinite(vAmp)) {
    vAmp = 20;
    valleyAmpInp.value = vAmp;
  }
  setTerrainAmps(mAmp, vAmp);
  rebuildGround();
  rebuildAABBs();
  resetChunks();
  updateChunks(true);
  alignPlayerToGround();
});

// Toggle procedural object generation
procToggle.addEventListener('click', () => {
  const on = toggleProcgen();
  procToggle.textContent = on ? 'Objects: On' : 'Objects: Off';
});
