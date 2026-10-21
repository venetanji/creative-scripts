'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PixelMotion=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TAU=2*Math.PI,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const ladder=[1/32,1/16,1/8,1/4,1/2,1];
  function rateFor(q,steps){let r=0;for(let i=0;i<steps.length;i++)r+=(steps[i]-(i?steps[i-1]:0))*smooth(q-4*(i+1));return r;}
  function phaseFor(q,steps){let cycles=0;for(let i=0;i<steps.length;i++){const x=Math.max(0,q-4*(i+1)),u=Math.min(1,x);cycles+=(steps[i]-(i?steps[i-1]:0))*(u*u*u-.5*u*u*u*u+Math.max(0,x-1));}return cycles*TAU;}
  const localLadder=ladder.map(x=>Math.min(.25,x));
  function localSectionRate(q){return rateFor(q,localLadder);}
  function localSectionPhase(q){return phaseFor(q,localLadder);}
  function sectionRate(q){let r=0;for(let i=0;i<ladder.length;i++)r+=(ladder[i]-(i?ladder[i-1]:0))*smooth(q-4*(i+1));return r;}
  // Each bar changes rate over its first quarter; analytic integration survives rewind and variable tempo.
  function sectionPhase(q){let cycles=0;for(let i=0;i<ladder.length;i++){const x=Math.max(0,q-4*(i+1)),u=Math.min(1,x);cycles+=(ladder[i]-(i?ladder[i-1]:0))*(u*u*u-.5*u*u*u*u+Math.max(0,x-1));}return cycles*TAU;}
  function scorePhase(q,chapters,guitarBeat=0,phaseFunction=sectionPhase){let a=0;for(let i=0;i<chapters.length;i++){const start=chapters[i].beat,end=i+1<chapters.length?chapters[i+1].beat:Infinity;const top=Math.min(q,end);if(top<=start)break;const gate=chapters[i].kind==='intro'?Math.max(start,guitarBeat):start;a+=Math.max(0,phaseFunction(top-start)-phaseFunction(gate-start));}return a;}
  function coneRate(q,start=35.979843){return sectionRate(q-start)/16;}
  function conePhase(q,start=35.979843){return sectionPhase(q-start)/16;}
  function globalAngle(stage,q){if(stage.kind==='cone')return conePhase(q,stage.startBeat);if(stage.previousKind==='cone'&&stage.blend<1){const a=conePhase(stage.startBeat,stage.previousStartBeat);return a-Math.atan2(Math.sin(a),Math.cos(a))*smooth((q-stage.startBeat)/4);}return 0;}
  function rotateY(p,a){const c=Math.cos(a),s=Math.sin(a);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
  function createNoteMotion(options={}){const chapters=options.chapters||[{beat:0,kind:'intro'}],guitarBeat=options.guitarBeat||0,fadeBeat=options.fadeBeat===undefined?Infinity:options.fadeBeat;let envelope=0,pitch=60,phase=0,q=0,cyclesPerQuarter=0,sectionQuarter=0;const fadeStartPhase=scorePhase(fadeBeat,chapters,guitarBeat,localSectionPhase);
    return {update(dt,note,amp,quarterAdvance,absoluteQuarter,stage){const k=1-Math.exp(-dt/.12);envelope+=((note===null?0:Math.min(1,amp))-envelope)*k;if(note!==null)pitch+=(note-pitch)*k;q=absoluteQuarter===undefined?q+quarterAdvance:absoluteQuarter;const current=stage||chapters.filter(c=>c.beat<=q).at(-1)||chapters[0];sectionQuarter=Math.max(0,q-(current.startBeat===undefined?current.beat:current.startBeat));phase=scorePhase(Math.min(q,fadeBeat),chapters,guitarBeat,localSectionPhase);cyclesPerQuarter=q<guitarBeat||q>=fadeBeat?0:localSectionRate(sectionQuarter);},state:()=>({envelope,pitch,phase,cyclesPerQuarter,sectionQuarter,fadeStartPhase}),reset(){envelope=0;pitch=60;phase=0;q=0;cyclesPerQuarter=0;sectionQuarter=0;}};
  }
  function multiply(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
  function axisGain(index){return 1;}
  function localAngle(index,note,t){const gain=axisGain(index);if(t>=187.2)return 0;let angle=note.phase*gain;if(t>=183){const start=note.fadeStartPhase*gain,finish=Math.ceil(start/TAU)*TAU;angle=start+(finish-start)*smooth((t-183)/4.2);}return angle;}
  function localQuaternion(index,note,t){if(t>=187.2)return [0,0,0,1];const half=localAngle(index,note,t)/2;return [0,Math.sin(half),0,Math.cos(half)];}
  function bodyQuaternion(index,motion,t,kind){const a=motion.globalAngle/2;return multiply([0,Math.sin(a),0,Math.cos(a)],localQuaternion(index,motion.note,t));}
  function fitCamera(positions,size=.42){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],margin=size*Math.sqrt(3)/2+.5;for(let i=0;i<positions.length;i++) {const a=i%3;min[a]=Math.min(min[a],positions[i]-margin);max[a]=Math.max(max[a],positions[i]+margin);}const center=[0,0,0],half=min.map((x,a)=>Math.max(Math.abs(x),Math.abs(max[a]))),tan=Math.tan(48*Math.PI/360);const required=half[2]+Math.max(half[1]/tan,half[0]/(tan*640/360))/.88;const distance=Math.max(34,required);return {position:[center[0],center[1],center[2]+distance],target:center,up:[0,1,0],fov:48,near:.1,far:90,mode:'full-projected-aabb-pullback',fit:{min,max,distance,required,margin}};}
  function lateCamera(pose,positions,t,end,opening){if(t<183||t>=end)return pose;const full=fitCamera(positions),pull=smooth((t-183)/3.8),home=smooth((t-187.2)/(end-187.2));return {...full,position:full.position.map((x,a)=>(pose.position[a]+(x-pose.position[a])*pull)*(1-home)+opening.position[a]*home),target:full.target.map((x,a)=>(pose.target[a]+(x-pose.target[a])*pull)*(1-home)+opening.target[a]*home)};}
  return {localSectionRate,localSectionPhase,sectionRate,sectionPhase,scorePhase,axisGain,localAngle,coneRate,conePhase,globalAngle,rotateY,createNoteMotion,localQuaternion,bodyQuaternion,fitCamera,lateCamera};
});
