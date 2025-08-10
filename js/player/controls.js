import {
  controls,
  camera,
  renderer,
  overlay,
  startBtn,
  hud,
  crosshair,
  fpsBox,
  posBox,
  timeBox,
  testsBox,
  warnBox,
  settingsPanel,
  builder,
  builderToggle,
  procToggle,
  worldgenPanel,
  state,
  debugPanel,
  } from '../core/index.js';
  import { updatePreview } from '../builder/preview.js';

let fallbackActive = state.fallbackActive;
let mouseEnabled = state.mouseEnabled;

function showUI(active) {
  overlay.style.display = active ? 'none' : 'grid';
  hud.hidden = !active;
  crosshair.hidden = !active;
  fpsBox.hidden = !active;
  posBox.hidden = !active;
  timeBox.hidden = !active;
  testsBox.hidden = !active;
  settingsPanel.hidden = !active;
  worldgenPanel.hidden = !active;
  builderToggle.hidden = !active;
  procToggle.hidden = !active;
  if (!active) builder.hidden = true;
  // Show or hide debug options with the main UI.
  debugPanel.hidden = !active;
  warnBox.hidden = !(active && fallbackActive);
}

function engageFallback() {
  if (fallbackActive) return;
  fallbackActive = true;
  state.fallbackActive = true;
  state.isActive = true;
  showUI(true);
  const canvas = renderer.domElement;
  let dragging = false,
    lx = 0,
    ly = 0;
  const look = 0.002;
  const yawObj = controls.getObject();
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx,
      dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    yawObj.rotation.y -= dx * look;
    camera.rotation.x -= dy * look;
    camera.rotation.z = 0;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  });
}

function sandboxBlocksPointerLock() {
  try {
    if (!window.frameElement) return false;
    if (!window.frameElement.hasAttribute('sandbox')) return false;
    const tokens = Array.from(window.frameElement.sandbox || []);
    return !tokens.includes('allow-pointer-lock');
  } catch {
    return false;
  }
}

function tryEnter() {
  const supportsPL =
    'pointerLockElement' in document && typeof document.body.requestPointerLock === 'function';
  if (!supportsPL || sandboxBlocksPointerLock()) {
    engageFallback();
    return;
  }
  const onError = () => {
    document.removeEventListener('pointerlockerror', onError);
    engageFallback();
  };
  document.addEventListener('pointerlockerror', onError, { once: true });
  controls.lock();
}

startBtn.addEventListener('click', tryEnter);

window.addEventListener('mousedown', (e) => {
  if (e.button === 2 && !fallbackActive) {
    e.preventDefault();
    if (controls.isLocked) {
      mouseEnabled = true;
      state.mouseEnabled = true;
      controls.unlock();
    } else if (mouseEnabled) {
      mouseEnabled = false;
      state.mouseEnabled = false;
      controls.lock();
    }
  }
});

window.addEventListener('contextmenu', (e) => {
  // block context menu when right click toggles pointer lock
  if (!fallbackActive) e.preventDefault();
});

controls.addEventListener('lock', () => {
  state.isActive = true;
  fallbackActive = false;
  state.fallbackActive = false;
  mouseEnabled = false;
  state.mouseEnabled = false;
  showUI(true);
  updatePreview();
});
controls.addEventListener('unlock', () => {
  if (mouseEnabled) {
    showUI(true);
  } else {
    state.isActive = false;
    showUI(false);
  }
});

export { showUI };
