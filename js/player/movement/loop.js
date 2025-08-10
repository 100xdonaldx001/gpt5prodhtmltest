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
const downRay = new THREE.Raycaster();
// Reuse vectors to avoid creating new objects every frame
const downOrigin = new THREE.Vector3();
const downDir = new THREE.Vector3(0, -1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const dirWorld = new THREE.Vector3();
function approach(cur, target, maxStep) {
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
    const targetF = sF * speed;
    const targetR = sR * speed;
    movement.vForward = approach(movement.vForward, targetF, maxStep);
    movement.vRight = approach(movement.vRight, targetR, maxStep);
    const damping = Math.max(0.8, 1 - 8 * delta);
    if (sF === 0) movement.vForward *= damping;
    if (sR === 0) movement.vRight *= damping;
    movement.vY -= movement.gravity * delta;
    const obj = controls.getObject();
    const prevY = obj.position.y;
    const prevFeetY = prevY - movement.playerHeight;
    const prevHeadY = prevY;
    obj.position.y += movement.vY * delta;
    resolveVerticalCollisions(prevFeetY, prevHeadY, obj.position);
    // Use preallocated vectors for raycasting
    downOrigin.copy(obj.position);
    downRay.set(downOrigin, downDir);
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
      const yaw = obj.rotation.y;
      // Reuse vectors to compute world direction without allocations
      forward.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(movement.vForward);
      right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(movement.vRight);
      dirWorld.copy(forward).add(right);
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
