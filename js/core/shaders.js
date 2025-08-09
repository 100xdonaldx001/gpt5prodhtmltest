import { THREE } from './environment.js';

// Create a basic lambert shader material with shadow support
// color: hexadecimal color value for the block
function createBlockMaterial(color) {
  // Clone lambert shader uniforms so each material has its own set
  const uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms);
  uniforms.diffuse.value = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
    lights: true,
  });
}

export { createBlockMaterial };
