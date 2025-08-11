import { THREE, scene } from '../../core/environment.js';
import { heightAt } from '../heightmap.js';

// Store all active creatures for updates
const creatures = [];

/**
 * Spawn simple animal meshes at random terrain positions.
 * Repeated calls are ignored once creatures exist.
 * @param {number} count Number of creatures to spawn.
 */
function spawnCreatures(count = 10) {
  if (creatures.length) return; // Prevent duplicate populations
  for (let i = 0; i < count; i++) {
    const isBird = Math.random() > 0.5;
    let mesh;
    if (isBird) {
      // Basic sphere to represent a bird
      const geo = new THREE.SphereGeometry(0.5, 8, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // Simple box for a deer-like creature
      const geo = new THREE.BoxGeometry(1, 1, 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
      mesh = new THREE.Mesh(geo, mat);
    }
    const x = (Math.random() - 0.5) * 1000;
    const z = (Math.random() - 0.5) * 1000;
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    // Offset used for unique motion patterns
    mesh.userData = { isBird, offset: Math.random() * Math.PI * 2 };
    creatures.push(mesh);
    scene.add(mesh);
  }
}

/**
 * Apply simple idle motion to all creatures.
 * Birds bob vertically while deer rotate gently.
 * @param {number} delta Time since last frame in seconds.
 */
function updateCreatures(delta) {
  const t = performance.now() * 0.001;
  creatures.forEach((c) => {
    if (c.userData.isBird) {
      c.position.y += Math.sin(t + c.userData.offset) * 0.5 * delta;
    } else {
      c.rotation.y += 0.2 * delta;
    }
  });
}

export { spawnCreatures, updateCreatures };
