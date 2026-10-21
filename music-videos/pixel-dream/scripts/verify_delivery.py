#!/usr/bin/env python3
"""Read-only local EDL/media checks. No inference, network, or report-file writes."""

import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys


DEFAULT_EDL = Path(__file__).resolve().parents[1] / "workflows/final-delivery.json"


class VerificationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def integer(value):
    return type(value) is int


def interval(value):
    return (isinstance(value, list) and len(value) == 2
            and all(integer(x) for x in value) and 0 <= value[0] < value[1])


def validate_edl(spec):
    require(spec["schema"] == "pixel-dream-archival-edl-v1", "unsupported EDL schema")
    require(spec["kind"] == "archival_edl_and_validation_contract"
            and spec["not_a_comfyui_import_graph"] is True, "not an archival EDL")
    timeline = spec["timeline"]
    n, fps = timeline["frames"], Fraction(timeline["fps"])
    require(integer(n) and n > 0 and fps > 0, "invalid frame count/rate")
    require(timeline["indexing"] == "zero_based_half_open", "unsupported indexing")
    require(Fraction(timeline["duration"]) == n / fps, "timeline duration mismatch")
    for asset in spec["assets"].values():
        name = Path(asset["file"])
        require(not name.is_absolute() and ".." not in name.parts,
                "asset names must be portable relative paths")
        require(integer(asset["frames"]) and asset["frames"] > 0, "invalid asset frames")
        require(re.fullmatch(r"[0-9a-f]{64}", asset["sha256"]), "invalid asset hash")
    cursor = 0
    for edit in spec["edits"]:
        out, source = edit["output"], edit["source"]
        require(interval(out) and interval(source), "invalid half-open edit")
        require(out[0] == cursor, "EDL gap or overlap")
        require(out[1] - out[0] == source[1] - source[0], "EDL retime not allowed")
        asset = spec["assets"][edit["asset"]]
        require(source[1] <= asset["frames"], "source interval exceeds asset")
        cursor = out[1]
    require(cursor == n, "EDL does not cover timeline")
    lo, hi = spec["repair"]["changed_final_48"]
    native_lo, native_hi = spec["repair"]["changed_source_24"]
    require(0 < lo < hi < n and lo == 2 * native_lo - 1 and hi == 2 * native_hi,
            "repair must include both interpolation bridges")
    require(spec["edits"] == [
        {"output": [0, lo], "asset": "master", "source": [0, lo]},
        {"output": [lo, hi], "asset": "repair", "source": [0, hi - lo]},
        {"output": [hi, n], "asset": "master", "source": [hi, n]},
    ], "unexpected master/repair selection")
    require(spec["assets"]["master"]["frames"] == n
            and spec["assets"]["repair"]["frames"] == hi - lo, "asset count mismatch")
    proof = spec["retained_input_proof"]
    require(proof["outside_frames"] == n - (hi - lo)
            and proof["patch_frames"] == hi - lo, "input proof count mismatch")
    audio = spec["delivery"]["audio"]
    require(Fraction(audio["duration_samples"], audio["sample_rate"]) == n / fps,
            "audio/video clocks differ")
    return {"frames": n, "fps": str(fps), "patch_frames": hi - lo,
            "outside_input_frames": proof["outside_frames"]}


def one_stream(metadata, kind):
    streams = [s for s in metadata["streams"] if s.get("codec_type") == kind]
    require(len(streams) == 1, "expected exactly one " + kind + " stream")
    return streams[0]


def validate_metadata(metadata, frames, spec, profile):
    delivery, timeline = spec["delivery"], spec["timeline"]
    video, audio = one_stream(metadata, "video"), one_stream(metadata, "audio")
    require(len(metadata["streams"]) == 2, "unexpected additional streams")
    for key, value in delivery["video"].items():
        require(video.get(key) == value, "video field mismatch: " + key)
    require([video["width"], video["height"]] == delivery["profiles"][profile]["dimensions"],
            "video dimensions mismatch")
    fps, n = Fraction(timeline["fps"]), timeline["frames"]
    require(Fraction(video["avg_frame_rate"]) == Fraction(video["r_frame_rate"]) == fps,
            "video frame rate mismatch")
    tb = Fraction(video["time_base"])
    require(int(video["duration_ts"]) * tb == n / fps, "video duration mismatch")
    require(int(video["start_pts"]) == 0, "video does not start at zero")
    require(len(frames) == n, "decoded video frame count mismatch")
    for i, frame in enumerate(frames):
        require(int(frame["pts"]) * tb == i / fps, "video PTS mismatch at frame " + str(i))
    for key in ("codec_name", "channels", "channel_layout", "time_base"):
        require(audio.get(key) == delivery["audio"][key], "audio field mismatch: " + key)
    require(int(audio["sample_rate"]) == delivery["audio"]["sample_rate"],
            "audio sample rate mismatch")
    require(int(audio["duration_ts"]) * Fraction(audio["time_base"])
            == Fraction(delivery["audio"]["duration_samples"], delivery["audio"]["sample_rate"]),
            "audio duration/padding mismatch")
    require(int(audio["start_pts"]) == 0, "audio does not start at zero")


def compare_audio(source_metadata, metadata, source_packets, packets, expected_count):
    original, actual = one_stream(source_metadata, "audio"), one_stream(metadata, "audio")
    for key in ("codec_name", "profile", "sample_rate", "channels", "channel_layout",
                "time_base", "start_pts", "duration_ts", "initial_padding", "trailing_padding",
                "extradata_hash"):
        require(original.get(key) == actual.get(key), "source AAC field mismatch: " + key)
    require(bool(original.get("extradata_hash")), "missing AAC extradata hash")
    require(len(source_packets) == len(packets) == expected_count, "AAC packet count mismatch")
    require(expected_count > 0, "empty audio packet list")
    for i, (left, right) in enumerate(zip(source_packets, packets)):
        for packet in (left, right):
            require(all(k in packet for k in ("pts", "dts", "duration", "size", "data_hash")),
                    "incomplete AAC packet metadata")
            require(re.fullmatch(r"SHA256:[0-9a-f]{64}", packet["data_hash"]),
                    "missing AAC packet payload hash")
        require(left == right, "AAC payload/timing/padding mismatch at packet " + str(i))


def atoms(handle, start, end):
    """Walk bounded ISO-BMFF boxes, skipping media payloads without decoding."""
    position = start
    while position < end:
        require(end - position >= 8, "truncated MP4 box header")
        handle.seek(position)
        size, kind = struct.unpack(">I4s", handle.read(8))
        header = 8
        if size == 1:
            require(end - position >= 16, "truncated extended box header")
            size, = struct.unpack(">Q", handle.read(8))
            header = 16
        elif size == 0:
            size = end - position
        require(header <= size <= end - position, "invalid MP4 box size")
        yield kind, position, position + header, position + size
        position += size


def inspect_mp4(path):
    with path.open("rb") as handle:
        top = list(atoms(handle, 0, path.stat().st_size))
        moov = [box for box in top if box[0] == b"moov"]
        mdat = [box for box in top if box[0] == b"mdat"]
        require(len(moov) == 1 and mdat, "expected MP4 movie and media boxes")
        mvhd = [box for box in atoms(handle, moov[0][2], moov[0][3]) if box[0] == b"mvhd"]
        require(len(mvhd) == 1, "missing or duplicate movie header")
        _, _, payload, end = mvhd[0]
        handle.seek(payload)
        version = handle.read(1)
        require(version in (b"\x00", b"\x01"), "unsupported movie header version")
        offset = 12 if version == b"\x00" else 20
        require(payload + offset + 4 <= end, "truncated movie timescale")
        handle.seek(payload + offset)
        timescale, = struct.unpack(">I", handle.read(4))
    return {"movie_timescale": timescale, "faststart": moov[0][1] < mdat[0][1]}


def local_file(value):
    path = Path(value).expanduser().resolve(strict=True)
    require(path.is_file(), "expected a local regular file")
    return path


def run(command):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, timeout=1800).stdout


def probe(path, *options):
    return json.loads(run(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe",
                           *options, "-of", "json", str(path)]))


def metadata(path):
    return probe(path, "-show_streams", "-show_data_hash", "sha256")


def audio_packets(path):
    return probe(path, "-select_streams", "a:0", "-show_packets", "-show_data_hash", "sha256",
                 "-show_entries", "packet=pts,dts,duration,size,data_hash,side_data_list")["packets"]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media", nargs="?", help="local MP4; omit to check only the archival EDL")
    parser.add_argument("--edl", type=Path, default=DEFAULT_EDL)
    parser.add_argument("--profile", choices=("candidate_4k", "review_720p"), default="candidate_4k")
    parser.add_argument("--source-audio-from", help="local preservation master for AAC identity")
    parser.add_argument("--check-sha256", action="store_true", help="require exact archived file hashes")
    parser.add_argument("--full-decode", action="store_true", help="also decode all A/V with FFmpeg")
    args = parser.parse_args(argv)
    if not args.media and (args.source_audio_from or args.check_sha256 or args.full_decode):
        parser.error("media is required for source audio, SHA-256 or decode checks")
    try:
        spec = json.loads(args.edl.read_text())
        report = {"edl": validate_edl(spec), "read_only": True,
                  "input_rgb_proof": "historical, not recomputed", "creative_acceptance": "not checked"}
        if args.media:
            path = local_file(args.media)
            info = metadata(path)
            frames = probe(path, "-select_streams", "v:0", "-show_frames",
                           "-show_entries", "frame=pts")["frames"]
            validate_metadata(info, frames, spec, args.profile)
            container = inspect_mp4(path)
            for key in ("movie_timescale", "faststart"):
                require(container[key] == spec["delivery"][key], "MP4 field mismatch: " + key)
            report.update(media_checks="passed", container=container,
                          audio_identity="not checked (no source supplied)", full_av_decode=False)
            if args.source_audio_from:
                source = local_file(args.source_audio_from)
                compare_audio(metadata(source), info, audio_packets(source), audio_packets(path),
                              spec["delivery"]["audio"]["packet_count"])
                report["audio_identity"] = "all source AAC packets, timing, extradata and padding match"
                if args.check_sha256:
                    require(sha256(source) == spec["assets"]["master"]["sha256"], "master hash mismatch")
            if args.check_sha256:
                require(sha256(path) == spec["delivery"]["profiles"][args.profile]["sha256"],
                        "delivery hash mismatch")
                report["archived_file_hashes"] = "passed for supplied media/source"
            if args.full_decode:
                run(["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-hwaccel", "none",
                     "-protocol_whitelist", "file,pipe", "-i", str(path), "-map", "0:v:0",
                     "-map", "0:a:0", "-f", "null", "-"])
                report["full_av_decode"] = True
        else:
            report["media_checks"] = "not requested"
        print(json.dumps(report, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError, IndexError, ZeroDivisionError,
            subprocess.SubprocessError) as error:
        print(json.dumps({"status": "failed", "error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
