import * as THREE from 'three';

// Active weather state: 'clear', 'rain', or 'snow'
let current = 'clear';

// Particle systems for different weather types
let rain, snow;

/**
 * Create a simple particle system for rain using THREE.Points.
 * @returns {{points: THREE.Points, positions: Float32Array, geom: THREE.BufferGeometry}}
 */
function createRain() {
  const geom = new THREE.BufferGeometry();
  const count = 1000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 100 + 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1 });
  const points = new THREE.Points(geom, mat);
  points.visible = false;
  return { points, positions, geom };
}

/**
 * Create a particle system for snow using THREE.Points.
 * @returns {{points: THREE.Points, positions: Float32Array, geom: THREE.BufferGeometry}}
 */
function createSnow() {
  const geom = new THREE.BufferGeometry();
  const count = 1000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 100 + 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 });
  const points = new THREE.Points(geom, mat);
  points.visible = false;
  return { points, positions, geom };
}

/**
 * Initialize weather particle systems and add them to the scene.
 * @param {THREE.Scene} scene Scene to attach particle systems to.
 */
function initWeather(scene) {
  rain = createRain();
  snow = createSnow();
  scene.add(rain.points);
  scene.add(snow.points);
}

/**
 * Set the active weather state.
 * @param {'clear'|'rain'|'snow'} state Desired weather state.
 */
function setWeather(state) {
  current = state;
  rain.points.visible = state === 'rain';
  snow.points.visible = state === 'snow';
}

/**
 * Retrieve current weather state.
 * @returns {'clear'|'rain'|'snow'}
 */
function getWeather() {
  return current;
}

/**
 * Update the active weather particle system.
 * @param {number} delta Time since last frame in seconds.
 */
function updateWeather(delta) {
  if (current === 'rain') {
    const pos = rain.positions;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= 100 * delta;
      if (pos[i + 1] < 0) pos[i + 1] = Math.random() * 100 + 50;
    }
    rain.geom.attributes.position.needsUpdate = true;
  } else if (current === 'snow') {
    const pos = snow.positions;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += (Math.random() - 0.5) * delta * 1;
      pos[i + 2] += (Math.random() - 0.5) * delta * 1;
      pos[i + 1] -= 10 * delta;
      if (pos[i + 1] < 0) pos[i + 1] = Math.random() * 100 + 50;
    }
    snow.geom.attributes.position.needsUpdate = true;
  }
}

export { initWeather, setWeather, getWeather, updateWeather };

