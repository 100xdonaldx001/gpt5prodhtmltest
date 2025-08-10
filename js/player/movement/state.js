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
  vForward: 0,
  vRight: 0,
  vY: 0,
  lastElev: 22,
  lastAzi: 140,
  lastColor: '#ffffff',
};

export default movement;
