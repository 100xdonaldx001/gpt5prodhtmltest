// Entry point that toggles between Babylon.js and Three.js renderers.

// Determine which engine to use; default to Babylon.
const params = new URLSearchParams(location.search);
let engineType = params.get('engine') || 'babylon';

// Button allowing user to switch engines.
const toggleBtn = document.getElementById('engineToggle');
toggleBtn.addEventListener('click', () => {
  const next = engineType === 'babylon' ? 'three' : 'babylon';
  params.set('engine', next);
  location.search = params.toString();
});

if (engineType === 'babylon') {
  toggleBtn.textContent = 'Use Three.js';
  initBabylon();
} else {
  document.getElementById('renderCanvas').style.display = 'none';
  toggleBtn.textContent = 'Use Babylon.js';
  initThree();
}

/**
 * Load the original Three.js world via dynamic import.
 */
function initThree() {
  // Pull in the untouched Three.js world from its folder
  import('../../three/js/main.js');
}

/**
 * Initialize Babylon.js scene with a procedural terrain.
 */
function initBabylon() {
  // Canvas for Babylon.js rendering
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);

  // Camera letting the user orbit the terrain
  const camera = new BABYLON.ArcRotateCamera(
    'camera',
    Math.PI / 4,
    Math.PI / 3,
    30,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);

  // Soft hemispheric light
  new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

  // Create ground mesh and modify vertices for height map
  const size = 20;
  const subdivisions = 100;
  const ground = BABYLON.MeshBuilder.CreateGround(
    'ground',
    { width: size, height: size, subdivisions },
    scene
  );
  const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    positions[i + 1] = Math.sin(x * 0.5) + Math.cos(z * 0.5);
  }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

  engine.runRenderLoop(() => {
    scene.render();
  });

  // Handle resize events
  window.addEventListener('resize', () => {
    engine.resize();
  });
}
