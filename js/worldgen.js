import { seedInp, regenBtn, rebuildGround, updateChunks, resetChunks, setWorldSeed } from './core/index.js';

// Generate a random 32-bit seed.
function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

// Apply seed and rebuild world when the regenerate button is pressed.
regenBtn.addEventListener('click', () => {
  let seed = parseInt(seedInp.value);
  if (!Number.isFinite(seed)) {
    seed = randomSeed();
    seedInp.value = seed;
  }
  setWorldSeed(seed);
  rebuildGround();
  resetChunks();
  updateChunks(true);
});
