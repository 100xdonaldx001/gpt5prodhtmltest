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

// Create a material that snaps vertex positions to a grid for a voxel look
function createVoxelTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x35506e, roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.voxelSize = { value: 4.0 };
    shader.vertexShader = 'uniform float voxelSize;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed = floor(transformed / voxelSize) * voxelSize;'
    );
  };
  return mat;
}

export { createBlockMaterial, createVoxelTerrainMaterial };
