import { sunColorInp, state } from '../../core/index.js';
import { toggleBuilder } from '../../builder/index.js';
import movement from './state.js';

function onKeyDown(e) {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      movement.move.forward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      movement.move.left = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      movement.move.back = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      movement.move.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      movement.move.run = true;
      break;
    case 'Space':
      if (movement.canJump && state.isActive) {
        // Apply upward velocity when jumping
        movement.vel.y = movement.jumpStrength;
        movement.canJump = false;
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
      movement.move.forward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      movement.move.left = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      movement.move.back = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      movement.move.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      movement.move.run = false;
      break;
  }
}
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
sunColorInp.addEventListener('change', () => {
  // Unfocus color picker so movement keys aren't captured
  sunColorInp.blur();
});
