import {
  THREE,
  scene,
  camera,
  controls,
  builder,
  builderToggle,
  shapeSel,
  colorInp,
  sxInp,
  syInp,
  szInp,
  spawnBtn,
  clearBtn,
  ground,
  blocks,
  userGroup,
  blockAABBs,
  rebuildAABBs,
  resetChunks,
  state,
} from './core/index.js';

// === Builder / Preview ===
function makeMeshByType(type, color) {
  let geo;
  switch (type) {
    case 'pyramid':
      geo = new THREE.ConeGeometry(0.5, 1, 4);
      break;
    case 'sphere':
      geo = new THREE.SphereGeometry(0.5, 24, 16);
      break;
    default:
      geo = new THREE.BoxGeometry(1, 1, 1);
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const previewMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
let preview = makeMeshByType('cube', 0xffffff);
preview.material = previewMat;
preview.castShadow = preview.receiveShadow = false;
preview.visible = false;
scene.add(preview);
const buildRay = new THREE.Raycaster();

function setBuilderVisible(visible) {
  builder.hidden = !visible;
  builderToggle.textContent = builder.hidden ? 'Builder: Off' : 'Builder: On';
  if (builder.hidden && preview) {
    preview.visible = false;
  }
  if (!builder.hidden) {
    updatePreview();
  }
}

export function toggleBuilder() {
  setBuilderVisible(builder.hidden);
}
builderToggle.addEventListener('click', () => toggleBuilder());
setBuilderVisible(true);

function updatePreviewGeometry() {
  const type = shapeSel.value;
  const needBox = type === 'cube' && !(preview.geometry instanceof THREE.BoxGeometry);
  const needCone = type === 'pyramid' && !(preview.geometry instanceof THREE.ConeGeometry);
  const needSphere = type === 'sphere' && !(preview.geometry instanceof THREE.SphereGeometry);
  if (needBox || needCone || needSphere) {
    scene.remove(preview);
    preview = makeMeshByType(type, 0xffffff);
    preview.material = previewMat;
    preview.castShadow = preview.receiveShadow = false;
    scene.add(preview);
  }
  const sx = Math.max(0.25, parseFloat(sxInp.value) || 1);
  const sy = Math.max(0.25, parseFloat(syInp.value) || 1);
  const sz = Math.max(0.25, parseFloat(szInp.value) || 1);
  preview.scale.set(sx, sy, sz);
}
function worldNormalFromIntersect(i) {
  if (!i.face || !i.object) return new THREE.Vector3(0, 1, 0);
  const n = i.face.normal.clone();
  const m3 = new THREE.Matrix3().getNormalMatrix(i.object.matrixWorld);
  n.applyMatrix3(m3).normalize();
  return n;
}
function updatePreviewPlacement() {
  if (!state.isActive || builder.hidden) {
    preview.visible = false;
    return;
  }
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3();
  controls.getDirection(dir);
  buildRay.set(origin, dir);
  const hits = buildRay.intersectObjects([ground, blocks], true);
  if (hits.length === 0) {
    preview.visible = false;
    return;
  }
  const hit = hits[0];
  const n = worldNormalFromIntersect(hit);
  const halfY = preview.scale.y / 2;
  const place = hit.point.clone().addScaledVector(n, halfY + 0.01);
  preview.position.copy(place);
  preview.visible = true;
}
export function updatePreview() {
  updatePreviewGeometry();
  updatePreviewPlacement();
}

function addAABBForMesh(mesh) {
  mesh.updateMatrixWorld(true);
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  blockAABBs.push({ box: b, mesh });
}
function spawnAtPreview() {
  if (!preview.visible) return;
  const type = shapeSel.value;
  const color = new THREE.Color(colorInp.value);
  const sx = Math.max(0.25, parseFloat(sxInp.value) || 1);
  const sy = Math.max(0.25, parseFloat(syInp.value) || 1);
  const sz = Math.max(0.25, parseFloat(szInp.value) || 1);
  const mesh = makeMeshByType(type, color.getHex());
  mesh.position.copy(preview.position);
  mesh.scale.set(sx, sy, sz);
  userGroup.add(mesh);
  addAABBForMesh(mesh);
}

// Remove all user-placed blocks and refresh collision boxes.
function clearUserBlocks() {
  userGroup.clear();
  // Also remove procedurally generated blocks
  resetChunks();
  rebuildAABBs();
}

shapeSel.addEventListener('change', updatePreview);
[sxInp, syInp, szInp].forEach((el) => el.addEventListener('input', updatePreview));
spawnBtn.addEventListener('click', spawnAtPreview);
clearBtn.addEventListener('click', clearUserBlocks);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state.isActive) spawnAtPreview();
});
document.addEventListener('mousemove', () => {
  if (state.isActive) updatePreviewPlacement();
});
