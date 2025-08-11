import { THREE, scene } from '../core/environment.js';
import { createTerrainMaterial } from '../core/shaders.js';
import { heightAt as baseHeightAt, fbm2D as baseFbm2D } from './heightmap.js';

// Water level for oceans, lakes, and rivers (default 130 units)
let SEA_LEVEL = 130;

// Allow the ground plane to expand as view distance increases
let groundSize = 800;
const GRID_STEP = 2; // spacing between ground vertices for a smoother mesh
const MAX_SEGMENTS = 1024; // prevent excessive geometry detail
const MAX_GROUND_SIZE = GRID_STEP * MAX_SEGMENTS; // cap size to avoid huge arrays
function createGroundGeo(size) {
  // Clamp segment count so geometry allocation never overflows
  const seg = Math.max(1, Math.min(MAX_SEGMENTS, Math.floor(size / GRID_STEP) || 1));
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
let groundGeo = createGroundGeo(groundSize);
// Standard material gives smooth ground without blocky artifacts
const groundMat = createTerrainMaterial();
const ground = new THREE.Mesh(groundGeo, groundMat);
// Allow terrain to cast shadows on itself so mountains block light.
ground.castShadow = ground.receiveShadow = true;

// Flat water plane that fills low-lying terrain
let waterGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
waterGeo.rotateX(-Math.PI / 2);
// Start from a standard material so lighting and reflections stay intact
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.6 });
// Inject a simple wave shader that displaces vertices over time
waterMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    '#include <common>\nuniform float uTime;'
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  transformed.y += (sin((position.x + uTime) * 0.1) + sin((position.z + uTime) * 0.1)) * 0.5;'
  );
  waterMat.userData.shader = shader;
};
const water = new THREE.Mesh(waterGeo, waterMat);
// Let water reflect light but not cast shadows
water.receiveShadow = true;
// Place water at the defined sea level so no duplicate plane appears at y=0
water.position.set(0, SEA_LEVEL, 0);

scene.add(ground);
scene.add(water);

// Options controlling base colors and slope thresholds for shading
const defaultTerrainOpts = {
  waterFloorColor: new THREE.Color(0x5c6e7e), // grayish blue for seabeds
  sandColor: new THREE.Color(0xc2b280), // pale yellow for beaches
  grassA: new THREE.Color(0x2e8f2e), // dark green
  grassB: new THREE.Color(0x5cad49), // light green
  stoneColor: new THREE.Color(0x777777), // gray for steep slopes
  rockSlopeStart: 2, // slope value where rocks begin to appear
  rockSlopeRange: 10, // additional slope needed to become full rock
  beachHeight: 3, // vertical range above water that counts as beach
};
let terrainOpts = { ...defaultTerrainOpts };
const tmpColor = new THREE.Color(); // scratch color for interpolation

// Cache height and noise samples to avoid redundant calculations
const heightCache = new Map();
const fbmCache = new Map();

// Build a string key from world coordinates
function cacheKey(x, z) {
  return `${x},${z}`;
}

// Retrieve a cached height value or compute and store it
function cachedHeightAt(x, z) {
  const key = cacheKey(x, z);
  let h = heightCache.get(key);
  if (h === undefined) {
    h = baseHeightAt(x, z);
    heightCache.set(key, h);
  }
  return h;
}

// Retrieve a cached fbm value or compute and store it
function cachedFbm2D(x, z) {
  const key = cacheKey(x, z);
  let n = fbmCache.get(key);
  if (n === undefined) {
    n = baseFbm2D(x, z);
    fbmCache.set(key, n);
  }
  return n;
}

// Clear caches when terrain origin or appearance changes
function clearCaches() {
  heightCache.clear();
  fbmCache.clear();
}

// Update terrain color and slope settings
function setTerrainOptions(opts = {}) {
  if (opts.waterFloorColor) terrainOpts.waterFloorColor.set(opts.waterFloorColor);
  if (opts.sandColor) terrainOpts.sandColor.set(opts.sandColor);
  if (opts.grassA) terrainOpts.grassA.set(opts.grassA);
  if (opts.grassB) terrainOpts.grassB.set(opts.grassB);
  if (opts.stoneColor) terrainOpts.stoneColor.set(opts.stoneColor);
  if (typeof opts.rockSlopeStart === 'number') terrainOpts.rockSlopeStart = opts.rockSlopeStart;
  if (typeof opts.rockSlopeRange === 'number') terrainOpts.rockSlopeRange = opts.rockSlopeRange;
  if (typeof opts.beachHeight === 'number') terrainOpts.beachHeight = opts.beachHeight;
  // Changing options can influence shading so invalidate cached samples
  clearCaches();
}

// Return a copy of current terrain options
function getTerrainOptions() {
  return {
    waterFloorColor: terrainOpts.waterFloorColor.clone(),
    sandColor: terrainOpts.sandColor.clone(),
    grassA: terrainOpts.grassA.clone(),
    grassB: terrainOpts.grassB.clone(),
    stoneColor: terrainOpts.stoneColor.clone(),
    rockSlopeStart: terrainOpts.rockSlopeStart,
    rockSlopeRange: terrainOpts.rockSlopeRange,
    beachHeight: terrainOpts.beachHeight,
  };
}

let groundCenter = new THREE.Vector2(0, 0);
function rebuildGround() {
  const pos = groundGeo.attributes.position;
  let colorAttr = groundGeo.getAttribute('color');
  // Ensure geometry has a color attribute for per-vertex shading
  if (!colorAttr || colorAttr.count !== pos.count) {
    const colors = new Float32Array(pos.count * 3);
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    colorAttr = groundGeo.getAttribute('color');
  }
  const colors = colorAttr.array;
  let i = 0;
  for (let vi = 0; vi < pos.count; vi++) {
    const gx = pos.array[i];
    const gz = pos.array[i + 2];
    const wx = groundCenter.x + gx;
    const wz = groundCenter.y + gz;
    const h = cachedHeightAt(wx, wz); // height of current vertex
    pos.array[i + 1] = h;

    // Approximate slope using forward differences in X and Z directions
    const hdx = cachedHeightAt(wx + GRID_STEP, wz);
    const hdz = cachedHeightAt(wx, wz + GRID_STEP);
    const slope = (Math.abs(h - hdx) + Math.abs(h - hdz)) / GRID_STEP;

    if (h < SEA_LEVEL) {
      // Sea floor takes on a muted blue color
      colors[i] = terrainOpts.waterFloorColor.r;
      colors[i + 1] = terrainOpts.waterFloorColor.g;
      colors[i + 2] = terrainOpts.waterFloorColor.b;
    } else if (h < SEA_LEVEL + terrainOpts.beachHeight) {
      // Light sandy strip just above water for beaches
      const n = (cachedFbm2D(wx * 0.1, wz * 0.1) + 1) / 2;
      tmpColor.copy(terrainOpts.sandColor);
      // Subtle brightness variation to mimic textured sand
      tmpColor.offsetHSL(0, 0, (n - 0.5) * 0.2);
      colors[i] = tmpColor.r;
      colors[i + 1] = tmpColor.g;
      colors[i + 2] = tmpColor.b;
    } else {
      // Use smooth noise to vary green shades subtly across the land
      const n = (cachedFbm2D(wx * 0.05, wz * 0.05) + 1) / 2;
      tmpColor.copy(terrainOpts.grassA).lerp(terrainOpts.grassB, n);
      // Blend towards gray rock when slopes become steep
      const rockMix = THREE.MathUtils.clamp(
        (slope - terrainOpts.rockSlopeStart) / terrainOpts.rockSlopeRange,
        0,
        1
      );
      tmpColor.lerp(terrainOpts.stoneColor, rockMix);
      colors[i] = tmpColor.r;
      colors[i + 1] = tmpColor.g;
      colors[i + 2] = tmpColor.b;
    }
    i += 3;
  }
  pos.needsUpdate = true;
  groundGeo.attributes.color.needsUpdate = true;
  groundGeo.computeVertexNormals();
  ground.position.set(groundCenter.x, 0, groundCenter.y);
  // Recenter water plane so rivers and oceans follow the terrain
  water.position.set(groundCenter.x, SEA_LEVEL, groundCenter.y);
}
rebuildGround();

// Resize ground mesh when view distance or chunk size changes
function setGroundSize(newSize) {
  // Keep size within reasonable bounds to prevent geometry errors
  const size = Math.min(MAX_GROUND_SIZE, Math.max(GRID_STEP, newSize));
  if (groundSize === size) return;
  groundSize = size;
  ground.geometry.dispose();
  groundGeo = createGroundGeo(groundSize); // rebuild with density based on size
  ground.geometry = groundGeo;
  // Resize the water plane to match the new ground size.
  water.geometry.dispose();
  waterGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  water.geometry = waterGeo;
  rebuildGround();
}

function maybeRecenterGround(playerX, playerZ) {
  // Determine whether the terrain origin needs to shift to keep
  // coordinates near the player and avoid precision issues.
  const dx = playerX - groundCenter.x;
  const dz = playerZ - groundCenter.y;
  const threshold = groundSize * 0.1;
  let shiftX = 0;
  let shiftZ = 0;
  // Move the terrain in fixed increments when the player strays too far.
  if (Math.abs(dx) > threshold) shiftX = Math.sign(dx) * threshold;
  if (Math.abs(dz) > threshold) shiftZ = Math.sign(dz) * threshold;
  if (shiftX || shiftZ) {
    groundCenter.x += shiftX;
    groundCenter.y += shiftZ;
    // Origin shifted, so cached samples no longer align
    clearCaches();
    rebuildGround();
    // Return the applied shift so other world elements can follow.
    return { shifted: true, dx: shiftX, dz: shiftZ };
  }
  // No recentering needed; report zero shift.
  return { shifted: false, dx: 0, dz: 0 };
}

// Update sea level and rebuild water position
function setSeaLevel(newLevel) {
  SEA_LEVEL = newLevel;
  rebuildGround();
}

export {
  ground,
  water,
  SEA_LEVEL,
  baseHeightAt as heightAt,
  maybeRecenterGround,
  rebuildGround,
  setGroundSize,
  setSeaLevel,
  setTerrainOptions,
  getTerrainOptions,
};
