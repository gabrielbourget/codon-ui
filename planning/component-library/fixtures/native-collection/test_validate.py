"""Synthetic verifier guards only; none are installed/native conformance evidence."""
import copy
import json
import unittest

import validate


def android():
    return {"target": 2, "alpha": 0, "width": 0, "height": 0, "importantForAccessibility": 4,
            "focused": False, "focusable": False, "clickable": False, "focusCandidates": 0,
            "touchCandidates": 0, "accessibleChildren": 0, "accessibilityFocusable": False,
            "accessibilityClickable": False, "accessibilityVisible": False,
            "parentAccessibleTargets": [4], "accessibilityActions": [], "children": []}


def ios():
    return {"target": 2, "alpha": 0, "width": 0, "height": 0, "userInteractionEnabled": False,
            "canBecomeFocused": False, "canBecomeFirstResponder": False, "isFirstResponder": False,
            "hitTarget": -1, "isAccessibilityElement": False, "accessibilityElementsHidden": True,
            "accessibilityElementCount": 0, "explicitAccessibilityElements": 0, "children": []}


class Guards(unittest.TestCase):
    def test_retained_indices_include_hidden_sdk_siblings(self):
        tree = {"target": 20, "children": [{"target": 21, "children": []}, {"target": 22, "children": []}]}
        node = {"descriptorId": "visible", "parentDescriptorId": "", "target": 22, "index": 0, "retainedIndex": 1, "hasRetainedChildren": False}
        validate.retained_positions([node], tree)
        node["retainedIndex"] = 0
        with self.assertRaises(AssertionError): validate.retained_positions([node], tree)
        del node["retainedIndex"]
        with self.assertRaises(AssertionError): validate.retained_positions([node], tree)

    def test_hidden_retained_children_are_not_reported_as_an_empty_physical_node(self):
        tree = {"target": 20, "children": [{"target": 21, "children": [{"target": 22, "children": []}]}]}
        node = {"descriptorId": "parent", "parentDescriptorId": "", "target": 21, "index": 0, "retainedIndex": 0, "hasRetainedChildren": True}
        validate.retained_positions([node], tree)
        node["hasRetainedChildren"] = False
        with self.assertRaises(AssertionError): validate.retained_positions([node], tree)

    def test_sdk_configurations_are_checked_in_both_platform_forms(self):
        validate.sdk_tree(android(), "android", {2})
        validate.sdk_tree(ios(), "ios", {2})

    def test_a_native_touch_candidate_is_rejected(self):
        tree = android()
        tree["touchCandidates"] = 1
        with self.assertRaises(AssertionError): validate.sdk_tree(tree, "android", {2})

    def test_metadata_exposed_by_parent_accessibility_is_rejected(self):
        tree = android()
        tree["parentAccessibleTargets"] = [2]
        with self.assertRaises(AssertionError): validate.sdk_tree(tree, "android", {2})

    def test_focusable_or_accessible_uikit_views_are_rejected(self):
        for field in ["canBecomeFocused", "canBecomeFirstResponder", "isFirstResponder", "isAccessibilityElement"]:
            tree = ios()
            tree[field] = True
            with self.assertRaises(AssertionError): validate.sdk_tree(tree, "ios", {2})

    def test_foreign_native_target_is_rejected(self):
        with self.assertRaises(AssertionError): validate.sdk_tree(android(), "android", {8})

    def test_nested_sdk_violations_are_not_hidden_by_a_valid_root(self):
        tree = android()
        child = copy.deepcopy(tree)
        child["width"] = 10
        tree["children"] = [child]
        with self.assertRaises(AssertionError): validate.sdk_tree(tree, "android", {2})

    def test_chunked_native_journal_is_lossless(self):
        record = {"probe": validate.PROBE, "sequence": 1, "kind": "begin", "large": "x" * 4000}
        line = "CUI_COLLECTION_GATE " + json.dumps(record)
        parts = [line[index:index + 700] for index in range(0, len(line), 700)]
        lines = ["logcat CUI_COLLECTION_GATE_CHUNK " + json.dumps({"probe": validate.PROBE, "recordSequence": 1, "part": i, "parts": len(parts), "content": part}) for i, part in enumerate(parts)]
        self.assertEqual(validate.parse("\n".join(lines)), [record])
        with self.assertRaises(AssertionError): validate.parse("\n".join(lines[:-1]))

    def test_success_text_without_original_native_callbacks_is_rejected(self):
        records = [{"probe": validate.PROBE, "sequence": 1, "kind": "begin", "sourceProducer": "a" * 40},
                   {"probe": validate.PROBE, "sequence": 2, "kind": "terminal", "outcome": "native-records-complete"}]
        with self.assertRaises((KeyError, AssertionError)): validate.validate(records, "android", "a" * 40)


if __name__ == "__main__":
    unittest.main()
