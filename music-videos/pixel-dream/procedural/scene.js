'use strict';
(function () {
  const W = 960, H = 540, NEAR = .1, FAR = 90;
  const simulation = PixelPhysics.createSimulation(PIXEL_EVENTS, PIXEL_FEATURES, {anchorTime: PIXEL_KICK_ANCHOR.chosen_anchor_source_s,
    performanceCues: PIXEL_PERFORMANCE_CUES, sectionCues: PIXEL_SECTION_CUES, synthClock: PIXEL_SYNTH_CLOCK, spectrum: PIXEL_SPECTRUM, shapes: PixelShapes, story: PixelStory});
  const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: false});
  renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.append(renderer.domElement);
  const gl = renderer.getContext(), scene = new THREE.Scene();
  scene.background = new THREE.Color('#081820');
  const camera = new THREE.PerspectiveCamera(48, W / H, NEAR, FAR);
  const root = new THREE.Group(); scene.add(root);
  scene.add(new THREE.HemisphereLight('#c6e2dc', '#19312d', 2.0));
  const key = new THREE.DirectionalLight('#ffe2ad', 3.0); key.position.set(-5, 9, 8); scene.add(key);
  const rim = new THREE.DirectionalLight('#51d4ce', 2.1); rim.position.set(5, 1, -6); scene.add(rim);
  const heart = new THREE.PointLight('#ffc56f', 14, 13, 1.5); heart.position.set(0, .2, 0); scene.add(heart);
  const cube = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  const material = new THREE.MeshStandardMaterial({roughness: .66, metalness: .12,
    emissive: '#835a2e', emissiveIntensity: .12});
  const heroMaterial = material.clone(); heroMaterial.color.set('#ffc16b');
  const hero = new THREE.Mesh(cube, heroMaterial); hero.frustumCulled = false; root.add(hero);
  // Self-lit world meshes share the beauty target's actual depth buffer.
  const starMaterial = new THREE.MeshBasicMaterial({color: '#ffffff',depthTest:true,depthWrite:true});
  const stars = new THREE.InstancedMesh(cube, starMaterial, PixelStars.CAPACITY);
  stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); stars.frustumCulled = false; root.add(stars);
  const terrainPool=PixelTerrain.createPool();
  const terrain=new THREE.InstancedMesh(cube,material,PixelTerrain.CAPACITY); terrain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);terrain.frustumCulled=false;root.add(terrain);
  const body = new THREE.InstancedMesh(cube, material, PixelPerformance.BODY_CAPACITY);
  const bodyLayout = PixelPerformance.bodyLayout();
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); body.frustumCulled = false; root.add(body);
  const gold = new THREE.Color('#ffc16b'), paleGold = new THREE.Color('#ffe3a6'), teal = new THREE.Color('#49ad9f'), coral = new THREE.Color('#e17b60');
  const color = new THREE.Color(), baseColors = [];
  for (let i = 0; i < simulation.count; i++) {
    const j = i * 3, r = Math.hypot(...simulation.rest.subarray(j, j + 3));
    color.copy(simulation.rest[j] >= 0 ? coral : teal);
    color.lerp(gold, Math.exp(-r * r / 6)); if (r < 1.25) color.lerp(paleGold, .45);
    baseColors.push(color.clone()); body.setColorAt(i, color);
  }
  const target = new THREE.WebGLRenderTarget(W, H, {minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedShortType)});
  target.texture.colorSpace = THREE.NoColorSpace;
  const depthTarget = new THREE.WebGLRenderTarget(W, H, {minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter, depthBuffer: false});
  depthTarget.texture.colorSpace = THREE.NoColorSpace;
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: {tDepth: {value: target.depthTexture}, near: {value: NEAR}, far: {value: FAR}, range: {value: 40}, gamma: {value: 1.6}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform sampler2D tDepth;uniform float near,far,range,gamma;void main(){float d=texture2D(tDepth,vUv).x;float z=near*far/(far-d*(far-near));float g=d>.99999?0.:pow(clamp(1.-z/range,0.,1.),gamma);gl_FragColor=vec4(vec3(g),1.);}'
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));
  const raw = new Uint8Array(W * H * 4), bytes = new Uint8Array(W * H * 3);
  const displayLut = Uint8Array.from({length: 256}, (_, i) => {
    const x = i / 255; return Math.round(255 * (x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055));
  });
  function read(t) {
    renderer.readRenderTargetPixels(t, 0, 0, W, H, raw);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dst = (y * W + x) * 3, src = ((H - 1 - y) * W + x) * 4;
      for (let c = 0; c < 3; c++) bytes[dst + c] = t === target ? displayLut[raw[src + c]] : raw[src + c];
    }
    let encoded = ''; for (let i = 0; i < bytes.length; i += 16384) encoded += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(encoded);
  }
  // Real twelve-edge boxes share each mesh's exact drawn transform and depth buffer.
  const edgeVertices=[];
  for(let axis=0;axis<3;axis++)for(let a of [-.5,.5])for(let b of [-.5,.5]){
    const other=[0,1,2].filter(x=>x!==axis),v=[0,0,0];v[other[0]]=a;v[other[1]]=b;
    v[axis]=-.5;edgeVertices.push(...v);v[axis]=.5;edgeVertices.push(...v);
  }
  const edgeScene=new THREE.Scene(),edgeLayers=[];
  const edgeMaterial=new THREE.ShaderMaterial({depthTest:true,depthWrite:false,vertexShader:'attribute mat4 instanceMatrix;void main(){gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(1.);}' });
  for(const mesh of [hero,body,stars,terrain]){
    const geo=new THREE.InstancedBufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(edgeVertices,3));
    const attr=new THREE.InstancedBufferAttribute(mesh===hero?new Float32Array(16):mesh.instanceMatrix.array,16);
    geo.setAttribute('instanceMatrix',attr);const lines=new THREE.LineSegments(geo,edgeMaterial);lines.frustumCulled=false;edgeScene.add(lines);edgeLayers.push({mesh,lines,geo,attr});
  }
  const blackMaterial=new THREE.MeshBasicMaterial({color:0x000000,depthTest:true,depthWrite:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  function drawState(){
    return {view:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),meshes:[hero,body,stars,terrain].map(m=>({name:m===hero?'hero':m===body?'body':m===stars?'stars':'terrain',visible:m.visible,count:m===hero?1:m.count,matrix:m.matrixWorld.toArray(),instances:m===hero?null:Array.from(m.instanceMatrix.array.subarray(0,m.count*16))}))};
  }
  function edgePass(){
    const before=drawState(),background=scene.background,override=scene.overrideMaterial;
    for(const e of edgeLayers){e.lines.visible=e.mesh.visible;e.geo.instanceCount=e.mesh===hero?1:e.mesh.count;if(e.mesh===hero)e.attr.array.set(e.mesh.matrixWorld.elements);e.attr.needsUpdate=true;}
    scene.background=new THREE.Color(0);scene.overrideMaterial=blackMaterial;renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
    scene.background=background;scene.overrideMaterial=override;renderer.autoClear=false;renderer.render(edgeScene,camera);renderer.autoClear=true;
    const edge=read(target),after=drawState();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('edge transform drift');return {edge,drawState:before};
  }
  function passes() {
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
    const triangles = renderer.info.render.triangles;
    renderer.setRenderTarget(depthTarget); renderer.clear(); renderer.render(postScene, postCamera);
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    return {rgb: read(target), depth: read(depthTarget), triangles};
  }
  function update(i) {
    const snapshot = simulation.sampleFrame(i), telemetry = simulation.telemetry(), pose = window.PIXEL_CAMERA_LOCK[i*5] || PixelPhysics.cameraAt(snapshot.time, snapshot);
    camera.position.fromArray(pose.position); camera.up.fromArray(pose.up); camera.lookAt(...pose.target); camera.updateMatrixWorld();
    const heroState = snapshot.hero;
    hero.visible = heroState.visible; hero.position.fromArray(heroState.position); hero.rotation.fromArray(heroState.rotation);
    hero.scale.setScalar(heroState.size * heroState.scale);
    body.visible = heroState.bodyVisible;
    const kind = telemetry.story.kind, p = snapshot.positions;
    const torusScale = PixelPerformance.torusScale(telemetry.synthMotion.beatPhase, snapshot.torusTightBeat);
    const baseSize = {intro: .42, plane: .26, torus: .52 * torusScale, 'torus-tight': .52 * torusScale, mobius: .48, stairs: .34, hypercube: .36, finale: .42}[kind] || .48;
    const bodyDraw = bodyLayout.draw(snapshot, p, baseSize); body.count = bodyDraw.count;const ownAxisSamples=[];const sampledIndices=new Set();
    for (let k = 0; k < bodyDraw.count; k++) {
      const item=bodyDraw.items[k], index=item.index, j=index*3;
      dummy.position.fromArray(item.position); dummy.rotation.fromArray(item.rotation);
      if(item.quaternion)dummy.quaternion.fromArray(item.quaternion);
      dummy.scale.setScalar(item.size); dummy.updateMatrix(); body.setMatrixAt(k, dummy.matrix);
      if([0,1,10,23,467,924].includes(index)&&!sampledIndices.has(index)){
        sampledIndices.add(index);const worldQuat=dummy.quaternion.toArray(),g=snapshot.motion.globalAngle/2;
        const local=new THREE.Quaternion(0,-Math.sin(g),0,Math.cos(g)).multiply(dummy.quaternion).toArray();
        const corner=new THREE.Vector3(.5,.5,.5).applyMatrix4(dummy.matrix);
        ownAxisSamples.push({index,localSpinApplied:Boolean(item.quaternion),localQuaternion:local,worldQuaternion:worldQuat,position:dummy.position.toArray(),size:item.size,worldCorner:corner.toArray()});
      }
      color.copy(baseColors[index]); const r = Math.hypot(...simulation.rest.subarray(j, j + 3));
      if (kind === 'plane') color.copy(teal).lerp(paleGold, Math.max(0, Math.min(1, p[j + 1] / 3.5)));
      if (kind === 'stairs') color.copy(coral).lerp(gold, .45);
      if (kind === 'hypercube') color.copy(index < simulation.count / 2 ? gold : teal);
      if (kind === 'finale') color.copy(gold);
      if (kind !== 'finale') color.lerp(paleGold, Math.exp(-r * r / 5) * telemetry.amplitudes.vocals * .24);
      body.setColorAt(k, color);
    }
    body.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = true;
    if (snapshot.stars.length > PixelStars.CAPACITY) throw new Error('Star pool overflow');
    stars.count = snapshot.stars.length;
    for (let k = 0; k < stars.count; k++) {
      const n = snapshot.stars[k];
      dummy.position.fromArray(n.position); dummy.rotation.set(0,0,0); dummy.scale.setScalar(n.size);
      dummy.updateMatrix(); stars.setMatrixAt(k, dummy.matrix);
      color.copy(paleGold).multiplyScalar(n.illumination); stars.setColorAt(k, color);
    }
    stars.visible = stars.count > 0; stars.instanceMatrix.needsUpdate = true;
    if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
    const terrainDraw=terrainPool.update({story:snapshot.story,cameraPose:pose,motion:snapshot.motion,time:snapshot.time,...snapshot.terrainInput});
    if(terrainDraw.count>PixelTerrain.CAPACITY)throw Error('Terrain pool overflow');
    terrain.count=terrainDraw.count;terrain.visible=terrain.count>0;
    const terrainBins={near:new Array(12).fill(0),horizon:new Array(12).fill(0)},terrainCorners=[];let terrainVisible=0,minTerrainClearance=Infinity;
    for(let k=0;k<terrain.count;k++){
      const j=k*3,index=terrainDraw.sourceIndices[k],size=terrainDraw.sizes[k],pos=terrainDraw.positions.subarray(j,j+3);
      const quaternion=PixelMotion.localQuaternion(index,snapshot.motion.note,snapshot.time);
      dummy.position.fromArray(pos);dummy.quaternion.fromArray(quaternion);dummy.scale.setScalar(size);dummy.updateMatrix();terrain.setMatrixAt(k,dummy.matrix);
      color.copy(teal).lerp(paleGold,Math.max(0,Math.min(1,pos[1]/2.1)));terrain.setColorAt(k,color);
      if(size<=.001)continue;
      minTerrainClearance=Math.min(minTerrainClearance,Math.hypot(...pos.map((x,a)=>x-pose.position[a]))-size*Math.sqrt(3)/2);
      const projected=PixelShapes.projectPoint(Array.from(pos),{...pose,width:W,height:H});
      if(projected.depth>.1&&projected.depth<90&&Math.abs(projected.ndc[0])<=1&&Math.abs(projected.ndc[1])<=1){terrainVisible++;const bin=Math.min(11,Math.floor((projected.ndc[0]+1)*6));if(projected.depth>=2&&projected.depth<14)terrainBins.near[bin]++;if(projected.depth>=20&&projected.depth<68)terrainBins.horizon[bin]++;}
      if(k%521===0){const corners=[];for(let corner=0;corner<8;corner++){const v=new THREE.Vector3(...[0,1,2].map(a=>(corner&(1<<a)?1:-1)/2)).applyMatrix4(dummy.matrix);const pr=PixelShapes.projectPoint(v.toArray(),{...pose,width:W,height:H});corners.push({world:v.toArray(),ndc:pr.ndc,depth:pr.depth});}terrainCorners.push({instance:k,sourceIndex:index,quaternion,corners});}
    }
    terrain.instanceMatrix.needsUpdate=true;if(terrain.instanceColor)terrain.instanceColor.needsUpdate=true;
    const terrainSummary={count:terrain.count,capacity:PixelTerrain.CAPACITY,blend:terrainDraw.blend,spatialReuse:true,historyRows:terrainDraw.historyRows,historyMaxTime:terrainDraw.historyMaxTime,bounds:terrainDraw.bounds,tileOrigin:terrainDraw.tileOrigin,tileSpan:terrainDraw.tileSpan,visibleCenters:terrainVisible,projectedBins:terrainBins,minCornerSphereClearance:Number.isFinite(minTerrainClearance)?minTerrainClearance:null,registeredCornerSamples:terrainCorners,policy:terrainDraw.policy};
    heart.intensity = 12 + (kind === 'finale' ? 0 : telemetry.amplitudes.vocals * 7 * (heroState.bodyVisible ? 1 : 0));
    return {frame: i, ...telemetry, stars:snapshot.stars, time: snapshot.time, instances: {hero: hero.visible ? 1 : 0, sharedBody: body.visible ? body.count : 0, foreground: 0, stars: stars.count, terrain:terrain.count}, bodySubdivision: {division: bodyDraw.division, parentDivision: bodyDraw.parentDivision, blend: bodyDraw.blend, merging: bodyDraw.merging}, heroPose: heroState, cameraShake: snapshot.cameraShake, motion:snapshot.motion,
      ownAxisSamples,terrain:terrainSummary, clipped: {sharedBody: 0}, cameraPose: pose, viewMatrix: camera.matrixWorldInverse.toArray(),
      projectionMatrix: camera.projectionMatrix.toArray(), sharedTransformClock: true, worldYUp: true};
  }
  // A single absolute-time evaluation owns all three views. No pass advances simulation.
  window.evaluate = t => {
    const i=Math.round(t*24); if(Math.abs(t-i/24)>1e-9)throw Error('24fps source clock required');
    const telemetry=update(i);scene.updateMatrixWorld(true);
    const initial=JSON.stringify({time:telemetry.time,frame:i,...drawState()});
    return {frame:i,time:t,telemetry,state:initial};
  };
  window.renderViews = snapshot => {
    const before=JSON.stringify({time:snapshot.telemetry.time,frame:snapshot.frame,...drawState()});
    if(before!==snapshot.state)throw Error('snapshot changed before views');
    const out=passes(),afterRGBDepth=JSON.stringify({time:snapshot.telemetry.time,frame:snapshot.frame,...drawState()});
    const edges=edgePass(),afterEdge=JSON.stringify({time:snapshot.telemetry.time,frame:snapshot.frame,...drawState()});
    if(before!==afterRGBDepth||before!==afterEdge)throw Error('shared view transform drift');
    return {...out,edge:edges.edge,telemetry:snapshot.telemetry,drawState:before,viewIdentity:{rgb:before,depth:afterRGBDepth,edge:afterEdge}};
  };
  window.edgeOcclusionProbe = i => {
    const snapshot=window.evaluate(i/24),a=window.renderViews(snapshot),visible=atob(a.edge);
    edgeMaterial.depthTest=false;edgeMaterial.needsUpdate=true;
    const xray=atob(edgePass().edge);
    edgeMaterial.depthTest=true;edgeMaterial.needsUpdate=true;
    const restored=window.renderViews(snapshot);
    if(restored.edge!==a.edge||restored.rgb!==a.rgb||restored.depth!==a.depth)throw Error('occlusion probe changed source');
    let visiblePixels=0,xrayPixels=0,hiddenPixels=0;
    for(let k=0;k<visible.length;k+=3){if(visible.charCodeAt(k))visiblePixels++;if(xray.charCodeAt(k))xrayPixels++;if(!visible.charCodeAt(k)&&xray.charCodeAt(k))hiddenPixels++;}
    if(hiddenPixels<100||xrayPixels<=visiblePixels)throw Error('occlusion not demonstrated');
    return {frame:i,edgeSegmentsPerBox:edgeVertices.length/6,visiblePixels,xrayPixels,hiddenPixels,restoredPixelsAndStateExact:true,depthPrepass:true};
  };
  window.renderFrame = i => window.renderViews(window.evaluate(i/24));
  window.inspectFrame = i => update(i);
  window.runtimeInfo = () => { const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION),
      width: W, height: H, fps: 24, start: 0, frames: 4634, physicsHz: 120, bodyCount: simulation.count,
      capacity: {hero: 1, sharedBody: PixelPerformance.BODY_CAPACITY, foreground: 0, stars: PixelStars.CAPACITY,terrain:PixelTerrain.CAPACITY},
      sources: ['terrain.js','motion.js','section-map.js','stars.js','section-cues.js', 'performance-cues.js', 'performance.js', 'physics.js', 'shapes.js', 'story.js', 'scene.js'],
      foregroundPolicy: 'disabled; legacy telemetry alias always zero', starPolicy:PixelStars.policy,
      geometryRegistry:['hero','sharedBody','stars','terrain'], authoredSections:PixelSectionMap.bindClock(PIXEL_SYNTH_CLOCK).chapters,motionPolicy:{guitarBeat:PixelSectionMap.quarterAt(PIXEL_SYNTH_CLOCK,PIXEL_PERFORMANCE_CUES.guitarEntry.availableAt),fadeBeat:PixelSectionMap.quarterAt(PIXEL_SYNTH_CLOCK,183),maxCyclesPerQuarter:.25,firstBarStill:true,durationsWholeNotes:[8,4,2,1,.5,.25],rampQuarters:1,axisPolicy:'shared fixed principal local Y, identical gain 1 and phase; pitch remains musical geometry only'},
      staircase: 'continuous tall fixed-pool spiral climb, not literal infinity', depth: {near: NEAR, far: FAR, range: 40, gamma: 1.6,
        kind: 'near-bright axial depth; fixed mapping; 8-bit RGB grayscale; stars share geometry/occlusion but axial z>=40 maps black'}, beauty: 'linear RGBA8 target -> sRGB LUT; beauty only',
      contextLost: gl.isContextLost()}; };
  window.conformance = () => {
    const saved = scene.children.slice(), fog = scene.fog, background = scene.background;
    const savedPosition = camera.position.clone(), savedQuaternion = camera.quaternion.clone(), savedUp = camera.up.clone();
    const savedTarget = renderer.getRenderTarget();
    const backMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color().setRGB(.25, .25, .25)});
    const frontMaterial = new THREE.MeshBasicMaterial({color: '#ffffff'});
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), backMaterial); back.position.z = -8;
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, .5), frontMaterial); front.position.set(-1.5, .8, -4.25);
    let checks;
    try {
      for (const item of saved) scene.remove(item); scene.fog = null; scene.background = new THREE.Color('#000000');
      camera.position.set(0, 0, 0); camera.up.set(0, 1, 0); camera.lookAt(0, 0, -1); camera.updateMatrixWorld(); scene.add(back, front);
      const out = passes(), first = Uint8Array.from(bytes), beauty = atob(out.rgb);
      const px = (a, x, y) => a[(y * W + x) * 3];
      const x = Math.round(W / 2 + (-1.5 / (4 * Math.tan(48 * Math.PI / 360))) * H / 2);
      const y = Math.round(H / 2 - (.8 / (4 * Math.tan(48 * Math.PI / 360))) * H / 2);
      const near = px(first, x, y), far = px(first, W - 50, H - 50), lower = px(first, x, H - 1 - y);
      front.position.z += .5; const movedOut = passes(), moved = px(bytes, x, y);
      const expected = z => Math.round(255 * Math.pow(1 - z / 40, 1.6));
      const beautyFar = beauty.charCodeAt(((H - 50) * W + W - 50) * 3), beautyNear = beauty.charCodeAt((y * W + x) * 3);
      // A fringe pixel covered only by the closer cube confirms RGB and depth displacement together.
      const fringeX = Math.round(W / 2 + (-2.2 / Math.tan(48 * Math.PI / 360)) * H / 4 * (1 / 4 + 1 / 3.5));
      const fringeIndex = (y * W + fringeX) * 3;
      const rgbMoved = atob(movedOut.rgb).charCodeAt(fringeIndex) > beauty.charCodeAt(fringeIndex);
      const depthMoved = bytes[fringeIndex] > first[fringeIndex];
      checks = {near, far, lower, moved, beautyFar, beautyNear, expectedNear: expected(4), expectedFar: expected(8), expectedMoved: expected(3.5),
        depthMapping: Math.abs(near - expected(4)) <= 2 && Math.abs(far - expected(8)) <= 2,
        nearestOcclusion: near > far, topLeftFlip: near > lower && lower === far,
        sharedDisplacement: moved > near && Math.abs(moved - expected(3.5)) <= 2 && rgbMoved && depthMoved,
        beautyTransfer: Math.abs(beautyFar - 137) <= 3 && beautyNear === 255};
      if (!checks.depthMapping || !checks.nearestOcclusion || !checks.topLeftFlip || !checks.sharedDisplacement || !checks.beautyTransfer)
        throw new Error('Live conformance failed: ' + JSON.stringify(checks));
    } finally {
      scene.remove(back, front); for (const item of saved) scene.add(item); scene.fog = fog; scene.background = background;
      camera.position.copy(savedPosition); camera.quaternion.copy(savedQuaternion); camera.up.copy(savedUp); camera.updateMatrixWorld();
      renderer.setRenderTarget(savedTarget); back.geometry.dispose(); front.geometry.dispose(); backMaterial.dispose(); frontMaterial.dispose();
    }
    return {checks, ...window.runtimeInfo()};
  };
})();
