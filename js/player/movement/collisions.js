import { blockAABBs } from '../../core/index.js';
import movement from './state.js';

function resolveHorizontalCollisions(pos3, feetY, headY) {
  const EPS = 1e-2;
  let collided = false;
  for (const { box } of blockAABBs) {
    if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
    const minX = box.min.x - movement.playerRadius,
      maxX = box.max.x + movement.playerRadius;
    const minZ = box.min.z - movement.playerRadius,
      maxZ = box.max.z + movement.playerRadius;
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
      // Stop horizontal movement along the X axis
      movement.vel.x = 0;
    } else {
      if (dzNear < dzFar) pos3.z = minZ;
      else pos3.z = maxZ;
      // Stop horizontal movement along the Z axis
      movement.vel.z = 0;
    }
    collided = true;
  }
  return collided;
}

function hasHorizontalOverlap(pos3, feetY, headY) {
  const EPS = 1e-2;
  for (const { box } of blockAABBs) {
    if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
    const minX = box.min.x - movement.playerRadius,
      maxX = box.max.x + movement.playerRadius;
    const minZ = box.min.z - movement.playerRadius,
      maxZ = box.max.z + movement.playerRadius;
    if (pos3.x >= minX && pos3.x <= maxX && pos3.z >= minZ && pos3.z <= maxZ) return true;
  }
  return false;
}

function attemptStepUp(obj) {
  const EPS = 1e-3;
  const feetY = obj.position.y - movement.playerHeight;
  const maxStep = Math.max(0, movement.stepHeight);
  let bestTop = Infinity;
  for (const { box } of blockAABBs) {
    const minX = box.min.x - movement.playerRadius,
      maxX = box.max.x + movement.playerRadius;
    const minZ = box.min.z - movement.playerRadius,
      maxZ = box.max.z + movement.playerRadius;
    if (obj.position.x < minX || obj.position.x > maxX || obj.position.z < minZ || obj.position.z > maxZ) continue;
    const top = box.max.y;
    if (top + EPS >= feetY && top <= feetY + maxStep + EPS) {
      if (top < bestTop) bestTop = top;
    }
  }
  if (!isFinite(bestTop)) return false;
  const tryY = bestTop + movement.playerHeight + EPS;
  const savedY = obj.position.y;
  obj.position.y = tryY;
  const ok = !hasHorizontalOverlap(obj.position, tryY - movement.playerHeight, tryY);
  if (ok) {
    movement.vel.y = 0;
    movement.canJump = true;
    return true;
  }
  obj.position.y = savedY;
  return false;
}

function attemptStepUpProbe(obj, dirWorld) {
  const EPS = 1e-3;
  const maxStep = Math.max(0, movement.stepHeight);
  if (dirWorld.lengthSq() < 1e-6) return false;
  const ahead = obj.position.clone().addScaledVector(dirWorld.clone().normalize(), movement.playerRadius + 0.05);
  const feetY = obj.position.y - movement.playerHeight;
  let bestTop = Infinity;
  for (const { box } of blockAABBs) {
    const minX = box.min.x - movement.playerRadius,
      maxX = box.max.x + movement.playerRadius;
    const minZ = box.min.z - movement.playerRadius,
      maxZ = box.max.z + movement.playerRadius;
    if (ahead.x < minX || ahead.x > maxX || ahead.z < minZ || ahead.z > maxZ) continue;
    const top = box.max.y;
    if (top + EPS >= feetY && top <= feetY + maxStep + EPS) {
      if (top < bestTop) bestTop = top;
    }
  }
  if (!isFinite(bestTop)) return false;
  const tryY = bestTop + movement.playerHeight + EPS;
  const savedY = obj.position.y;
  obj.position.y = tryY;
  const ok = !hasHorizontalOverlap(obj.position, tryY - movement.playerHeight, tryY);
  if (ok) {
    movement.vel.y = 0;
    movement.canJump = true;
    return true;
  }
  obj.position.y = savedY;
  return false;
}

function resolveVerticalCollisions(prevFeetY, prevHeadY, pos3) {
  for (const { box } of blockAABBs) {
    const minX = box.min.x - movement.playerRadius,
      maxX = box.max.x + movement.playerRadius;
    const minZ = box.min.z - movement.playerRadius,
      maxZ = box.max.z + movement.playerRadius;
    if (pos3.x < minX || pos3.x > maxX || pos3.z < minZ || pos3.z > maxZ) continue;
    const feetY = pos3.y - movement.playerHeight;
    const headY = pos3.y;
    if (movement.vel.y > 0 && prevHeadY <= box.min.y && headY > box.min.y) {
      pos3.y = box.min.y - movement.playerHeight;
      movement.vel.y = 0;
      movement.canJump = false;
    }
    if (movement.vel.y < 0 && prevFeetY >= box.max.y && feetY < box.max.y) {
      pos3.y = box.max.y + movement.playerHeight;
      movement.vel.y = 0;
      movement.canJump = true;
    }
  }
}

export {
  resolveHorizontalCollisions,
  attemptStepUp,
  attemptStepUpProbe,
  resolveVerticalCollisions,
};
