import {
  THREE,
  scene,
  camera,
  controls,
  builder,
  shapeSel,
  sxInp,
  syInp,
  szInp,
  ground,
  blocks,
  state,
} from '../core/index.js';

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
function updatePreview() {
  updatePreviewGeometry();
  updatePreviewPlacement();
}

export { preview, makeMeshByType, updatePreview, updatePreviewPlacement };
