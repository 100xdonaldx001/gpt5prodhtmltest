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
  posBox,
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
  rebuildAABBs,
} from '../../core/index.js';
import { constrainPanel } from '../../ui.js';
import movement from './state.js';
import { resolveHorizontalCollisions, attemptStepUp, attemptStepUpProbe, resolveVerticalCollisions } from './collisions.js';

const { move } = movement;
let last = performance.now(), frames = 0, acc = 0;
const clock = new THREE.Clock();
const downRay = new THREE.Raycaster(); // Used to detect ground beneath the player
function approach(cur, target, maxStep) {
  // Move the current value toward the target without exceeding maxStep
  if (cur < target) return Math.min(target, cur + maxStep);
  if (cur > target) return Math.max(target, cur - maxStep);
  return cur;
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
  updateChunks();
  if (state.isActive) {
    const sF = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
    const sR = (move.right ? 1 : 0) - (move.left ? 1 : 0);
    movement.walk = Math.max(0.1, parseFloat(speedInp.value) || 10);
    movement.runMul = Math.max(1, parseFloat(runMulInp.value) || 1.8);
    movement.jumpStrength = Math.max(0.1, parseFloat(jumpInp.value) || 11.5);
    movement.stepHeight = Math.max(0, parseFloat(stepHInp.value) || 1);
    const elev = parseFloat(sunElevInp.value) || 22;
    const azi = parseFloat(sunAziInp.value) || 140;
    const col = sunColorInp.value || '#ffffff';
    if (elev !== movement.lastElev || azi !== movement.lastAzi) {
      setSun(elev, azi);
      movement.lastElev = elev;
      movement.lastAzi = azi;
    }
    if (col !== movement.lastColor) {
      sunLight.color.set(col);
      movement.lastColor = col;
    }
    const speed = movement.walk * (move.run ? movement.runMul : 1);
    const accel = speed * 20;
    const maxStep = accel * delta;
    // Object representing the player's camera
    const obj = controls.getObject();
    const yaw = obj.rotation.y;
    // Forward and right vectors in world space
    const dirF = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const dirR = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    // Target velocities based on input
    const targetVelX = (dirF.x * sF + dirR.x * sR) * speed;
    const targetVelZ = (dirF.z * sF + dirR.z * sR) * speed;
    movement.vel.x = approach(movement.vel.x, targetVelX, maxStep);
    movement.vel.z = approach(movement.vel.z, targetVelZ, maxStep);
    const damping = Math.max(0.8, 1 - 8 * delta);
    if (sF === 0 && sR === 0) {
      movement.vel.x *= damping;
      movement.vel.z *= damping;
    }
    movement.vel.y -= movement.gravity * delta;
    const prevY = obj.position.y;
    const prevFeetY = prevY - movement.playerHeight;
    const prevHeadY = prevY;
    // Move vertically first to handle gravity
    obj.position.y += movement.vel.y * delta;
    resolveVerticalCollisions(prevFeetY, prevHeadY, obj.position);
    // Cast a ray downward to keep the player grounded
    const downOrigin = obj.position.clone();
    const downDir = new THREE.Vector3(0, -1, 0);
    downRay.set(downOrigin, downDir);
    const hits = downRay.intersectObjects([ground, blocks], true);
    const minDist = movement.playerHeight;
    if (hits.length) {
      const d = hits[0].distance;
      if (d < minDist) {
        obj.position.y += minDist - d;
        movement.vel.y = 0;
        movement.canJump = true;
      }
    }
    if (obj.position.y < -20) {
      obj.position.set(0, movement.playerHeight + 1, 0);
      movement.vel.x = movement.vel.y = movement.vel.z = 0;
    }
    // Apply horizontal velocity
    obj.position.x += movement.vel.x * delta;
    obj.position.z += movement.vel.z * delta;
    const feetY = obj.position.y - movement.playerHeight;
    const headY = obj.position.y;
    const collided = resolveHorizontalCollisions(obj.position, feetY, headY);
    if (collided) {
      attemptStepUp(obj);
    } else {
      const dirWorld = new THREE.Vector3(movement.vel.x, 0, movement.vel.z);
      attemptStepUpProbe(obj, dirWorld);
    }
    if (maybeRecenterGround(obj.position.x, obj.position.z)) rebuildAABBs();
    const dist = 100;
    sunLight.position.set(
      obj.position.x + sunDir.x * dist,
      obj.position.y + sunDir.y * dist,
      obj.position.z + sunDir.z * dist
    );
    sunLight.target.position.copy(obj.position);
    sunLight.target.updateMatrixWorld();
    sky.position.copy(obj.position);
    // Show current player position
    posBox.textContent =
      `X: ${obj.position.x.toFixed(1)} Y: ${obj.position.y.toFixed(1)} Z: ${obj.position.z.toFixed(1)}`;
  }
  renderer.render(scene, camera);
}
// Set initial player position before starting the loop to avoid a visible teleport.
controls.getObject().position.set(0, movement.playerHeight + 1, 8);
animate();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  constrainPanel(settingsPanel);
  constrainPanel(builder);
  constrainPanel(worldgenPanel);
});
