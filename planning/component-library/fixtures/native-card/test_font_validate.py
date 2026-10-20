"""Synthetic journal rejection guards; these never represent native observations."""
from copy import deepcopy
import unittest

from font_validate import validate


def journal():
    rows = [{"kind": "begin", "producer": "test"}]
    for family in ["cui-font-fixture-override", "cui-font-fixture-custom", "sans-serif", "cui-font-fixture-missing"]:
        for style in [-1, 0, 1, 2, 3]:
            for weight in [-1, 100, 200, 300, 400, 500, 600, 700, 800, 900]:
                for features in [None, "'liga' off, 'tnum'"]:
                    rows.append({"kind": "font-case", "case": len(rows) - 1, "family": family, "style": style, "weight": weight, "features": features, "sourceWidth": 1, "copiedWidth": 1, "sourceLines": [[1], [2]], "copiedLines": [[1], [2]], "originalCachesUnchanged": True})
    rows += [{"kind": "font-summary", "cases": 400, "assertions": 401, "sdk": 36, "fontFitting": True, "requestIsolation": True, "sourceCachesUnchangedByScratch": True, "fullCard": False}, {"kind": "terminal", "outcome": "native-font-pass", "producer": "test"}]
    return rows


class Guards(unittest.TestCase):
    def test_complete_protocol(self):
        self.assertEqual(validate(journal(), "android", "test")["fontCases"], 400)

    def test_rejects_missing_or_duplicate_profile(self):
        for change in [lambda rows: rows.pop(1), lambda rows: rows.__setitem__(1, deepcopy(rows[2]))]:
            rows = journal(); change(rows)
            with self.assertRaises(AssertionError): validate(rows, "android", "test")

    def test_rejects_original_observation_mismatch(self):
        for key, value in [("copiedWidth", 2), ("copiedLines", [[3], [4]]), ("originalCachesUnchanged", False)]:
            rows = journal(); rows[1][key] = value
            with self.assertRaises(AssertionError): validate(rows, "android", "test")

    def test_rejects_wrong_producer_or_failure(self):
        for key, value in [("producer", "stale"), ("outcome", "failed")]:
            rows = journal(); rows[-1][key] = value
            with self.assertRaises(AssertionError): validate(rows, "android", "test")


if __name__ == "__main__": unittest.main()
