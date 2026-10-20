"""Synthetic phase/custody rejection checks; none is native or displayed proof."""
import copy
import unittest

from ios_drawing_run import PROBE, validate_pixels, validate_ready
from ios_geometry_build import unchanged_native_integration_inputs


def ready():
    return {"probe": PROBE, "producer": "source", "status": "ready", "nonce": "source:run", "step": 0,
        "pairIndex": 0, "profile": "solid-circular", "mode": "authored", "kind": "calibration", "control": "plain",
        "appState": "active", "targets": [2, 4, 6], "frames": [[39, 184, 120, 80], [231, 184, 120, 80], [16, 104, 32, 8]],
        "density": 3, "screen": {"width": 390, "height": 844, "scale": 3}}


def pixels(row):
    return {**{key: row[key] for key in ["producer", "nonce", "pairIndex", "step", "profile", "mode", "kind"]},
        "markerMatched": True, "referenceControlPassed": True, "changedBytes": 0, "maximumChannelDifference": 0,
        "nativeSHA256": "a" * 64, "ownedSHA256": "a" * 64, "cropWidth": 504, "cropHeight": 384,
        "imageWidth": 1170, "imageHeight": 2532, "fullCard": False, "fullGoal": False}


class DrawingWindowCustody(unittest.TestCase):
    def test_original_bound_phase_and_pixel_records(self):
        row = ready(); validate_ready(row, "source", 0); validate_pixels(pixels(row), row)

    def test_stale_foreign_or_relabelled_phase_rejects(self):
        for key, value in [("producer", "other"), ("nonce", "other:run"), ("step", 1), ("pairIndex", 1),
            ("profile", "outer-circular"), ("mode", "identity"), ("kind", "owned"), ("control", "outer-shadow"), ("appState", "background")]:
            row = ready(); row[key] = value
            with self.assertRaises(AssertionError): validate_ready(row, "source", 0)
        with self.assertRaises(AssertionError): validate_ready(ready(), "source", 0, "source:old")

    def test_original_targets_and_complete_native_frames_required(self):
        for targets in [[2, 2, 6], [0, 4, 6], [2, 4], [True, 4, 6]]:
            row = ready(); row["targets"] = targets
            with self.assertRaises(AssertionError): validate_ready(row, "source", 0)
        for frame in [[0, 0, 0, 80], [0, 0, 120, 79], [float("nan"), 0, 120, 80]]:
            row = ready(); row["frames"][0] = frame
            with self.assertRaises(AssertionError): validate_ready(row, "source", 0)

    def test_pixel_marker_controls_and_zero_difference_cannot_be_omitted(self):
        for key, value in [("markerMatched", False), ("referenceControlPassed", False), ("changedBytes", 1),
            ("maximumChannelDifference", 1), ("ownedSHA256", "b" * 64), ("cropWidth", 503), ("imageHeight", 2500), ("fullCard", True)]:
            row = ready(); result = pixels(row); result[key] = value
            with self.assertRaises(AssertionError): validate_pixels(result, row)

    def test_pixels_from_other_capture_cannot_be_reused(self):
        row = ready()
        for key, value in [("nonce", "source:old"), ("step", 1), ("producer", "other"), ("kind", "owned")]:
            result = copy.deepcopy(pixels(row)); result[key] = value
            with self.assertRaises(AssertionError): validate_pixels(result, row)

    def test_integration_reuse_rejects_added_removed_or_changed_native_inputs(self):
        previous = {"sourceInputs": {"packages/react-native/ios/view.mm": "native", "pnpm-lock.yaml": "lock", "scene.tsx": "old"},
            "nativeProjectInputs": {"Podfile.lock": "pods"}}
        current = copy.deepcopy(previous); current["sourceInputs"]["scene.tsx"] = "new"
        self.assertEqual(len(unchanged_native_integration_inputs(current, previous)), 2)
        for mutate in [lambda value: value["sourceInputs"].pop("packages/react-native/ios/view.mm"),
            lambda value: value["sourceInputs"].update({"packages/react-native/ios/new.mm": "new"}),
            lambda value: value["sourceInputs"].update({"pnpm-lock.yaml": "changed"}),
            lambda value: value["nativeProjectInputs"].update({"Podfile.lock": "changed"})]:
            current = copy.deepcopy(previous); mutate(current)
            with self.assertRaises(AssertionError): unchanged_native_integration_inputs(current, previous)


if __name__ == "__main__": unittest.main()
