'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./stars.js'),require('./motion.js'));
  else root.PixelPerformance = factory(root.PixelStars,root.PixelMotion);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (starsLib,motionLib) {
  const END = 4633 / 24, HERO_ROTATION = [-.10, -.32, .10], CAPACITY = 32;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = v => { v = clamp(v); return v*v*(3-2*v); };
  function validate(cues) {
    if (!cues || !cues.guitarEntry || !Array.isArray(cues.guitarOnsets) || !cues.torusExit || !cues.melody || cues.melody.sourceStem !== 'synth') throw new Error('V9 requires PIXEL_PERFORMANCE_CUES with guitarEntry, guitarOnsets, torusExit and synth melody');
    for (const n of [cues.guitarEntry, ...cues.guitarOnsets]) {
      if (![n.sourceTime, n.availableAt, n.pitch].every(Number.isFinite) || n.availableAt < n.sourceTime || n.sourceTime < 0) throw new Error('Invalid causal guitar cue');
    }
    if (!Number.isFinite(cues.torusExit.beatPhase) || !Number.isFinite(cues.torusExit.sourceTime)) throw new Error('Invalid torus musical exit');
    return cues;
  }
  function validateSections(cues) {
    if(!cues || cues.schema!==1 || !cues.withdrawal || !cues.return)throw new Error('V9 requires PIXEL_SECTION_CUES schema 1');
    for(const n of [cues.withdrawal,cues.return])if(!Number.isFinite(n.sourceTime)||!Number.isFinite(n.availableAt)||n.availableAt<n.sourceTime)throw new Error('Invalid section availability');
    if(cues.return.availableAt<=cues.withdrawal.availableAt)throw new Error('Section return must follow withdrawal');
    return cues;
  }
  function rotate(p, rotation = HERO_ROTATION) {
    let [x,y,z] = p; const [a,b,c] = rotation;
    // Three.js Euler XYZ is Rx * Ry * Rz: apply Z, then Y, then X to a point.
    [x,y] = [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c)];
    [x,z] = [x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
    [y,z] = [y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
    return [x,y,z];
  }
  function packedCube() {
    const out = new Float64Array(925*3); let removed = 0, index = 0;
    for (let x=0;x<10;x++) for (let y=0;y<10;y++) for (let z=0;z<10;z++) {
      if ((x===1 || x===6) && y>0 && y<9 && z>0 && z<9 && removed<75) { removed++; continue; }
      out.set(rotate([(x-4.5)*.42,(y-4.5)*.42,(z-4.5)*.42]), index++*3);
    }
    return out;
  }
  function torusScale(beat, tightBeat, quarters = 4) {
    return 1.72 - 1.07*smooth((beat-tightBeat)/quarters);
  }
  function exitBeat(clock, cues) {
    const t=Number.isFinite(cues.torusExit.availableAt)?cues.torusExit.availableAt:cues.torusExit.sourceTime;
    let i=0; while(i+1<clock.beatTimesSource.length && clock.beatTimesSource[i+1]<=t)i++;
    const a=clock.beatTimesSource[i], b=clock.beatTimesSource[i+1] || clock.beatTimesSourceNext;
    return i+(t-a)/(b-a);
  }
  function ending(t) { return smooth((t-187.2)/(END-187.2)); }
  function heroState(t, released, beatPhase, synthAmp) {
    const fold = ending(t), early = released === 0;
    return {visible: early || fold>=.94, scale: 1,
      rotation: early ? [HERO_ROTATION[0],HERO_ROTATION[1],HERO_ROTATION[2]] : HERO_ROTATION.slice(),
      position: [0,0,0], size: 4.2, bodyVisible: !early && fold<.94, bodyScale: 1, fold};
  }
  function build(clock, cues, features) {
    validate(cues);
    const guitar = cues.guitarOnsets.map((n,i)=>({...n, id:'g'+i, availableAt:Math.max(n.availableAt,cues.guitarEntry.availableAt), velocity:clamp(n.velocity == null ? .8 : n.velocity>1 ? n.velocity/127 : n.velocity)})).sort((a,b)=>a.availableAt-b.availableAt);
    if (!guitar.length || guitar[0].availableAt>cues.guitarEntry.availableAt+1e-6) guitar.unshift({...cues.guitarEntry,velocity:.8,id:'entry'});
    const melody = clock.notes.map((n,i)=>({sourceTime:n.on, availableAt:Math.max(n.on,Number.isFinite(n.availabilityAt)?n.availabilityAt:n.on), off:n.off, pitch:n.pitch,
      velocity:clamp(n.velocity == null ? .85 : n.velocity>1 ? n.velocity/127 : n.velocity), id:'s'+i})).sort((a,b)=>a.availableAt-b.availableAt);
    // One top-pitch voice per simultaneous onset; acoustic gating remains separate.
    const voices=[];
    for (const n of melody) {
      const prev=voices[voices.length-1];
      if (prev && Math.abs(prev.availableAt-n.availableAt)<1e-6) { if(n.pitch>prev.pitch) voices[voices.length-1]=n; }
      else voices.push(n);
    }
    let held=[],melodyCursor=0;
    const topVoices=voices.filter(n=>{
      while(melodyCursor<melody.length && melody[melodyCursor].availableAt<=n.availableAt)held.push(melody[melodyCursor++]);
      held=held.filter(x=>x.off>n.availableAt);
      return n.pitch===Math.max(...held.map(x=>x.pitch));
    });
    const raw=[...guitar,...melody].sort((a,b)=>a.availableAt-b.availableAt);let originalMaximumScheduled=0,rawFirst=0;
    for(let i=0;i<raw.length;i++){while(raw[rawFirst].availableAt<=raw[i].availableAt-.24)rawFirst++;originalMaximumScheduled=Math.max(originalMaximumScheduled,i-rawFirst+1);}
    const all=topVoices.map(n=>({...n,stem:'synth'})).sort((a,b)=>a.availableAt-b.availableAt);
    let maxActive=0, first=0;
    for(let i=0;i<all.length;i++) { while(all[first].availableAt<=all[i].availableAt-.24) first++; maxActive=Math.max(maxActive,i-first+1); }
    if(maxActive>CAPACITY) throw new Error('Synth attack capacity 32 exceeded: '+maxActive);
    let heldCursor=0,synthHeld=[];
    let cursor=0, guitarCursor=0, active=[], admittedGuitar=0, lastGuitar=null, lastOnset=-Infinity;
    function reset(){heldCursor=0;synthHeld=[];cursor=0;guitarCursor=0;active=[];admittedGuitar=0;lastGuitar=null;lastOnset=-Infinity;}
    function update(t, rmsAt) {
      const newGuitar=[];
      while(guitarCursor<guitar.length && guitar[guitarCursor].availableAt<=t) {
        const n=guitar[guitarCursor++];
        if(rmsAt('guitar',n.availableAt)>(cues.guitarPolicy ? cues.guitarPolicy.gateMinimumRms : .0001)) {admittedGuitar++;lastGuitar=n;newGuitar.push(n);lastOnset=n.availableAt;}
      }
      while(cursor<all.length && all[cursor].availableAt<=t) {
        const n=all[cursor++];
        if(rmsAt(n.stem,n.availableAt)>.0001 && (n.stem!=='guitar' || n.availableAt>=cues.guitarEntry.availableAt)) { active.push(n);lastOnset=n.availableAt; }
      }
      active=active.filter(n=>t-n.availableAt<.4);
      while(heldCursor<melody.length&&melody[heldCursor].availableAt<=t){const n=melody[heldCursor++];if(rmsAt('synth',n.availableAt)>.0001)synthHeld.push(n);}
      synthHeld=synthHeld.filter(n=>n.off>t);
      const stars=starsLib.sample(t,synthHeld,active,rmsAt('synth',t),features&&features.tracks.synth?features.tracks.synth.referenceRms:1);
      const foreground=[];
      const subdivisionAt = [1,3,6,10].includes(admittedGuitar) && lastGuitar ? lastGuitar.availableAt : lastGuitar ? guitar[[1,3,6,10].filter(x=>x<=admittedGuitar).pop()-1].availableAt : 0;
      return {admittedGuitar,lastGuitar,newGuitar,foreground,stars,lastOnset,subdivisionAt,release:clamp(admittedGuitar/13), maxActive,originalMaximumScheduled,capacity:CAPACITY};
    }
    return {update,reset,maxActive,originalMaximumScheduled,capacity:CAPACITY,voicePolicy:'highest active synth pitch; only a newly attacked top voice emits; simultaneous lower voices omitted; guitar attacks drive body only; causal RMS gate; finite 40ms attack + 200ms release; distant world stars'};
  }
  const BODY_CAPACITY = 2048;
  function seedCells() {
    const cells=[];let removed=0;
    for(let x=0;x<10;x++)for(let y=0;y<10;y++)for(let z=0;z<10;z++) {
      if((x===1||x===6)&&y>0&&y<9&&z>0&&z<9&&removed<75){removed++;continue;}
      cells.push([x,y,z]);
    }
    return cells;
  }
  function polyhedron(kind) {
    const phi=(1+Math.sqrt(5))/2;let vertices=[];
    if(kind==='tetrahedron')vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    else if(kind==='octahedron') for(let d=0;d<3;d++)for(const sign of [-1,1]) {const p=[0,0,0];p[d]=sign;vertices.push(p);}
    else if(kind==='icosahedron')for(const a of [-1,1])for(const b of [-phi,phi])vertices.push([0,a,b],[a,b,0],[b,0,a]);
    else if(kind==='dodecahedron'){
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
      for(const a of [-1/phi,1/phi])for(const b of [-phi,phi])vertices.push([0,a,b],[a,b,0],[b,0,a]);
    } else throw new Error('Unknown Platonic solid '+kind);
    const radius=Math.hypot(...vertices[0]);vertices=vertices.map(p=>p.map(x=>x/radius));
    const planes=[],keys=new Set();
    for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++)for(let c=b+1;c<vertices.length;c++) {
      const u=vertices[b].map((x,i)=>x-vertices[a][i]),v=vertices[c].map((x,i)=>x-vertices[a][i]);
      let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
      if(length<1e-8)continue;n=n.map(x=>x/length);
      let d=n.reduce((sum,x,i)=>sum+x*vertices[a][i],0);
      const distances=vertices.map(p=>n.reduce((sum,x,i)=>sum+x*p[i],0)-d);
      if(distances.some(x=>x>1e-7)&&distances.some(x=>x< -1e-7))continue;
      if(d<0){n=n.map(x=>-x);d=-d;}
      const key=[...n,d].map(x=>(Math.abs(x)<1e-7?0:x).toFixed(6)).join(',');if(keys.has(key))continue;keys.add(key);
      planes.push({normal:n,distance:d,vertices:vertices.map((p,i)=>Math.abs(n.reduce((sum,x,j)=>sum+x*p[j],0)-d)<1e-7?i:-1).filter(i=>i>=0)});
    }
    return {kind,vertices,planes};
  }
  const POLYHEDRA=Object.fromEntries(['tetrahedron','octahedron','icosahedron','dodecahedron'].map(k=>[k,polyhedron(k)]));
  function solidTargets(kind) {
    const out=new Float64Array(2775),poly=POLYHEDRA[kind];
    for(let i=0;i<925;i++) {
      const y=1-2*(i+.5)/925,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),dir=[r*Math.cos(a),y,r*Math.sin(a)];
      let extent=1;
      if(poly){extent=Infinity;for(const plane of poly.planes){const dot=plane.normal.reduce((sum,x,j)=>sum+x*dir[j],0);if(dot>0)extent=Math.min(extent,plane.distance/dot);}}
      // Surface-majority filled voxels keep the face planes readable, with interior volume.
      const depth=i%5===0?Math.cbrt(((i*37)%925+.5)/925):1;
      out.set(dir.map(x=>x*extent*4.8*depth),i*3);
    }
    return out;
  }
  const SOLID_TARGETS=Object.fromEntries([...Object.keys(POLYHEDRA),'sphere'].map(k=>[k,solidTargets(k)]));
  function fillIntroSolids(beat,out,rotation) {
    const kinds=['tetrahedron','octahedron','icosahedron','dodecahedron','sphere'];
    const index=Math.min(4,Math.max(0,Math.floor((beat-12)/4))),blend=smooth((beat-(12+index*4))/2);
    const kind=kinds[index],previous=kinds[Math.max(0,index-1)],a=SOLID_TARGETS[previous],b=SOLID_TARGETS[kind];
    for(let i=0;i<925;i++){const j=i*3,p=rotate([a[j]+(b[j]-a[j])*blend,a[j+1]+(b[j+1]-a[j+1])*blend,a[j+2]+(b[j+2]-a[j+2])*blend],[.18,rotation,.12]);out.set(p,j);}
    return {kind,previousKind:previous,blend,source:'authored quarter grid; genuine regular convex face-plane geometry'};
  }
  function bodyLayout() {
    const cells=seedCells(),cache=new Map();
    function groups(div) {
      if(cache.has(div))return cache.get(div);
      const map=new Map();
      cells.forEach((p,i)=>{const key=div===10?i:p.map(x=>Math.floor(x*div/10)).join(',');if(!map.has(key))map.set(key,[]);map.get(key).push(i);});
      const g=Array.from(map.values());cache.set(div,g);return g;
    }
    function means(g,positions){return g.map(ids=>{const p=[0,0,0];for(const i of ids)for(let a=0;a<3;a++)p[a]+=positions[i*3+a]/ids.length;return p;});}
    function level(hits){return hits>=10?10:hits>=6?8:hits>=3?4:hits>=1?2:1;}
    function draw(state,positions,baseSize) {
      if(!state.hero.bodyVisible)return {count:0,items:[],capacity:BODY_CAPACITY};
      const fold=state.hero.fold,hits=state.performance.admittedGuitar;
      let div=state.story.kind==='intro' && !state.kickLock.triggered?level(hits):10,parentDiv=div,blend=1,merging=false;
      if(fold>0){
        const levels=[10,8,4,2,1],bounds=[0,.35,.60,.80,.94];let i=0;while(i+1<levels.length&&fold>=bounds[i+1])i++;
        div=levels[i];parentDiv=levels[Math.min(4,i+1)];blend=smooth((fold-bounds[i])/(bounds[Math.min(4,i+1)]-bounds[i]||1));merging=true;
      } else if(state.story.kind==='intro' && !state.kickLock.triggered) {
        parentDiv=div===10?8:div/2;parentDiv=Math.max(1,parentDiv);
        const thresholds={2:1,4:3,8:6,10:10};
        const event=state.performance.subdivisionAt;
        blend=smooth((state.time-event)/.38);
        if(hits!==thresholds[div] && state.time-event>.38)blend=1;
      }
      const g=groups(div),pg=groups(parentDiv),gm=means(g,positions),pm=means(pg,positions),parentLookup=new Int32Array(925);
      pg.forEach((ids,k)=>ids.forEach(i=>parentLookup[i]=k));
      const items=g.map((ids,k)=>{
        const parent=parentLookup[ids[0]],center=pm[parent],own=gm[k],progress=merging?1-blend:blend;
        const position=own.map((x,a)=>center[a]+(x-center[a])*progress);
        const parentSize=parentDiv===10?baseSize:4.2/parentDiv,childSize=div===10?baseSize:4.2/div;
        const size=parentSize+(childSize-parentSize)*progress;
        if(div===1)for(let a=0;a<3;a++)position[a]*=1-smooth((fold-.80)/.14);
        // A merged family can be larger than its physics anchors: clear its actual box sphere.
        const delta=position.map((x,a)=>x-state.cameraPose.position[a]),distance=Math.hypot(...delta),clearance=size*Math.sqrt(3)/2+.32;
        if(distance<clearance){const normal=distance>1e-9?delta.map(x=>x/distance):[0,1,0];for(let a=0;a<3;a++)position[a]=state.cameraPose.position[a]+normal[a]*clearance;}
        return {position,size,index:ids[0],rotation:div===10?[0,0,0]:HERO_ROTATION,quaternion:div===10&&state.motion?motionLib.bodyQuaternion(ids[0],state.motion,state.time,state.story.kind):null,merge:merging};
      });
      if(items.length>BODY_CAPACITY)throw new Error('Body pool overflow');
      return {count:items.length,items,capacity:BODY_CAPACITY,division:div,parentDivision:parentDiv,blend,merging};
    }
    return {draw};
  }
  function shake(t, kick, onset) {
    let out=[0,0,0];
    for(const [event,strength] of [[kick,.10],[onset,.06]]) {
      const age=t-event;
      if(age>=0 && age<.24) { const a=strength*Math.pow(1-age/.24,2)*Math.sin(age*75);out[0]+=a;out[1]+=a*.45; }
    }
    return out;
  }
  return {END,HERO_ROTATION,CAPACITY,BODY_CAPACITY,POLYHEDRA,fillIntroSolids,bodyLayout,validate,validateSections,exitBeat,rotate,packedCube,torusScale,ending,heroState,build,shake,smooth};
});
