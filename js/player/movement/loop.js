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
  moonStrengthInp,
  state,
  updateChunks,
  maybeRecenterGround,
  rebuildAABBs,
  updateEnvironment,
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
  // Advance time and drive a basic day/night cycle
  dayTime = (dayTime + delta * 0.01) % 1;
  const sunElev = Math.sin(dayTime * Math.PI * 2) * 90;
  // Rotate the sun around the player for a full 360° cycle
  const sunAz = dayTime * 360;
  setSun(sunElev, sunAz);
  updateEnvironment(sunElev);
  updateTimeDisplay();
  updateChunks();
  // Only update player motion when enabled in the debug menu.
  if (state.isActive && (!window.__DEBUG || window.__DEBUG.movement)) {
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
    const dist = 100;
    sunLight.position.set(
      obj.position.x + sunDir.x * dist,
      obj.position.y + sunDir.y * dist,
      obj.position.z + sunDir.z * dist
    );
    sunLight.target.position.copy(obj.position);
    sunLight.target.updateMatrixWorld();
    // Position the moon opposite the sun and apply user-defined strength
    const moonStrength = parseFloat(moonStrengthInp.value);
    moonLight.intensity = Number.isFinite(moonStrength) ? moonStrength : 0.2;
    moonLight.position.set(
      obj.position.x - sunDir.x * dist,
      obj.position.y - sunDir.y * dist,
      obj.position.z - sunDir.z * dist
    );
    moonLight.target.position.copy(obj.position);
    moonLight.target.updateMatrixWorld();
    // Keep the visible moon mesh aligned with the light
    moon.position.copy(moonLight.position);
    sky.position.copy(obj.position);
    // Show current player position in the HUD
    posBox.textContent =
      `X: ${obj.position.x.toFixed(1)} Y: ${obj.position.y.toFixed(1)} Z: ${obj.position.z.toFixed(1)}`;
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
controls.getObject().position.set(0, movement.playerHeight + 1, 8);
