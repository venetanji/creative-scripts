# Pixel Dream Workflows

These are normalized **ComfyUI API prompt dictionaries**, not frontend canvas
exports. Use a compatible API-graph importer or your own reviewed transport.
They are not an end-to-end runner. Reading or validating these files is
offline; execution requires separately supplied assets, licensed models,
matching custom nodes, available resources and an explicitly selected local
backend. Do not infer GPU feasibility from a registered node's numeric limits.

## Retained Executed Recipes

| File | Role | Important distinction |
| --- | --- | --- |
| [h3-opening.api.json](h3-opening.api.json) | Actual first shot with registered edge and music guides, but no beauty-RGB starting picture | Avoids baking procedural RGB appearance into the generated film |
| [h3-edge-continuation.api.json](h3-edge-continuation.api.json) | Actual shot02, Union edge0.8 and previous generated native174 first-picture anchor | Single-image chaining plus control video, not generated-video-history continuation |
| [h3-transition-repair.api.json](h3-transition-repair.api.json) | Selected 124-frame H3 transition rerender, actual neighboring picture/motion guides and original-song conditioning | This is the selected recovery, not the rejected 175-frame attempt; no additional detail resynthesis was applied to this repair |
| [ltx-detail-refinement.api.json](ltx-detail-refinement.api.json) | Representative executed LTX-2.5 IC-LoRA detail pass used on an earlier span | It belongs before FILM; it is not the final NVIDIA upscale and not the selected repair's generation graph |
| [ltx-detail-full-shot.api.json](ltx-detail-full-shot.api.json) | Actual full-shot detail refinement with177 model frames and175 retained frames | Distinct from the shorter129/124 local detail window |
| [film-2x.api.json](film-2x.api.json) | Actual FILM model, multiplier 2, PNG-frame output | Interpolated odd frames need their own selection; original/even-frame preservation must be checked |
| [final-delivery.json](final-delivery.json) | Full-film clock, patch EDL and final export specification | Archival assembly specification, **not** an executable ComfyUI graph |
| [base-film-frame-map.json](base-film-frame-map.json) | All27 original edge0.8 shots: source/native indices, selections, seeds and conditioning-audio clocks | Base-film timing only; later locally selected replacements are separate |

## Base-Film Guide And Clock

The continuation graph retains the actual shot02 execution, including its
structured prompt and seed. The first picture must be the preceding shot's
uncropped generated native frame174. No generated frame0 was discarded on the
assumption that it was a duplicate. Union control is separate from that
first-picture conditioning; it uses the entire registered edge-video guide at
strength0.8 over sampling fractions0..1.

The175-frame H3 clock is not the same as each source-song window. The retained
base-film map gives both `native_to_source` and `delivery_to_native` arrays,
not an approximate seconds-based trim. The conditioning audio used a
pitch-preserving `atempo` conversion for the native window and bounded
pad/trim; that conversion applies **only to model conditioning**. It never
retimes the final soundtrack. Preserve each shot's recorded sample bounds
and map, rather than using one constant conversion for the whole film.
The final source-audio bound stops at the real song's9,267,840 samples;
the160 terminal zeros belong to the later full-film picture/audio clock,
not an extension of the supplied original song.

[graph-provenance.json](graph-provenance.json) records original source hashes,
normalized hashes and every changed asset/prefix field. Model names, prompts,
seeds, links and sampling settings remain those of the executed graphs. Input
basenames and output prefixes were replaced to remove machine- and task-local
bindings. These recipes are therefore not byte-identical execution receipts.

## Prepare The Selected Transition Repair

All indices are zero-based, end-exclusive. The full-frame coordinate system is
24 fps before FILM and 48 fps afterward.

1. Extract the existing generated 24 fps context `[3010,3134)`: 124 frames.
   Use actual selected generated imagery, not the neutral procedural guide.
2. Create `pixel-dream/repair/first.png` from context frame 0 and `last.png`
   from frame 123. The incoming motion clip is `[1,23)` (22 frames); outgoing
   motion is `[101,123)` (22 frames). Both belong to this same context.
3. H3 consumes a padded 1280x768 picture. The production preparation kept the
   1280x720 image centered with 24 pixels above/below; output selection crops
   `1280:720:0:24`. Verify padding/cropping against actual asset pixels, rather
   than resizing the image and changing its camera framing.
4. Supply `song-window.wav` on that same source clock, with the production
   context-padding policy and no audio retime. The native graph conditions on
   that audio; its generated audio is **not** substituted for the master song.
5. Keep native output `[23,101)` (78 frames) for global24 `[3033,3111)`.
   This graph's seed is `202610181036`; generation is 124 frames at 24 fps,
   Euler/simple, 8 steps, shifts video12/audio3, FL8 LoRA strength1.
6. Insert the selected frames into their unchanged neighboring 24 fps
   context, then interpolate across both boundaries. The delivered replacement
   includes 157 frames at global48 `[6065,6222)`, not merely the 156 even/odd
   frames that start at 6066: frame6065 bridges the old preceding frame into
   the new generated frame. See [finishing](../FINISHING.md).

Do not submit this recipe until the external guide assets are prepared and
their clocks match. The long structured prompt contains picture alignment,
continuous physical transformation, camera/parallax, soundscape and supplied
music sections. Read the actual prompt rather than replacing it with a short
style slogan.

## Prepare The Detail Passes

The executed graph takes a 129-frame, 1280x736 prepared source window and
sample-aligned audio. The extra rows/frames are model input preparation, not
permission to extend the edit. It uses the LTX-2.5 distilled transformer,
refine-details IC-LoRA, video/audio VAEs, Gemma encoder, Euler with the explicit
manual sigma schedule, tiled fusion and a tiled decode. The graph crops
1280x720 at y8 and retains the first124 frames. Do not substitute H3's temporal
rules or VAE here; the model families have different layouts.

The full-shot graph records the separate main-production preparation:
crop H3's175 native pictures to1280x720, pad eight rows above/below to736,
then append two copies of native174 to satisfy LTX's177-frame (`8k+1`)
layout. Temporal fusion uses97-frame tiles; after decode/crop, retain175
pictures and apply the original source/native map. The padding is never
added to the delivered edit. The129/124 graph above is a shorter local
detail span, not the whole-film temporal recipe.

## Prepare FILM Windows

The representative graph consumes a lossless RGB video window and writes
interpolated images with `film_net_fp16.safetensors`. Production bounded
windowing kept real neighboring frames for interpolation; frame banking and
selection happened outside this small graph. Keep shared overlap only once,
confirm originals at even positions, and select only newly computed odd
midpoints for the global frame map. Merely concatenating every window's
complete output duplicates context and changes timing.
Across the complete4,634-picture24fps bank,4,633 source intervals yield
9,267 pictures after2x interpolation. Add **one** final endpoint hold to
reach9,268 pictures at48fps; never add a terminal hold to every chunk.

## Archive, Not A Turnkey Regeneration Promise

The public recipes omit local scheduler/resource locks, credentials, endpoint
addresses, execution identifiers and private logs. On a shared backend, use
the site's existing queue/ownership and disk/VRAM controls, durable submission
records and terminal-history reconciliation; never blindly retry an uncertain
POST. This archive does not grant permission to bypass those controls.

No NVIDIA runtime, proprietary implementation, benchmark or comparative
evaluation is redistributed. The final SDK configuration and stream/audio
contract are documented in [FINISHING.md](../FINISHING.md); install and accept
any applicable dependencies independently.
