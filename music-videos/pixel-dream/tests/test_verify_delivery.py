import copy
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
module = importlib.util.spec_from_file_location("verify_delivery", ROOT / "scripts/verify_delivery.py")
verify = importlib.util.module_from_spec(module)
module.loader.exec_module(verify)


def contract():
    return json.loads((ROOT / "workflows/final-delivery.json").read_text())


def synthetic_metadata(spec):
    video = dict(spec["delivery"]["video"], codec_type="video", width=3840, height=2160,
                 avg_frame_rate="48/1", r_frame_rate="48/1", duration_ts=2372608, start_pts=0)
    audio = dict(codec_type="audio", codec_name="aac", profile="LC", sample_rate="48000",
                 channels=2, channel_layout="stereo", time_base="1/48000", duration_ts=9268000,
                 start_pts=0, extradata_hash="SHA256:" + "a" * 64)
    frames = [{"pts": n * 256} for n in range(spec["timeline"]["frames"])]
    return {"streams": [video, audio]}, frames


class OfflineChecks(unittest.TestCase):
    def setUp(self):
        self.spec = contract()
        self.metadata, self.frames = synthetic_metadata(self.spec)

    def test_archival_edl(self):
        self.assertEqual(verify.validate_edl(self.spec)["outside_input_frames"], 9111)

    def test_gap_overlap_retime_and_path_escape_rejected(self):
        mutations = [
            lambda s: s["edits"][1]["output"].__setitem__(0, 6066),
            lambda s: s["edits"][1]["output"].__setitem__(0, 6064),
            lambda s: s["edits"][1]["source"].__setitem__(1, 156),
            lambda s: s["assets"]["master"].__setitem__("file", "../master.mp4"),
            lambda s: s["assets"]["master"].__setitem__("file", "/private/master.mp4"),
            lambda s: s["retained_input_proof"].__setitem__("outside_frames", 9110),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                spec = copy.deepcopy(self.spec)
                mutate(spec)
                with self.assertRaises(verify.VerificationError):
                    verify.validate_edl(spec)

    def test_pts_dimensions_rate_and_exact_audio_duration(self):
        verify.validate_metadata(self.metadata, self.frames, self.spec, "candidate_4k")
        mutations = [
            lambda m, f: f.pop(),
            lambda m, f: f[50].__setitem__("pts", f[49]["pts"]),
            lambda m, f: m["streams"][0].__setitem__("width", 1920),
            lambda m, f: m["streams"][0].__setitem__("avg_frame_rate", "48000/1001"),
            lambda m, f: m["streams"][1].__setitem__("duration_ts", 9267984),
            lambda m, f: m["streams"].append({"codec_type": "subtitle"}),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                metadata, frames = copy.deepcopy(self.metadata), copy.deepcopy(self.frames)
                mutate(metadata, frames)
                with self.assertRaises(verify.VerificationError):
                    verify.validate_metadata(metadata, frames, self.spec, "candidate_4k")

    def test_audio_payload_pts_and_padding_are_all_identity(self):
        packets = [{"pts": -1024, "dts": -1024, "duration": 1024, "size": "10",
                    "data_hash": "SHA256:" + "b" * 64,
                    "side_data_list": [{"side_data_type": "Skip Samples", "skip_samples": 1024,
                                        "discard_padding": 224}]}]
        verify.compare_audio(self.metadata, self.metadata, packets, packets, 1)
        for key, value in [("pts", 0), ("duration", 1008), ("data_hash", "SHA256:" + "c" * 64),
                           ("side_data_list", [{"discard_padding": 240}])]:
            changed = copy.deepcopy(packets)
            changed[0][key] = value
            with self.subTest(key=key), self.assertRaises(verify.VerificationError):
                verify.compare_audio(self.metadata, self.metadata, packets, changed, 1)
        changed_metadata = copy.deepcopy(self.metadata)
        changed_metadata["streams"][1]["extradata_hash"] = "SHA256:" + "d" * 64
        with self.assertRaises(verify.VerificationError):
            verify.compare_audio(self.metadata, changed_metadata, packets, packets, 1)

    def test_bounded_movie_header_parser(self):
        def box(kind, payload):
            return struct.pack(">I4s", len(payload) + 8, kind) + payload

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tiny.mp4"
            for version in (0, 1):
                prefix = bytes([version]) + bytes(11 if version == 0 else 19)
                moov = box(b"moov", box(b"mvhd", prefix + struct.pack(">I", 48000)))
                path.write_bytes(moov + box(b"mdat", b""))
                self.assertEqual(verify.inspect_mp4(path), {"movie_timescale": 48000, "faststart": True})
                path.write_bytes(box(b"mdat", b"") + moov)
                self.assertFalse(verify.inspect_mp4(path)["faststart"])
            path.write_bytes(struct.pack(">I4s", 1000, b"moov"))
            with self.assertRaises(verify.VerificationError):
                verify.inspect_mp4(path)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "optional local FFmpeg tools")
class TinyMediaChecks(unittest.TestCase):
    def test_fractional_movie_timescale_and_lossless_remux(self):
        """Four frames only; never decodes or modifies production media."""
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source, rounded, repaired = [directory / name for name in ("source.mp4", "rounded.mp4", "fixed.mp4")]

            def ff(*args):
                subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-n", *map(str, args)],
                               check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

            ff("-f", "lavfi", "-i", "color=c=black:s=16x16:r=48", "-f", "lavfi", "-i",
               "anullsrc=r=48000:cl=stereo", "-frames:v", "4", "-af", "atrim=end_sample=4000",
               "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac",
               "-video_track_timescale", "12288", "-movie_timescale", "48000", "-movflags", "+faststart", source)
            ff("-i", source, "-c", "copy", "-movie_timescale", "1000", "-movflags", "+faststart", rounded)
            ff("-i", rounded, "-i", source, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy",
               "-video_track_timescale", "12288", "-movie_timescale", "48000", "-movflags", "+faststart", repaired)
            original_info, rounded_info, repaired_info = [verify.metadata(p) for p in (source, rounded, repaired)]
            original_packets, rounded_packets, repaired_packets = [verify.audio_packets(p) for p in (source, rounded, repaired)]
            self.assertEqual(verify.one_stream(original_info, "audio")["duration_ts"], 4000)
            self.assertEqual(verify.one_stream(rounded_info, "audio")["duration_ts"], 3984)
            self.assertEqual(verify.inspect_mp4(rounded)["movie_timescale"], 1000)
            self.assertEqual(verify.inspect_mp4(repaired), {"movie_timescale": 48000, "faststart": True})
            self.assertEqual([p["data_hash"] for p in original_packets], [p["data_hash"] for p in rounded_packets])
            with self.assertRaises(verify.VerificationError):
                verify.compare_audio(original_info, rounded_info, original_packets, rounded_packets, len(original_packets))
            verify.compare_audio(original_info, repaired_info, original_packets, repaired_packets, len(original_packets))
            frames = verify.probe(repaired, "-select_streams", "v:0", "-show_frames",
                                  "-show_entries", "frame=pts")["frames"]
            self.assertEqual([f["pts"] for f in frames], [0, 256, 512, 768])


if __name__ == "__main__":
    unittest.main()
