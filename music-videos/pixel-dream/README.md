# Pixel Dream / Pixel Dreams

A song-driven journey through tangible, voxel-built geometry: a single cube
breaks into a performing world, moves through cone, plane, torus, Mobius strip,
stairs and hypercube, then returns to a single cube. The intended feeling is
continuous, organic and dreamlike transformation, rather than a sequence of
unrelated AI shots.

[![Watch Pixel Dreams on YouTube](https://i.ytimg.com/vi/2aDa_EmED8g/hqdefault.jpg)](https://www.youtube.com/watch?v=2aDa_EmED8g)

**[Watch Pixel Dreams - Giovanni Lion](https://www.youtube.com/watch?v=2aDa_EmED8g)**

GitHub sanitizes iframe embeds in Markdown, so the linked thumbnail is the
repository-compatible embed. The supplied YouTube link is the showcase; a
YouTube transcode is not claimed to match a local file hash.

## What This Project Contains

This is a production case study and a collection of source recipes, **not** a
`music_video.py all` YAML. The early `song.yaml` was an unfinished scaffold;
the delivered film was made with a procedural guide renderer, explicit ComfyUI
graphs, frame-selected assembly and a separate finishing pass. It would be
misleading to publish that scaffold as the executable production workflow.

| Document / source | Purpose |
| --- | --- |
| [Production](PRODUCTION.md) | Musical clock, choreography, registered guides, H3 generation and continuity lessons |
| [Finishing](FINISHING.md) | Detail refinement, interpolation, localized repairs, original-audio preservation and 4K delivery |
| [Workflows](workflows/README.md) | Actual graph recipes with portable asset names and explicit preparation requirements |
| [Provenance](PROVENANCE.md) | What is retained, what was normalized, dependencies and reproducibility limits |
| [Procedural source](procedural/README.md) | Eight original-B geometry/render modules with an explicit external-input contract |
| [Production prompts](prompts/) | All27 structured H3 prompts, indexed by the retained base-film map |

## Pipeline At A Glance

```text
supplied full mix + stems + MIDI
  -> measured alignment + variable-tempo musical clock
  -> phrase-locked geometry / deterministic physics / authored camera
  -> registered RGB + mapped-depth / edge guides from one WebGL scene
  -> native H3 guided generation and motion-context transition repairs
  -> selected LTX-2.5 detail refinement, where used
  -> FILM 24 -> 48 fps + explicit frame selection / lossless banks
  -> immutable 720p48 edit + localized replacement
  -> NVIDIA native 3x upscale -> 3840x2160 / 48 fps delivery
  -> untouched original soundtrack + full decode / timing / boundary review
```

The latest locally documented export is **9,268 frames, 48 fps,
193.083333 seconds**, H.264/yuv420p at 3840x2160. It is an upscale of the
1280x720 edit, not native 4K generation. The original song is 193.080 seconds;
the frame-aligned picture/soundtrack endpoint includes 160 terminal zero
samples at 48 kHz. The original 720p edit is retained separately.

## Lessons Worth Reusing

- Compose transformations on musical **phrases**, not just arbitrary beats.
  Keep measured attacks distinct from the formal score grid.
- Make geometry perform the **current** notes. A tunnel showing future notes
  down its length reads as a score visualization, not a living landscape.
- Render color, depth and edge control with identical camera, geometry,
  transforms and timestamps. An independently redesigned guide changes the
  creative treatment, not merely the control channel.
- Use actual neighboring generated frames and motion context for joins.
  A correct endpoint image does not guarantee matching velocity or geometry.
- Diagnose defects at matched times through native generation, detail,
  interpolation and upscale; repair the first bad stage, not automatically
  the final enhancer.
- Preserve accepted footage and the original audio. Change explicit frame
  ranges, then verify unchanged inputs outside them independently.
- Technical completion, visual continuity and artistic acceptance are
  separate outcomes. Keep a useful candidate and state its remaining defects.

## Scope And Dependencies

The reusable graph/model foundation is
[`venetanji/creative-skills`](https://github.com/venetanji/creative-skills).
This directory records the project-specific composition rather than copying
the graph library or claiming these experimental graphs are exposed through
every Easel API/client or orchestration command.

Source music, stems, MIDI, guide movies, generated banks, model weights and
licensed SDK binaries are **not bundled**. Supply assets you are entitled to
use, install the appropriate dependencies separately, and validate the live
node schemas before any submission. No workflow here downloads weights,
accepts licenses, starts GPU jobs or changes services automatically.

The most recent transition repair reduces the cyan-wall tearing but retains
an entrance material/sky change and a compressed turn. The earlier cone-entry
pop is a separate issue. The case study does not certify a seamless film or
claim that a delivery checklist establishes the artist's acceptance.
