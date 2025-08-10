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

// Simple 2D value noise for hills and valleys.
function noise2D(x, z) {
  const sx = Math.floor(x);
  const sz = Math.floor(z);
  const fx = x - sx;
  const fz = z - sz;
  const seed = state.worldSeed >>> 0;
  const n00 = mulberry32(seed ^ (sx * 73856093) ^ (sz * 19349663))();
  const n10 = mulberry32(seed ^ ((sx + 1) * 73856093) ^ (sz * 19349663))();
  const n01 = mulberry32(seed ^ (sx * 73856093) ^ ((sz + 1) * 19349663))();
  const n11 = mulberry32(seed ^ ((sx + 1) * 73856093) ^ ((sz + 1) * 19349663))();
  const nx0 = n00 * (1 - fx) + n10 * fx;
  const nx1 = n01 * (1 - fx) + n11 * fx;
  return nx0 * (1 - fz) + nx1 * fz;
}

// Terrain height biased toward valleys with occasional hills.
function heightAt(x, z) {
  const n = noise2D(x * 0.02, z * 0.02);
  return (n - 0.6) * 6;
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
