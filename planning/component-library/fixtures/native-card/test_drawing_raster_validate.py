"""Synthetic data-custody guards; none executes UIKit or proves a drawing result."""
from pathlib import Path
import copy
import json
import tempfile
import unittest

from drawing_raster_validate import HEIGHT, WIDTH, analyze


def fixture(root):
    data = bytearray(WIDTH * HEIGHT * 4)
    row = bytes([224, 232, 240, 255]) * 360
    for y in range(72, 312):
        start = (y * WIDTH + 72) * 4
        data[start:start + len(row)] = row
    value = {"profile": "solid-circular", "mode": "authored", "control": "plain",
        "nativeFile": "drawing-solid-circular-authored-native.rgba", "ownedFile": "drawing-solid-circular-authored-owned.rgba",
        "width": WIDTH, "height": HEIGHT, "bytesPerPixel": 4, "scale": 3, "margin": 24,
        "facts": {"changedBytes": 0, "maximumChannelDifference": 0, "referenceCenterAlpha": 255,
            "referenceOpaquePixels": 86400, "referenceTransparentPixels": WIDTH * HEIGHT - 86400,
            "referenceOpaqueDifferentPixels": 0, "referenceOutsideAlphaPixels": 0}}
    for side in ["native", "owned"]: (root / value[side + "File"]).write_bytes(data)
    (root / "drawing-raster-observations.json").write_text(json.dumps([value]))
    return value, data


class DrawingRasterCustody(unittest.TestCase):
    def test_matching_prefix_is_not_complete_or_native_family_acceptance(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); fixture(root)
            result = analyze(root, False)
            self.assertEqual(result["status"], "INCOMPLETE_OR_MISMATCH")
            self.assertFalse(result["fullCard"])
            self.assertFalse(result["fullGoal"])
            with self.assertRaisesRegex(AssertionError, "complete original"): analyze(root)

    def test_changed_original_bytes_cannot_reuse_an_equal_native_report(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); row, data = fixture(root)
            data[(150 * WIDTH + 150) * 4] ^= 1
            (root / row["ownedFile"]).write_bytes(data)
            with self.assertRaisesRegex(AssertionError, "Native metrics"): analyze(root, False)

    def test_incomplete_original_buffers_reject(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); row, data = fixture(root)
            (root / row["ownedFile"]).write_bytes(data[:-1])
            with self.assertRaisesRegex(AssertionError, "Complete original raster"): analyze(root, False)

    def test_duplicate_or_replaced_pair_identity_rejects(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); row, _ = fixture(root)
            (root / "drawing-raster-observations.json").write_text(json.dumps([row, copy.deepcopy(row)]))
            with self.assertRaisesRegex(AssertionError, "Original ordered"): analyze(root, False)
            row["ownedFile"] = "other.rgba"
            (root / "drawing-raster-observations.json").write_text(json.dumps([row]))
            with self.assertRaises(AssertionError): analyze(root, False)

    def test_equal_blank_images_cannot_establish_reference_output(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); row, _ = fixture(root)
            for side in ["native", "owned"]: (root / row[side + "File"]).write_bytes(bytes(WIDTH * HEIGHT * 4))
            row["facts"].update(referenceCenterAlpha=0, referenceOpaquePixels=0, referenceTransparentPixels=WIDTH * HEIGHT)
            (root / "drawing-raster-observations.json").write_text(json.dumps([row]))
            with self.assertRaises(AssertionError): analyze(root, False)


if __name__ == "__main__": unittest.main()
