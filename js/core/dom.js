const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const fpsBox = document.getElementById('fps');
const testsBox = document.getElementById('tests');
const warnBox = document.getElementById('warn');
const posBox = document.getElementById('pos');
const timeBox = document.getElementById('time');

const settingsPanel = document.getElementById('settings');
const settingsHandle = document.getElementById('settingsHandle');
const builder = document.getElementById('builder');
const builderHandle = document.getElementById('builderHandle');
const builderToggle = document.getElementById('builderToggle');
const procToggle = document.getElementById('procToggle');
const shapeSel = document.getElementById('shape');
const colorInp = document.getElementById('color');
const sxInp = document.getElementById('sx');
const syInp = document.getElementById('sy');
const szInp = document.getElementById('sz');
const spawnBtn = document.getElementById('spawn');
const clearBtn = document.getElementById('clearBlocks');
const speedInp = document.getElementById('speed');
const runMulInp = document.getElementById('runmul');
const jumpInp = document.getElementById('jump');
const stepHInp = document.getElementById('stepH');
const viewDistInp = document.getElementById('viewDist');
const chunkSizeInp = document.getElementById('chunkSize');
const seaLevelInp = document.getElementById('seaLevel');

const worldgenPanel = document.getElementById('worldgen');
const worldHandle = document.getElementById('worldHandle');
const seedInp = document.getElementById('seed');
const regenBtn = document.getElementById('regen');
const mountainAmpInp = document.getElementById('mountainAmp');
const valleyAmpInp = document.getElementById('valleyAmp');
const terrainTypeSel = document.getElementById('terrainType');
const waterFloorColorInp = document.getElementById('waterFloorColor');
const grassAInp = document.getElementById('grassA');
const grassBInp = document.getElementById('grassB');
const stoneColorInp = document.getElementById('stoneColor');
const rockSlopeStartInp = document.getElementById('rockSlopeStart');
const rockSlopeRangeInp = document.getElementById('rockSlopeRange');

const debugPanel = document.getElementById('debug');
const debugHandle = document.getElementById('debugHandle');
const dbgTests = document.getElementById('dbgTests');
const dbgMovement = document.getElementById('dbgMovement');
const dbgGround = document.getElementById('dbgGround');

export {
  overlay,
  startBtn,
  hud,
  crosshair,
  fpsBox,
  posBox,
  timeBox,
  testsBox,
  warnBox,
  settingsPanel,
  settingsHandle,
  builder,
  builderHandle,
  builderToggle,
  procToggle,
  shapeSel,
  colorInp,
  sxInp,
  syInp,
  szInp,
  spawnBtn,
  clearBtn,
  speedInp,
  runMulInp,
  jumpInp,
  stepHInp,
  viewDistInp,
  chunkSizeInp,
  seaLevelInp,
  worldgenPanel,
  worldHandle,
  seedInp,
  regenBtn,
  mountainAmpInp,
  valleyAmpInp,
  terrainTypeSel,
  waterFloorColorInp,
  grassAInp,
  grassBInp,
  stoneColorInp,
  rockSlopeStartInp,
  rockSlopeRangeInp,
  debugPanel,
  debugHandle,
  dbgTests,
  dbgMovement,
  dbgGround,
};
