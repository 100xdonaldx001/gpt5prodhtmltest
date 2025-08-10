import {
  THREE,
  builder,
  builderToggle,
  shapeSel,
  colorInp,
  sxInp,
  syInp,
  szInp,
  spawnBtn,
  clearBtn,
  userGroup,
  blockAABBs,
  rebuildAABBs,
  resetChunks,
  state,
} from '../core/index.js';
import { preview, makeMeshByType, updatePreview, updatePreviewPlacement } from './preview.js';

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
