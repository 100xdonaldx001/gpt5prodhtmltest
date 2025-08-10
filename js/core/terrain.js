import { THREE, scene } from './environment.js';
import { state } from './state.js';

const GROUND_SIZE = 800;
const GROUND_SEG = 128;
const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
groundGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x35506e, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

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

// Height map producing smooth ground with taller mountains.
function heightAt(x, z) {
  const n = fbm2D(x * 0.005, z * 0.005);
  const mountain = Math.pow(Math.max(0, n), 3) * 120;
  const valley = -Math.pow(Math.max(0, -n), 2) * 20;
  return mountain + valley;
}

let groundCenter = new THREE.Vector2(0, 0);
function rebuildGround() {
  const pos = groundGeo.attributes.position;
  let i = 0;
  for (let vi = 0; vi < pos.count; vi++) {
    const gx = pos.array[i];
    const gz = pos.array[i + 2];
    const wx = groundCenter.x + gx;
    const wz = groundCenter.y + gz;
    pos.array[i + 1] = heightAt(wx, wz);
    i += 3;
  }
  pos.needsUpdate = true;
  groundGeo.computeVertexNormals();
  ground.position.set(groundCenter.x, 0, groundCenter.y);
}
rebuildGround();

function maybeRecenterGround(playerX, playerZ) {
  const dx = playerX - groundCenter.x;
  const dz = playerZ - groundCenter.y;
  const threshold = GROUND_SIZE * 0.25;
  if (Math.abs(dx) > threshold || Math.abs(dz) > threshold) {
    groundCenter.x = Math.round(playerX / (GROUND_SIZE * 0.25)) * (GROUND_SIZE * 0.25);
    groundCenter.y = Math.round(playerZ / (GROUND_SIZE * 0.25)) * (GROUND_SIZE * 0.25);
    rebuildGround();
  }
}

export { ground, heightAt, maybeRecenterGround, rebuildGround };
