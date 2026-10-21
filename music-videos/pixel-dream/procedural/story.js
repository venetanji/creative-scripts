'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./performance.js'),require('./section-map.js'));
  else root.PixelStory = factory(root.PixelPerformance,root.PixelSectionMap);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (performance,sectionMap) {
  const TAU=Math.PI*2, smooth=performance.smooth;
  const chapters=sectionMap.wholeSectionMap.chapters;
  function stageAt(phase,map,time){
    if(!map||!map.chapters||!Number.isFinite(time))throw new TypeError('Bound V9 section map and authored seconds required');
    const score=map.chapters;let index=0;
    while(index+1<score.length && time>=score[index+1].time)index++;
    const c=score[index],p=score[Math.max(0,index-1)];
    return {kind:c.kind,previousKind:p.kind,startBeat:c.beat,previousStartBeat:p.beat,
      startTime:c.time,sourceType:c.sourceType,geometryEnd:c.geometryEnd,cameraEnd:c.cameraEnd,
      blend:index?smooth((phase-c.beat)/4):1,index,endBeat:index+1<score.length?score[index+1].beat:Infinity};
  }
  function pose(position,target=[0,0,0],mode='directed-orbit') {return {position,target,up:[0,1,0],fov:48,near:.1,far:90,mode};}
  function orbit(angle,radius,y,target=[0,0,0]){return {...pose([radius*Math.sin(angle),y,radius*Math.cos(angle)],target),azimuth:angle};}
  function opening(){return orbit(.45,8,1.15);}
  function baseCamera(kind,stage,c){
    const b=c.beatPhase, start=kind===stage.kind?stage.startBeat:stage.previousStartBeat;
    const progress=Math.max(0,b-start), end=kind===stage.kind?stage.endBeat:stage.startBeat;
    const p=smooth(progress/Math.max(4,end-start)), angle=.45+(b-(c.guitarEntryBeat||0))*TAU/32;
    if(kind==='intro') {
      if(!c.guitarRelease)return opening();
      return orbit(.45+Math.max(0,b-c.guitarEntryBeat)*TAU/32,8+5*smooth((b-4)/25),1.15+1.15*smooth((b-4)/25));
    }
    if(kind==='cone') {
      const enter=smooth((progress-5)/11),radius=12*(1-enter)+1.65*enter;
      return orbit(.45,radius,2.3+1.2*enter,[.75*enter,-.6,0]);
    }
    if(kind==='plane'){const z=-13+24*p,x=-1.5+3*p;return pose([x,3.3,z],[x+.25,2.65,z+16],'low-frequency-history-forward-flyby');}
    if(kind==='torus' || kind==='torus-tight') {
      const scale=performance.torusScale(b,c.torusTightBeat,4), approach=smooth((b-c.torusEntryBeat)/15);
      const u=.4+(b-c.torusEntryBeat)*TAU/48, rotation=c.rotation||0, a=u;
      // Approach through the hollow tube mouth, then track the scaled centerline.
      const radius=Math.min(14.4,scale*(6+6*(1-approach))),ahead=a+.30;
      return {...pose([radius*Math.cos(a),scale*1.0*(1-approach),radius*Math.sin(a)],
        [6*scale*Math.cos(ahead),0,6*scale*Math.sin(ahead)],'scaled-hollow-torus-passage'),azimuth:Math.PI/2-a};
    }
    if(kind==='mobius') {
      const enter=smooth((progress-4)/18),r=12*(1-enter)+1.85*enter,y=3*(1-enter)+.45*enter;
      const a=angle, ribbonAngle=a+.65;
      const look=[5*Math.sin(ribbonAngle),.4,5*Math.cos(ribbonAngle)];
      return orbit(a,r,y,look.map(x=>x*enter));
    }
    if(kind==='stairs') {
      const step=58+65*p,a=TAU*step/72+(c.rotation||0)*.15,ahead=a+TAU*8/72,y=(step-92)*.16+1.2;
      return pose([7.2*Math.cos(a),y,7.2*Math.sin(a)],[5*Math.cos(ahead),y+.08,5*Math.sin(ahead)],'continuous-spiral-climbing-camera');
    }
    if(kind==='hypercube') {
      const enter=smooth(progress/28),radius=15*(1-enter)+.8*enter;
      return orbit(angle,radius,3*(1-enter)+.35*enter,[-2*Math.sin(angle)*enter,.15,-2*Math.cos(angle)*enter]);
    }
    const fold=smooth((c.time-185.2)/(performance.END-185.2)); if(fold===1)return opening(); const last=baseCamera('hypercube',{...stage,kind:'hypercube',startBeat:c.hypercubeBeat,endBeat:stage.startBeat},{...c,beatPhase:stage.startBeat});
    const home=opening(),a=Math.atan2(last.position[0],last.position[2]),delta=Math.atan2(Math.sin(.45-a),Math.cos(.45-a));
    const radius=Math.hypot(last.position[0],last.position[2])*(1-fold)+8*fold;
    return orbit(a+delta*fold,radius,last.position[1]*(1-fold)+1.15*fold,last.target.map(x=>x*(1-fold)));
  }
  function cameraAt(stage,c){
    const current=baseCamera(stage.kind,stage,c),cameraBlend=smooth((c.beatPhase-stage.startBeat)/4);
    if(cameraBlend>=1 || !stage.index)return current;
    const previous=baseCamera(stage.previousKind,stage,c),s=cameraBlend;
    const startControls={...c,beatPhase:stage.startBeat,rotation:c.transitionRotation||0};
    const startCurrent=baseCamera(stage.kind,stage,startControls),startPrevious=baseCamera(stage.previousKind,stage,startControls);
    const orbital=Number.isFinite(previous.azimuth)&&Number.isFinite(current.azimuth);
    const wrap=orbital?Math.round((startPrevious.azimuth-startCurrent.azimuth)/TAU)*TAU:0;
    const angle=previous.azimuth+(current.azimuth+wrap-previous.azimuth)*s;
    const r=Math.hypot(previous.position[0],previous.position[2])*(1-s)+Math.hypot(current.position[0],current.position[2])*s;
    const position=orbital?[r*Math.sin(angle),previous.position[1]*(1-s)+current.position[1]*s,r*Math.cos(angle)]:previous.position.map((x,a)=>x+(current.position[a]-x)*s);
    const view = p => {const d=p.target.map((x,i)=>x-p.position[i]);return {yaw:Math.atan2(d[0],d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),distance:Math.hypot(...d)};};
    const v0=view(previous),v1=view(current),v00=view(startPrevious),v10=view(startCurrent);
    const unwrap=(x,ref)=>ref+Math.atan2(Math.sin(x-ref),Math.cos(x-ref));
    const yaw0=unwrap(v0.yaw,v00.yaw),yaw1=unwrap(v1.yaw,v10.yaw),yawWrap=Math.round((v00.yaw-v10.yaw)/TAU)*TAU;
    const yaw=yaw0+(yaw1+yawWrap-yaw0)*s,pitch=v0.pitch+(v1.pitch-v0.pitch)*s,distance=Math.max(.5,v0.distance*(1-s)+v1.distance*s);
    const target=[position[0]+Math.sin(yaw)*Math.cos(pitch)*distance,position[1]+Math.sin(pitch)*distance,position[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
    return {...current,position,target,mode:'four-quarter-steady-camera-morph',transitionTo:current.mode};
  }
  function fillTargets(stage,rest,out,previous,c,shapes){
    if(stage.kind==='intro')return;
    const geometry=k=>k==='torus-tight'?'torus':k==='finale'?'hypercube':k;
    shapes.fillTargets(geometry(stage.kind),rest,out,c);
    if(stage.blend<1){
      if(stage.previousKind==='intro')previous.set(c.introTargets);
      else shapes.fillTargets(geometry(stage.previousKind),rest,previous,stage.previousKind==='torus'?{...c,torusScale:1.72}:c);
      for(let i=0;i<out.length;i++)out[i]=previous[i]+(out[i]-previous[i])*stage.blend;
    }
    if(stage.kind==='finale'){
      const fold=performance.ending(c.time);
      for(let i=0;i<out.length;i++)out[i]=out[i]*(1-fold)+c.packed[i]*fold;
    }
  }
  return {chapters,stageAt,cameraAt,fillTargets,opening};
});
