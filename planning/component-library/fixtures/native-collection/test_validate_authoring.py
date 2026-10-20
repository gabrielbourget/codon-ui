"""Synthetic authoring verifier guards; no SDK observations are fabricated for acceptance."""
import copy
import json
import unittest

import validate_authoring as validator


def pair():
    root = {"ownerId": "owner", "rootId": "root", "rootRevision": "revision", "target": 10, "surfaceId": 1, "windowId": "window", "epoch": 1, "sequence": 2}
    wire = [{"descriptorId": "descriptor", "descriptorRevision": "committed", "parentDescriptorId": "", "target": 11, "index": 0, "retainedIndex": 1, "hasRetainedChildren": False}]
    packet = {**root, "attached": True, "complete": True, "metadataOnly": True, "error": "", "hierarchy": json.dumps(wire)}
    selected = {"lease": root, "logical": [{"key": "a", "role": "a", "type": "item", "descriptorId": "descriptor", "descriptorRevision": "committed", "metadataTarget": 11, "index": 1, "parentKey": None, "prevKey": None, "nextKey": None, "originalValue": True, "originalRef": True}], "lookup": ["a"], "size": 1, "visibleTargets": {"a": 20}}
    return selected, packet


class Guards(unittest.TestCase):
    def test_exact_original_receipt_and_retained_index_pass(self):
        validator.correspondence(*pair())

    def test_guessed_dense_index_is_rejected(self):
        selected, packet = pair()
        selected["logical"][0]["index"] = 0
        with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_pending_or_changed_descriptors_are_rejected(self):
        for revision in ["uncommitted", "different"]:
            selected, packet = pair()
            selected["logical"][0]["descriptorRevision"] = revision
            with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_metadata_refs_cannot_become_visible_refs(self):
        selected, packet = pair()
        selected["visibleTargets"]["a"] = 11
        with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_stale_or_unrelated_native_lease_is_rejected(self):
        selected, packet = pair()
        selected["lease"] = {**selected["lease"], "sequence": 1}
        with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_partial_logical_membership_is_rejected(self):
        selected, packet = pair()
        selected["logical"] = []
        with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_copied_js_values_or_refs_are_rejected(self):
        for field in ["originalValue", "originalRef"]:
            selected, packet = pair()
            selected["logical"][0][field] = False
            with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_foreign_links_are_rejected(self):
        for field in ["parentKey", "prevKey", "nextKey"]:
            selected, packet = pair()
            selected["logical"][0][field] = "foreign"
            with self.assertRaises(AssertionError): validator.correspondence(selected, packet)

    def test_authoring_parser_preserves_original_records(self):
        record = {"probe": validator.PROBE, "sequence": 1, "kind": "begin", "text": "x" * 1800}
        line = "CUI_COLLECTION_AUTHORING " + json.dumps(record)
        parts = [line[index:index + 700] for index in range(0, len(line), 700)]
        lines = ["CUI_COLLECTION_AUTHORING_CHUNK " + json.dumps({"probe": validator.PROBE, "recordSequence": 1, "part": i, "parts": len(parts), "content": part}) for i, part in enumerate(parts)]
        self.assertEqual(validator.parse("\n".join(lines)), [record])
        with self.assertRaises(AssertionError): validator.parse("\n".join(lines[:-1]))

    def test_success_label_without_original_callbacks_is_rejected(self):
        rows = [{"probe": validator.PROBE, "sequence": 1, "kind": "begin", "sourceProducer": "a" * 40}, {"probe": validator.PROBE, "sequence": 2, "kind": "terminal", "outcome": "native-records-complete"}]
        with self.assertRaises((AssertionError, KeyError)): validator.validate(copy.deepcopy(rows), "android", "a" * 40)


if __name__ == "__main__":
    unittest.main()
