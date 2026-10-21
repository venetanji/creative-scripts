# Original-B Procedural Source Fragments

These eight files are byte-preserved handwritten modules from the used
original-B shared WebGL renderer, not a newly invented approximation:

| File | Responsibility |
| --- | --- |
| `physics.js` | Fixed-step state, instrument/event admission, camera and deterministic sampling |
| `shapes.js` | Geometric families and morph targets |
| `motion.js` | Carried phase and own-axis motion |
| `performance.js` | Instanced body layout and musical articulation |
| `terrain.js` | Finite spectral-plane terrain extensions |
| `stars.js` | World-space star layout and illumination |
| `story.js` | Choreographic chapter state |
| `scene.js` | Three.js scene, camera/instances, shared-state RGB/depth/edge readbacks |

[`source-provenance.json`](../workflows/source-provenance.json) records their
hashes. The comments reflect historical source, not current authorization to
run a job. No code is automatically executed by importing this directory.

## Required External Inputs

This is **not a runnable renderer bundle**. The original host supplied Three.js
and data/scripts for the following interfaces, in dependency order:

- Original note events and held-note state (`events.js`).
- Prepared causal stem features and trailing spectrum (`features.js`,
  `spectrum.js`); these are large music-derived arrays, not small libraries.
- Integrated variable-tempo synth clock (`clock.js`), measured impact anchor
  (`anchor.js`), performance and section cues.
- Authored section map and the selected camera-lock snapshot, which encode
  artistic decisions beyond automatic music analysis.
- A browser host/export adapter to load those inputs, call the frame APIs,
  stream bounded raw images and encode the desired guide files.

The complete music-derived arrays, music/MIDI and chosen camera snapshot are
not redistributed. Their existence and input-building procedure are described
in [production](../PRODUCTION.md), but regenerating them is not implemented
as a portable one-command pipeline here. The original browser exporter also
depended on host-specific Playwright, sandbox mounts and runtime paths; it is
intentionally not copied as if portable. Install a compatible Three.js/browser
runtime separately under its own license.

## Registration Contract

Keep `evaluate(t)` and the shared view snapshot together. `renderViews` must
not advance simulation between beauty, depth and occluded-edge passes.
Preserve world-Y-up camera behavior, deterministic rewind, instance ordering,
input source time and the exact crop/pad policy. Do not replace original-B's
motion/camera with a newer isolated treatment and still claim pixel identity
with the production guide.

Useful focused checks when adapting this source: deterministic repeated and
out-of-order frame queries; causal feature availability; matching view and
projection matrices; hidden-edge occlusion; exact viewport/crop/pad; and
native-pixel guide/result comparisons. Matching durations alone is not a
registration test. The archived module syntax is checked offline; a new
browser's visual result requires its own inspection.
