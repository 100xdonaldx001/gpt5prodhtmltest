import { THREE, scene } from './environment.js';
import { ground } from './terrain.js';

const grid = new THREE.GridHelper(400, 80, 0x7aa2ff, 0x2b3d55);
grid.material.opacity = 0.25;
grid.material.transparent = true;
scene.add(grid);

const blocks = new THREE.Group();
scene.add(blocks);
const presetGroup = new THREE.Group();
blocks.add(presetGroup);
const chunksGroup = new THREE.Group();
blocks.add(chunksGroup);
const userGroup = new THREE.Group();
blocks.add(userGroup);

const baseMat = new THREE.MeshStandardMaterial({ color: 0x6ee7ff, roughness: 0.6, metalness: 0.15 });
function addBlockTo(group, x, y, z, sx = 4, sy = 1, sz = 4, color = null) {
  const mat = baseMat.clone();
  if (color !== null) mat.color = new THREE.Color(color);
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y + sy / 2, z);
  m.castShadow = m.receiveShadow = true;
  m.updateMatrixWorld(true);
  group.add(m);
  return m;
}

// Presets
addBlockTo(presetGroup, 0, 0.1, -10, 6, 1, 6, 0x4fd1c5);
addBlockTo(presetGroup, 8, 1, -16, 4, 1, 4, 0x93c5fd);
addBlockTo(presetGroup, 14, 2, -22, 4, 1, 4, 0xf9a8d4);
addBlockTo(presetGroup, 20, 3, -26, 4, 1, 4, 0xfcd34d);
addBlockTo(presetGroup, 26, 5, -30, 6, 1, 6, 0x86efac);

let blockAABBs = [];
function rebuildAABBs() {
  blockAABBs = [];
  const collect = (mesh) => {
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    blockAABBs.push({ box: b, mesh });
  };
  presetGroup.updateMatrixWorld(true);
  presetGroup.traverse(collect);
  chunksGroup.updateMatrixWorld(true);
  chunksGroup.traverse(collect);
  userGroup.updateMatrixWorld(true);
  userGroup.traverse(collect);
}
rebuildAABBs();

export {
  grid,
  blocks,
  presetGroup,
  chunksGroup,
  userGroup,
  addBlockTo,
  blockAABBs,
  rebuildAABBs,
};
