import { THREE, controls } from './environment.js';
import { chunksGroup, addBlockTo, rebuildAABBs } from './world.js';
import { chunkSizeInp, viewDistInp } from './dom.js';
import { state } from './state.js';
import { setGroundSize, heightAt, SEA_LEVEL } from './terrain.js';

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const loaded = new Map();
// Disable procedural object generation by default
let PROC_ENABLED = false;
let CHUNK_SIZE = 32;
let VIEW_DIST = 5;

function key(cx, cz) {
  return cx + ',' + cz;
}
function worldToChunk(x, z) {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

function generateChunk(cx, cz) {
  const g = new THREE.Group();
  g.userData.type = 'chunk';
  const seed = state.worldSeed ^ (cx * 73856093) ^ (cz * 19349663);
  const rand = mulberry32(seed >>> 0);
  const count = 12 + Math.floor(rand() * 10);
  for (let i = 0; i < count; i++) {
    const sx = 1 + Math.floor(rand() * 3);
    const sy = 0.6 + rand() * 1.8;
    const sz = 1 + Math.floor(rand() * 3);
    const localX = (rand() - 0.5) * (CHUNK_SIZE - 2);
    const localZ = (rand() - 0.5) * (CHUNK_SIZE - 2);
    const worldX = cx * CHUNK_SIZE + localX;
    const worldZ = cz * CHUNK_SIZE + localZ;
    const terrainY = heightAt(worldX, worldZ);
    // Skip placement if the location is underwater.
    if (terrainY <= SEA_LEVEL) continue;
    const y = terrainY + 0.2;
    const col = new THREE.Color().setHSL((rand() * 0.25 + 0.55) % 1, 0.55, 0.6).getHex();
    addBlockTo(g, worldX, y, worldZ, sx, sy, sz, col);
  }
  g.children.forEach((m) => m.updateMatrixWorld(true));
  chunksGroup.add(g);
  return g;
}

function loadChunk(cx, cz) {
  const k = key(cx, cz);
  if (loaded.has(k)) return;
  const g = generateChunk(cx, cz);
  loaded.set(k, { group: g });
}
function unloadChunk(cx, cz) {
  const k = key(cx, cz);
  const rec = loaded.get(k);
  if (!rec) return;
  chunksGroup.remove(rec.group);
  rec.group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  loaded.delete(k);
}

// Remove all loaded chunks so a new seed can regenerate the world.
function resetChunks() {
  for (const k of Array.from(loaded.keys())) {
    const [cx, cz] = k.split(',').map(Number);
    unloadChunk(cx, cz);
  }
}

let lastChunkUpdate = 0;
function updateChunks(force = false, forcedPos = null) {
  const now = performance.now();
  if (!force && now - lastChunkUpdate < 250) return;
  lastChunkUpdate = now;
  CHUNK_SIZE = Math.max(8, parseInt(chunkSizeInp.value) || 32);
  VIEW_DIST = Math.max(1, Math.min(64, parseInt(viewDistInp.value) || 10));
  // Always resize the ground to match the chosen view distance
  setGroundSize((VIEW_DIST * 2 + 2) * CHUNK_SIZE);
  // Update collision data for resized terrain
  rebuildAABBs();

  // Skip chunk generation when procedural objects are disabled
  if (!PROC_ENABLED) return;

  const obj = controls.getObject();
  const px = forcedPos ? forcedPos.x : obj.position.x;
  const pz = forcedPos ? forcedPos.z : obj.position.z;
  const [ccx, ccz] = worldToChunk(px, pz);

  const needed = new Set();
  for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
    for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
      const nx = ccx + dx,
        nz = ccz + dz;
      needed.add(key(nx, nz));
    }
  }
  needed.forEach((k) => {
    const [sx, sz] = k.split(',').map(Number);
    loadChunk(sx, sz);
  });
  for (const k of Array.from(loaded.keys())) {
    if (!needed.has(k)) {
      const [ux, uz] = k.split(',').map(Number);
      unloadChunk(ux, uz);
    }
  }
  rebuildAABBs();
}
window.__forceChunkUpdate = (x, z) => updateChunks(true, new THREE.Vector3(x, 0, z));
updateChunks(true, new THREE.Vector3(0, 0, 0));

function toggleProcgen() {
  // Toggle procedural generation and rebuild or clear chunks
  PROC_ENABLED = !PROC_ENABLED;
  if (!PROC_ENABLED) {
    resetChunks();
  } else {
    updateChunks(true);
  }
  return PROC_ENABLED;
}

export { updateChunks, worldToChunk, resetChunks, toggleProcgen };
