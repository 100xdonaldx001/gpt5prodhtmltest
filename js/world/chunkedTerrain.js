import { THREE, scene, camera, renderer } from '../core/environment.js';
// Import the utility functions for merging geometries
import { mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tile size in world units
const TILE_SIZE = 64;
// Maximum quadtree depth for LOD
const MAX_DEPTH = 6;

// Render target for GPU heightmap generation
const heightTarget = new THREE.WebGLRenderTarget(256, 256, {
  type: THREE.FloatType
});

// Plane geometry reused for tiles; displacement happens in vertex shader
const baseGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, 64, 64);
baseGeo.rotateX(-Math.PI / 2);

// Shader to generate heights using OpenSimplex noise
const heightMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uOffset: { value: new THREE.Vector2() },
    uScale: { value: 0.005 }
  },
  vertexShader: `
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec2 uOffset;   // Offset for noise lookup
    uniform float uScale;   // Scale of noise sampling
    // 2D OpenSimplex noise adapted for GLSL
    vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec2 mod289(vec2 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ; m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / 256.0;
      float h = snoise((uv + uOffset) / uScale);
      gl_FragColor = vec4(h, h, h, 1.0);
    }
  `
});

// Shader material for displaced terrain with triplanar texturing
const terrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uHeightMap: { value: heightTarget.texture },
    uScale: { value: TILE_SIZE / 256.0 },
    uTexAtlas: { value: null }
  },
  vertexShader: `
    uniform sampler2D uHeightMap;
    uniform float uScale;
    varying vec3 vPos;
    void main(){
      vec2 uv = uv;
      float h = texture2D(uHeightMap, uv).r;
      vec3 transformed = position;
      transformed.y += h * uScale;
      vPos = transformed;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexAtlas;
    varying vec3 vPos;
    // Basic triplanar mapping selecting texture from atlas
    vec3 getTriPlanar(vec3 p){
      vec3 n = normalize(cross(dFdx(p), dFdy(p)));
      vec3 blend = abs(n);
      blend /= dot(blend, vec3(1.0));
      vec3 x = texture2D(uTexAtlas, p.zy).rgb;
      vec3 y = texture2D(uTexAtlas, p.xz).rgb;
      vec3 z = texture2D(uTexAtlas, p.xy).rgb;
      return x * blend.x + y * blend.y + z * blend.z;
    }
    void main(){
      gl_FragColor = vec4(getTriPlanar(vPos), 1.0);
    }
  `,
  side: THREE.DoubleSide
});

// Node in the quadtree structure
class ChunkNode {
  constructor(level, x, z){
    this.level = level;
    this.x = x;
    this.z = z;
    this.children = [];
    this.mesh = null;
    this.bounds = new THREE.Box3();
  }
  // Generate or update mesh for this chunk
  build(){
    if(this.mesh) return;
    this.mesh = new THREE.Mesh(baseGeo, terrainMaterial);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = true;
    this.mesh.position.set(this.x * TILE_SIZE, 0, this.z * TILE_SIZE);
    this.mesh.updateMatrix();
    scene.add(this.mesh);
  }
}

const root = new ChunkNode(0, 0, 0);

// Update quadtree based on camera position and streaming radius
function updateTerrainChunks(){
  const camX = camera.position.x;
  const camZ = camera.position.z;
  // Simple quadtree expansion around camera
  function updateNode(node){
    const size = TILE_SIZE * Math.pow(2, node.level);
    const minX = node.x * TILE_SIZE;
    const minZ = node.z * TILE_SIZE;
    const maxX = minX + size;
    const maxZ = minZ + size;
    node.bounds.set(
      new THREE.Vector3(minX, -1000, minZ),
      new THREE.Vector3(maxX, 1000, maxZ)
    );
    const distance = Math.max(Math.abs(camX - (minX + size/2)), Math.abs(camZ - (minZ + size/2)));
    if(node.level < MAX_DEPTH && distance < size * 2){
      if(node.children.length === 0){
        const half = size/2 / TILE_SIZE;
        node.children.push(new ChunkNode(node.level+1, node.x*2, node.z*2));
        node.children.push(new ChunkNode(node.level+1, node.x*2+1, node.z*2));
        node.children.push(new ChunkNode(node.level+1, node.x*2, node.z*2+1));
        node.children.push(new ChunkNode(node.level+1, node.x*2+1, node.z*2+1));
      }
      node.children.forEach(updateNode);
    } else {
      node.build();
    }
  }
  updateNode(root);
}

// Generate the height map texture on the GPU
function updateHeightTexture(offset){
  heightMaterial.uniforms.uOffset.value.copy(offset);
  renderer.setRenderTarget(heightTarget);
  renderer.render(fullscreenScene, fullscreenCamera);
  renderer.setRenderTarget(null);
}

// Fullscreen quad setup for render-to-texture
const fullscreenScene = new THREE.Scene();
const fullscreenCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
fullscreenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), heightMaterial));

// Instanced mesh for vegetation
const vegetation = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.5, 2, 5),
  new THREE.MeshStandardMaterial({ color: 0x228822 }),
  2000
);
vegetation.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(vegetation);

function populateVegetation(){
  const dummy = new THREE.Object3D();
  for(let i=0;i<vegetation.count;i++){
    const x = (Math.random()-0.5)*1000;
    const z = (Math.random()-0.5)*1000;
    dummy.position.set(x, 0, z);
    dummy.updateMatrix();
    vegetation.setMatrixAt(i, dummy.matrix);
  }
  vegetation.instanceMatrix.needsUpdate = true;
  vegetation.frustumCulled = false;
}

// Merge static meshes and freeze materials for performance
function finalizeStatic(){
  const meshes = [];
  scene.traverse((o)=>{ if(o.isMesh && o !== vegetation) meshes.push(o); });
  // Combine all collected geometries into a single mesh for better performance
  const merged = mergeBufferGeometries(meshes.map(m=>m.geometry));
  const finalMesh = new THREE.Mesh(merged, terrainMaterial);
  finalMesh.matrixAutoUpdate = false;
  scene.add(finalMesh);
  meshes.forEach(m=>scene.remove(m));
}

export { updateTerrainChunks, updateHeightTexture, populateVegetation, finalizeStatic };
