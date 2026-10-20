"""Synthetic protocol rejection guards; no native observations are generated here."""
from copy import deepcopy
import unittest

from editor_validate import validate


def journal():
    rows = [{"kind": "begin", "producer": "test"}]
    rows += [{"kind": "change-text", "field": field, "value": value} for field, value in [(0, "x"), (0, ""), (1, "native_input")]]
    sdk = []
    for phase in ["initial", "narrow", "restore"]:
        editors = [{"tag": 10 + field, "nativeRef": 20 + field, "editableRef": 30 + field,
          "text": "" if field == 0 else "native_input", "cachedStateMapCount": 0, "stateRef": 40 + field,
          "spans": [50 + field], "parents": [{"tag": 100 + field}]} for field in [0, 1]]
        for mode in ["before", "after"]:
            sdk.append({"kind": "native-editor-" + mode, "phase": phase, "producer": "test", "pid": 123,
              "editors": deepcopy(editors), "originalFontCachesUnchanged": mode == "after"})
        rows.append({"kind": "phase-ready", "phase": phase, "fields": [{"tag": 10}, {"tag": 11}]})
        for field in [0, 1]:
            geometry = {"ownerId": "owner" + str(field), "bindingId": "binding" + str(field), "target": 100 + field,
              "windowId": "window", "scopeOwnerId": "scope", "epoch": 1, "attachmentRevision": 1, "commitRevision": phase,
              "snapshot": {"layout": [0, 0, 180 if phase == "narrow" else 240, 100 if phase == "narrow" else 80], "density": 2}}
            result = {key: value for key, value in geometry.items() if key not in ["snapshot", "commitRevision"]}
            result.update({"kind": "evaluated-layout", "surfaceId": 1, "nativeViewRevision": phase,
              "results": [{"index": index, "metrics": {"width": width, "height": 100 if index == 1 else 80}} for index, width in enumerate([240, 180, 240])]})
            rows.append({"kind": "evaluated", "phase": phase, "field": field, "sameRefs": True, "values": ["", "native_input"],
              "callbacksBefore": [2, 1], "callbacksAfter": [2, 1], "before": deepcopy(geometry), "after": deepcopy(geometry), "result": result})
        rows.append({"kind": "phase-complete", "phase": phase})
    rows.append({"kind": "terminal", "producer": "test", "outcome": "native-editor-records-complete"})
    for sequence, row in enumerate(rows, 1): row["sequence"] = sequence
    return rows, sdk


class Guards(unittest.TestCase):
    def rejects(self, change):
        rows, sdk = journal(); change(rows, sdk)
        with self.assertRaises(AssertionError): validate(rows, "android", "test", sdk)

    def test_complete_protocol(self):
        rows, sdk = journal()
        self.assertEqual(validate(rows, "android", "test", sdk)["actualNativeQueries"], 6)

    def test_rejects_widget_or_cache_change(self):
        for key, value in [("text", "changed"), ("nativeRef", 999), ("stateRef", 999), ("spans", [999])]:
            self.rejects(lambda rows, sdk, key=key, value=value: sdk[1]["editors"][0].__setitem__(key, value))

    def test_rejects_font_write_or_unrelated_native_hierarchy(self):
        self.rejects(lambda rows, sdk: sdk[1].__setitem__("originalFontCachesUnchanged", False))
        self.rejects(lambda rows, sdk: [editor.__setitem__("parents", []) for event in sdk for editor in event["editors"]])

    def test_rejects_evaluated_geometry_without_native_match(self):
        def change(rows, sdk):
            next(row for row in rows if row["kind"] == "evaluated")["result"]["results"][0]["metrics"]["height"] = 900
        self.rejects(change)

    def test_rejects_editor_callback_and_retired_binding(self):
        for key, value in [("callbacksAfter", [99]), ("sameRefs", False)]:
            self.rejects(lambda rows, sdk, key=key, value=value: next(row for row in rows if row["kind"] == "evaluated").__setitem__(key, value))
        self.rejects(lambda rows, sdk: next(row for row in rows if row["kind"] == "evaluated")["result"].__setitem__("bindingId", "stale"))


if __name__ == "__main__": unittest.main()
