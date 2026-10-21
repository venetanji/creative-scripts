(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PixelShapes = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COUNT = 925, TAU = Math.PI * 2;
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, finite(v)));
  function controls(c = {}) {
    return {beat: Number.isFinite(c.motionBeat) ? c.motionBeat : finite(c.beatPhase), pitch: c.synthPitch == null ? null : finite(c.synthPitch, 60),
      synth: clamp(c.synthAmp, 0, 1), bass: clamp(c.bassAmp, 0, 1), kick: clamp(c.kickPulse, 0, 1),
      flow: .5*finite(c.flowPhase), rotation: .5*finite(c.rotation), scale: Number.isFinite(c.torusScale) ? c.torusScale : 1, torusEntryProgress: finite(c.torusEntryProgress, 100), quiet: clamp(c.quietMix,0,1), expansion: clamp(c.returnExpansion,0,.5), spectrum: c.spectrum || null};
  }
  function rotateY(p, angle) {
    const co = Math.cos(angle), si = Math.sin(angle);
    return [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]];
  }
  function normalize(a) { const d = Math.hypot(...a); return a.map(x => x / d); }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a, b) { return a.reduce((s, x, i) => s + x*b[i], 0); }
  function sub(a, b) { return a.map((x, i) => x-b[i]); }
  function mix(a, b, t) { return a.map((x, i) => x+(b[i]-x)*t); }
  function mobiusPoint(u, v, radius = 5) {
    return [(radius + v*Math.cos(u/2))*Math.cos(u), v*Math.sin(u/2),
      (radius + v*Math.cos(u/2))*Math.sin(u)];
  }
  function hypercubeGraph() {
    const vertices = Array.from({length: 16}, (_, i) => Array.from({length: 4}, (_, d) => (i & (1 << d)) ? 1 : -1));
    const edges = [];
    for (let i = 0; i < 16; i++) for (let d = 0; d < 4; d++) if (!(i & (1 << d))) edges.push([i, i | (1 << d)]);
    return {vertices, edges};
  }
  const GRAPH = hypercubeGraph();
  function rotate4(p, a, b, angle) {
    const x = p[a], y = p[b], co = Math.cos(angle), si = Math.sin(angle);
    p[a] = x*co-y*si; p[b] = x*si+y*co;
  }
  function projectHypercube(input = {}) {
    const c = controls(input), pitch = c.pitch == null ? 0 : (c.pitch-60)/12;
    const angles = {xy: c.rotation + c.beat*TAU/64, xw: c.beat*TAU/48 + pitch*.24*c.synth,
      yz: c.beat*TAU/96 + c.bass*.4};
    const distance4 = 4.5, scale = 3.1 + c.kick*.15;
    let minimumDenominator = Infinity;
    const vertices = GRAPH.vertices.map(v => {
      const p = v.slice(); rotate4(p, 0, 1, angles.xy); rotate4(p, 0, 3, angles.xw); rotate4(p, 1, 2, angles.yz);
      const denominator = distance4-p[3]; minimumDenominator = Math.min(minimumDenominator, denominator);
      return p.slice(0, 3).map(x => x*scale*distance4/denominator);
    });
    return {vertices, edges: GRAPH.edges.map(e => e.slice()), angles, distance4, minimumDenominator};
  }
  const STAIR_CAMERA = {position: [10, 12, 16], target: [0, 0, 0], up: [0, 1, 0],
    fov: 48, width: 640, height: 360, locked: true};
  function cameraBasis(camera) {
    const forward = normalize(sub(camera.target, camera.position));
    const right = normalize(cross(forward, camera.up)), up = cross(right, forward);
    return {forward, right, up, tangent: Math.tan(camera.fov*Math.PI/360), aspect: camera.width/camera.height};
  }
  const STAIR_BASIS = cameraBasis(STAIR_CAMERA);
  const STAIR_CORNERS = [[-.56, -.08], [-.05, -.40], [.56, .08], [.05, .40], [-.56, -.08]];
  function stairScreen(t) {
    const u = clamp(t, 0, 1)*4, edge = Math.min(3, Math.floor(u)), fraction = u-edge;
    return mix(STAIR_CORNERS[edge], STAIR_CORNERS[edge+1], fraction);
  }
  function stairRayPoint(screen, y) {
    const b = STAIR_BASIS;
    const ray = b.forward.map((x, i) => x + b.right[i]*screen[0]*b.tangent*b.aspect + b.up[i]*screen[1]*b.tangent);
    const depth = (y-STAIR_CAMERA.position[1])/ray[1];
    return ray.map((x, i) => STAIR_CAMERA.position[i]+x*depth);
  }
  function stairLoopPoint(t, input = {}) {
    const c = controls(input), rise = 6 + .6*c.synth, lift = .10*c.kick;
    return stairRayPoint(stairScreen(t), -rise/2 + rise*t + lift);
  }
  function projectPoint(p, camera = STAIR_CAMERA) {
    const b = cameraBasis(camera), relative = sub(p, camera.position), depth = dot(relative, b.forward);
    const ndc = [dot(relative, b.right)/(depth*b.tangent*b.aspect), dot(relative, b.up)/(depth*b.tangent)];
    return {ndc, pixel: [(ndc[0]+1)*camera.width/2, (1-ndc[1])*camera.height/2], depth};
  }
  function nearestSpectrum(spectrum, pitch) {
    if (!spectrum || !spectrum.pitches || !spectrum.values) return 0;
    let closest = Infinity, value = 0;
    const n = Math.min(spectrum.pitches.length, spectrum.values.length);
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(spectrum.pitches[j])) continue;
      const distance = Math.abs(spectrum.pitches[j]-pitch);
      if (distance < closest) { closest = distance; value = clamp(spectrum.values[j], 0, 1); }
    }
    return value;
  }
  function cameraHint(kind, input = {}) {
    const c = controls({...input,flowPhase:2*finite(input.flowPhase),rotation:2*finite(input.rotation)});
    if (kind === 'stairs') return {position: [10, 4, 10], target: [0, 0, 0], up: [0, 1, 0], preset: 'continuous-climbing-spiral-helix', locked: false};
    if (kind === 'torus' || kind === 'tunnel') {
      const angle = c.flow-c.rotation;
      return {position: [0, 0, 0], target: [6*Math.cos(angle), 0, 6*Math.sin(angle)], up: [0, 1, 0],
        preset: 'central-hole-looking-at-flow-section', minimumCenterClearance: 4};
    }
    if (kind === 'plane') return {position: [10, 13, 14], target: [0, .6, 0], up: [0, 1, 0]};
    return {position: [12, 9, 15], target: [0, 0, 0], up: [0, 1, 0]};
  }
  function fillTargets(kind, rest, target, input = {}) {
    if (!(rest instanceof Float64Array) || !(target instanceof Float64Array) || rest.length !== COUNT*3 || target.length !== COUNT*3)
      throw new TypeError('rest and target must be Float64Array(2775)');
    if (rest === target || (rest.buffer === target.buffer && rest.byteOffset < target.byteOffset+target.byteLength && target.byteOffset < rest.byteOffset+rest.byteLength))
      throw new TypeError('target must not overlap immutable rest');
    const c = controls(input), supported = ['cone', 'plane', 'torus', 'tunnel', 'mobius', 'stairs', 'hypercube'];
    if (!supported.includes(kind)) throw new RangeError('Unsupported PixelShapes kind: '+kind);
    const projected = kind === 'hypercube' ? projectHypercube(input) : null;
    const spectrumColumns = kind === 'plane' ? Array.from({length: 30}, (_, x) => nearestSpectrum(c.spectrum, 24 + 84*x/29)) : null;
    const history = kind === 'plane' && c.spectrum && c.spectrum.history;
    const historyColumns = history ? Array.from({length: 30}, (_, row) => {
      const values = history[Math.min(row, history.length - 1)];
      return Array.from({length: 30}, (_, x) => nearestSpectrum({pitches: c.spectrum.pitches, values}, 36 + 60*x/29));
    }) : null;
    const coneHeight = 6 + 3*(c.pitch == null ? .5 : clamp((c.pitch-36)/60, 0, 1));
    const minorRadius = 1.6+.4*c.bass;
    let maxRadius = 0;
    for (let i = 0; i < COUNT; i++) {
      let p;
      if (kind === 'cone') {
        const row = Math.floor(i/25), column = i%25, h = row/36;
        const angle = TAU*column/25 + TAU*3*h;
        const radius = (3+3*h)*(1+.055*c.kick);
        p = [radius*Math.cos(angle), (h-.5)*coneHeight, radius*Math.sin(angle)];
      } else if (kind === 'plane') {
        const x = i < 900 ? i%30 : Math.round((i-900)*29/24), z = i < 900 ? Math.floor(i/30) : 30;
        const rowGain = z === 29 ? 1 : .65+.35*Math.cos((29-z)*.32 - c.beat*TAU/4);
        const height = historyColumns ? historyColumns[Math.min(z, 29)][x] : spectrumColumns[x]*rowGain;
        p = [-15+30*x/29, 3.5*height, -15+30*z/29];
      } else if (kind === 'torus' || kind === 'tunnel') {
        const u = TAU*Math.floor(i/25)/37 + c.flow;
        const twist = TAU*(i%25)/25 + 3*u + .35*c.synth;
        // A hollow toroidal shell leaves its centerline clear for the traveling camera.
        const radial = 6 + minorRadius*Math.cos(twist);
        p = [radial*Math.cos(u)*c.scale, minorRadius*Math.sin(twist)*c.scale, radial*Math.sin(u)*c.scale];
      } else if (kind === 'mobius') {
        const u = TAU*Math.floor(i/5)/185 + c.flow;
        const v = (i%5-2)*(.85+.1*c.synth)*(1-.35*c.quiet);
        // Do not wrap u modulo 2pi: the second lap reverses the strip's transverse coordinate.
        p = mobiusPoint(u, v, 5+1.5*c.quiet);
      } else if (kind === 'stairs') {
        // Five radial cubes form each connected tread: a tall bounded helix, no recycling.
        const step=Math.floor(i/5),across=i%5-2;
        const angle=TAU*step/72+c.rotation*.15;
        const radius=5+across*.34;
        p=[radius*Math.cos(angle),(step-92)*.16,radius*Math.sin(angle)];
      } else {
        const edge = Math.floor(i*32/COUNT), start = Math.ceil(edge*COUNT/32), end = Math.ceil((edge+1)*COUNT/32);
        const local = i-start, n = end-start, t = local/(n-1), e = projected.edges[edge];
        const a = projected.vertices[e[0]], b = projected.vertices[e[1]], dir = normalize(sub(b, a));
        const reference = Math.abs(dir[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
        const normal = normalize(cross(dir, reference)), offset = local === 0 || local === n-1 ? 0 : (local%3-1)*.11;
        p = mix(a, b, t).map((x, axis) => x+normal[axis]*offset);
      }
      if (kind !== 'stairs' && kind !== 'hypercube') p = rotateY(p, c.rotation);
      if(kind==='hypercube' && c.expansion>0)p=p.map(x=>x*(1+c.expansion));
      target.set(p, i*3); maxRadius = Math.max(maxRadius, Math.hypot(...p));
    }
    return {kind, count: COUNT, maxRadius, deterministic: true, camera: cameraHint(kind, input),
      ...(kind === 'cone' ? {height: coneHeight, radii: [3, 6], hollow: true} : {}),
      ...(kind === 'plane' ? {grid: [30, 30], edgeCount: 25, pitchRange: history ? [36, 96] : [24, 108], spectrumMode: history ? 'causal-rolling-spectrum-history' : 'current-row-only'} : {}),
      ...(kind === 'torus' || kind === 'tunnel' ? {majorRadius: 6*c.scale, minorRadius: minorRadius*c.scale, worldScale: c.scale, topology: 'hollow-three-turn-toroidal-shell'} : {}),
      ...(kind === 'mobius' ? {topology: 'half-twist-strip', transportPeriod: 4*Math.PI} : {}),
      ...(kind === 'stairs' ? {steps: 185, rise:.16, stepsPerTurn:72, topology: 'continuous-climbing-spiral-helix', cameraLocked: false} : {}),
      ...(projected ? {vertices4: 16, edges4: 32, minimumDenominator: projected.minimumDenominator,
        angles4: projected.angles, topology: 'tesseract-perspective-projection'} : {})};
  }
  return {COUNT, fillTargets, cameraHint, mobiusPoint, hypercubeGraph, projectHypercube, stairLoopPoint, projectPoint};
});
