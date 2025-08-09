    import * as THREE from 'three';
    import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
    import { Sky } from 'three/addons/objects/Sky.js';

    // === Scene setup ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b3e8); // sky color fallback
    scene.fog = new THREE.Fog(0x87b3e8, 120, 1200);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 1.75, 5);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Atmosphere sky (shader-based, not a skybox texture)
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    const sun = new THREE.Vector3();
    function setSun(elevation=20, azimuth=130){
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(azimuth);
      sun.setFromSphericalCoords(1, phi, theta);
      sky.material.uniforms[ 'sunPosition' ].value.copy(sun);
    }
    sky.material.uniforms[ 'turbidity' ].value = 2.0;
    sky.material.uniforms[ 'rayleigh' ].value = 1.2;
    sky.material.uniforms[ 'mieCoefficient' ].value = 0.003;
    sky.material.uniforms[ 'mieDirectionalG' ].value = 0.8;
    setSun(22, 140);

    // Lights
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.8); scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(20,80,10); dir.castShadow = true; dir.shadow.mapSize.set(2048,2048); scene.add(dir);

    // === Infinite ground (re-centers under the player) ===
    const GROUND_SIZE = 800; // visible patch size
    const GROUND_SEG = 128;
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
    groundGeo.rotateX(-Math.PI/2);
    const groundMat = new THREE.MeshStandardMaterial({ color:0x35506e, roughness:0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true; scene.add(ground);

    function heightAt(x,z){ return Math.sin(x*0.05)*Math.cos(z*0.05)*0.6; }
    let groundCenter = new THREE.Vector2(0,0);
    function rebuildGround(){
      const pos = groundGeo.attributes.position;
      let i=0; for(let vi=0; vi<pos.count; vi++){
        const gx = pos.array[i]; // local x
        const gz = pos.array[i+2]; // local z
        const wx = groundCenter.x + gx;
        const wz = groundCenter.y + gz;
        pos.array[i+1] = heightAt(wx, wz);
        i += 3;
      }
      pos.needsUpdate = true;
      groundGeo.computeVertexNormals();
      ground.position.set(groundCenter.x, 0, groundCenter.y);
    }
    rebuildGround();

    function maybeRecenterGround(playerX, playerZ){
      const dx = playerX - groundCenter.x;
      const dz = playerZ - groundCenter.y;
      const threshold = GROUND_SIZE * 0.25; // recalc when a quarter across the patch
      if (Math.abs(dx) > threshold || Math.abs(dz) > threshold){
        // Snap center in chunked steps to avoid excessive recompute
        groundCenter.x = Math.round(playerX / (GROUND_SIZE*0.25)) * (GROUND_SIZE*0.25);
        groundCenter.y = Math.round(playerZ / (GROUND_SIZE*0.25)) * (GROUND_SIZE*0.25);
        rebuildGround();
      }
    }

    // World groups
    const grid = new THREE.GridHelper(400,80,0x7aa2ff,0x2b3d55); grid.material.opacity=.25; grid.material.transparent=true; scene.add(grid);
    const blocks = new THREE.Group(); scene.add(blocks);
    const presetGroup = new THREE.Group(); blocks.add(presetGroup);
    const chunksGroup = new THREE.Group(); blocks.add(chunksGroup);
    const userGroup   = new THREE.Group(); blocks.add(userGroup);

    const baseMat = new THREE.MeshStandardMaterial({ color:0x6ee7ff, roughness:.6, metalness:.15 });
    function addBlockTo(group, x,y,z,sx=4,sy=1,sz=4,color=null){ const mat=baseMat.clone(); if(color!==null) mat.color=new THREE.Color(color); const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat); m.position.set(x,y+sy/2,z); m.castShadow=m.receiveShadow=true; m.updateMatrixWorld(true); group.add(m); return m; }

    // Some presets near origin
    addBlockTo(presetGroup,0,0.1,-10,6,1,6,0x4fd1c5); addBlockTo(presetGroup,8,1,-16,4,1,4,0x93c5fd); addBlockTo(presetGroup,14,2,-22,4,1,4,0xf9a8d4); addBlockTo(presetGroup,20,3,-26,4,1,4,0xfcd34d); addBlockTo(presetGroup,26,5,-30,6,1,6,0x86efac);

    // AABB registry
    let blockAABBs = [];
    function rebuildAABBs(){
      blockAABBs = [];
      const collect = (mesh)=>{ if(!mesh.isMesh) return; if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); blockAABBs.push({ box:b, mesh }); };
      presetGroup.updateMatrixWorld(true); presetGroup.traverse(collect);
      chunksGroup.updateMatrixWorld(true); chunksGroup.traverse(collect);
      userGroup.updateMatrixWorld(true);   userGroup.traverse(collect);
    }
    rebuildAABBs();

    // Controls & UI refs
    const controls = new PointerLockControls(camera, document.body); scene.add(controls.getObject());
    const overlay = document.getElementById('overlay');
    const startBtn = document.getElementById('start');
    const hud = document.getElementById('hud');
    const crosshair = document.getElementById('crosshair');
    const fpsBox = document.getElementById('fps');
    const testsBox = document.getElementById('tests');
    const warnBox = document.getElementById('warn');

    // Panels & inputs
    const settingsPanel = document.getElementById('settings');
    const settingsHandle = document.getElementById('settingsHandle');
    const builder = document.getElementById('builder');
    const builderHandle = document.getElementById('builderHandle');
    const builderToggle = document.getElementById('builderToggle');
    const shapeSel = document.getElementById('shape');
    const colorInp = document.getElementById('color');
    const sxInp = document.getElementById('sx');
    const syInp = document.getElementById('sy');
    const szInp = document.getElementById('sz');
    const spawnBtn = document.getElementById('spawn');
    const speedInp = document.getElementById('speed');
    const runMulInp = document.getElementById('runmul');
    const jumpInp = document.getElementById('jump');
    const stepHInp = document.getElementById('stepH');
    const viewDistInp = document.getElementById('viewDist');
    const chunkSizeInp = document.getElementById('chunkSize');

    let fallbackActive = false;
    let isActive = false;

    function showUI(active){
      overlay.style.display = active ? 'none' : 'grid';
      hud.hidden = !active; crosshair.hidden = !active; fpsBox.hidden = !active; testsBox.hidden = !active;
      settingsPanel.hidden = !active; builderToggle.hidden = !active;
      if (!active) builder.hidden = true;
      warnBox.hidden = !(active && fallbackActive);
    }

    // Pointer-lock fallback
    function engageFallback(){
      if(fallbackActive) return; fallbackActive=true; isActive=true; showUI(true);
      const canvas = renderer.domElement; let dragging=false, lx=0, ly=0; const look=0.002; const yawObj=controls.getObject();
      canvas.addEventListener('mousedown', e=>{ dragging=true; lx=e.clientX; ly=e.clientY; });
      window.addEventListener('mouseup', ()=>{ dragging=false; });
      window.addEventListener('mousemove', e=>{ if(!dragging) return; const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY; yawObj.rotation.y -= dx*look; camera.rotation.x -= dy*look; camera.rotation.z = 0; camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x)); });
    }

    function sandboxBlocksPointerLock(){
      try{
        if(!window.frameElement) return false; if(!window.frameElement.hasAttribute('sandbox')) return false;
        const tokens = Array.from(window.frameElement.sandbox || []);
        return !tokens.includes('allow-pointer-lock');
      }catch{ return false; }
    }

    function tryEnter(){
      const supportsPL = 'pointerLockElement' in document && typeof document.body.requestPointerLock === 'function';
      if(!supportsPL || sandboxBlocksPointerLock()){ engageFallback(); return; }
      const onError = ()=>{ document.removeEventListener('pointerlockerror', onError); engageFallback(); };
      document.addEventListener('pointerlockerror', onError, { once:true });
      controls.lock();
    }

    startBtn.addEventListener('click', tryEnter);
    controls.addEventListener('lock', ()=>{ isActive=true; fallbackActive=false; showUI(true); updatePreview(); });
    controls.addEventListener('unlock', ()=>{ isActive=false; showUI(false); });

    // Movement
    const move = { forward:false, back:false, left:false, right:false, run:false };
    let canJump=false; const gravity=30; let walk=10; let runMul=1.8; let jumpStrength=11.5; let stepHeight=0.5; const playerHeight=1.75;
    const playerRadius = 0.45;
    let vForward = 0, vRight = 0, vY = 0;

    function onKeyDown(e){
      switch(e.code){
        case 'ArrowUp': case 'KeyW': move.forward=true; break;
        case 'ArrowLeft': case 'KeyA': move.left=true; break;
        case 'ArrowDown': case 'KeyS': move.back=true; break;
        case 'ArrowRight': case 'KeyD': move.right=true; break;
        case 'ShiftLeft': case 'ShiftRight': move.run=true; break;
        case 'Space': if(canJump && isActive){ vY = jumpStrength; canJump=false; } break;
        case 'KeyB': if(isActive){ setBuilderVisible(builder.hidden); } break;
      }
    }
    function onKeyUp(e){
      switch(e.code){
        case 'ArrowUp': case 'KeyW': move.forward=false; break;
        case 'ArrowLeft': case 'KeyA': move.left=false; break;
        case 'ArrowDown': case 'KeyS': move.back=false; break;
        case 'ArrowRight': case 'KeyD': move.right=false; break;
        case 'ShiftLeft': case 'ShiftRight': move.run=false; break;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const downRay = new THREE.Raycaster();

    function approach(cur, target, maxStep){
      if(cur < target) return Math.min(target, cur + maxStep);
      if(cur > target) return Math.max(target, cur - maxStep);
      return cur;
    }

    // Collisions
    function resolveHorizontalCollisions(pos3, feetY, headY){
      const EPS = 1e-2; let collided=false;
      for(const { box } of blockAABBs){
        if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
        const minX = box.min.x - playerRadius, maxX = box.max.x + playerRadius;
        const minZ = box.min.z - playerRadius, maxZ = box.max.z + playerRadius;
        if (pos3.x < minX || pos3.x > maxX || pos3.z < minZ || pos3.z > maxZ) continue;
        const dxLeft  = Math.abs(pos3.x - minX);
        const dxRight = Math.abs(maxX - pos3.x);
        const dzNear  = Math.abs(pos3.z - minZ);
        const dzFar   = Math.abs(maxZ - pos3.z);
        const pushX = Math.min(dxLeft, dxRight);
        const pushZ = Math.min(dzNear, dzFar);
        if (pushX < pushZ){ if (dxLeft < dxRight) pos3.x = minX; else pos3.x = maxX; vRight = 0; }
        else { if (dzNear < dzFar) pos3.z = minZ; else pos3.z = maxZ; vForward = 0; }
        collided = true;
      }
      return collided;
    }

    function hasHorizontalOverlap(pos3, feetY, headY){
      const EPS=1e-2;
      for (const { box } of blockAABBs){
        if (feetY >= box.max.y - EPS || headY <= box.min.y + EPS) continue;
        const minX = box.min.x - playerRadius, maxX = box.max.x + playerRadius;
        const minZ = box.min.z - playerRadius, maxZ = box.max.z + playerRadius;
        if (pos3.x >= minX && pos3.x <= maxX && pos3.z >= minZ && pos3.z <= maxZ) return true;
      }
      return false;
    }

    function attemptStepUp(obj){
      const EPS=1e-3;
      const feetY = obj.position.y - playerHeight;
      const maxStep = Math.max(0, stepHeight);
      let bestTop = Infinity;
      for (const { box } of blockAABBs){
        const minX = box.min.x - playerRadius, maxX = box.max.x + playerRadius;
        const minZ = box.min.z - playerRadius, maxZ = box.max.z + playerRadius;
        if (obj.position.x < minX || obj.position.x > maxX || obj.position.z < minZ || obj.position.z > maxZ) continue;
        const top = box.max.y;
        if (top + EPS >= feetY && top <= feetY + maxStep + EPS){ if (top < bestTop) bestTop = top; }
      }
      if (!isFinite(bestTop)) return false;
      const tryY = bestTop + playerHeight + EPS;
      const savedY = obj.position.y; obj.position.y = tryY;
      const ok = !hasHorizontalOverlap(obj.position, tryY - playerHeight, tryY);
      if (ok){ vY = 0; canJump = true; return true; }
      obj.position.y = savedY; return false;
    }

    function attemptStepUpProbe(obj, dirWorld){
      const EPS = 1e-3;
      const maxStep = Math.max(0, stepHeight);
      if (dirWorld.lengthSq() < 1e-6) return false;
      const ahead = obj.position.clone().addScaledVector(dirWorld.clone().normalize(), playerRadius + 0.05);
      const feetY = obj.position.y - playerHeight;
      let bestTop = Infinity;
      for (const { box } of blockAABBs){
        const minX = box.min.x - playerRadius, maxX = box.max.x + playerRadius;
        const minZ = box.min.z - playerRadius, maxZ = box.max.z + playerRadius;
        if (ahead.x < minX || ahead.x > maxX || ahead.z < minZ || ahead.z > maxZ) continue;
        const top = box.max.y;
        if (top + EPS >= feetY && top <= feetY + maxStep + EPS){ if(top < bestTop) bestTop = top; }
      }
      if (!isFinite(bestTop)) return false;
      const tryY = bestTop + playerHeight + EPS;
      const savedY = obj.position.y; obj.position.y = tryY;
      const ok = !hasHorizontalOverlap(obj.position, tryY - playerHeight, tryY);
      if (ok){ vY = 0; canJump = true; return true; }
      obj.position.y = savedY; return false;
    }

    function resolveVerticalCollisions(prevFeetY, prevHeadY, pos3){
      for(const { box } of blockAABBs){
        const minX = box.min.x - playerRadius, maxX = box.max.x + playerRadius;
        const minZ = box.min.z - playerRadius, maxZ = box.max.z + playerRadius;
        if (pos3.x < minX || pos3.x > maxX || pos3.z < minZ || pos3.z > maxZ) continue;
        const feetY = pos3.y - playerHeight;
        const headY = pos3.y;
        if (vY > 0 && prevHeadY <= box.min.y && headY > box.min.y){
          pos3.y = box.min.y - (playerHeight);
          vY = 0; canJump = false;
        }
        if (vY < 0 && prevFeetY >= box.max.y && feetY < box.max.y){
          pos3.y = box.max.y + playerHeight;
          vY = 0; canJump = true;
        }
      }
    }

    // === Procedural chunks ===
    function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15, t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
    const loaded = new Map(); // key -> {group}
    let PROC_ENABLED = true;
    let CHUNK_SIZE = 32;
    let VIEW_DIST = 5; // in chunks

    function key(cx,cz){ return cx+','+cz; }
    function worldToChunk(x,z){ return [Math.floor(x/CHUNK_SIZE), Math.floor(z/CHUNK_SIZE)]; }

    function generateChunk(cx,cz){
      const g = new THREE.Group(); g.userData.type='chunk';
      const seed = (cx*73856093) ^ (cz*19349663);
      const rand = mulberry32(seed>>>0);
      const count = 12 + Math.floor(rand()*10);
      for(let i=0;i<count;i++){
        const sx = 1 + Math.floor(rand()*3);
        const sy = 0.6 + rand()*1.8;
        const sz = 1 + Math.floor(rand()*3);
        const localX = (rand()-0.5) * (CHUNK_SIZE-2);
        const localZ = (rand()-0.5) * (CHUNK_SIZE-2);
        const worldX = cx*CHUNK_SIZE + localX;
        const worldZ = cz*CHUNK_SIZE + localZ;
        const y = 0.2 + rand()*2.0;
        const col = new THREE.Color().setHSL((rand()*0.25+0.55)%1, 0.55, 0.6).getHex();
        addBlockTo(g, worldX, y, worldZ, sx, sy, sz, col);
      }
      g.children.forEach(m=>m.updateMatrixWorld(true));
      chunksGroup.add(g);
      return g;
    }

    function loadChunk(cx,cz){ const k = key(cx,cz); if(loaded.has(k)) return; const g = generateChunk(cx,cz); loaded.set(k,{group:g}); }
    function unloadChunk(cx,cz){ const k = key(cx,cz); const rec = loaded.get(k); if(!rec) return; chunksGroup.remove(rec.group); rec.group.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); if(o.material.map) o.material.map.dispose(); o.material.dispose(); }}); loaded.delete(k); }

    let lastChunkUpdate = 0;
    function updateChunks(force=false, forcedPos=null){
      if(!PROC_ENABLED) return;
      const now = performance.now();
      if(!force && (now - lastChunkUpdate) < 250) return; // throttle
      lastChunkUpdate = now;
      CHUNK_SIZE = Math.max(8, (parseInt(chunkSizeInp.value)||32));
      VIEW_DIST = Math.max(1, Math.min(12, (parseInt(viewDistInp.value)||5)));

      const obj = controls.getObject();
      const px = forcedPos?forcedPos.x:obj.position.x;
      const pz = forcedPos?forcedPos.z:obj.position.z;
      const [ccx, ccz] = worldToChunk(px, pz);

      const needed = new Set();
      for(let dz=-VIEW_DIST; dz<=VIEW_DIST; dz++){
        for(let dx=-VIEW_DIST; dx<=VIEW_DIST; dx++){
          const nx = ccx+dx, nz = ccz+dz; needed.add(key(nx,nz));
        }
      }
      needed.forEach(k=>{ const [sx,sz]=k.split(',').map(Number); loadChunk(sx,sz); });
      for(const k of Array.from(loaded.keys())){ if(!needed.has(k)){ const [ux,uz]=k.split(',').map(Number); unloadChunk(ux,uz); } }
      rebuildAABBs();
    }
    window.__forceChunkUpdate = (x,z)=>updateChunks(true, new THREE.Vector3(x,0,z));

    updateChunks(true, new THREE.Vector3(0,0,0));

    // FPS meter
    let last=performance.now(), frames=0, acc=0;

    const clock = new THREE.Clock();
    function animate(){
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);

      const now = performance.now(); frames++; acc += (now-last); last = now; if(acc>=500){ fpsBox.textContent = Math.round(frames*1000/acc) + ' FPS'; frames=0; acc=0; }

      // Keep chunks updated around player
      updateChunks();

      if(isActive){
        const sF = (move.forward?1:0) - (move.back?1:0);
        const sR = (move.right?1:0) - (move.left?1:0);
        walk = Math.max(0.1, parseFloat(speedInp.value)||10);
        runMul = Math.max(1, parseFloat(runMulInp.value)||1.8);
        jumpStrength = Math.max(0.1, parseFloat(jumpInp.value)||11.5);
        stepHeight = Math.max(0, parseFloat(stepHInp.value)||0.5);

        const speed = walk * (move.run?runMul:1);
        const accel = speed * 20;
        const maxStep = accel * delta;

        const targetF = sF * speed;
        const targetR = sR * speed;

        vForward = approach(vForward, targetF, maxStep);
        vRight   = approach(vRight, targetR, maxStep);
        const damping = Math.max(.8, 1 - 8*delta);
        if(sF === 0) vForward *= damping;
        if(sR === 0) vRight   *= damping;

        vY -= gravity * delta;
        const obj = controls.getObject();
        const prevY = obj.position.y;
        const prevFeetY = prevY - playerHeight;
        const prevHeadY = prevY;
        obj.position.y += vY * delta;
        resolveVerticalCollisions(prevFeetY, prevHeadY, obj.position);

        const downOrigin = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
        downRay.set(downOrigin, new THREE.Vector3(0,-1,0));
        const hits = downRay.intersectObjects([ground, blocks], true);
        const minDist = playerHeight;
        if(hits.length){
          const d = hits[0].distance;
          if(d < minDist){ obj.position.y += (minDist - d); vY = 0; canJump = true; }
        }
        if(obj.position.y < -20){ obj.position.set(0, playerHeight+1, 0); vForward=vRight=vY=0; }

        controls.moveForward(vForward * delta);
        controls.moveRight(  vRight   * delta);
        const feetY = obj.position.y - playerHeight;
        const headY = obj.position.y;
        const collided = resolveHorizontalCollisions(obj.position, feetY, headY);
        if (collided) {
          attemptStepUp(obj);
        } else {
          const yaw = controls.getObject().rotation.y;
          const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          const dirWorld = forward.multiplyScalar(vForward).add(right.multiplyScalar(vRight));
          attemptStepUpProbe(obj, dirWorld);
        }

        // Recenter ground under player to simulate infinite terrain
        maybeRecenterGround(obj.position.x, obj.position.z);
      }

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', ()=>{ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); constrainPanel(settingsPanel); constrainPanel(builder); });
    controls.getObject().position.set(0, 1.75 + 1, 8);

    // === Builder / Preview ===
    function makeMeshByType(type, color){
      let geo;
      switch(type){
        case 'pyramid': geo = new THREE.ConeGeometry(0.5, 1, 4); break;
        case 'sphere': geo = new THREE.SphereGeometry(0.5, 24, 16); break;
        default: geo = new THREE.BoxGeometry(1,1,1);
      }
      const mat = new THREE.MeshStandardMaterial({ color, roughness:.6, metalness:.15 });
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
    }
    const previewMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    let preview = makeMeshByType('cube', 0xffffff); preview.material = previewMat; preview.castShadow = preview.receiveShadow = false; preview.visible = false; scene.add(preview);
    const buildRay = new THREE.Raycaster();

    function setBuilderVisible(visible){
      builder.hidden = !visible;
      builderToggle.textContent = builder.hidden ? 'Builder: Off' : 'Builder: On';
      if (builder.hidden && preview){ preview.visible = false; }
      if (!builder.hidden) { updatePreview(); }
    }

    builderToggle.addEventListener('click', ()=>{ setBuilderVisible(builder.hidden); });
    setBuilderVisible(true);

    function updatePreviewGeometry(){
      const type = shapeSel.value;
      const needBox = (type==='cube' && !(preview.geometry instanceof THREE.BoxGeometry));
      const needCone = (type==='pyramid' && !(preview.geometry instanceof THREE.ConeGeometry));
      const needSphere = (type==='sphere' && !(preview.geometry instanceof THREE.SphereGeometry));
      if (needBox || needCone || needSphere){
        scene.remove(preview); preview = makeMeshByType(type, 0xffffff); preview.material = previewMat; preview.castShadow = preview.receiveShadow = false; scene.add(preview);
      }
      const sx = Math.max(0.25, parseFloat(sxInp.value)||1);
      const sy = Math.max(0.25, parseFloat(syInp.value)||1);
      const sz = Math.max(0.25, parseFloat(szInp.value)||1);
      preview.scale.set(sx, sy, sz);
    }
    function worldNormalFromIntersect(i){ if (!i.face || !i.object) return new THREE.Vector3(0,1,0); const n = i.face.normal.clone(); const m3 = new THREE.Matrix3().getNormalMatrix(i.object.matrixWorld); n.applyMatrix3(m3).normalize(); return n; }
    function updatePreviewPlacement(){
      if (!isActive || builder.hidden) { preview.visible = false; return; }
      const origin = camera.getWorldPosition(new THREE.Vector3()); const dir = new THREE.Vector3(); controls.getDirection(dir);
      buildRay.set(origin, dir);
      const hits = buildRay.intersectObjects([ground, blocks], true);
      if (hits.length === 0) { preview.visible = false; return; }
      const hit = hits[0]; const n = worldNormalFromIntersect(hit);
      const halfY = preview.scale.y/2; const place = hit.point.clone().addScaledVector(n, halfY + 0.01);
      preview.position.copy(place); preview.visible = true;
    }
    function updatePreview(){ updatePreviewGeometry(); updatePreviewPlacement(); }

    function addAABBForMesh(mesh){ mesh.updateMatrixWorld(true); if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); blockAABBs.push({ box: b, mesh }); }
    function spawnAtPreview(){ if (!preview.visible) return; const type = shapeSel.value; const color = new THREE.Color(colorInp.value); const sx = Math.max(0.25, parseFloat(sxInp.value)||1); const sy = Math.max(0.25, parseFloat(syInp.value)||1); const sz = Math.max(0.25, parseFloat(szInp.value)||1); const mesh = makeMeshByType(type, color.getHex()); mesh.position.copy(preview.position); mesh.scale.set(sx, sy, sz); userGroup.add(mesh); addAABBForMesh(mesh); }

    shapeSel.addEventListener('change', updatePreview);
    [sxInp, syInp, szInp].forEach(el=>el.addEventListener('input', updatePreview));
    spawnBtn.addEventListener('click', spawnAtPreview);
    window.addEventListener('keydown', (e)=>{ if (e.code==='Enter' && isActive) spawnAtPreview(); });
    document.addEventListener('mousemove', ()=>{ if(isActive) updatePreviewPlacement(); });

    // === Draggable panels ===
    function constrainPanel(panel){
      const rect = panel.getBoundingClientRect();
      let x = rect.left, y = rect.top;
      const maxX = window.innerWidth - rect.width; const maxY = window.innerHeight - rect.height;
      x = Math.max(0, Math.min(x, Math.max(0, maxX)));
      y = Math.max(0, Math.min(y, Math.max(0, maxY)));
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    }
    function makeDraggable(panel, handle, storageKey){
      let sx=0, sy=0, px=0, py=0, dragging=false;
      const bringToFront = ()=>{ panel.style.zIndex = (+new Date()).toString(); };
      handle.addEventListener('mousedown', (e)=>{ dragging=true; bringToFront(); sx=e.clientX; sy=e.clientY; const r=panel.getBoundingClientRect(); px=r.left; py=r.top; e.preventDefault(); });
      window.addEventListener('mousemove', (e)=>{ if(!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy; panel.style.left = (px+dx)+"px"; panel.style.top=(py+dy)+"px"; });
      window.addEventListener('mouseup', ()=>{ if(!dragging) return; dragging=false; constrainPanel(panel); if(storageKey){ const r=panel.getBoundingClientRect(); localStorage.setItem(storageKey, JSON.stringify({x:r.left,y:r.top})); } });
      if(storageKey){ const saved = localStorage.getItem(storageKey); if(saved){ try{ const p=JSON.parse(saved); if(Number.isFinite(p.x)&&Number.isFinite(p.y)){ panel.style.left=p.x+"px"; panel.style.top=p.y+"px"; constrainPanel(panel);} }catch{} } }
    }
    makeDraggable(settingsPanel, settingsHandle, 'ui.settings.pos');
    makeDraggable(builder, builderHandle, 'ui.builder.pos');

    // === Tests ===
    function tlog(msg){ console.log('[TEST]', msg); }
    function assert(name, cond){ if(!assert.results) assert.results={pass:0,fail:0,details:[]}; if(cond){assert.results.pass++; assert.results.details.push('✔ '+name);} else {assert.results.fail++; assert.results.details.push('✘ '+name);} }
    function runTests(){
      assert('PointerLockControls is constructable', typeof PointerLockControls === 'function');
      assert('Scene contains ground', scene.children.includes(ground));
      assert('Blocks group exists', !!blocks && blocks.children.length > 0);
      assert('Fog far extended', scene.fog.far >= 1000);

      const testRay = new THREE.Raycaster(new THREE.Vector3(0,10,0), new THREE.Vector3(0,-1,0)); const hit = testRay.intersectObject(ground,true)[0];
      assert('Raycaster hits ground', !!hit);

      // Proc gen load/unload
      const preLoadedCount = chunksGroup.children.length;
      window.__forceChunkUpdate(0, 0);
      const loadedNear = chunksGroup.children.length;
      assert('Chunks load near origin', loadedNear >= preLoadedCount);
      window.__forceChunkUpdate(10000, 10000);
      const loadedFar = chunksGroup.children.length;
      assert('Chunks unload when far', loadedFar <= loadedNear);
      window.__forceChunkUpdate(0, 0);

      // Basic UI existence
      assert('Settings handle exists', !!document.getElementById('settingsHandle'));
      assert('Builder handle exists', !!document.getElementById('builderHandle'));

      const res = assert.results; const summary = `Tests: ${res.pass} passed, ${res.fail} failed`; tlog(summary); res.details.forEach(tlog); testsBox.textContent = summary;
    }
    runTests();

    // Prevent context menu during gameplay
    window.addEventListener('contextmenu', e=>e.preventDefault());
