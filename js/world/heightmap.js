import { state } from '../core/state.js';

// Pseudo-random generator producing deterministic values for terrain.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fade curve for smooth interpolation (same as used by Perlin noise).
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// 2D Perlin-style gradient noise for smooth hills.
function noise2D(x, z) {
  const sx = Math.floor(x);
  const sz = Math.floor(z);
  const fx = x - sx;
  const fz = z - sz;
  const seed = state.worldSeed >>> 0;

  // Create deterministic gradients for the corners of the cell.
  function gradient(ix, iz) {
    const r = mulberry32(seed ^ (ix * 73856093) ^ (iz * 19349663))() * Math.PI * 2;
    return { x: Math.cos(r), z: Math.sin(r) };
  }

  const g00 = gradient(sx, sz);
  const g10 = gradient(sx + 1, sz);
  const g01 = gradient(sx, sz + 1);
  const g11 = gradient(sx + 1, sz + 1);

  // Dot products between gradient and distance vectors.
  const d00 = g00.x * fx + g00.z * fz;
  const d10 = g10.x * (fx - 1) + g10.z * fz;
  const d01 = g01.x * fx + g01.z * (fz - 1);
  const d11 = g11.x * (fx - 1) + g11.z * (fz - 1);

  const u = fade(fx);
  const v = fade(fz);

  const nx0 = d00 + u * (d10 - d00);
  const nx1 = d01 + u * (d11 - d01);
  return nx0 + v * (nx1 - nx0);
}

// Fractal Brownian motion layers multiple noise octaves for detail.
function fbm2D(x, z) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < 6; i++) {
    total += noise2D(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max;
}

// Ridged multifractal noise for sharp Terragen-style mountains.
function ridgedFbm2D(x, z) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 6; i++) {
    let n = noise2D(x * frequency, z * frequency);
    n = 1 - Math.abs(n); // invert valleys into ridges
    total += n * n * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total;
}

// Smooth the ridged noise by averaging nearby samples.
function smoothedRidgedFbm2D(x, z) {
  const s = 0.005; // sample spacing for smoothing
  const h = ridgedFbm2D(x, z);
  const h1 = ridgedFbm2D(x + s, z);
  const h2 = ridgedFbm2D(x - s, z);
  const h3 = ridgedFbm2D(x, z + s);
  const h4 = ridgedFbm2D(x, z - s);
  return (h + h1 + h2 + h3 + h4) / 5;
}

// Basic terrain with smooth mountains, valleys, and rivers.
function basicHeightAt(x, z) {
  // Blend several noise layers for varied terrain features.
  const base = fbm2D(x * 0.01, z * 0.01); // medium-scale mountains
  const continent = fbm2D((x + 1000) * 0.002, (z + 1000) * 0.002); // large landmasses
  const detail = fbm2D((x - 1000) * 0.05, (z - 1000) * 0.05) * 0.1; // fine detail
  const n = base * 0.6 + continent * 0.3 + detail; // combine noise layers
  // Amplify heights using configurable mountain and valley factors.
  const mountain = Math.pow(Math.max(0, n), 3) * state.mountainAmp;
  const valley = -Math.pow(Math.max(0, -n), 2) * state.valleyAmp;
  // Carve rivers with low-frequency noise. Values near zero become riverbeds.
  const r = Math.abs(noise2D(x * 0.0008, z * 0.0008));
  const river = Math.max(0, 0.02 - r) * 100;
  // Lower overall height to form oceans and lakes at sea level.
  return mountain + valley - river - 5;
}

// Terragen-like terrain using ridged noise for craggy peaks.
function terragenHeightAt(x, z) {
  const scale = 0.001; // enlarge terrain features by 10x
  const ridged = smoothedRidgedFbm2D(x * scale, z * scale);
  const detail = fbm2D((x + 2000) * scale * 3, (z + 2000) * scale * 3) * 0.1;
  return (ridged * 0.8 + detail) * state.mountainAmp - 5;
}

// Public height function selecting the active terrain algorithm.
function heightAt(x, z) {
  return state.terrainType === 'terragen'
    ? terragenHeightAt(x, z)
    : basicHeightAt(x, z);
}

export { heightAt };
