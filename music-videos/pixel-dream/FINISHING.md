# Pixel Dream: Finishing Without Moving The Song

This is the finishing recipe for the retained **repair candidate**, not a claim
that every transition is seamless or that the candidate received creative
acceptance. The supplied public viewing reference is
[Pixel Dream on YouTube](https://www.youtube.com/watch?v=2aDa_EmED8g).
YouTube transcodes uploads; neither that link nor these notes establish which
local file was uploaded, or a byte-hash match to its streams.

[`workflows/final-delivery.json`](workflows/final-delivery.json) is a portable
**archival edit decision list (EDL) and validation contract**, not a ComfyUI
import graph, executable GPU workflow, or bundled media package. Asset names
are relative placeholders: supply your own licensed local files. No model
weights, SDK binaries, proprietary implementation, or private evaluation
reports are distributed here.

## 1. Keep One Frame Clock And An Immutable Master

The finished timeline is **9,268 frames at 48/1 fps**, exactly `9268/48` seconds
(`193.083333...`), with 48 kHz stereo soundtrack. Every video presentation
timestamp is `n/48`, beginning at zero. Use integer, zero-based, half-open frame
ranges throughout; do not drive an edit from rounded decimal seconds.

Preserve the selected 1280x720 master before further work. Its lossless H.264
YUV420p encoding makes decoded-frame preservation meaningful; a lossy viewing
copy cannot serve as that proof. File identity and decoded RGB identity are
different checks, and a colorspace conversion needs a fixed, explicit recipe.

| Retained local artifact | SHA-256 |
| --- | --- |
| Preservation master | `ed692a54164b3348d70fa265e5022398dbd5f640c299dca32ea6b30dffa1b64f` |
| Selected 157-frame lossless patch | `d4665364c1935675524c0177baf8a12bd3d65e9abf3cfe4e544529be24a76c26` |
| 3840x2160 repair candidate | `08af4f279bfbdda9aae9419c4317c77a8689223bfc7cf932b1bbc2146aaf3a70` |

These hashes identify retained local artifacts only; media is not included in
the repository. The full-film review copy is a lossy downscale of the actual
4K candidate, not an input-identity witness.

## 2. Diagnose At Matched Pixels, Then Repair Locally

The production chain was native H3 generation, selected LTX detail passes,
FILM 24-to-48 fps interpolation, local patch selection, then the final 3x
upscale. Do not apply every stage blindly to every repair: the selected new
H3 repair explicitly **skipped detail resynthesis**.

For the conspicuous cyan-wall tear around 2:08, compare the native H3, detail,
FILM and upscale outputs at the same global clock and crop. The original
native H3 contains stretching/tearing at source-24 frames 3069..3075, and a
broad cyan/glass sheet at 3087..3090. Detail changes texture; subsequent stages
inherit the underlying structure. The deformation was **not introduced by
NVIDIA**. A mismatched crop or H3's uncropped padding can confound this test.

The bounded repair used two native attempts. A 175-frame attempt reset the
view abruptly and was rejected before interpolation/upscale. The selected
124-frame recovery reused the original guide topology, two adjacent generated
motion guides, original-song conditioning and seed `202610181036`, with a
solid copper/ivory/cyan geometry prompt. Crop native 1280x768 output to
1280x720 at `x=0,y=24`; retain native frames `[23,101)` as the 78 replacements
for global source-24 `[3033,3111)`. Prompt edits did not guarantee a seamless
entrance or unchanged material.

## 3. Interpolate With Explicit Frame Ownership

FILM 2x consumes 17 source frames per window and produces 33 frames. Advance
the source by 16 frames, retain 32 output roles per window, and leave the
shared endpoint to the next window. Six windows cover the 192-frame review
at global-48 `[6048,6240)`, or 126..130 seconds. Restore the cropped native
source images at **even** roles; use generated FILM images at **odd** roles.
Interpolation must not silently reconstruct the original frames as well.

Replacing source-24 `[3033,3111)` requires final-48 **`[6065,6222)`**, exactly
157 frames. The preceding odd frame 6065 bridges original source 3032 and new
source 3033; keeping the old odd frame would interpolate into pixels that no
longer exist. The last odd frame 6221 bridges new source 3110 and original
source 3111. Frame 6222 itself remains original.

The final input EDL is deliberately small:

| Output frames at 48 fps | Source | Source frames |
| --- | --- | --- |
| `[0,6065)` | Unchanged preservation master | `[0,6065)` |
| `[6065,6222)` | Selected lossless repair | `[0,157)` |
| `[6222,9268)` | Unchanged preservation master | `[6222,9268)` |

An independent decode of the immutable master verified all **9,111 outside
input RGB frames**, not merely equality to a production bank assumed to
represent that master. All 157 repair input frames matched the selected
lossless patch. The outside-input RGB stream digest was
`1a973f2776ea4370358cc56535cf5e8cc6b669dce58f39513a3a3da606f0cb27`;
the patch-input RGB stream digest was
`7cd1bbdc8bdf0916985bd647789a9dae8c56f185310a7977da2508119f6da0e8`.
Those are RGB24 stream digests in frame order under the retained conversion
recipe, not container hashes. They prove **upscale input selection**, not
identity of the intentionally altered 4K output. Re-encoding to lossy H.264
also precludes output-pixel identity claims.

## 4. Use The Selected Licensed Upscale Configuration

The retained export used the already available NVIDIA VFX SDK 0.2.0.0
VideoSuperRes configuration: `HIGHBITRATE_ULTRA`, strength `1.0`, `RGB8`,
native 3x from 1280x720 to 3840x2160. One effect consumed the assembled
9,268-frame sequence in order, with no arbitrary effect resets at chunks or
patch boundaries. Decode, select, process and encode as a bounded stream;
retain the input selection ledger independently of the encoder.

This describes a selected process configuration, not a redistribution or a
general SDK integration. Acquire and use licensed dependencies through their
owners and comply with the applicable evaluation/use terms. This repository
contains no SDK implementation and authorizes no new inference or evaluation.

Other bounded explorations included conventional Lanczos resizing, native
SeedVR2 processing, and the upstream H3 learned latent upscaler. They are
separate exploratory treatments, not additional stages in the selected
export or performance/quality rankings. In particular, the H3 exploration
encoded finished RGB into the native VAE, applied learned latent upscale,
then decoded; it did not reuse original generation latents. Its repaired
integration used the upstream direct Comfy LATENT contract without external
normalization conversions.

The selected export encoded H.264 with `libx264`, **CRF 17**, preset `medium`,
`yuv420p`, square pixels and explicit SDR BT.709 limited-range tags. The video
track timescale was 12288 (256 ticks per 48 fps frame). MP4 faststart places
`moov` before `mdat`. These are delivery choices, not proof of extra authentic
scene detail or of seamless motion.

## 5. Preserve AAC Packets, Including Their Edges

Copy the original soundtrack, rather than re-encoding, normalizing, retiming
or crossfading it. Compare **all 9,052 AAC packets**: payload hashes, order,
PTS, DTS, durations, and skip/discard-padding side data. Check the stream's
time base and exact duration too; matching payload alone is insufficient.

The retained audio has 9,268,000 samples per channel on its 48 kHz clock.
Its established original-song timeline includes 160 terminal zero samples;
that is distinct from AAC codec padding. The first packet starts at -1024
with 1024 skipped priming samples. The last packet has PTS 9,267,200,
duration 800 and discard padding 224. Preserve those values by copying the
source audio; do not synthesize a new AAC tail to fit a decimal duration.

The initial MP4 used a **1000 Hz movie timescale**. Although payloads and PTS
matched, rounding shortened the audio by **16 samples** and changed final
discard padding from 224 to 240. A **lossless remux** with the untouched
original AAC and **48000 Hz movie timescale** restored exact duration and
padding. No upscale or encoder rerun was needed. Movie timescale and video
track timescale are separate settings.

For an equivalent repair on your own local inputs (not run by the verifier):

```sh
ffmpeg -nostdin -n -i candidate-before-remux.mp4 -i master48.mp4 \
  -map 0:v:0 -map 1:a:0 -c copy -video_track_timescale 12288 \
  -movie_timescale 48000 -movflags +faststart candidate-fixed.mp4
```

Use a new output filename, then recheck every packet and decoded timestamp.
Avoid `-shortest`, decimal trim durations, or an audio encoder in this step.
An optional short viewing excerpt had re-encoded audio and is not the audio
identity reference for either full-film deliverable.

## 6. Separate Technical QC From Creative Acceptance

The retained 4K candidate and compact full-film review passed full A/V decode,
frame count/rate/dimensions, exact `n/48` video PTS, original AAC packet and
padding identity, and faststart inspection. Representative final images
included both patch boundaries, the cone and the preferred centered staircase.
No new letterbox or H3 padding was visible. These historical checks are not
automatically re-run when this documentation is read.

The selected patch reduces the severe torn cyan sheet, but **ivory material
shift, earlier cool sky, a detectable entrance difference and compressed
camera turn remain**. The earlier cone entry pop at approximately **28.583333
seconds** is retained, not repaired by the finishing pass. The preferred
restored staircase around 151 seconds is also retained as master input.
Inspect motion and native-resolution crops, not only downscaled panels;
low frame-difference metrics can reward smoothing rather than fidelity.
Technical completion is not creative acceptance.

### Portable Offline Checks

The stdlib-only [`scripts/verify_delivery.py`](scripts/verify_delivery.py)
validates the EDL without media or external tools by default:

```sh
python3 music-videos/pixel-dream/scripts/verify_delivery.py
python3 -m unittest discover -s music-videos/pixel-dream/tests -v
```

With local files, opt into read-only FFprobe inspection and source AAC
comparison. FFprobe's per-frame timing check decodes the video stream; expect
it to read the full file. Add `--full-decode` only when a new full A/V decoder
pass is appropriate, and `--check-sha256` only for the exact archived files.

```sh
python3 music-videos/pixel-dream/scripts/verify_delivery.py \
  repaired-candidate4k48.mp4 --source-audio-from master48.mp4
python3 music-videos/pixel-dream/scripts/verify_delivery.py \
  review720p48.mp4 --profile review_720p --source-audio-from master48.mp4 \
  --full-decode
```

The script prints JSON to stdout, does not overwrite media or write a report,
and makes no network, GPU, inference or submission calls. FFprobe is needed
only for media inspection; FFmpeg is needed only for `--full-decode`.
MP4 movie timescale and top-level faststart atoms are read directly. Without
`--source-audio-from`, audio identity is explicitly **not checked**. The
script does not recreate the historical input-RGB ledger, prove source-song
PCM identity from an AAC copy, or judge visual/creative acceptance. Reuse
retained proof for unchanged media; do not repeat large decodes merely to
exercise the validator.
