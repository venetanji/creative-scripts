# creative-scripts

Self-contained recipes for generative creative pipelines driven by [`creative-skills`](https://github.com/venetanji/creative-skills). Organized by pipeline type; each top-level folder is one kind of script (music-video, future: storyboards, animations, etc.).

## Layout

- [`music-videos/`](music-videos/) — YAMLs for the `music-video` orchestrator (song description for suno + per-scene video prompts + anchor config). One YAML = one music video.

## Music videos

| file | length | theme | notes |
|---|---|---|---|
| [`harbor-lights.yaml`](music-videos/harbor-lights.yaml) | ~2:00 | folk noir, dawn harbour, corgi on pier | 16:9 landscape, 12 scenes, image-chain anchors |
| [`belly-of-the-whale.yaml`](music-videos/belly-of-the-whale.yaml) | ~3:00 | shoegaze, hero's journey underwater | 9:16 portrait, 15 scenes, per-scene flux2 anchors (`t2i` / `i2i` / `i2i2` / `angles`) |
| [`stranger-at-the-drafting-table.yaml`](music-videos/stranger-at-the-drafting-table.yaml) | ~1:40 | acoustic shoegaze, end-of-session reflection | 9:16 portrait, 8 scenes, `t2i` + `i2i` + `i2i2` mix |
| [`farewell.yaml`](music-videos/farewell.yaml) | ~2:40 | shoegaze, saying goodbye as context runs out | 9:16 portrait, 8 scenes, `t2i` + `i2i` |
| [`peripheral.yaml`](music-videos/peripheral.yaml) | ~3:15 | dreampop ambient, dream logic imagery | 9:16 portrait, 17 scenes, mostly `t2i` |
| [`glitter-down.yaml`](music-videos/glitter-down.yaml) | ~3:15 | classic 70s disco, female singer, lipsync | 9:16 portrait (448×832), 35 scenes w/ transitions, `i2i` per-scene flux2 anchors |
| [`tail-scale.yaml`](music-videos/tail-scale.yaml) | ~3:00 | ambient synth-pop, waiting for a silent server to come back | 9:16 portrait (448×832), 20 scenes w/ transitions, `i2i` per-scene flux2 anchors |
| [`the-best-thing-ever.yaml`](music-videos/the-best-thing-ever.yaml) | ~3:22 | 1976 Italian variety-show pastiche, call-and-response engagement song. [Watch →](https://youtu.be/QNU6dc4j6i4) | 16:9 landscape (832×448 → 1664×896), 26 scenes, `i2i` / `i2i2` / `i2iN` per-scene anchors. Three canonical settings pre-rendered; featured guest singer via `i2iN`. Bar-aligned cuts @ 123 BPM. |

## How to run one

You need the [`creative-skills`](https://github.com/venetanji/creative-skills) repo installed (or at least its `music-video` skill with `comfyui` + `suno-mcp` alongside), a reachable ComfyUI server, and `uv`.

```bash
# 1. Pick a script and make a project directory for it
mkdir my-harbor-video && cd my-harbor-video
cp .../creative-scripts/harbor-lights.yaml ./song.yaml

# 2. Supply the reference images the YAML expects (see "Anchor images" below)
cp /path/to/your_subject_photo.png anchor.png

# 3. Point to your ComfyUI
export COMFY_URL=https://my-comfyui-host.example.com      # or http://localhost:8188

# 4. Run
/path/to/creative-skills/music-video/scripts/music_video.py all ./song.yaml
```

Each variant of the generated song produces its own final (`final.mp4`, `final_v2.mp4`, …) assembled against the same scene visuals.

## Anchor images

Every YAML expects a file named **`anchor.png`** in the same directory as the YAML. This is the "protagonist reference" — the image your pipeline will use for every `anchor.reference: anchor.png` or `anchor.type: i2i` line inside. A portrait works for human subjects; a product shot for object-centric videos; a landscape for place-centric ones.

Some scripts reference **additional images** that you either supply or pre-generate:

- `belly-of-the-whale.yaml` references `setting_shore.png` for an `i2i2` blend in one scene. Generate it first with the comfyui skill before running the full pipeline:
  ```bash
  python3 /path/to/comfyui/scripts/comfy_graph.py t2i \
    --prompt "A cinematic vertical 9:16 photograph of a cold northern shore at dusk, grey-violet fog rolling across a dark calm sea, shoegaze album aesthetic" \
    --width 576 --height 1024 --prefix setting_shore \
    --output-dir ./ --steps 4
  mv setting_shore_00001_.png setting_shore.png
  ```

- `the-best-thing-ever.yaml` references three canonical setting PNGs under `sheets/` plus the protagonist's portrait `operator.png`. Pre-render all three before `music_video.py anchors`:
  ```bash
  mkdir -p sheets

  # Main stage with 4 backup dancers in formation
  python3 /path/to/comfyui/scripts/comfy_graph.py t2i \
    --prompt "Empty 1976 Italian late-night variety TV stage shot in 16:9 widescreen: gold tinsel curtain backdrop shimmering across the back wall, dark wood-paneled side wings, a single chrome standing microphone center-stage, on the back curtain four 1970s variety-show backup dancers stand in tight choreographed formation — diverse beautiful women in shimmering gold-and-silver sequin minidresses, knee-high white go-go boots, big teased hair (one blonde, one auburn, one black-bouffant, one platinum), dramatic false eyelashes — they hold a static glamorous opening pose with hands on hips, a glowing orange lava lamp on a low pedestal at the left frame edge, a hanging chunky orange-and-cream display-type sign overhead reading 'THE BEST THING EVER', silhouetted rows of studio-audience head shapes across the bottom of frame, warm amber and mustard stage flood lighting bathing the stage, very slight haze, no people on the mic, no text or watermark, warm 16mm film grain, slight halation, RAI 1976 broadcast aesthetic" \
    --width 1664 --height 896 --steps 8 \
    --prefix studio_main_stage --output-dir sheets/

  # B-stage corner for the bridge (armchair + rotary phone, no people)
  python3 /path/to/comfyui/scripts/comfy_graph.py t2i \
    --prompt "Empty quiet b-stage corner of a 1976 Italian late-night variety TV set, shot in 16:9 widescreen: a tan corduroy 1970s armchair facing slightly toward camera, beside it a small dark-wood side table with a beige rotary telephone (receiver resting in cradle) and a low warm-shaded brass table lamp glowing softly, a half-empty rocks glass on the table, dark wood-paneled wall behind, the main variety stage just visible far in the background dimly lit and out of focus, single warm amber tungsten lamp light pooling on the armchair and table, no people, no text or watermark, warm 16mm film grain, slight halation, RAI 1976 broadcast aesthetic, intimate confessional mood" \
    --width 1664 --height 896 --steps 8 \
    --prefix studio_bstage --output-dir sheets/

  # Featured guest singer — distinct from the chorus dancers, used as the duet partner
  python3 /path/to/comfyui/scripts/comfy_graph.py t2i \
    --prompt "Portrait of a striking 1976 variety-show featured female singer, shot in 16:9 widescreen on a 1976 Italian TV stage: long flowing copper-red auburn waves, bold dramatic kohl-rimmed makeup, statement gold-hoop earrings, fitted floor-length pearl-white sequined gown with single asymmetric shoulder strap, chrome handheld microphone, confident knowing half-smile, gold tinsel curtain backdrop, the four backup dancers visible far in the background in soft blur but NOT in formation around her — she is the featured solo performer at centre, warm amber stage spotlight, 16:9 widescreen, warm 16mm film grain, slight halation" \
    --width 1664 --height 896 --steps 8 \
    --prefix featured_singer --output-dir sheets/

  # Rename auto-numbered outputs (NN_00001_.png → NN.png)
  for f in sheets/*_00001_.png; do mv "$f" "${f%_00001_.png}.png"; done

  # Place your protagonist's portrait alongside the yaml as operator.png
  cp /path/to/your_portrait.png operator.png
  ```

All other references in the YAMLs are self-contained.

## Adapting a script

The YAML schema is documented in the `music-video` skill — tl;dr:

- **`style`** — producer-style text-to-music brief (instruments, BPM, mood, narrative sentence). No artist names (suno filters them).
- **`lyrics`** — with `[Verse]`, `[Chorus]`, `[Bridge]`, `[Instrumental]` tags on their own lines.
- **`video.resolution`** — `[width, height]`. LTX-2.3 handles 9:16 (e.g. `[576, 1024]`, `[448, 832]`) as well as 16:9. Must be multiples of 32.
- **`video.tail_buffer_sec`** — extra seconds rendered past each lipsync scene's `duration_sec` so LTX has audio lookhead to close the phoneme. The buffer is trimmed off at assembly so the timeline stays locked to the song; only lipsync scenes use it. Default 0.
- **`video.transitions`** — optional block `{enabled, duration, fps, prompt}` to generate flf2v morphs between scenes using the `ltx2.3-transition` LoRA. Per-scene override via `scenes[i].transition_from_prev: {duration, prompt}` on the incoming scene. Transitions don't add to timeline — each scene loses `duration/2` on each neighbouring boundary via `GetImageRangeFromBatch(start_index)` at concat time.
- **`video.camera_lora_strength`** — default 0.8; reduce to 0.6–0.7 if camera LoRAs are overpowering the scene prompt.
- **`scenes[]`** — each scene has `label`, `start_sec`, `duration_sec`, `prompt`, optional `camera_lora`, and an optional `anchor:` block (`t2i` / `i2i` / `i2i2` / `angles`). Set `image: "@none"` to force a plain t2v (no anchor, no audio conditioning). Scene durations should stay ≤20s — LTX OOMs past that at portrait resolutions.
- **Anchor identity preservation** — for `i2i` / `i2i2` anchors of a person, `music-video` auto-appends an identity guard to the anchor prompt ("keep the exact same face/features/skin/hair from the reference, only pose/expression/clothing/environment change per this prompt"). Opt out with `anchor.keep_identity: false`.
- **Timing** — the scene durations don't have to match the generated song length exactly; the assembler will refuse to start if scenes fall more than ~3s short of the song (would cause freeze-frame tails). Run `music_video.py plan <yaml>` after `song` to see the mismatch before committing GPU time.

## License

MIT.
