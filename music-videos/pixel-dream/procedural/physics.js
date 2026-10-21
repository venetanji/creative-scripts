'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./performance.js'),require('./section-map.js'),require('./stars.js'),require('./motion.js'));
  else root.PixelPhysics = factory(root.PixelPerformance,root.PixelSectionMap,root.PixelStars,root.PixelMotion);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (performanceLib,sectionMapLib,starsLib,motionLib) {
  const TRACKS = ['guitar', 'bass', 'drums', 'percussion', 'synth', 'keyboard', 'brass', 'strings', 'vocals'];
  const CONSTANTS = Object.freeze({hz: 120, fps: 24, start: 0, frames: 4634, duration: 193.08, drumShift: .300,
    spacing: .62, latticeRadius: 6, anchorSpring: 14, neighborSpring: 1.8, damping: 3.2,
    maxDisplacement: 24, maxTargetDisplacement: 10, maxSpeed: 26, amplitudeFloor: .025, amplitudeCap: 1.25});
  const TAU = Math.PI * 2, dt = 1 / CONSTANTS.hz;
  const FIELD_GAINS = Object.freeze({guitar: .65, bass: 1, drums: 1, percussion: 1,
    synth: .85, keyboard: 1.5, brass: 1.4, strings: 1.4, vocals: 1});
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function featureIndex(times, t) {
    let lo = 0, hi = times.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (times[m] <= t) lo = m + 1; else hi = m; }
    return lo - 1;
  }
  function cameraAt(t, snapshot) {
    if (snapshot && snapshot.cameraPose) return snapshot.cameraPose;
    const synth = snapshot && snapshot.synthMotion;
    const angle = .45 + (synth ? synth.beatPhase * TAU / 8 : 0);
    const elevation = .12;
    const dir = [Math.cos(elevation) * Math.sin(angle), Math.sin(elevation), Math.cos(elevation) * Math.cos(angle)];
    const target = [0, .1, 0], p = snapshot && snapshot.positions;
    if (p) {
      target.fill(0); for (let j = 0; j < p.length; j++) target[j % 3] += p[j] / (p.length / 3);
    }
    // Hold framing through the impact: automatic zoom-out would conceal the burst.
    const radius = 19;
    return {position: target.map((v, i) => v + dir[i] * radius), target, radius, elevation, angle,
      up: [0, 1, 0], fov: 48, near: .1, far: 90};
  }
  function createSimulation(events, features, options = {}) {
    if (!events || events.schema !== 1 || !features || !Array.isArray(features.times)) throw new Error('Expected event schema 1 and causal features.times');
    for (let i = 0; i < features.times.length; i++)
      if (!Number.isFinite(features.times[i]) || (i && features.times[i] <= features.times[i - 1])) throw new Error('Feature times must increase strictly');
    const enabled = new Set(options.enabled || TRACKS), midiEnabled = options.midiEnabled !== false;
    const anchorTime = options.anchorTime;
    if (!Number.isFinite(anchorTime) || anchorTime < CONSTANTS.start) throw new Error('Measured kick anchor required');
    const synthClock = options.synthClock;
    if (!synthClock || !Array.isArray(synthClock.beatTimesSource) || !Array.isArray(synthClock.notes)) throw new Error('Verified synth/beat clock required');
    const synthFeatures = features.tracks[synthClock.sourceStem];
    if (!synthFeatures) throw new Error('Missing tracked synth features');
    const introLevels = synthFeatures.rms.filter((x, i) => features.times[i] <= 7 && x > 0 && Number.isFinite(x)).sort((a, b) => a - b);
    const introReference = introLevels[Math.floor(introLevels.length * .95)] || synthFeatures.referenceRms;
    const admittedCues = performanceLib.validate(options.performanceCues);
    const performanceCues = admittedCues;
    const authored = sectionMapLib.bindClock(synthClock);
    const chapter = kind => authored.chapters.find(c=>c.kind===kind);
    const torusEntryBeat=chapter('torus').beat,torusTightBeat=chapter('torus-tight').beat,torusExitBeat=chapter('mobius').beat,hypercubeBeat=chapter('hypercube').beat;
    const sectionCues = performanceLib.validateSections(options.sectionCues);
    const performance = performanceLib.build(synthClock, performanceCues, features);
    const eventEnabled = options.eventEnabled !== false, returnEnabled = eventEnabled && options.returnEventEnabled !== false;
    const shapeLib = options.shapes, storyLib = options.story, spectrum = options.spectrum;
    if (!shapeLib || !storyLib || !spectrum || !Array.isArray(spectrum.times)) throw new Error('Full-song geometry, story and spectrum required');
    const notes = {}, controls = {}, restList = [], cells = new Map(), links = [];
    for (const name of TRACKS) {
      const source = events.tracks[name] || [];
      notes[name] = source.map(n => {
        if (n.length !== 4 || !n.every(Number.isFinite) || n[1] < n[0]) throw new Error('Invalid note in ' + name);
        const shift = name === 'drums' ? CONSTANTS.drumShift : 0;
        return [n[0] + shift, n[1] + shift, n[2], n[3]];
      }).sort((a, b) => a[0] - b[0]);
      const f = features.tracks[name];
      if (f) for (const key of ['rms', 'low', 'mid', 'high', 'onset', 'flags']) {
        if (!f[key] || f[key].length !== features.times.length) throw new Error('Feature shape: ' + name + '.' + key);
      }
      controls[name] = {};
    }
    for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) for (let z = -6; z <= 6; z++) {
      if (x * x + y * y + z * z > 36) continue;
      cells.set([x, y, z].join(','), restList.length / 3);
      restList.push(x * CONSTANTS.spacing, y * CONSTANTS.spacing, z * CONSTANTS.spacing);
    }
    for (const [key, i] of cells) {
      const xyz = key.split(',').map(Number);
      for (let a = 0; a < 3; a++) { const next = xyz.slice(); next[a]++; const j = cells.get(next.join(',')); if (j !== undefined) links.push(i * 3, j * 3); }
    }
    const packed = performanceLib.packedCube();
    const rest = Float64Array.from(restList), positions = packed.slice(), velocities = new Float64Array(rest.length), acc = new Float64Array(rest.length), targets = rest.slice();
    const count = rest.length / 3;
    const worldPositions=positions.slice(),noteMotion=motionLib.createNoteMotion({chapters:authored.chapters,guitarBeat:sectionMapLib.quarterAt(synthClock,performanceCues.guitarEntry.availableAt),fadeBeat:sectionMapLib.quarterAt(synthClock,183)});
    const introSolidTargets = packed.slice(); let introSolid = null, introSolidSample = -1;
    const mathTargets = rest.slice(), previousMathTargets = rest.slice();
    const zeroSpectrum = Array(spectrum.pitches.length).fill(0);
    let step = 0, drumCursor = 0, drumHits = 0, lastDrumAdmission = null, drumPulses = [], clampCount = 0, fieldRms = {}, unfurl = 0, helixPhase = 0;
    let triggered = false, triggerTime = null, beatCount = 0, lastKickTime = null, orbitAngle = 0;
    let effectiveAnchorSpring = CONSTANTS.anchorSpring, effectiveNeighborSpring = .35 * CONSTANTS.neighborSpring;
    let synthMotion = {beatPhase: 0, beatIndex: -1, noteCount: 0, pitch: null, amplitude: 0, twist: 0};
    let storyState = storyLib.stageAt(0, authored,0), shapeControls = {}, shapeRotation = 0, previousBeatPhase = 0;
    let performanceState = {admittedGuitar: 0, release: 0, foreground: [], stars: [], lastOnset: -Infinity}, flowPhase = 0;
    let synthCursor = 0, synthHeld = [], admittedSynthCount = 0;
    const noteCursors = Object.fromEntries(TRACKS.map(n => [n, 0])), heldNotes = Object.fromEntries(TRACKS.map(n => [n, []])), latestNotes = {};
    function rmsAt(name, t) { const i = featureIndex(features.times, t), f = features.tracks[name]; return i >= 0 && f ? f.rms[i] : 0; }
    let section = {phase:'ensemble',withdrawalTime:null,returnTime:null,returnCount:0,authoredImpactTime:null,authoredImpactSource:'authored-master-impact',liveReturnCount:0}, quietMix = 0, motionBeat = 0;
    let transitionRotation = 0;
    const guitarEntryBeat = (() => {const i=featureIndex(synthClock.beatTimesSource,performanceCues.guitarEntry.availableAt);return i+(performanceCues.guitarEntry.availableAt-synthClock.beatTimesSource[i])/(synthClock.beatTimesSource[i+1]-synthClock.beatTimesSource[i]);})();
    let targetSample = -1, targetKind = '', spectrumIndex = -1;
    function reset() {
      step = 0; noteMotion.reset(); positions.set(packed); targets.set(packed); performance.reset();
      performanceState = {admittedGuitar: 0, release: 0, foreground: [], stars: [], lastOnset: -Infinity}; flowPhase = 0; synthCursor = 0; synthHeld = []; admittedSynthCount = 0;
      for (const n of TRACKS) { noteCursors[n] = 0; heldNotes[n] = []; latestNotes[n] = null; } velocities.fill(0); drumCursor = 0; drumHits = 0; unfurl = 0; helixPhase = 0;
      lastDrumAdmission = null; drumPulses = []; clampCount = 0; fieldRms = Object.fromEntries(TRACKS.map(n=>[n,0]));
      triggered = false; triggerTime = null; beatCount = 0; lastKickTime = null; orbitAngle = 0;
      effectiveAnchorSpring = CONSTANTS.anchorSpring; effectiveNeighborSpring = .35 * CONSTANTS.neighborSpring;
      synthMotion = {beatPhase: 0, beatIndex: -1, noteCount: 0, pitch: null, amplitude: 0, twist: 0};
      storyState = storyLib.stageAt(0, authored,0); shapeControls = {}; shapeRotation = 0; previousBeatPhase = 0;
      targetSample = -1; targetKind = ''; spectrumIndex = -1; transitionRotation = 0; section = {phase:'ensemble',withdrawalTime:null,returnTime:null,returnCount:0,authoredImpactTime:null,authoredImpactSource:'authored-master-impact',liveReturnCount:0}; quietMix = 0; motionBeat = 0; introSolid = null; introSolidSample = -1;
      for (const name of TRACKS) Object.assign(controls[name], {amp: 0, feature: -1, attackTime: -Infinity, previousOnset: 0,
        pitch: 60, velocity: .65, ax: 1, az: 0, chordX: 0, chordZ: 0, pulse: 0, low: 0, high: 0});
      updateControls(0);
    }
    function kickImpulse(t, first) {
      const center = [0, 0, 0];
      for (let j = 0; j < positions.length; j++) center[j % 3] += positions[j] / count;
      const speed = first ? 18 : storyState.kind === 'intro' ? 6 : storyState.kind === 'cone' ? 1.8 : storyState.kind === 'plane' ? .8 : 0;
      for (let j = 0; j < positions.length; j += 3) {
        const dx = positions[j] - center[0], dy = positions[j + 1] - center[1], dz = positions[j + 2] - center[2];
        const length = Math.max(.15, Math.hypot(dx, dy, dz));
        velocities[j] += speed * dx / length;
        velocities[j + 1] += speed * dy / length;
        velocities[j + 2] += speed * dz / length;
      }
      beatCount++; lastKickTime = t;
    }
    function updateControls(t) {
      const idx = featureIndex(features.times, t);
      for (const name of TRACKS) {
        const c = controls[name], f = features.tracks[name], active = enabled.has(name);
        const ref = f && Number.isFinite(f.referenceRms) && f.referenceRms > 0 ? f.referenceRms : 1;
        const value = key => f && idx >= 0 && Number.isFinite(f[key][idx]) ? Math.max(0, f[key][idx]) : 0;
        const ratio = value('rms') / ref;
        const wanted = active && ratio > CONSTANTS.amplitudeFloor ? Math.min(CONSTANTS.amplitudeCap, Math.sqrt(ratio)) : 0;
        c.amp += (wanted - c.amp) * (1 - Math.exp(-dt / (wanted > c.amp ? .045 : .16)));
        if (wanted === 0 && c.amp < .00001) c.amp = 0;
        c.low = clamp(value('low') / ref, 0, 1.25); c.high = clamp(value('high') / ref, 0, 1.25);
        if (idx !== c.feature) {
          const onset = value('onset');
          // For unverified MIDI, only the trailing-window acoustic attack opens a pulse.
          if (active && wanted > 0 && (value('flags') > 0 || (onset > .2 && onset > c.previousOnset + .12))) c.attackTime = t;
          c.previousOnset = onset; c.feature = idx;
        }
        const age = t - c.attackTime;
        c.pulse = active && age < .55 ? Math.exp(-age / .115) : 0;
        c.pitch = 60; c.velocity = .65; c.ax = 1; c.az = 0; c.chordX = 0; c.chordZ = 0;
        if (midiEnabled) {
          let held = 0, weight = 0, sx = 0, sz = 0, pitch = 0, vel = 0, latest = null;
          while (noteCursors[name] < notes[name].length && notes[name][noteCursors[name]][0] <= t) {
            const n = notes[name][noteCursors[name]++]; heldNotes[name].push(n); latestNotes[name] = n;
          }
          heldNotes[name] = heldNotes[name].filter(n => n[1] > t);
          latest = latestNotes[name];
          for (const n of heldNotes[name]) {
            const w = clamp(n[3] / 127, 0, 1), angle = ((n[2] % 12) / 12) * TAU;
            held++; weight += w; sx += Math.cos(angle) * w; sz += Math.sin(angle) * w; pitch += n[2] * w; vel += w;
          }
          // Retain only an already-admitted pitch during audio/MIDI mismatch or tiny score durations.
          if (held && weight > 0) { c.pitch = pitch / weight; c.velocity = vel / held; c.chordX = sx / weight; c.chordZ = sz / weight; }
          else if (latest) { c.pitch = latest[2]; c.velocity = clamp(latest[3] / 127, 0, 1); }
          const angle = (c.pitch % 12) / 12 * TAU; c.ax = Math.cos(angle); c.az = Math.sin(angle);
        }
      }
      if (midiEnabled) {
        while (drumCursor < notes.drums.length && notes.drums[drumCursor][0] <= t) {
          const n = notes.drums[drumCursor++];
          if (enabled.has('drums') && controls.drums.amp > .01) {
            drumPulses.push({time: t, pitch: n[2], strength: clamp(n[3] / 127, 0, 1)});
            drumHits++; lastDrumAdmission = t;
            const selectedReturn = Math.abs(n[0]-sectionCues.return.sourceTime)<.12 && [35,36].includes(n[2]);
            if (eventEnabled && triggered && section.phase !== 'melody-play' && !selectedReturn && [35, 36].includes(n[2]) && n[0] > anchorTime + .10) kickImpulse(t, false);
          }
        }
      }
      drumPulses = drumPulses.filter(p => t - p.time < .6);
    }
    function integrate(t) {
      updateControls(t); acc.fill(0);
      const beats = synthClock.beatTimesSource, beatIndex = featureIndex(beats, t);
      const previous = beatIndex >= 0 ? beats[beatIndex] : null;
      const next = beats[beatIndex + 1] === undefined ? synthClock.beatTimesSourceNext : beats[beatIndex + 1];
      const beatFraction = previous !== null && Number.isFinite(next) ? clamp((t - previous) / (next - previous), 0, 1) : 0;
      const beatPhase = beatIndex < 0 ? 0 : beatIndex + beatFraction;
      let pitch = null, noteCount = 0;
      while (synthCursor < synthClock.notes.length && synthClock.notes[synthCursor].on <= t) {
        synthHeld.push(synthClock.notes[synthCursor++]); admittedSynthCount++;
      }
      synthHeld = synthHeld.filter(n => n.off > t);
      for (const note of synthHeld) if (pitch === null || note.pitch > pitch) pitch = note.pitch;
      noteCount = admittedSynthCount;
      const synthFeatureIndex = featureIndex(features.times, t);
      const synthRms = synthFeatureIndex >= 0 ? synthFeatures.rms[synthFeatureIndex] : 0;
      if (!(synthRms > .0001)) pitch = null;
      const reference = t < 7 ? introReference : synthFeatures.referenceRms;
      const introAmplitude = pitch === null ? 0 : Math.min(1.25, Math.sqrt(synthRms / Math.max(1e-9, reference)));
      const wantedTwist = pitch === null ? 0 : ((pitch % 12) / 12 * TAU - Math.PI) * introAmplitude;
      synthMotion.twist += (wantedTwist - synthMotion.twist) * (1 - Math.exp(-dt / .12));
      Object.assign(synthMotion, {beatPhase, beatIndex, noteCount, pitch, amplitude: introAmplitude});
      const nextStage = storyLib.stageAt(beatPhase, authored,t);
      if (nextStage.kind !== storyState.kind) transitionRotation = shapeRotation + synthMotion.twist * .25;
      storyState = nextStage;
      performanceState = performance.update(t, rmsAt);
      const withdrawal = sectionCues.withdrawal, returnCue = sectionCues.return;
      const featureAt = featureIndex(features.times,t), bassLow = featureAt>=0 ? features.tracks.bass.low[featureAt] : 0;
      if(section.withdrawalTime===null && t>=withdrawal.availableAt && rmsAt('bass',t)<withdrawal.bassQuietThreshold && bassLow<withdrawal.bassQuietThreshold) {section.withdrawalTime=t;section.phase='melody-play';}
      if(returnEnabled && section.authoredImpactTime===null && t>=authored.impacts.second.time) {
        section.authoredImpactTime=t;kickImpulse(t,true);section.returnCount++;
      }
      if(section.withdrawalTime!==null && section.returnTime===null && t>=returnCue.availableAt && rmsAt('bass',t)>=returnCue.bassGrowthThreshold && rmsAt('drums',t)>.0001) {
        section.returnTime=t;section.phase='second-explosion';section.liveReturnCount++;
      }
      const quiet = section.phase==='melody-play';
      quietMix += ((quiet?1:0)-quietMix)*(1-Math.exp(-dt/.5));
      const phaseAdvance = Math.max(0, beatPhase - previousBeatPhase);
      noteMotion.update(dt,pitch,introAmplitude,phaseAdvance,beatPhase,storyState);
      const noteState=noteMotion.state();
      shapeRotation += phaseAdvance * (quiet ? .12 : 1) * noteState.envelope * (.16 + .02 * (noteState.pitch % 12));
      const torusScale = performanceLib.torusScale(beatPhase, torusTightBeat);
      motionBeat += phaseAdvance * (quiet ? .12 : 1);
      flowPhase += (quiet ? 0 : phaseAdvance) * TAU / 8 * (['torus','torus-tight'].includes(storyState.kind) ? 1.72 / torusScale : 1);
      previousBeatPhase = beatPhase;
      if (!performanceState.admittedGuitar) { positions.set(packed); targets.set(packed); velocities.fill(0); fieldRms = Object.fromEntries(TRACKS.map(n => [n, 0])); return; }
      if (storyState.kind === 'intro') for (const note of performanceState.newGuitar) {
        const face = Math.round(note.pitch) % 6, axis = Math.floor(face / 2), sign = face % 2 ? 1 : -1;
        for (let j = 0; j < positions.length; j += 3) {
          const weight = .18 + .82 * clamp((packed[j + axis] * sign + 1.2) / 3, 0, 1);
          velocities[j + axis] += sign * (1.6 + note.velocity * 2.4) * weight;
          velocities[j + (axis + 1) % 3] += Math.sin(note.pitch * .4 + j * .01) * weight * .65;
        }
      }
      if (eventEnabled && !triggered && t >= anchorTime) {
        triggered = true; triggerTime = t;
        kickImpulse(t, true);
      }
      const primaryBurstAge = triggered ? t-triggerTime : Infinity;
      const returnBurstAge = section.authoredImpactTime===null || !returnEnabled ? Infinity : t-section.authoredImpactTime;
      const burstAge = Math.min(primaryBurstAge,returnBurstAge);
      const beatAge = lastKickTime === null ? Infinity : t - lastKickTime;
      const beatPulse = quiet ? 0 : Math.exp(-beatAge / .14);
      const mathematical = storyState.kind !== 'intro';
      const platonic = !mathematical && !triggered && beatPhase >= 12;
      const introSample = Math.floor(step/5);
      if (platonic && introSample !== introSolidSample) {introSolid = performanceLib.fillIntroSolids(beatPhase, introSolidTargets, shapeRotation*.175);introSolidSample=introSample;}
      const stiffness = {cone: 32, plane: 30, torus: 450, 'torus-tight':450, mobius: 65, stairs: 90, hypercube: 55, finale: 45};
      const spring = burstAge < 1.05 ? 1.2 : mathematical ? stiffness[storyState.kind] : platonic ? 80 : triggered ? 5 : CONSTANTS.anchorSpring;
      const damping = burstAge < 1.05 ? 1.1 : mathematical ? ['torus','torus-tight'].includes(storyState.kind) ? 30 : storyState.kind === 'stairs' ? 20 : 12 : platonic ? 14 : 2.8;
      effectiveAnchorSpring = spring;
      effectiveNeighborSpring = (burstAge < 1.05 ? .08 : mathematical ? .05 : .35) * CONSTANTS.neighborSpring;
      const orbitTarget = Math.max(0, beatCount - 1) * .26;
      orbitAngle += (orbitTarget - orbitAngle) * (1 - Math.exp(-dt / .20));
      let kick = 0, snare = 0, hat = 0;
      for (const p of drumPulses) {
        const age = t - p.time;
        if ([35, 36].includes(p.pitch)) kick += p.strength * Math.exp(-age / .075);
        else if ([38, 40].includes(p.pitch)) snare += p.strength * Math.exp(-age / .055);
        else hat += p.strength * Math.exp(-age / .032);
      }
      const dc = controls.drums;
      if (!midiEnabled || !notes.drums.length) kick = dc.pulse * .45;
      kick = Math.min(1.5, kick) * dc.amp; snare = Math.min(1.5, snare) * dc.amp; hat = Math.min(1.5, hat) * dc.amp;
      const synth = controls.synth, strings = controls.strings, bass = controls.bass;
      const opening = performanceState.release;
      unfurl += (opening - unfurl) * (1 - Math.exp(-dt / .24));
      // Torque advances only with audible synth; pitch chooses the helix phase, not admission.
      helixPhase = triggered ? Math.max(0, beatCount - 1) * Math.PI / 8 : 0;
      const phase = helixPhase + synthMotion.twist;
      const stretch = 1 + .38 * unfurl + .55 * strings.amp - .12 * bass.amp;
      const tilt = .85 * unfurl, ct = Math.cos(tilt), st = Math.sin(tilt);
      const sums = Object.fromEntries(TRACKS.map(n => [n, 0]));
      for (let j = 0; j < rest.length; j += 3) {
        const x = rest[j], y = rest[j + 1], z = rest[j + 2], px = positions[j], py = positions[j + 1], pz = positions[j + 2];
        const r = Math.hypot(x, y, z), radial = 1 / Math.max(.62, r), core = Math.exp(-r * r / 5), outer = .2 + .8 * r / 3.72;
        const side = x >= 0 ? 1 : -1, winding = y * (1.05 + .32 * synth.amp) + phase;
        const ca = Math.cos(winding), sa = Math.sin(winding);
        const synthBeatPulse = introAmplitude * Math.exp(-beatFraction * 8);
        const flare = 2.55 + .5 * Math.cos(y * .8 + phase * .5) + .5 * kick + .65 * synthBeatPulse;
        // Two squeezed half-volumes become opposite corkscrew lobes with an open center.
        const hx = side * flare + (x - side * 1.35) * .3, hz = z * .28;
        const rx = hx * ca - hz * sa, rz = hx * sa + hz * ca;
        const tx = x * (1 - unfurl) + rx * unfurl, ty = y * stretch;
        let dx = tx * ct - ty * st - x, dy = tx * st + ty * ct - y, dz = z * (1 - unfurl) + rz * unfurl - z;
        const targetDistance = Math.hypot(dx, dy, dz), bound = Math.min(1, CONSTANTS.maxTargetDisplacement / Math.max(targetDistance, 1e-9));
        targets[j] = x + dx * bound; targets[j + 1] = y + dy * bound; targets[j + 2] = z + dz * bound;
        if (triggered) {
          const angle = Math.atan2(z, x) + helixPhase;
          const ringRadius = 5.8 + 1.7 * beatPulse + .35 * y;
          targets[j] = Math.cos(angle) * ringRadius;
          targets[j + 1] = y * .7;
          targets[j + 2] = Math.sin(angle) * ringRadius;
        }
        if (!triggered) {
          const release = performanceState.release * (.5 + .5 * clamp((packed[j + (Math.round(performanceState.lastGuitar.pitch) % 3)] + 2.1) / 4.2, 0, 1));
          for (let a = 0; a < 3; a++) targets[j + a] = packed[j + a] + (targets[j + a] - packed[j + a]) * release;
        }
        if (platonic) for (let a=0;a<3;a++) targets[j+a]=introSolidTargets[j+a];
        let fx = 0, fy = 0, fz = 0;
        for (const name of TRACKS) {
          const c = controls[name], a = c.amp * (.55 + .45 * c.velocity); let u = 0, v = 0, w = 0;
          if (a > 0 || name === 'drums') {
            const along = x * c.ax + z * c.az;
            if (name === 'bass') {
              u = -a * (1.7 + 2.4 * c.low) * px; w = -a * (1.7 + 2.4 * c.low) * pz;
              v = -a * (5.5 * y + 2.4);
            } else if (name === 'guitar') {
              const strand = .25 + .75 * Math.pow(Math.cos(y * 2.5 + c.pitch * .09), 8);
              const wave = Math.sin(along * 1.6 - (t - c.attackTime) * 6);
              const pluck = a * 70 * c.pulse * strand * (Number.isFinite(wave) ? wave : 0);
              u = -c.az * pluck; w = c.ax * pluck; v = pluck * .35;
            } else if (name === 'synth') {
              const torque = a * (.7 + c.pulse * 1.2) * (.65 + .35 * Math.cos(y * .6 + c.pitch * .1));
              u = -pz * torque; w = px * torque; v = a * 2 * Math.sin(along + y * .8);
            } else if (name === 'keyboard') {
              const symmetry = Math.cos(3 * Math.atan2(z, x) + c.pitch * .13);
              u = a * (5 * c.chordX + 3 * c.ax - px * .7 + 2.2 * symmetry * x);
              w = a * (5 * c.chordZ + 3 * c.az - pz * .7 + 2.2 * symmetry * z);
              v = a * (2.5 * Math.sin(y * 1.6 + c.pitch * .17) + 2 * c.pulse);
            } else if (name === 'drums') {
              u = kick * 75 * x * radial + snare * 45 * Math.tanh(y * 2);
              v = kick * 75 * y * radial + hat * 3 * Math.sin(y * 2);
              w = kick * 75 * z * radial - snare * 20 * Math.tanh(x) + hat * 2 * Math.cos(z * 2);
            } else if (name === 'percussion') {
              const ripple = a * 16 * c.pulse * Math.sin(y * 2.2 + along - (t - c.attackTime) * 18);
              u = (Number.isFinite(ripple) ? ripple : 0) * (.3 + .7 * outer); v = a * 2 * c.pulse * Math.sin(z * 2); w = u * .3;
            } else if (name === 'brass') {
              const jet = a * (5 + 8 * c.pulse) * (.35 + .65 * Math.max(0, along / 3.72));
              u = c.ax * jet + a * 2 * x * outer; w = c.az * jet + a * 2 * z * outer;
              v = jet * (.7 + .5 * Math.cos(y)) + a * 2 * Math.sin(x * 2 + z);
            } else if (name === 'strings') {
              const stretch = a * (3.5 + 1.5 * c.low) * along;
              u = stretch * c.ax - a * (x - along * c.ax) * 2.2;
              w = stretch * c.az - a * (z - along * c.az) * 2.2; v = a * (y * 2.5 + .7 * Math.sin(along));
            } else if (name === 'vocals') {
              const breath = c.pulse, pull = a * (2.5 + core * 3.5);
              u = -px * pull + a * breath * x; w = -pz * pull + a * breath * z;
              v = -py * pull + a * (3.5 + breath * 2) * core;
            }
          }
          const foreground = quiet && ['bass','drums','percussion'].includes(name) ? 0 : mathematical ? storyState.kind === 'stairs' ? 0 : .025 : name === 'drums' ? .3 : .16;
          u *= FIELD_GAINS[name] * foreground; v *= FIELD_GAINS[name] * foreground; w *= FIELD_GAINS[name] * foreground;
          fx += u; fy += v; fz += w; sums[name] += u * u + v * v + w * w;
        }
        acc[j] = fx - spring * (px - targets[j]) - damping * velocities[j];
        acc[j + 1] = fy - spring * (py - targets[j + 1]) - damping * velocities[j + 1];
        acc[j + 2] = fz - spring * (pz - targets[j + 2]) - damping * velocities[j + 2];
      }
      const sample = Math.floor(step / 5);
      if (mathematical && (sample !== targetSample || targetKind !== storyState.kind)) {
        spectrumIndex = featureIndex(spectrum.times, t);
        const values = spectrumIndex >= 0 ? spectrum.values[spectrumIndex] : zeroSpectrum;
        const history = [], historyTimes = [];
        if (storyState.kind === 'plane' || storyState.previousKind === 'plane' && storyState.blend < 1) {
          for (let row = 0; row < 30; row++) {
            const index = featureIndex(spectrum.times, Math.max(0, t - (29 - row) * .06));
            history.push(index >= 0 ? spectrum.values[index] : zeroSpectrum);
            historyTimes.push(index >= 0 ? spectrum.times[index] : 0);
          }
        }
        shapeControls = {time: t, beatPhase, motionBeat, quietMix, returnExpansion: returnEnabled && section.authoredImpactTime!==null && ['hypercube','finale'].includes(storyState.kind) ? .30*performanceLib.smooth((t-section.authoredImpactTime)/1.8) : 0, synthPitch: noteMotion.state().pitch, synthAmp: noteMotion.state().envelope,
          bassAmp: controls.bass.amp, kickPulse: beatPulse, flowPhase, torusScale, torusEntryProgress: beatPhase - torusEntryBeat, torusEntryBeat,torusTightBeat,torusExitBeat,hypercubeBeat,
          rotation: storyState.kind==='cone'||storyState.kind==='plane' ? 0 : shapeRotation,
          spectrum: {pitches: spectrum.pitches, values, history: history.length ? history : undefined},
          spectrumTime: spectrumIndex >= 0 ? spectrum.times[spectrumIndex] : 0,
          historyTimes, introTargets: targets, packed,
          finaleDuration: CONSTANTS.duration - chapter('finale').time};
        storyLib.fillTargets(storyState, rest, mathTargets, previousMathTargets, shapeControls, shapeLib);
        targetSample = sample; targetKind = storyState.kind;
      }
      if (mathematical) for (let j = 0; j < targets.length; j++) {
        acc[j] += spring * (mathTargets[j] - targets[j]);
        targets[j] = mathTargets[j];
      }
      // Keep all 2436 links, transmitting deviations around the structured moving rest shape.
      for (let l = 0; l < links.length; l += 2) for (let a = 0; a < 3; a++) {
        const i = links[l] + a, j = links[l + 1] + a;
        const f = effectiveNeighborSpring * ((positions[j] - targets[j]) - (positions[i] - targets[i]));
        acc[i] += f; acc[j] -= f;
      }
      // The observer parts the local shell during entry; the target remains a true hollow torus.
      let observer = performanceState.admittedGuitar > 0 ? storyLib.cameraAt(storyState,
        {time:t,beatPhase,guitarRelease:performanceState.release,guitarEntryBeat,transitionRotation,
          torusEntryBeat,torusTightBeat,torusExitBeat,hypercubeBeat,torusScale,rotation:shapeControls.rotation||0}) : null;
      if(observer && t>=183) {for(let j=0;j<positions.length;j+=3)worldPositions.set(motionLib.rotateY(positions.subarray(j,j+3),motionLib.globalAngle(storyState,beatPhase)),j);observer=motionLib.lateCamera(observer,worldPositions,t,performanceLib.END,storyLib.opening());}
      if(observer) observer={...observer,position:motionLib.rotateY(observer.position,-motionLib.globalAngle(storyState,beatPhase))};
      const observerSize = {intro:.42,cone:.48,plane:.26,torus:.52*torusScale,'torus-tight':.52*torusScale,mobius:.48,stairs:.34,hypercube:.36,finale:.42}[storyState.kind] || .48;
      const observerRadius = observerSize*Math.sqrt(3)/2 + .32;
      for (let j = 0; j < rest.length; j += 3) {
        for (let a = 0; a < 3; a++) { velocities[j + a] += acc[j + a] * dt; }
        const speed = Math.hypot(velocities[j], velocities[j + 1], velocities[j + 2]);
        if (speed > CONSTANTS.maxSpeed) for (let a = 0; a < 3; a++) velocities[j + a] *= CONSTANTS.maxSpeed / speed;
        for (let a = 0; a < 3; a++) positions[j + a] += velocities[j + a] * dt;
        if (observer) {
          const delta = [positions[j]-observer.position[0],positions[j+1]-observer.position[1],positions[j+2]-observer.position[2]];
          const distance = Math.hypot(...delta);
          if (distance < observerRadius) {
            const normal = distance > 1e-9 ? delta.map(x=>x/distance) : [0,1,0];
            const inward = velocities[j]*normal[0]+velocities[j+1]*normal[1]+velocities[j+2]*normal[2];
            for (let a=0;a<3;a++) {positions[j+a]=observer.position[a]+normal[a]*observerRadius;if(inward<0)velocities[j+a]-=inward*normal[a];}
          }
        }
        const dx = positions[j] - rest[j], dy = positions[j + 1] - rest[j + 1], dz = positions[j + 2] - rest[j + 2], d = Math.hypot(dx, dy, dz);
        if (d > CONSTANTS.maxDisplacement) {
          clampCount++; const k = CONSTANTS.maxDisplacement / d, outward = (velocities[j] * dx + velocities[j + 1] * dy + velocities[j + 2] * dz) / (d * d);
          for (let a = 0; a < 3; a++) {
            const delta = positions[j + a] - rest[j + a]; positions[j + a] = rest[j + a] + delta * k;
            if (outward > 0) velocities[j + a] -= outward * delta;
          }
        }
      }
      fieldRms = Object.fromEntries(TRACKS.map(n => [n, Math.sqrt(sums[n] / count)]));
    }
    function advanceTo(t) {
      if (!Number.isFinite(t) || t < 0) throw new Error('Nonnegative absolute song time required');
      const target = Math.floor(t * CONSTANTS.hz + 1e-8);
      if (target < step) reset();
      while (step < target) { step++; integrate(step / CONSTANTS.hz); }
      const hero = performanceLib.heroState(t, performanceState.admittedGuitar, synthMotion.beatPhase, synthMotion.amplitude);
      let cameraPose = storyLib.cameraAt(storyState, {time: t, beatPhase: synthMotion.beatPhase,
        guitarRelease: performanceState.release, guitarEntryBeat, transitionRotation, torusEntryBeat,torusTightBeat,torusExitBeat,hypercubeBeat,torusScale:performanceLib.torusScale(synthMotion.beatPhase,torusTightBeat),
        synthPitch: synthMotion.pitch, synthAmp: synthMotion.amplitude,
        flowPhase, rotation: shapeControls.rotation || 0}, shapeLib);
      const globalAngle=motionLib.globalAngle(storyState,synthMotion.beatPhase);
      for(let j=0;j<positions.length;j+=3) worldPositions.set(motionLib.rotateY(positions.subarray(j,j+3),globalAngle),j);
      // The draw camera and physics observer use the same registered world-space path.
      cameraPose=motionLib.lateCamera(cameraPose,worldPositions,t,performanceLib.END,storyLib.opening());
      const motion={globalAngle,cyclesPerQuarter:storyState.kind==='cone'?motionLib.coneRate(synthMotion.beatPhase,storyState.startBeat):0,unwrappedConePhase:motionLib.conePhase(synthMotion.beatPhase,chapter('cone').beat),note:noteMotion.state()};
      const cameraShake = section.phase==='melody-play' || t >= 187.2 || performanceState.admittedGuitar === 0 ? [0, 0, 0] : performanceLib.shake(t, !returnEnabled || section.authoredImpactTime===null ? (triggerTime===null ? -Infinity : triggerTime) : section.authoredImpactTime, -Infinity);
      for (let a = 0; a < 3; a++) { cameraPose.position[a] += cameraShake[a]; cameraPose.target[a] += cameraShake[a]; }
      return {time: step / CONSTANTS.hz, positions:worldPositions, internalPositions:positions, motion, rest, count, cameraPose, hero, section: {...section}, torusExitBeat,torusTightBeat,torusEntryBeat, introSolid: platonicState(), foreground: [],stars:hero.visible?[]:performanceState.stars, cameraShake, performance: {...performanceState, newGuitar: undefined}, story: {...storyState},
        terrainInput:{spectrum:shapeControls.spectrum,spectrumHistoryTimes:shapeControls.historyTimes||[]}, synthMotion: {...synthMotion}, kickLock: {anchorTime, triggered, triggerTime, beatCount, lastKickTime, orbitAngle}};
    }
    function platonicState() {return storyState.kind === 'intro' && !triggered && introSolid ? {...introSolid} : null;}
    function telemetry() {
      let displacement = 0, kinetic = 0, max = 0, anchorEnergy = 0;
      const min = [Infinity, Infinity, Infinity], boundsMax = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < rest.length; i += 3) {
        const d = Math.hypot(positions[i] - rest[i], positions[i + 1] - rest[i + 1], positions[i + 2] - rest[i + 2]);
        max = Math.max(max, d); displacement += d * d;
        for (let a = 0; a < 3; a++) { kinetic += velocities[i + a] ** 2; anchorEnergy += .5 * effectiveAnchorSpring * (positions[i + a] - targets[i + a]) ** 2;
          min[a] = Math.min(min[a], positions[i + a]); boundsMax[a] = Math.max(boundsMax[a], positions[i + a]); }
      }
      let neighborEnergy = 0;
      for (let l = 0; l < links.length; l += 2) for (let a = 0; a < 3; a++) {
        const i = links[l] + a, j = links[l + 1] + a;
        neighborEnergy += .5 * effectiveNeighborSpring * ((positions[j] - targets[j]) - (positions[i] - targets[i])) ** 2;
      }
      return {time: step / CONSTANTS.hz, step, count, springs: links.length / 2, drumHits, lastDrumAdmission,
        rmsDisplacement: Math.sqrt(displacement / count), maxDisplacement: max,
        energy: (.5 * kinetic + anchorEnergy + neighborEnergy) / count,
        kineticEnergy: .5 * kinetic / count,
        clampCount, fieldRms, amplitudes: Object.fromEntries(TRACKS.map(n => [n, controls[n].amp])),
        kickLock: {anchorTime, triggered, triggerTime, beatCount, lastKickTime, orbitAngle},
        synthMotion: {...synthMotion},
        performance: {...performanceState, newGuitar: undefined}, stars:performanceLib.heroState(step/CONSTANTS.hz,performanceState.admittedGuitar,synthMotion.beatPhase,synthMotion.amplitude).visible?[]:performanceState.stars,starPolicy:starsLib.policy,starCapacity:starsLib.CAPACITY,authoredSectionMapSchema:authored.schema,foregroundPolicy:performance.voicePolicy, foregroundCapacity:0,foregroundMaximumScheduled:0,foregroundOriginalMaximumScheduled:0,starPulseCapacity:performance.capacity,starMaximumScheduled:performance.maxActive,starOriginalMaximumScheduled:performance.originalMaximumScheduled,
        story: {...storyState}, section: {...section}, quietMix, motionBeat, shapeRotation, noteMotion:noteMotion.state(), returnExpansion:shapeControls.returnExpansion||0, introSolid: platonicState(),
        spectrumTime: spectrumIndex >= 0 ? spectrum.times[spectrumIndex] : 0,
        spectrumHistoryTimes: shapeControls.historyTimes || [],
        shape: {unfurl, helixPhase, extent: boundsMax.map((v, i) => v - min[i]), min, max: boundsMax},
        featureIndex: featureIndex(features.times, step / CONSTANTS.hz)};
    }
    function sampleFrame(i) {
      if (!Number.isInteger(i) || i < 0 || i >= CONSTANTS.frames) throw new Error('Full-song frame must be 0..4633');
      const t = CONSTANTS.start + i / CONSTANTS.fps;
      return {...advanceTo(t), time: t};
    }
    reset();
    return {rest, positions, velocities, count, advanceTo, sampleFrame, telemetry, reset};
  }
  return {TRACKS, CONSTANTS, FIELD_GAINS, featureIndex, cameraAt, createSimulation};
});
