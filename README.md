# creative-scripts

Music-video specs (YAMLs) as authored, ready to run through the [`creative-skills`](https://github.com/venetanji/creative-skills) `music-video` orchestrator. Each YAML is a complete self-contained recipe: song description for suno, per-scene video prompts, anchor types, camera-LoRA choices, crossfade settings.

## The scripts

| file | length | theme | notes |
|---|---|---|---|
| [`harbor-lights.yaml`](harbor-lights.yaml) | ~2:00 | folk noir, dawn harbour, corgi on pier | 16:9 landscape, 12 scenes, image-chain anchors |
| [`belly-of-the-whale.yaml`](belly-of-the-whale.yaml) | ~3:00 | shoegaze, hero's journey underwater | 9:16 portrait, 15 scenes, per-scene flux2 anchors (`t2i` / `i2i` / `i2i2` / `angles`) |
| [`stranger-at-the-drafting-table.yaml`](stranger-at-the-drafting-table.yaml) | ~1:40 | acoustic shoegaze, end-of-session reflection | 9:16 portrait, 8 scenes, `t2i` + `i2i` + `i2i2` mix |

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

All other references in the YAMLs are self-contained.

## Adapting a script

The YAML schema is documented in the `music-video` skill — tl;dr:

- **`style`** — producer-style text-to-music brief (instruments, BPM, mood, narrative sentence). No artist names (suno filters them).
- **`lyrics`** — with `[Verse]`, `[Chorus]`, `[Bridge]`, `[Instrumental]` tags on their own lines.
- **`video.resolution`** — `[width, height]`. LTX-2.3 handles 9:16 (e.g. `[576, 1024]`) as well as 16:9.
- **`video.crossfade`** — seconds of ffmpeg xfade between scenes; `0` for hard cuts. Set `0` if you're on a memory-constrained host — 15-input xfade at 2K can OOM a 4 GB box.
- **`video.camera_lora_strength`** — default 0.8; reduce to 0.6–0.7 if camera LoRAs are overpowering the scene prompt.
- **`scenes[]`** — each scene has `label`, `start_sec`, `duration_sec`, `prompt`, `camera_lora` (optional), and an `anchor:` block (`t2i` / `i2i` / `i2i2` / `angles`). Scene durations should stay at or below 20s — LTX OOMs past that at portrait resolutions.
- **Timing** — the scene durations don't have to match the generated song length exactly; if scenes are shorter than the song, the assembler pads the tail with a frozen last frame; if longer, it trims. Run `music_video.py plan <yaml>` after `song` to see the mismatch before committing GPU time.

## License

MIT.
