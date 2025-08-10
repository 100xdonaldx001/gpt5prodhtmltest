const movement = {
  move: { forward: false, back: false, left: false, right: false, run: false },
  canJump: false,
  gravity: 30,
  walk: 10,
  runMul: 1.8,
  jumpStrength: 11.5,
  stepHeight: 1,
  playerHeight: 1.75,
  playerRadius: 0.45,
  // Player velocity in world units per second
  vel: { x: 0, y: 0, z: 0 },
  lastElev: 22,
  lastAzi: 140,
  lastColor: '#ffffff',
};

export default movement;
