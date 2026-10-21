# From Music To A Performing Geometric World

## 1. Begin With The Chosen Song, Not A New Generation

The source was an already selected [Pixel Dreams song](https://suno.com/s/HUieGydLjLxdRqAA),
supplied with the original mix, eleven audio stems and nine MIDI tracks.
The working mix was stereo PCM16, 48 kHz, 193.080 seconds. We did not generate
a new song or write lyrics as part of this video production.

The initial project YAML retained `suno.runs: 0`, TODO text and no scenes.
It was setup, not the executed film specification. The actual work became a
custom procedural-guide and graph-based production.

The visual brief was a mesmerizing, tangible voxel journey: let instruments
enter, perform and withdraw through geometry, while a persistent world evolves
around a continuous camera. The single cube at the beginning and end gives
the piece an identifiable object and a sense of return.

## 2. The Rejected Experiment Was A Useful Creative Test

An initial Blender corridor put musical notes along the travel axis. It
produced RGB/depth guide movies, but showed future notes before they sounded
and retained fallback architecture through musical rests. It read as flying
through a prewritten score, rather than watching the music animate a world.

The resulting change was conceptual, not just a renderer swap: geometry
must represent current held notes, attacks and releases. Three.js/WebGL,
instanced filled boxes and deterministic sampling made that iteration
practical. Blender is part of the experiment history, not the final guide
renderer. A world-Y-up camera also avoids the roll caused by a look-at
singularity in the earlier corridor.

## 3. Keep Three Clocks Distinct

**Musical score.** Integrate the actual MIDI tempo map: 480 PPQ and262 tempo
events, approximately89.03..92.48 BPM, not a guessed constant BPM. The drum
score required a measured +0.300-second offset against the mix. The synth
note alignment used a separate provisional +0.260-second offset and acoustic
gating; it was not certified note-perfect for the whole song.

**Causal response.** Held-note state, finite attack/release envelopes, stem
energy, measured onsets and trailing spectral history drive motion. Read only
feature rows available at the current source time. A detector's `availableAt`
cannot be backdated to the attack it later identifies.

**Offline choreography.** An authored section map can use the complete song
to plan a transformation before rendering. This is not a claim of live
prediction. For example, the authored bass-break boundary is130.430512s,
whereas the live sustained-rest detector confirms only at130.810s; the second
impact is authored at151.324s, while the combined live detector is available
at151.370s.

No supplied MIDI had an explicit time-signature or section-marker event.
The arrangement strongly supports4/4, but that meter remains inferred.
Invalid key-signature metadata was not used to claim a proven modulation.
The artist's first-chorus and coda labels were retained as artistic labels,
not represented as independent lyric or harmonic transcription.

## 4. Anchor Large Changes To Phrases

Being on a beat is insufficient if the new world arrives a bar late. The
eight-bar phrase origin was corrected to bar2/q4: a four-quarter shift of
the phrase grouping, not a different beat/downbeat phase. Bar1/q0 begins
at0.300s and is an inferred synth prelude; the guitar attack at2.930s remains
separate from the formal q4 grid at2.994299s.

| Original-song time (s) | Authored guide change |
| ---: | --- |
| 0 | Single close cube; synth-led orbit |
| 2.930 | Guitar-led breakup inside the opening chapter |
| 24.485 | Primary kick/bass impact and hollow cone |
| 45.869374 | Spectral landscape plane |
| 67.201359 | Large torus / first chorus |
| 88.415643 | Tighter torus / next phrase |
| 109.476427 | Mobius / coda change |
| 130.430512 | Moving stairs / bass-withdrawal break |
| 151.324 | Hypercube / full-band return and second impact |
| 172.173180 | Recollection / final phrase |
| 193.080 | Return to the single cube at the song endpoint |

These are **guide choreography times**, not exact semantic joins in the
generated film. Except for immediate measured impacts, geometry and camera
morphs begin at their section anchors and extend across four quarters
(one bar, roughly2.6 seconds). Starting the morph on the phrase boundary
feels different from finishing a short morph there.

## 5. Deterministic Geometry And Camera

The source simulation advances at a fixed120 Hz and is sampled into4,634
frames at24 fps. Preserve deterministic state, rewind behavior and event
admission when rendering frames out of order for review.

Different instruments have different roles: guitar-led cube-family breakup,
kick/bass impacts, synth-driven motion and stars, and trailing spectral
terrain are not one amplitude meter applied to everything. The world
progresses through faceted/rounded aggregates, cone, plane, torus, Mobius,
stairs and projected hypercube, then merges back to the initial cube.

Own-axis spin, collective rotation, note clock, camera and chapter timing
are separate controls. The used original-B treatment slowed structural flow
without slowing the song or moving chapter boundaries. Its local Y spin is
capped at0.25 cycles/quarter with opening-bar stillness. Integrated rate ramps
carry phase continuously instead of resetting an orientation when a rate
changes. The retained camera lock preserves the chosen path when geometry
changes would otherwise alter an automatic ending fit.

The final guide uses the **original-B** renderer lineage, not an unmodified
earlier V11 and not the later standalone fast-torus experiment. The plane's
finite horizon was extended using instanced terrain and trailing spectral
rows; tiling existing history was not described as extra measured history.
The stairs use viewpoint-dependent geometry, not proof of a physically
impossible object; the hypercube is a4D projection, not physical4D space.

Eight original-B algorithm/render modules are archived in
[`procedural/`](procedural/README.md). They deliberately exclude large
music-derived arrays and machine-specific exporters. They are source
fragments with an explicit input contract, not a runnable full renderer.

## 6. One Scene, Registered Control Views

Evaluate the simulation once, capture its camera/instance matrices, then
render RGB, mapped depth and geometric edges from that same snapshot. Do not
advance the simulation between passes, or redesign the torus/camera while
calling the new render merely a different guide channel.

- Use identical geometry, projection, frame clock, viewport and transforms.
- The edge pass uses depth-tested box edges, with hidden lines occluded.
  It is **not detector-derived Canny** and not an x-ray wire overlay, even
  though some historical task names used the word Canny.
- Depth is mapped8-bit grayscale with near/far0.1/90 and
  `(1 - z/40)^1.6`, clamped to the range. It is not metric depth,16-bit
  depth, or normalization independently recalculated on each frame.
- The original guide picture is960x540 inside960x576 (18 padded rows each
  side). Guide-only nearest scaling makes1280x720 inside1280x768 (24 rows
  each side). Crop/pad bookkeeping is part of the camera contract.
- Check deterministic repeated/out-of-order samples, actual occlusion and
  pixel agreement with the frozen RGB/depth reference. Test frame
  registration, not merely matching file durations.

Production compared every new RGB/depth readback to frozen original-B
hashes before reusing retained guides. This is evidence about that export,
not a guarantee that a newly installed browser will render identical pixels.

## 7. H3: Shape Control And Art Direction Are Separate

The main original-edge film used27 balanced source windows: ten171-frame
and seventeen172-frame windows, covering4,634 source pictures. H3 generated
175 native frames per window. Endpoint-preserving integer maps selected the
source-clock pictures rather than hiding the mismatch with an approximate
trim. Every job's source/sample bounds, native mapping and seed are retained
in [`base-film-frame-map.json`](workflows/base-film-frame-map.json).

The used recipe is native H3 FL2VA int8, FL8 LoRA strength1, Union2 edge
control0.8 for sampling fractions0..1, Euler/simple8, denoise1, video/audio
shifts12/3, and1280x768 at24 fps. Exact model names and links are in the
normalized [opening](workflows/h3-opening.api.json) and
[continuation](workflows/h3-edge-continuation.api.json) graphs.

The first chunk has no procedural RGB first-picture anchor. Each successor
inherits its own previous **actual generated uncropped native frame174**.
This is image chaining, not generated-video-history continuation. Keep
first-image anchoring distinct from Union strength. Verify generated frame0
and the first retained picture; do not drop frame0 on an assumed duplicate.

Use native structured prompts: picture-alignment preamble where applicable,
`integrated_multimodal_description`, `overall_soundscape`, and
`non_diegetic_music`. Describe the persistent pieces, concrete physical
transformation, camera/parallax, material evolution and sound relationship.
The actual27 prompts are in [`prompts/`](prompts/), indexed by the base-film
map. They describe a progression from amber/brass through cooler opal,
porcelain, metallic and glass worlds, then return to warmth.

Supplied song windows condition H3 through its audio guide. Conditioning-only
pitch-preserving tempo conversion and pad/trim match the native clock;
the final soundtrack is never that generated or retimed audio. Graph
wiring proves supplied-audio conditioning, not causal beat responsiveness
or exact preservation of every procedural cube.

## 8. Continuity Needs Motion, Not Just Matching Pictures

Single-image chaining inherits appearance and position but not necessarily
velocity. Later local repairs used actual incoming and outgoing22-frame
generated RGB clips, first/last pictures and the source-clock song. The
selected [124-frame repair graph](workflows/h3-transition-repair.api.json)
retains its middle78 source frames `[23,101)`.

Match camera heading, scale, parallax and speed before the outgoing guide,
not only on the final picture. Prompt bodily reconfiguration of persistent
pieces rather than replacement scenery. This improves the conditions for
continuity but does not guarantee it: a cone retry still introduced an entry
pop, and the latest staircase-entrance repair traded cyan tearing for a
material/sky difference and compressed turn.

Review matched native boundaries, dense nonperiodic samples and actual
playback. Periodic motion can look stationary in sparse contact sheets.
Trace defects through native H3, detail refinement, FILM and upscale at the
same global frame before deciding what to rerender.

## Experiments Versus Selected Production

The earlier depth-guided material exploration, low-depth trials, separate
centered-edge0.65 film, standalone fast-torus treatment, shortened control
schedule and H3 learned-upscaler/SeedVR2 studies remain experiments, not
settings silently applied to the selected original-edge0.8 film. The Plus
upscaler fork with no declared code license was not used; the separately
approved MIT upstream version was tested instead. Upscale evaluation data
and private comparisons are not redistributed here.

For selected detail refinement, temporal interpolation, exact restoration
of preferred footage, the final157-frame repair and audio-safe4K finishing,
continue with [FINISHING.md](FINISHING.md).
