import {
  THREE,
  scene,
  controls,
  camera,
  renderer,
  setSun,
  sunLight,
  sunDir,
  sky,
  ground,
  blocks,
  fpsBox,
  settingsPanel,
  builder,
  worldgenPanel,
  speedInp,
  runMulInp,
  jumpInp,
  stepHInp,
  sunElevInp,
  sunAziInp,
  sunColorInp,
  state,
  updateChunks,
  maybeRecenterGround,
  blockAABBs,
  rebuildAABBs,
} from '../core/index.js';
import { toggleBuilder } from '../builder.js';
import { constrainPanel } from '../ui.js';

const move = { forward: false, back: false, left: false, right: false, run: false };
let canJump = false;
const gravity = 30;
let walk = 10;
let runMul = 1.8;
let jumpStrength = 11.5;
// Height the player can step over; matches voxel height
let stepHeight = 1;
const playerHeight = 1.75;
const playerRadius = 0.45;
let vForward = 0,
  vRight = 0,
  vY = 0;
let lastElev = 22,
  lastAzi = 140,
  lastColor = '#ffffff';

function onKeyDown(e) {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      move.forward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      move.left = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      move.back = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      move.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      move.run = true;
      break;
    case 'Space':
      if (canJump && state.isActive) {
        vY = jumpStrength;
        canJump = false;
      }
      break;
    case 'KeyB':
      if (state.isActive) {
        toggleBuilder();
      }
      break;
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      move.forward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      move.left = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      move.back = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      move.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      move.run = false;
      break;
  }
}
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
sunColorInp.addEventListener('change', () => {
  // Unfocus color picker so movement keys aren't captured
  sunColorInp.blur();
});

const downRay = new THREE.Raycaster();

function approach(cur, target, maxStep) {
  if (cur < target) return Math.min(target, cur + maxStep);
  if (cur > target) return Math.max(target, cur - maxStep);
  return cur;
}

function resolveHorizontalCollisions(pos3, feetY, headY) {
  const EPS = 1e-2;
  let collided = false;
  for (const { box } of blockAABBs) {
    if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
    const minX = box.min.x - playerRadius,
      maxX = box.max.x + playerRadius;
    const minZ = box.min.z - playerRadius,
      maxZ = box.max.z + playerRadius;
    if (pos3.x < minX || pos3.x > maxX || pos3.z < minZ || pos3.z > maxZ) continue;
    const dxLeft = Math.abs(pos3.x - minX);
    const dxRight = Math.abs(maxX - pos3.x);
    const dzNear = Math.abs(pos3.z - minZ);
    const dzFar = Math.abs(maxZ - pos3.z);
    const pushX = Math.min(dxLeft, dxRight);
    const pushZ = Math.min(dzNear, dzFar);
    if (pushX < pushZ) {
      if (dxLeft < dxRight) pos3.x = minX;
      else pos3.x = maxX;
      vRight = 0;
    } else {
      if (dzNear < dzFar) pos3.z = minZ;
      else pos3.z = maxZ;
      vForward = 0;
    }
    collided = true;
  }
  return collided;
}

function hasHorizontalOverlap(pos3, feetY, headY) {
  const EPS = 1e-2;
  for (const { box } of blockAABBs) {
    if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
    const minX = box.min.x - playerRadius,
      maxX = box.max.x + playerRadius;
    const minZ = box.min.z - playerRadius,
      maxZ = box.max.z + playerRadius;
    if (pos3.x >= minX && pos3.x <= maxX && pos3.z >= minZ && pos3.z <= maxZ) return true;
  }
  return false;
}

function attemptStepUp(obj) {
  const EPS = 1e-3;
  const feetY = obj.position.y - playerHeight;
  const maxStep = Math.max(0, stepHeight);
  let bestTop = Infinity;
  for (const { box } of blockAABBs) {
    const minX = box.min.x - playerRadius,
      maxX = box.max.x + playerRadius;
    const minZ = box.min.z - playerRadius,
      maxZ = box.max.z + playerRadius;
    if (obj.position.x < minX || obj.position.x > maxX || obj.position.z < minZ || obj.position.z > maxZ) continue;
    const top = box.max.y;
    if (top + EPS >= feetY && top <= feetY + maxStep + EPS) {
      if (top < bestTop) bestTop = top;
    }
  }
  if (!isFinite(bestTop)) return false;
  const tryY = bestTop + playerHeight + EPS;
  const savedY = obj.position.y;
  obj.position.y = tryY;
  const ok = !hasHorizontalOverlap(obj.position, tryY - playerHeight, tryY);
  if (ok) {
    vY = 0;
    canJump = true;
    return true;
  }
  obj.position.y = savedY;
  return false;
}

function attemptStepUpProbe(obj, dirWorld) {
  const EPS = 1e-3;
  const maxStep = Math.max(0, stepHeight);
  if (dirWorld.lengthSq() < 1e-6) return false;
  const ahead = obj.position.clone().addScaledVector(dirWorld.clone().normalize(), playerRadius + 0.05);
  const feetY = obj.position.y - playerHeight;
  let bestTop = Infinity;
  for (const { box } of blockAABBs) {
    const minX = box.min.x - playerRadius,
      maxX = box.max.x + playerRadius;
    const minZ = box.min.z - playerRadius,
      maxZ = box.max.z + playerRadius;
    if (ahead.x < minX || ahead.x > maxX || ahead.z < minZ || ahead.z > maxZ) continue;
    const top = box.max.y;
    if (top + EPS >= feetY && top <= feetY + maxStep + EPS) {
      if (top < bestTop) bestTop = top;
    }
  }
  if (!isFinite(bestTop)) return false;
  const tryY = bestTop + playerHeight + EPS;
  const savedY = obj.position.y;
  obj.position.y = tryY;
  const ok = !hasHorizontalOverlap(obj.position, tryY - playerHeight, tryY);
  if (ok) {
    vY = 0;
    canJump = true;
    return true;
  }
  obj.position.y = savedY;
  return false;
}

function resolveVerticalCollisions(prevFeetY, prevHeadY, pos3) {
  for (const { box } of blockAABBs) {
    const minX = box.min.x - playerRadius,
      maxX = box.max.x + playerRadius;
    const minZ = box.min.z - playerRadius,
      maxZ = box.max.z + playerRadius;
    if (pos3.x < minX || pos3.x > maxX || pos3.z < minZ || pos3.z > maxZ) continue;
    const feetY = pos3.y - playerHeight;
    const headY = pos3.y;
    if (vY > 0 && prevHeadY <= box.min.y && headY > box.min.y) {
      pos3.y = box.min.y - playerHeight;
      vY = 0;
      canJump = false;
    }
    if (vY < 0 && prevFeetY >= box.max.y && feetY < box.max.y) {
      pos3.y = box.max.y + playerHeight;
      vY = 0;
      canJump = true;
    }
  }
}

let last = performance.now(),
  frames = 0,
  acc = 0;
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  frames++;
  acc += now - last;
  last = now;
  if (acc >= 500) {
    fpsBox.textContent = Math.round((frames * 1000) / acc) + ' FPS';
    frames = 0;
    acc = 0;
  }
  updateChunks();
  if (state.isActive) {
    const sF = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
    const sR = (move.right ? 1 : 0) - (move.left ? 1 : 0);
    walk = Math.max(0.1, parseFloat(speedInp.value) || 10);
    runMul = Math.max(1, parseFloat(runMulInp.value) || 1.8);
    jumpStrength = Math.max(0.1, parseFloat(jumpInp.value) || 11.5);
    stepHeight = Math.max(0, parseFloat(stepHInp.value) || 1);
    const elev = parseFloat(sunElevInp.value) || 22;
    const azi = parseFloat(sunAziInp.value) || 140;
    const col = sunColorInp.value || '#ffffff';
    if (elev !== lastElev || azi !== lastAzi) {
      setSun(elev, azi);
      lastElev = elev;
      lastAzi = azi;
    }
    if (col !== lastColor) {
      sunLight.color.set(col);
      lastColor = col;
    }

    const speed = walk * (move.run ? runMul : 1);
    const accel = speed * 20;
    const maxStep = accel * delta;

    const targetF = sF * speed;
    const targetR = sR * speed;

    vForward = approach(vForward, targetF, maxStep);
    vRight = approach(vRight, targetR, maxStep);
    const damping = Math.max(0.8, 1 - 8 * delta);
    if (sF === 0) vForward *= damping;
    if (sR === 0) vRight *= damping;

    vY -= gravity * delta;
    const obj = controls.getObject();
    const prevY = obj.position.y;
    const prevFeetY = prevY - playerHeight;
    const prevHeadY = prevY;
    obj.position.y += vY * delta;
    resolveVerticalCollisions(prevFeetY, prevHeadY, obj.position);

    const downOrigin = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
    downRay.set(downOrigin, new THREE.Vector3(0, -1, 0));
    const hits = downRay.intersectObjects([ground, blocks], true);
    const minDist = playerHeight;
    if (hits.length) {
      const d = hits[0].distance;
      if (d < minDist) {
        obj.position.y += minDist - d;
        vY = 0;
        canJump = true;
      }
    }
    if (obj.position.y < -20) {
      obj.position.set(0, playerHeight + 1, 0);
      vForward = vRight = vY = 0;
    }

    controls.moveForward(vForward * delta);
    controls.moveRight(vRight * delta);
    const feetY = obj.position.y - playerHeight;
    const headY = obj.position.y;
    const collided = resolveHorizontalCollisions(obj.position, feetY, headY);
    if (collided) {
      attemptStepUp(obj);
    } else {
      const yaw = controls.getObject().rotation.y;
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const dirWorld = forward.multiplyScalar(vForward).add(right.multiplyScalar(vRight));
      attemptStepUpProbe(obj, dirWorld);
    }

    if (maybeRecenterGround(obj.position.x, obj.position.z)) {
      rebuildAABBs();
    }
    // Reposition sunlight to follow the player for consistent shadow coverage
    const dist = 100;
    sunLight.position.set(
      obj.position.x + sunDir.x * dist,
      obj.position.y + sunDir.y * dist,
      obj.position.z + sunDir.z * dist
    );
    sunLight.target.position.copy(obj.position);
    sunLight.target.updateMatrixWorld();
    // Keep skybox centered on the player
    sky.position.copy(obj.position);
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  constrainPanel(settingsPanel);
  constrainPanel(builder);
  constrainPanel(worldgenPanel);
});
controls.getObject().position.set(0, 1.75 + 1, 8);
