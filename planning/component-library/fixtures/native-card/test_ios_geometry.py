"""Synthetic custody/provider guards only; never app startup or native evidence."""
from pathlib import Path
import copy
import tempfile
import unittest

from ios_geometry_build import pod_changes, provider_file
from ios_geometry_validate import PHASES, PROBE, WIDTHS, validate


def journal():
    rows = [{"kind": "begin", "producer": "source"}]
    for index, phase in enumerate(PHASES):
        actual = {"kind": "frame", "attached": True, "error": "", "ownerId": "owner", "bindingId": "binding", "target": 8,
            "windowId": "window", "scopeOwnerId": "scope", "epoch": 1, "attachmentRevision": 1, "geometryRevision": index * 2 + 2, "commitRevision": "",
            "snapshot": {"platform": "ios", "coordinateSpace": "window", "units": "points", "mountObservationAvailable": True, "density": 3,
                "layout": [0, 0, WIDTHS[index], 80], "ancestors": [{"clip": {"complete": True, "mask": {"pathAvailable": True, "path": [[0, 1, 2]], "fillRule": "non-zero", "nativePrimitive": {"kind": "cui-owned-path-mask"}}}}],
                "layers": [{"clip": {"complete": True}}]}}
        mount = {**copy.deepcopy(actual), "kind": "mount-after", "geometryRevision": index * 2 + 1, "transactionId": str(index + 1)}
        rows += [{"kind": "native-geometry", "phase": phase, "actual": mount}, {"kind": "native-geometry", "phase": phase, "actual": actual},
            {"kind": "phase-complete", "phase": phase, "actual": actual, "mount": mount, "sameRefs": True, "actualTarget": 8, "editorTargets": [11, 12], "textCallbacks": 0}]
    rows.append({"kind": "terminal", "outcome": "native-geometry-records-complete"})
    return [{"probe": PROBE, "sequence": index + 1, **row} for index, row in enumerate(rows)]


class OriginalObserverCustody(unittest.TestCase):
    def test_scoped_result(self):
        result = validate(journal(), "source")
        self.assertEqual(result["mountedPhases"], 3)
        self.assertFalse(result["fullCard"])

    def test_model_or_partial_clip_cannot_pass(self):
        for change in [lambda row: row["actual"].update(kind="sample"), lambda row: row["actual"]["snapshot"]["ancestors"][0]["clip"].update(complete=False)]:
            rows = journal()
            change(next(row for row in rows if row["kind"] == "phase-complete"))
            with self.assertRaises(AssertionError): validate(rows, "source")

    def test_missing_native_original_cannot_pass(self):
        rows = journal()
        next(row for row in rows if row["kind"] == "phase-complete")["actual"] = copy.deepcopy(rows[2]["actual"])
        next(row for row in rows if row["kind"] == "phase-complete")["actual"]["geometryRevision"] = 99
        with self.assertRaises(AssertionError): validate(rows, "source")

    def test_replaced_refs_window_and_mount_cannot_pass(self):
        for change in [lambda row: row.update(editorTargets=[20, 21]), lambda row: row["actual"].update(windowId="other"), lambda row: row["mount"].update(transactionId="1")]:
            rows = journal()
            change([row for row in rows if row["kind"] == "phase-complete"][1])
            with self.assertRaises(AssertionError): validate(rows, "source")

    def test_wrong_width_and_text_callback_cannot_pass(self):
        for change in [lambda row: row["actual"]["snapshot"]["layout"].__setitem__(2, 77), lambda row: row.update(textCallbacks=1)]:
            rows = journal()
            change([row for row in rows if row["kind"] == "phase-complete"][1])
            with self.assertRaises(AssertionError): validate(rows, "source")


class NativeIntegrationGuards(unittest.TestCase):
    def test_actual_nested_provider_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            nested = root / "ReactCodegen/RCTThirdPartyComponentsProvider.mm"
            nested.parent.mkdir()
            nested.write_text("CUIFocusView CUIKeyboardScope CUICollectionRoot CUICollectionNode")
            self.assertEqual(provider_file(root), nested)
            (root / nested.name).write_text(nested.read_text())
            with self.assertRaisesRegex(AssertionError, "One actual"): provider_file(root)

    def test_only_owned_checksum_changes(self):
        before = {"PODS": ["React-Core (0.86.3)"], "SPEC CHECKSUMS": {"CodonNativeInput": "a", "React-Core": "b"}}
        after = copy.deepcopy(before)
        after["SPEC CHECKSUMS"]["CodonNativeInput"] = "new"
        self.assertEqual(pod_changes(before, after), ["CodonNativeInput"])
        after["PODS"] = ["React-Core (different)"]
        with self.assertRaisesRegex(AssertionError, "versions"): pod_changes(before, after)


if __name__ == "__main__": unittest.main()
