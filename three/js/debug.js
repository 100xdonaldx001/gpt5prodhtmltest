import {
  dbgTests,
  dbgMovement,
  dbgGround,
  testsBox,
} from './core/index.js';
import { runTests } from './tests.js';

// Track which debug options are enabled.
const DEBUG = {
  tests: dbgTests.checked,
  movement: dbgMovement.checked,
  ground: dbgGround.checked,
};

// Expose the debug state globally for other modules.
window.__DEBUG = DEBUG;

// Run or hide tests based on the checkbox state.
function applyTests() {
  DEBUG.tests = dbgTests.checked;
  testsBox.hidden = !DEBUG.tests;
  if (DEBUG.tests) {
    testsBox.textContent = 'Running tests…';
    runTests();
  }
}

// Update movement flag when toggled.
function applyMovement() {
  DEBUG.movement = dbgMovement.checked;
}

// Update ground generation flag when toggled.
function applyGround() {
  DEBUG.ground = dbgGround.checked;
}

dbgTests.addEventListener('change', applyTests);
dbgMovement.addEventListener('change', applyMovement);
dbgGround.addEventListener('change', applyGround);

// Initialize all debug options on load.
applyTests();
applyMovement();
applyGround();

