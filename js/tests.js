import { THREE, PointerLockControls, scene, ground, blocks, chunksGroup, testsBox } from './core/index.js';

function tlog(msg) {
  console.log('[TEST]', msg);
}
function assert(name, cond) {
  if (!assert.results) assert.results = { pass: 0, fail: 0, details: [] };
  if (cond) {
    assert.results.pass++;
    assert.results.details.push('✔ ' + name);
  } else {
    assert.results.fail++;
    assert.results.details.push('✘ ' + name);
  }
}
export function runTests() {
  assert('PointerLockControls is constructable', typeof PointerLockControls === 'function');
  assert('Scene contains ground', scene.children.includes(ground));
  assert('Blocks group exists', !!blocks && blocks.children.length > 0);
  assert('Fog far extended', scene.fog.far >= 1000);

  const testRay = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
  const hit = testRay.intersectObject(ground, true)[0];
  assert('Raycaster hits ground', !!hit);

  const preLoadedCount = chunksGroup.children.length;
  window.__forceChunkUpdate(0, 0);
  const loadedNear = chunksGroup.children.length;
  assert('Chunks load near origin', loadedNear >= preLoadedCount);
  window.__forceChunkUpdate(10000, 10000);
  const loadedFar = chunksGroup.children.length;
  assert('Chunks unload when far', loadedFar <= loadedNear);
  window.__forceChunkUpdate(0, 0);

  assert('Settings handle exists', !!document.getElementById('settingsHandle'));
  assert('Builder handle exists', !!document.getElementById('builderHandle'));
  assert('World gen handle exists', !!document.getElementById('worldHandle'));

  const res = assert.results;
  const summary = `Tests: ${res.pass} passed, ${res.fail} failed`;
  tlog(summary);
  res.details.forEach(tlog);
  testsBox.textContent = summary;
}
runTests();
