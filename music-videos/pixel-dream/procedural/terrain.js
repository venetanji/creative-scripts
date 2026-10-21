'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./motion.js'));else root.PixelTerrain=factory(root.PixelMotion);})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 const BASE=925,CAPACITY=BASE*9,STEP=1.1,TILE=30*STEP,TAU=2*Math.PI;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 function weight(stage){if(stage.kind==='plane')return stage.blend;if(stage.previousKind==='plane'&&stage.blend<1)return 1-stage.blend;return 0;}
 function createPool(){const positions=new Float64Array(CAPACITY*3),sizes=new Float64Array(CAPACITY),sourceIndices=new Uint16Array(CAPACITY),heights=new Float64Array(BASE);return {update(s){
  const blend=weight(s.story),history=s.spectrum&&s.spectrum.history||[],times=s.spectrumHistoryTimes||[];
  if(times.some(t=>t>s.time+1e-8))throw Error('Terrain future spectral input');
  if(blend<=0)return {count:0,capacity:CAPACITY,blend,positions,sizes,sourceIndices,spatialReuse:true,historyRows:history.length,historyMaxTime:Math.max(0,...times)};
  if(history.length!==30)throw Error('Terrain requires the retained 30 causal history rows');
  const pitches=s.spectrum.pitches,columns=Array.from({length:30},(_,x)=>{let idx=0;for(let i=1;i<pitches.length;i++)if(Math.abs(pitches[i]-(36+60*x/29))<Math.abs(pitches[idx]-(36+60*x/29)))idx=i;return idx;});
  for(let i=0;i<BASE;i++){const x=i<900?i%30:Math.round((i-900)*29/24),z=i<900?Math.floor(i/30):29;heights[i]=2.1*Math.max(0,Math.min(1,history[z][columns[x]]||0));}
  // World-lattice tiles are recycled only behind the observer. Reuse is spatial, not extra audio history.
  const camera=s.cameraPose,cellX=Math.floor((camera.position[0]+TILE/2)/TILE),cellZ=Math.floor((camera.position[2]+TILE/2)/TILE);
  let k=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let tz=0;tz<3;tz++)for(let tx=-1;tx<=1;tx++)for(let i=0;i<BASE;i++){
   if(k>=CAPACITY)throw Error('Terrain pool overflow');const x=i<900?i%30:Math.round((i-900)*29/24),z=i<900?Math.floor(i/30):30;
   const p=[(cellX+tx)*TILE+(x-14.5)*STEP,heights[i],(cellZ+tz)*TILE+(z-14.5)*STEP];
   const delta=p.map((v,a)=>v-camera.position[a]),distance=Math.hypot(...delta);const edge=1-smooth((distance-48)/14);
   const size=.78*blend*edge,clearance=size*Math.sqrt(3)/2+.32;if(distance<clearance){const n=distance>1e-9?delta.map(x=>x/distance):[0,-1,0];for(let a=0;a<3;a++)p[a]=camera.position[a]+n[a]*clearance;}positions.set(p,k*3);sizes[k]=size;sourceIndices[k]=i;for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]-size*Math.sqrt(3)/2);max[a]=Math.max(max[a],p[a]+size*Math.sqrt(3)/2);}k++;
  }
  return {count:k,capacity:CAPACITY,blend,positions,sizes,sourceIndices,spatialReuse:true,historyRows:history.length,historyMaxTime:Math.max(0,...times),bounds:{min,max},tileOrigin:[cellX,cellZ],tileSpan:TILE,policy:'3x3 world-lattice spatial reuse of 925 identities / 30 real causal rows; no additional measurements'};
 }};}
 return {CAPACITY,BASE,STEP,TILE,weight,createPool};
});
