"""Synthetic custody guards; none executes UIKit or proves native drawing."""
import copy
import unittest

from continuous_uikit_probe import PROFILE_NAMES, validate_journal


def journal():
    return [{"kind": "begin", "producer": "source", "pid": 123},
        {"kind": "reference-control", "producer": "source", "metrics": {"binaryCoverageDifferences": 10}},
        {"kind": "factory-guards", "producer": "source", "outcome": "guards-complete"},
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
        rows[4] = copy.deepcopy(rows[3])
        with self.assertRaises(AssertionError): validate_journal(rows, "source")

    def test_foreign_identity_and_acceptance_promotion_reject(self):
        rows = journal()
        rows[2]["producer"] = "other"
        with self.assertRaises(AssertionError): validate_journal(rows, "source")
        rows = journal()
        rows[-1]["fullCard"] = True
        with self.assertRaises(AssertionError): validate_journal(rows, "source")


if __name__ == "__main__": unittest.main()
