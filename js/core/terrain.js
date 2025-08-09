import { THREE, scene } from './environment.js';

const GROUND_SIZE = 800;
const GROUND_SEG = 128;
const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
groundGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x35506e, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

function heightAt(x, z) {
  return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.6;
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
