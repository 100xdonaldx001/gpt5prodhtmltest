import { THREE } from './environment.js';

// Cache materials by color to avoid cloning shader uniforms for every voxel
const materialCache = new Map();

// Return a lambert shader material with shadow support
// color: hexadecimal color value for the block
function createBlockMaterial(color) {
  // Reuse existing material if one was already created for this color
  if (!materialCache.has(color)) {
    const uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms);
    uniforms.diffuse.value = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: THREE.ShaderLib.lambert.vertexShader,
      fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
      lights: true,
    });
    materialCache.set(color, mat);
  }
  return materialCache.get(color);
}

export { createBlockMaterial };
