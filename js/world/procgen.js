import { THREE, controls } from '../core/environment.js';
import { chunksGroup, addBlockTo, rebuildAABBs } from './world.js';
import { chunkSizeInp, viewDistInp } from '../core/dom.js';
import { state } from '../core/state.js';
import { setGroundSize, heightAt, SEA_LEVEL } from './terrain.js';

// Deterministic pseudo-random number generator used for chunk decoration
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tracks all loaded chunk groups keyed by their coordinates
const loaded = new Map();
// Disable procedural object generation by default
let PROC_ENABLED = false;
let CHUNK_SIZE = 32;
let VIEW_DIST = 5;
// Precomputed LOD thresholds in chunk units with smaller increments
let LOD_RANGES = [5, 7.5, 10, 12.5];

// Convert chunk coordinates to a unique string key
function key(cx, cz) {
  return cx + ',' + cz;
}
// Convert world-space position to chunk coordinates
function worldToChunk(x, z) {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

// Create chunk geometry with detail scaled by LOD level
function generateChunk(cx, cz, lod) {
  const g = new THREE.Group();
  g.userData.type = 'chunk';
  const seed = state.worldSeed ^ (cx * 73856093) ^ (cz * 19349663);
  const rand = mulberry32(seed >>> 0);
  // Scale number of spawned blocks based on LOD level
  const detailMul = [1, 0.5, 0.25, 0.1][lod] || 0;
  const count = Math.floor((12 + rand() * 10) * detailMul);
  for (let i = 0; i < count; i++) {
    const sx = 1 + Math.floor(rand() * 3);
    const sy = 0.6 + rand() * 1.8;
    const sz = 1 + Math.floor(rand() * 3);
    const localX = (rand() - 0.5) * (CHUNK_SIZE - 2);
    const localZ = (rand() - 0.5) * (CHUNK_SIZE - 2);
    const worldX = cx * CHUNK_SIZE + localX;
    const worldZ = cz * CHUNK_SIZE + localZ;
    const terrainY = heightAt(worldX, worldZ);
    // Skip placement if the location is underwater
    if (terrainY <= SEA_LEVEL) continue;
    const y = terrainY + 0.2;
    const col = new THREE.Color().setHSL((rand() * 0.25 + 0.55) % 1, 0.55, 0.6).getHex();
    addBlockTo(g, worldX, y, worldZ, sx, sy, sz, col);
  }
  g.children.forEach((m) => m.updateMatrixWorld(true));
  chunksGroup.add(g);
  return g;
}

// Ensure a chunk at a specific LOD is present in the scene
function loadChunk(cx, cz, lod) {
  const k = key(cx, cz);
  const rec = loaded.get(k);
  if (rec && rec.lod === lod) return;
  if (rec) unloadChunk(cx, cz);
  const g = generateChunk(cx, cz, lod);
  loaded.set(k, { group: g, lod });
}
// Remove a chunk and dispose of its resources
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

// Remove all loaded chunks so a new seed can regenerate the world
function resetChunks() {
  for (const k of Array.from(loaded.keys())) {
    const [cx, cz] = k.split(',').map(Number);
    unloadChunk(cx, cz);
  }
}

let lastChunkUpdate = 0;
// Periodically determine which chunks surround the player and load/unload them
function updateChunks(force = false, forcedPos = null) {
  // Skip updates when ground generation is disabled via debug menu.
  if (window.__DEBUG && !window.__DEBUG.ground) return;
  const now = performance.now();
  if (!force && now - lastChunkUpdate < 250) return;
  lastChunkUpdate = now;
  CHUNK_SIZE = Math.max(8, parseInt(chunkSizeInp.value) || 32);
  VIEW_DIST = Math.max(1, Math.min(64, parseInt(viewDistInp.value) || 10));
  // Define four LOD bands with smaller incremental steps
  LOD_RANGES = [VIEW_DIST, VIEW_DIST * 1.5, VIEW_DIST * 2, VIEW_DIST * 2.5];
  // Resize ground to cover the most distant LOD ring
  setGroundSize((LOD_RANGES[3] * 2 + 2) * CHUNK_SIZE);
  // Update collision data for resized terrain
  rebuildAABBs();

  // Skip chunk generation when procedural objects are disabled
  if (!PROC_ENABLED) return;

  const obj = controls.getObject();
  const px = forcedPos ? forcedPos.x : obj.position.x;
  const pz = forcedPos ? forcedPos.z : obj.position.z;
  const [ccx, ccz] = worldToChunk(px, pz);

  const needed = new Map();
  const maxRange = LOD_RANGES[3];
  for (let dz = -maxRange; dz <= maxRange; dz++) {
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      const nx = ccx + dx;
      const nz = ccz + dz;
      const dist = Math.max(Math.abs(dx), Math.abs(dz));
      let lod = 3;
      if (dist <= LOD_RANGES[0]) lod = 0;
      else if (dist <= LOD_RANGES[1]) lod = 1;
      else if (dist <= LOD_RANGES[2]) lod = 2;
      needed.set(key(nx, nz), lod);
    }
  }
  needed.forEach((lod, k) => {
    const [sx, sz] = k.split(',').map(Number);
    loadChunk(sx, sz, lod);
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

// Toggle procedural generation and rebuild or clear chunks
function toggleProcgen() {
  PROC_ENABLED = !PROC_ENABLED;
  if (!PROC_ENABLED) {
    resetChunks();
  } else {
    updateChunks(true);
  }
  return PROC_ENABLED;
}

export { updateChunks, worldToChunk, resetChunks, toggleProcgen };
