import { THREE, scene } from '../core/environment.js';
import { createTerrainMaterial } from '../core/shaders.js';
import { heightAt, fbm2D } from './heightmap.js';

// Water level for oceans, lakes, and rivers (default 130 units)
let SEA_LEVEL = 130;

// Allow the ground plane to expand as view distance increases
let groundSize = 800;
const GRID_STEP = 2; // spacing between ground vertices for a smoother mesh
function createGroundGeo(size) {
  const seg = Math.max(1, Math.floor(size / GRID_STEP)); // keep detail consistent
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
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.6 });
const water = new THREE.Mesh(waterGeo, waterMat);
// Let water reflect light but not cast shadows
water.receiveShadow = true;

scene.add(ground);
scene.add(water);

// Precompute colors used for terrain shading
const waterFloorColor = new THREE.Color(0x5c6e7e); // grayish blue for seabeds
const grassA = new THREE.Color(0x2e8f2e); // dark green
const grassB = new THREE.Color(0x5cad49); // light green
const stoneColor = new THREE.Color(0x777777); // gray for steep slopes
const tmpColor = new THREE.Color(); // scratch color for interpolation

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
    const h = heightAt(wx, wz); // height of current vertex
    pos.array[i + 1] = h;

    // Approximate slope using forward differences in X and Z directions
    const hdx = heightAt(wx + GRID_STEP, wz);
    const hdz = heightAt(wx, wz + GRID_STEP);
    const slope = (Math.abs(h - hdx) + Math.abs(h - hdz)) / GRID_STEP;

    if (h < SEA_LEVEL) {
      // Sea floor takes on a muted blue color
      colors[i] = waterFloorColor.r;
      colors[i + 1] = waterFloorColor.g;
      colors[i + 2] = waterFloorColor.b;
    } else {
      // Use smooth noise to vary green shades subtly across the land
      const n = (fbm2D(wx * 0.05, wz * 0.05) + 1) / 2;
      tmpColor.copy(grassA).lerp(grassB, n);
      // Blend towards gray rock when slopes become steep
      const rockMix = THREE.MathUtils.clamp((slope - 2) / 10, 0, 1);
      tmpColor.lerp(stoneColor, rockMix);
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
  if (groundSize === newSize) return;
  groundSize = newSize;
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
  heightAt,
  maybeRecenterGround,
  rebuildGround,
  setGroundSize,
  setSeaLevel,
};
