"""Discriminating saved-data controls for the Meter screenshot reconciliation."""
import copy
import os
from pathlib import Path
import struct
import unittest

from MeterStyleAndroidCheck import Bitmap, geometry


class StyleControls(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("CODON_NATIVE_CONTROL_BMP"), "Supply the retained native decoder-control BMP explicitly")
    def test_real_decoder_matches_independent_saved_native_pixel_samples(self):
        image = Bitmap(Path(os.environ["CODON_NATIVE_CONTROL_BMP"]).read_bytes())
        self.assertEqual((image.width, image.height), (720, 1600))
        self.assertEqual(image.argb([46, 765]), 0xffff8800)
        self.assertEqual(image.argb([253, 930]), 0xffffffff)
        self.assertNotEqual(image.argb([253, 930]), 0xffff8800)
        for point in [[720, 0], [-1, 0], [0, 1600]]:
            with self.assertRaises(ValueError): image.argb(point)

    def test_full_white_parent_rejects_one_gray254_pixel_and_outside_crop(self):
        width, height = 3, 2
        stride = 12
        header = b"BM" + struct.pack("<IHHI", 54 + stride * height, 0, 0, 54) + struct.pack("<IiiHHIIiiII", 40, width, -height, 1, 24, 0, stride * height, 0, 0, 0, 0)
        white = b"\xff" * 9 + b"\0" * 3
        image = Bitmap(header + white * height)
        self.assertEqual(image.white([0, 0, 3, 2]), 6)
        data = bytearray(header + white * height);data[54 + stride + 6] = 254
        with self.assertRaisesRegex(ValueError, "absence failed"): Bitmap(bytes(data)).white([0, 0, 3, 2])
        with self.assertRaises(ValueError): image.white([0, 0, 4, 2])
        bottom_up = bytearray(header + white * height);struct.pack_into("<i", bottom_up, 22, height);bottom_up[54:57] = b"\0\0\xff"
        self.assertEqual(Bitmap(bytes(bottom_up)).argb([0, 1]), 0xffff0000)
        self.assertEqual(Bitmap(bytes(bottom_up)).argb([0, 0]), 0xffffffff)

    def test_actual_metadata_boundary_rejects_wrong_target_geometry_duplicate_and_stale_state(self):
        event = {"nativeTarget": 71, "currentTarget": 71, "layout": {"x": 12, "y": 12, "width": 73.142857, "height": 13.714286}}
        state = {"rootTag": 71, "attaches": 1, "detaches": 0, "index": 1, "case": "fractional", "value": 25, "mode": "light", "layouts": {"target": event, "reference": event}}
        row = {"state": state, "afterState": copy.deepcopy(state), "captureStartedEpochMs": 10, "captureFinishedEpochMs": 20, "geometry": {"scale": 1.75, "expected": [12, 12, 73.25, 13.75]}, "windows": {"windowRoots": 1, "windowNodes": []}, "targetCount": 1, "nativeTarget": {"id": "meter-style-target", "visible": True, "className": "android.view.View", "roleDescription": "Progress Bar", "rangeInfo": {"min": 0, "max": 100, "current": 25}, "contentDescription": "Style meter, 25%"}}
        self.assertEqual(geometry(row, state), 1)
        for change in ["target", "size", "duplicate", "stale", "event"]:
            bad = copy.deepcopy(row)
            if change == "target": bad["nativeTarget"]["id"] = "other-target"
            elif change == "duplicate": bad["targetCount"] = 2
            elif change == "stale": bad["afterState"]["value"] = 75
            elif change == "event": bad["state"]["layouts"]["target"]["currentTarget"] = 99
            else: bad["state"]["layouts"]["target"]["layout"]["width"] = 76
            with self.subTest(change=change), self.assertRaises(ValueError): geometry(bad, state)


if __name__ == "__main__": unittest.main()
