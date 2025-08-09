import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b3e8);
scene.fog = new THREE.Fog(0x87b3e8, 120, 1200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
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
sky.scale.setScalar(10000);
scene.add(sky);
const sun = new THREE.Vector3();
function setSun(elevation = 20, azimuth = 130) {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms['sunPosition'].value.copy(sun);
}
sky.material.uniforms['turbidity'].value = 2.0;
sky.material.uniforms['rayleigh'].value = 1.2;
sky.material.uniforms['mieCoefficient'].value = 0.003;
sky.material.uniforms['mieDirectionalG'].value = 0.8;
setSun(22, 140);

// Lights
const hemi = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(20, 80, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
scene.add(dir);

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
};
