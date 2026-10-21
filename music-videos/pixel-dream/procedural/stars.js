'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PixelStars=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CAPACITY=192,clamp=x=>Math.max(0,Math.min(1,x));
  // Fixed Fibonacci shell: neither note attacks nor camera motion can relocate a star.
  const field=Object.freeze(Array.from({length:CAPACITY},(_,i)=>{
    const y=1-2*(i+.5)/CAPACITY,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),radius=32+16*((i*73)%CAPACITY)/(CAPACITY-1);
    return Object.freeze({id:'star'+i,position:Object.freeze([radius*r*Math.cos(a),radius*y,radius*r*Math.sin(a)]),radius,pitchRegion:i%12});
  }));
  function sample(t,held,pulses,rms,reference=1){
    if(t>=187.2||!(rms>.0001))return [];
    const latest=pulses.slice().sort((a,b)=>b.availableAt-a.availableAt)[0];
    const voice=held.slice().sort((a,b)=>b.pitch-a.pitch||b.availableAt-a.availableAt)[0]||latest;
    if(!voice)return [];
    const amplitude=clamp(Math.sqrt(rms/Math.max(1e-9,reference)));
    return field.map(s=>{
      let pulse=0,attack=null;
      for(const n of pulses){if(((Math.round(n.pitch)%12)+12)%12!==s.pitchRegion)continue;
        const age=t-n.availableAt,envelope=age<0||age>=.24?0:age<.04?age/.04:1-(age-.04)/.20;
        const strength=envelope*n.velocity*amplitude;if(strength>pulse){pulse=strength;attack=n;}
      }
      return {...s,coordinateSpace:'world',stem:'synth',pitch:attack?attack.pitch:voice.pitch,availableAt:attack?attack.availableAt:voice.availableAt,sourceTime:attack?attack.sourceTime:voice.sourceTime,
        pulse,pulseAge:attack?t-attack.availableAt:null,attackId:attack?attack.id:null,causalRms:rms,referenceRms:reference,amplitude,
        size:.12+.08*amplitude+.10*pulse,illumination:(.065+.18*amplitude+.65*pulse)*amplitude};
    });
  }
  return Object.freeze({CAPACITY,field,sample,policy:'world Fibonacci shell 32..48; synth only; highest active newly attacked voice; causal RMS; 40ms attack/200ms release; provisional +0.26s note estimate; no camera attachment'});
});
