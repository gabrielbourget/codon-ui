"""Synthetic custody guards; none executes UIKit or proves native drawing."""
import copy
import unittest
from unittest.mock import patch

from continuous_uikit_probe import DRAWING_PROFILES, PROFILE_NAMES, native_command, validate_journal


def journal():
    return [{"kind": "begin", "producer": "source", "pid": 123},
        {"kind": "reference-control", "producer": "source", "metrics": {"binaryCoverageDifferences": 10}},
        {"kind": "factory-guards", "producer": "source", "outcome": "guards-complete"},
        {"kind": "receiver-assertions", "producer": "source", "result": {"outcome": "receiver-assertions-complete", "fixturesCompleted": 4,
            "maskGeometry": {"assertions": 21, "byteExactRaster": True, "rasterWidth": 360, "rasterHeight": 240, "rasterBytesPerPixel": 4},
            "drawingRaster": {"pairs": 36, "profileNames": DRAWING_PROFILES, "byteExactRaster": True,
                "rasterWidth": 504, "rasterHeight": 384, "rasterBytesPerPixel": 4}}},
        *[{"kind": "profile", "producer": "source", "name": name} for name in PROFILE_NAMES],
        *[{"kind": "raster-control", "producer": "source", "name": name + "-circular"} for name in PROFILE_NAMES],
        *[{"kind": "native-layer-candidate", "producer": "source", "name": name + "-native-layer"} for name in PROFILE_NAMES],
        *[{"kind": "native-mask-candidate", "producer": "source", "name": name + "-native-mask"} for name in PROFILE_NAMES],
        *[{"kind": "factory-mask-candidate", "producer": "source", "name": name + "-factory-mask"} for name in PROFILE_NAMES],
        {"kind": "terminal", "producer": "source", "outcome": "native-reference-characterization-complete", "fullCard": False, "fullGoal": False}]


class ReferenceCustody(unittest.TestCase):
    def test_characterization_preserves_scope(self):
        result = validate_journal(journal(), "source")
        self.assertEqual(result["nativeProfileCount"], 7)
        self.assertFalse(result["fullCard"])

    def test_failed_reference_cannot_complete_profile_journal(self):
        rows = journal()
        rows[1]["metrics"]["binaryCoverageDifferences"] = 0
        with self.assertRaisesRegex(AssertionError, "did not distinguish"): validate_journal(rows, "source")
        rows = [rows[0], rows[1], rows[-1]]
        rows[-1]["outcome"] = "native-reference-capability-unavailable"
        self.assertEqual(validate_journal(rows, "source")["nativeProfileCount"], 0)

    def test_duplicate_profile_cannot_replace_missing_profile(self):
        rows = journal()
        indices = [index for index, row in enumerate(rows) if row["kind"] == "profile"]
        rows[indices[1]] = copy.deepcopy(rows[indices[0]])
        with self.assertRaises(AssertionError): validate_journal(rows, "source")

    def test_foreign_identity_and_acceptance_promotion_reject(self):
        rows = journal()
        rows[2]["producer"] = "other"
        with self.assertRaises(AssertionError): validate_journal(rows, "source")
        rows = journal()
        rows[-1]["fullCard"] = True
        with self.assertRaises(AssertionError): validate_journal(rows, "source")

    def test_receiver_failure_cannot_be_hidden_by_primitive_results(self):
        rows = journal()
        receiver = next(row for row in rows if row["kind"] == "receiver-assertions")
        receiver["result"] = {"outcome": "receiver-assertions-failed", "reason": "Original CUI view assertion"}
        with self.assertRaises(AssertionError): validate_journal(rows, "source")
        failed = rows[:rows.index(receiver) + 1] + [rows[-1]]
        failed[-1]["outcome"] = "native-receiver-assertions-failed"
        self.assertEqual(validate_journal(failed, "source")["outcome"], "native-receiver-assertions-failed")

    def test_partial_crash_journal_rejects_with_diagnostic(self):
        with self.assertRaisesRegex(AssertionError, "missing terminal"):
            validate_journal(journal()[:3], "source")

    def test_mask_geometry_fixture_cannot_be_omitted(self):
        rows = journal()
        receiver = next(row for row in rows if row["kind"] == "receiver-assertions")
        receiver["result"]["fixturesCompleted"] = 2
        with self.assertRaises(AssertionError): validate_journal(rows, "source")
        receiver["result"]["fixturesCompleted"] = 4
        receiver["result"]["maskGeometry"]["byteExactRaster"] = False
        with self.assertRaises(AssertionError): validate_journal(rows, "source")

    def test_complete_receiver_rasters_cannot_be_omitted_or_relabelled(self):
        for key, invalid in [("pairs", 35), ("byteExactRaster", False), ("profileNames", DRAWING_PROFILES[:-1]), ("rasterWidth", 360)]:
            rows = journal()
            receiver = next(row for row in rows if row["kind"] == "receiver-assertions")
            receiver["result"]["drawingRaster"][key] = invalid
            with self.assertRaises(AssertionError): validate_journal(rows, "source")

    def test_native_command_termination_stays_inside_work_allowance(self):
        with patch("continuous_uikit_probe.time.monotonic", return_value=400), patch("continuous_uikit_probe.command", return_value=(0, b"")) as run:
            native_command("root", "observe", ["native-command"], 420, 30)
        requested_cap = run.call_args.args[3]
        self.assertLessEqual(requested_cap + 10, 20)

    def test_native_cutoff_starts_no_command(self):
        with patch("continuous_uikit_probe.time.monotonic", return_value=411), patch("continuous_uikit_probe.command") as run:
            with self.assertRaisesRegex(AssertionError, "reserved cleanup"):
                native_command("root", "observe", ["native-command"], 420)
        run.assert_not_called()


if __name__ == "__main__": unittest.main()
