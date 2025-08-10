import { THREE, scene } from '../core/environment.js';
import { createVoxelTerrainMaterial } from '../core/shaders.js';
import { heightAt } from './heightmap.js';

// Water level for oceans, lakes, and rivers
const SEA_LEVEL = -10;

// Allow the ground plane to expand as view distance increases
let groundSize = 800;
const GROUND_SEG = 128;
let groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, GROUND_SEG, GROUND_SEG);
groundGeo.rotateX(-Math.PI / 2);
// Shader material snaps vertices to a grid so smooth ground appears voxel-like
const groundMat = createVoxelTerrainMaterial();
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
  // Recenter water plane so rivers and oceans follow the terrain.
  water.position.set(groundCenter.x, SEA_LEVEL, groundCenter.y);
}
rebuildGround();

// Resize ground mesh when view distance or chunk size changes
function setGroundSize(newSize) {
  if (groundSize === newSize) return;
  groundSize = newSize;
  ground.geometry.dispose();
  groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, GROUND_SEG, GROUND_SEG);
  groundGeo.rotateX(-Math.PI / 2);
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

export { ground, water, SEA_LEVEL, heightAt, maybeRecenterGround, rebuildGround, setGroundSize };
