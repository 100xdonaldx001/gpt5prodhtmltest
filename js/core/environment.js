import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b3e8);
// Extend fog and camera range so distant chunks remain visible
scene.fog = new THREE.Fog(0x87b3e8, 120, 3000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 1.75, 5);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// Use soft shadows for a smoother appearance
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Atmosphere sky
const sky = new Sky();
// Enlarge skybox so it remains beyond the furthest view distance
sky.scale.setScalar(20000);
scene.add(sky);
// Direction vector pointing from origin toward the sun
const sunDir = new THREE.Vector3();
// Update sun direction and sky shader based on elevation and azimuth
function setSun(elevation = 20, azimuth = 130) {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms['sunPosition'].value.copy(sunDir);
}
// Configure atmospheric scattering parameters
sky.material.uniforms['turbidity'].value = 2.0;
sky.material.uniforms['rayleigh'].value = 1.2;
sky.material.uniforms['mieCoefficient'].value = 0.003;
sky.material.uniforms['mieDirectionalG'].value = 0.8;
setSun(22, 140);
// Helper to blend two colors
function lerpColor(a, b, t) {
  // Clone to avoid mutating the originals then interpolate
  return a.clone().lerp(b, t);
}

// Base colors for day and night phases
const dayColor = new THREE.Color(0x87b3e8);
const nightColor = new THREE.Color(0x0a0a33);
const daySun = new THREE.Color(0xffffff);
const nightSun = new THREE.Color(0x222244);

// Update lighting, fog and background from sun elevation (degrees)
function updateEnvironment(elevation) {
  const t = Math.max(0, Math.sin(THREE.MathUtils.degToRad(elevation)));
  const bg = lerpColor(nightColor, dayColor, t);
  const sunCol = lerpColor(nightSun, daySun, t);
  scene.background.copy(bg);
  scene.fog.color.copy(bg);
  sunLight.color.copy(sunCol);
  sunLight.intensity = 0.2 + 0.8 * t;
  hemi.intensity = 0.1 + 0.9 * t;
}

// Lights
const hemi = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.8);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
sunLight.position.set(20, 80, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
// Widen the shadow camera so distant blocks can still receive and cast shadows
const shadowRange = 100;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -shadowRange;
sunLight.shadow.camera.right = shadowRange;
sunLight.shadow.camera.top = shadowRange;
sunLight.shadow.camera.bottom = -shadowRange;
scene.add(sunLight);

// Controls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

export {
  THREE,
  PointerLockControls,
  Sky,
  scene,
  camera,
  renderer,
  controls,
  setSun,
  sunLight,
  sunDir,
  sky,
  updateEnvironment,
};
