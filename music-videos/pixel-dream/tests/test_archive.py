"""Offline integrity checks for the retained source and normalized recipes."""

import hashlib
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / "workflows"


def load(name):
    return json.loads((WORKFLOWS / name).read_text())


def endpoint_map(index, count_from, count_to):
    # Integer half-up, including both endpoints; avoids Python's ties-to-even.
    return (2 * index * (count_to - 1) + count_from - 1) // (2 * (count_from - 1))


class ArchiveChecks(unittest.TestCase):
    def test_retained_source_and_normalized_graph_hashes(self):
        for item in load("source-provenance.json")["files"]:
            with self.subTest(file=item["file"]):
                self.assertEqual(hashlib.sha256((ROOT / item["file"]).read_bytes()).hexdigest(),
                                 item["sha256"])
        for item in load("graph-provenance.json")["graphs"]:
            with self.subTest(file=item["file"]):
                self.assertEqual(hashlib.sha256((WORKFLOWS / item["file"]).read_bytes()).hexdigest(),
                                 item["normalized_sha256"])

    def test_api_graph_links_and_portable_bindings(self):
        graphs = list(WORKFLOWS.glob("*.api.json"))
        self.assertEqual(len(graphs), 6)
        bindings = {"LoadImage": "image", "LoadVideo": "file", "LoadAudio": "audio"}
        for path in graphs:
            graph = json.loads(path.read_text())
            for node_id, node in graph.items():
                with self.subTest(graph=path.name, node=node_id):
                    self.assertIsInstance(node["class_type"], str)
                    for value in node["inputs"].values():
                        if (isinstance(value, list) and len(value) == 2
                                and isinstance(value[0], str) and type(value[1]) is int):
                            self.assertIn(value[0], graph)
                            self.assertGreaterEqual(value[1], 0)
                    key = bindings.get(node["class_type"])
                    if key:
                        value = node["inputs"][key]
                        self.assertTrue(value.startswith("pixel-dream/"))
                        self.assertNotIn("..", Path(value).parts)
                        self.assertFalse(Path(value).is_absolute())

    def test_base_film_partition_native_maps_and_audio_clock(self):
        spec = load("base-film-frame-map.json")
        jobs = spec["jobs"]
        self.assertEqual(len(jobs), 27)
        self.assertEqual(sum(j["source_frames"] == 171 for j in jobs), 10)
        self.assertEqual(sum(j["source_frames"] == 172 for j in jobs), 17)
        cursor = 0
        for number, job in enumerate(jobs, 1):
            with self.subTest(shot=number):
                self.assertEqual(job["id"], number)
                self.assertEqual(job["source_start"], cursor)
                source_n = job["source_frames"]
                self.assertEqual(job["source_end"] - cursor, source_n)
                self.assertEqual(job["native_frames"], 175)
                self.assertEqual(job["sample_start"], cursor * 2000)
                self.assertEqual(job["sample_end"], min(job["source_end"] * 2000,
                                 spec["original_song_samples_per_channel"]))
                self.assertEqual(job["native_to_source"],
                                 [endpoint_map(i, 175, source_n) for i in range(175)])
                self.assertEqual(job["delivery_to_native"],
                                 [endpoint_map(i, source_n, 175) for i in range(source_n)])
                self.assertTrue((ROOT / "prompts" / f"{number:02d}.txt").is_file())
                cursor = job["source_end"]
        self.assertEqual(cursor, spec["source_frames"])
        self.assertEqual(spec["audio_samples_per_channel"], cursor * 2000)
        self.assertEqual(spec["audio_samples_per_channel"]
                         - spec["original_song_samples_per_channel"], 160)

    def test_used_recipes_remain_distinct(self):
        opening = load("h3-opening.api.json")
        successor = load("h3-edge-continuation.api.json")
        repair = load("h3-transition-repair.api.json")
        self.assertNotIn("first_frame", opening["6"]["inputs"])
        self.assertIn("first_frame", successor["6"]["inputs"])
        self.assertEqual(successor["21"]["inputs"]["strength"], 0.8)
        self.assertEqual(successor["8"]["inputs"]["noise_seed"],
                         load("base-film-frame-map.json")["jobs"][1]["seed"])
        self.assertEqual(successor["6"]["inputs"]["prompt"],
                         (ROOT / "prompts/02.txt").read_text())
        self.assertEqual(repair["6"]["inputs"]["length"], 124)
        self.assertEqual(repair["30"]["inputs"]["frame_idx"], 101)
        self.assertNotIn("MiniMaxH3FunControlNetApply",
                         {node["class_type"] for node in repair.values()})
        for name, length, retained in [("ltx-detail-full-shot.api.json", 177, 175),
                                      ("ltx-detail-refinement.api.json", 129, 124)]:
            graph = load(name)
            self.assertEqual(graph["14"]["inputs"]["length"], length)
            self.assertEqual(graph["21"]["inputs"]["num_frames"], retained)
        self.assertEqual(load("film-2x.api.json")["4"]["inputs"]["multiplier"], 2)


if __name__ == "__main__":
    unittest.main()
