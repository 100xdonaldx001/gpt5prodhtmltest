import {
  THREE,
  scene,
  controls,
  camera,
  renderer,
  setSun,
  sunLight,
  moonLight,
  moon,
  sunDir,
  sky,
  ground,
  blocks,
  fpsBox,
  posBox,
  timeBox,
  settingsPanel,
  builder,
  worldgenPanel,
  speedInp,
  runMulInp,
  jumpInp,
  stepHInp,
  state,
  updateChunks,
  updateTerrainChunks,
  updateHeightTexture,
  populateVegetation,
  maybeRecenterGround,
  rebuildAABBs,
  updateEnvironment,
  alignPlayerToGround,
} from '../../core/index.js';
import { constrainPanel } from '../../ui.js';
import movement from './state.js';
import { resolveHorizontalCollisions, attemptStepUp, attemptStepUpProbe, resolveVerticalCollisions } from './collisions.js';

const { move } = movement;
let last = performance.now(), frames = 0, acc = 0;
const clock = new THREE.Clock();
const downRay = new THREE.Raycaster();
let dayTime = 0; // Tracks passage of time in the day-night cycle

function updateTimeDisplay() {
  // Convert dayTime (0–1) to total minutes in a 24h cycle with a 6h offset
  const totalMinutes = Math.floor(((dayTime + 0.25) % 1) * 24 * 60);
  // Format hours and minutes with leading zeros
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  timeBox.textContent = `${hours}:${minutes}`;
}
function approach(cur, target, maxStep) {
  if (cur < target) return Math.min(target, cur + maxStep);
  if (cur > target) return Math.max(target, cur - maxStep);
  return cur;
}
function applyDeadzone(v, threshold = 1e-3) {
  // Remove tiny residual velocity to prevent drifting
  return Math.abs(v) < threshold ? 0 : v;
}
/**
 * Advance time and drive a basic day-night cycle.
 * Also updates the environment and HUD clock display.
 * @param {number} delta Time since last frame in seconds.
 */
function updateDayNightCycle(delta) {
  dayTime = (dayTime + delta * 0.01) % 1;
  const sunElev = Math.sin(dayTime * Math.PI * 2) * 90;
  const sunAz = dayTime * 360; // Rotate the sun 360° around the player
  setSun(sunElev, sunAz);
  updateEnvironment(sunElev);
  updateTimeDisplay();
}

/**
 * Handle player movement and collision resolution.
 * Updates HUD position readout and recenters the world when needed.
 * @param {number} delta Time since last frame in seconds.
 * @returns {THREE.Object3D} Player control object.
 */
function updatePlayerMovement(delta) {
  const sF = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
  const sR = (move.right ? 1 : 0) - (move.left ? 1 : 0);
  movement.walk = Math.max(0.1, parseFloat(speedInp.value) || 10);
  movement.runMul = Math.max(1, parseFloat(runMulInp.value) || 1.8);
  movement.jumpStrength = Math.max(0.1, parseFloat(jumpInp.value) || 11.5);
  movement.stepHeight = Math.max(0, parseFloat(stepHInp.value) || 1);
  const speed = movement.walk * (move.run ? movement.runMul : 1);
  const accel = speed * 20;
  const maxStep = accel * delta;
  const targetF = sF * speed;
  const targetR = sR * speed;
  movement.vForward = approach(movement.vForward, targetF, maxStep);
  movement.vRight = approach(movement.vRight, targetR, maxStep);
  const damping = Math.max(0.8, 1 - 8 * delta);
  if (sF === 0) movement.vForward *= damping;
  if (sR === 0) movement.vRight *= damping;
  movement.vForward = applyDeadzone(movement.vForward);
  movement.vRight = applyDeadzone(movement.vRight);
  movement.vY -= movement.gravity * delta;
  const obj = controls.getObject();
  const prevY = obj.position.y;
  const prevFeetY = prevY - movement.playerHeight;
  const prevHeadY = prevY;
  obj.position.y += movement.vY * delta;
  resolveVerticalCollisions(prevFeetY, prevHeadY, obj.position);
  const downOrigin = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
  downRay.set(downOrigin, new THREE.Vector3(0, -1, 0));
  const hits = downRay.intersectObjects([ground, blocks], true);
  const minDist = movement.playerHeight;
  if (hits.length) {
    const d = hits[0].distance;
    if (d < minDist) {
      obj.position.y += minDist - d;
      movement.vY = 0;
      movement.canJump = true;
    }
  }
  if (obj.position.y < -20) {
    obj.position.set(0, movement.playerHeight + 1, 0);
    movement.vForward = movement.vRight = movement.vY = 0;
    alignPlayerToGround();
  }
  controls.moveForward(movement.vForward * delta);
  controls.moveRight(movement.vRight * delta);
  const feetY = obj.position.y - movement.playerHeight;
  const headY = obj.position.y;
  const collided = resolveHorizontalCollisions(obj.position, feetY, headY);
  if (collided) {
    attemptStepUp(obj);
  } else {
    const yaw = controls.getObject().rotation.y;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dirWorld = forward.multiplyScalar(movement.vForward).add(right.multiplyScalar(movement.vRight));
    attemptStepUpProbe(obj, dirWorld);
  }
  const recenter = maybeRecenterGround(obj.position.x, obj.position.z);
  if (recenter.shifted) rebuildAABBs();
  posBox.textContent =
    `X: ${obj.position.x.toFixed(1)} Y: ${obj.position.y.toFixed(1)} Z: ${obj.position.z.toFixed(1)}`;
  return obj;
}

/**
 * Position lighting and sky objects relative to the player.
 * Keeps shadow casters near while the visible moon is far away.
 * @param {THREE.Object3D} obj Player control object.
 */
function updateLighting(obj) {
  const sunDist = 100; // Stable shadow distance for the sun
  const moonDist = 1000; // Place the moon far so it doesn't rise from the ground
  sunLight.position.set(
    obj.position.x + sunDir.x * sunDist,
    obj.position.y + sunDir.y * sunDist,
    obj.position.z + sunDir.z * sunDist
  );
  sunLight.target.position.copy(obj.position);
  sunLight.target.updateMatrixWorld();
  // Position the moon light opposite the sun but keep it near for shadows
  moonLight.position.set(
    obj.position.x - sunDir.x * sunDist,
    obj.position.y - sunDir.y * sunDist,
    obj.position.z - sunDir.z * sunDist
  );
  moonLight.target.position.copy(obj.position);
  moonLight.target.updateMatrixWorld();
  // Place the visible moon mesh farther away to avoid popping up at the player
  moon.position.set(
    obj.position.x - sunDir.x * moonDist,
    obj.position.y - sunDir.y * moonDist,
    obj.position.z - sunDir.z * moonDist
  );
  sky.position.copy(obj.position);
}

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
  updateDayNightCycle(delta);
  updateChunks();
  updateTerrainChunks();
  updateHeightTexture(new THREE.Vector2(camera.position.x, camera.position.z));
  if (state.isActive && (!window.__DEBUG || window.__DEBUG.movement)) {
    const obj = updatePlayerMovement(delta);
    updateLighting(obj);
  }
  renderer.render(scene, camera);
}
populateVegetation();
animate();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  constrainPanel(settingsPanel);
  constrainPanel(builder);
  constrainPanel(worldgenPanel);
});
controls.getObject().position.set(0, movement.playerHeight + 1, 8);
alignPlayerToGround();
