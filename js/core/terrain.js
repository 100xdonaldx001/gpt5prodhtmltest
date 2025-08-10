import { THREE, scene } from './environment.js';
import { createBlockMaterial } from './shaders.js';
import { state } from './state.js';

// Water level for oceans, lakes, and rivers
const SEA_LEVEL = -10;

// Size of each cubic voxel
const VOXEL_SIZE = 4;

// Default span of generated terrain around the player
let groundSize = 128;

// Group holding all voxel meshes representing the terrain
const ground = new THREE.Group();
ground.castShadow = ground.receiveShadow = true;
scene.add(ground);

// Flat water plane that fills low-lying terrain
let waterGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.6 });
const water = new THREE.Mesh(waterGeo, waterMat);
// Let water reflect light but not cast shadows
water.receiveShadow = true;
scene.add(water);

// Pseudo-random generator producing deterministic values for terrain
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fade curve for smooth interpolation (same as used by Perlin noise)
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// 2D gradient noise reused for base height map
function noise2D(x, z) {
  const sx = Math.floor(x);
  const sz = Math.floor(z);
  const fx = x - sx;
  const fz = z - sz;
  const seed = state.worldSeed >>> 0;

  // Create deterministic gradients for the corners of the cell
  function gradient(ix, iz) {
    const r = mulberry32(seed ^ (ix * 73856093) ^ (iz * 19349663))() * Math.PI * 2;
    return { x: Math.cos(r), z: Math.sin(r) };
  }

  const g00 = gradient(sx, sz);
  const g10 = gradient(sx + 1, sz);
  const g01 = gradient(sx, sz + 1);
  const g11 = gradient(sx + 1, sz + 1);

  // Dot products between gradient and distance vectors
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

// Fractal Brownian motion layers multiple noise octaves for detail
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

// 3D gradient noise used for overhangs and caves
function noise3D(x, y, z) {
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  const sz = Math.floor(z);
  const fx = x - sx;
  const fy = y - sy;
  const fz = z - sz;
  const seed = state.worldSeed >>> 0;

  // Deterministic gradient for each cell corner
  function gradient(ix, iy, iz) {
    const r = mulberry32(seed ^ (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791))() * Math.PI * 2;
    return {
      x: Math.cos(r),
      y: Math.sin(r * 1.3),
      z: Math.cos(r * 0.7),
    };
  }

  const g000 = gradient(sx, sy, sz);
  const g100 = gradient(sx + 1, sy, sz);
  const g010 = gradient(sx, sy + 1, sz);
  const g110 = gradient(sx + 1, sy + 1, sz);
  const g001 = gradient(sx, sy, sz + 1);
  const g101 = gradient(sx + 1, sy, sz + 1);
  const g011 = gradient(sx, sy + 1, sz + 1);
  const g111 = gradient(sx + 1, sy + 1, sz + 1);

  // Distance vectors from corner to point
  function dot(g, dx, dy, dz) {
    return g.x * dx + g.y * dy + g.z * dz;
  }

  const d000 = dot(g000, fx, fy, fz);
  const d100 = dot(g100, fx - 1, fy, fz);
  const d010 = dot(g010, fx, fy - 1, fz);
  const d110 = dot(g110, fx - 1, fy - 1, fz);
  const d001 = dot(g001, fx, fy, fz - 1);
  const d101 = dot(g101, fx - 1, fy, fz - 1);
  const d011 = dot(g011, fx, fy - 1, fz - 1);
  const d111 = dot(g111, fx - 1, fy - 1, fz - 1);

  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);

  const nx00 = d000 + u * (d100 - d000);
  const nx01 = d001 + u * (d101 - d001);
  const nx10 = d010 + u * (d110 - d010);
  const nx11 = d011 + u * (d111 - d011);

  const nxy0 = nx00 + v * (nx10 - nx00);
  const nxy1 = nx01 + v * (nx11 - nx01);

  return nxy0 + w * (nxy1 - nxy0);
}

// Fractal noise in 3D for additional variation
function fbm3D(x, y, z) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < 4; i++) {
    total += noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max;
}

// Step 1: base terrain of hills and valleys
function hillValleyHeight(x, z) {
  const n = fbm2D(x * 0.01, z * 0.01);
  const mountain = Math.pow(Math.max(0, n), 3) * state.mountainAmp;
  const valley = -Math.pow(Math.max(0, -n), 2) * state.valleyAmp;
  return mountain + valley;
}

// Step 2: carve rivers using low frequency noise
function riverDepth(x, z) {
  const r = Math.abs(noise2D(x * 0.0008, z * 0.0008));
  return Math.max(0, 0.02 - r) * 100;
}

// Step 3: lay down roads similar to rivers but shallower
function roadDepth(x, z) {
  const r = Math.abs(noise2D((x + 1000) * 0.0009, (z - 1000) * 0.0009));
  return Math.max(0, 0.01 - r) * 50;
}

// Combine all terrain steps into a single height value
function baseHeight(x, z) {
  return hillValleyHeight(x, z) - riverDepth(x, z) - roadDepth(x, z) - 5;
}

// Determine what surface feature exists at a coordinate
function featureAt(x, z) {
  if (roadDepth(x, z) > 0) return 'road';
  if (riverDepth(x, z) > 0) return 'river';
  return 'ground';
}

// Pick a color for a voxel based on its feature with slight variation
function blockColor(x, y, z, feature) {
  const rand = mulberry32(state.worldSeed ^ (x * 73856093) ^ (y * 19349663) ^ (z * 83492791))();
  const base = new THREE.Color();
  if (feature === 'road') {
    base.set(0xbfa27a); // light brown road
  } else if (feature === 'river') {
    base.set(0x6d7f8a); // stone grey with blue hint
  } else {
    base.set(0x3a9f40); // grassy green ground
  }
  const hsl = {};
  base.getHSL(hsl);
  hsl.l = Math.min(1, Math.max(0, hsl.l + (rand - 0.5) * 0.2));
  base.setHSL(hsl.h, hsl.s, hsl.l);
  return base.getHex();
}

// Density field that determines whether a voxel is solid
function densityAt(x, y, z) {
  // Overhangs and caves come from 3D noise added after roads and rivers
  const h = baseHeight(x, z);
  const cave = fbm3D(x * 0.02, y * 0.02, z * 0.02) * 15;
  return h + cave - y;
}

// Sample the highest solid voxel at a given x/z position
function heightAt(x, z) {
  const max = 80;
  const min = -40;
  for (let y = max; y >= min; y -= VOXEL_SIZE) {
    if (densityAt(x, y, z) > 0) {
      return y;
    }
  }
  return min;
}

let groundCenter = new THREE.Vector2(0, 0);

// Rebuild voxel terrain around the current ground center
function rebuildGround() {
  // Dispose previous voxel meshes
  while (ground.children.length) {
    const m = ground.children.pop();
    m.geometry.dispose();
    m.material.dispose();
  }
  const half = groundSize / 2;
  for (let x = -half; x < half; x += VOXEL_SIZE) {
    for (let z = -half; z < half; z += VOXEL_SIZE) {
      for (let y = -40; y < 80; y += VOXEL_SIZE) {
        const wx = groundCenter.x + x;
        const wy = y;
        const wz = groundCenter.y + z;
        if (densityAt(wx, wy, wz) > 0) {
          const feature = featureAt(wx, wz);
          const color = blockColor(wx, wy, wz, feature);
          const mat = createBlockMaterial(color);
          const cube = new THREE.Mesh(new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE), mat);
          cube.position.set(wx + VOXEL_SIZE / 2, wy + VOXEL_SIZE / 2, wz + VOXEL_SIZE / 2);
          cube.castShadow = cube.receiveShadow = true;
          ground.add(cube);
        }
      }
    }
  }
  // Recenter water plane so rivers and oceans follow the terrain
  water.position.set(groundCenter.x, SEA_LEVEL, groundCenter.y);
}
rebuildGround();

// Resize terrain when view distance or chunk size changes
function setGroundSize(newSize) {
  if (groundSize === newSize) return;
  groundSize = newSize;
  water.geometry.dispose();
  waterGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  water.geometry = waterGeo;
  rebuildGround();
}

// Rebuild terrain if the player moves too far from the current center
function maybeRecenterGround(playerX, playerZ) {
  const dx = playerX - groundCenter.x;
  const dz = playerZ - groundCenter.y;
  const threshold = groundSize * 0.25;
  if (Math.abs(dx) > threshold || Math.abs(dz) > threshold) {
    groundCenter.x = Math.round(playerX / (groundSize * 0.25)) * (groundSize * 0.25);
    groundCenter.y = Math.round(playerZ / (groundSize * 0.25)) * (groundSize * 0.25);
    rebuildGround();
  }
}

export { ground, water, SEA_LEVEL, heightAt, maybeRecenterGround, rebuildGround, setGroundSize };
