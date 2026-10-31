"""Synthetic driver guards for the observed collapsed-scope failure; no native input."""
import unittest
from unittest.mock import patch

from editor_control import advance


class InputBounds(unittest.TestCase):
    def run_location(self, parent_height, commands=None):
        records = [{"kind": "phase-ready", "phase": "initial", "fields": [{"tag": 8}, {"tag": 12}]}]
        sdk = [{"kind": "native-editor-locate", "request": "locate-empty", "editors": [{
          "tag": 8, "nativeRef": 101, "screenPixels": [42, 63, 392, 36], "shown": True, "enabled": True, "focusable": True,
          "parents": [{"tag": 22, "screenPixels": [0, 0, 720, parent_height]}]}]}]
        state = {"externalTestInputActions": 0, "editorControls": ["locate-empty"]}
        if commands is None: commands = []
        advance(lambda *arguments: commands.append(arguments), records, sdk, state)
        return commands, state

    def test_collapsed_scope_rejected_before_input(self):
        commands = []
        with self.assertRaisesRegex(AssertionError, "outside native ancestor"):
            self.run_location(56, commands)
        self.assertEqual(commands, [])

    def test_contained_point_uses_sdk_coordinates(self):
        commands, state = self.run_location(1600)
        self.assertEqual(commands[0][1], ["shell", "input", "tap", "238", "81"])
        self.assertEqual(len(commands), 1)
        self.assertEqual(state["externalTestInputActions"], 1)


class NativeInputAcknowledgments(unittest.TestCase):
    def setUp(self):
        self.commands = []
        self.records = [{"kind": "phase-ready", "phase": "initial", "fields": [{"tag": 8}, {"tag": 12}]}]
        self.editors = [{"tag": tag, "nativeRef": ref, "focused": field == 0, "windowFocused": True, "imeVisible": False, "text": ""}
            for field, (tag, ref) in enumerate([(8, 101), (12, 102)])]
        self.sdk = [{"kind": "native-editor-locate", "request": "locate-empty", "editors": self.editors}]
        self.state = {"externalTestInputActions": 1, "editorControls": ["locate-empty", "tap-empty"], "editorOriginalRefs": [101, 102]}

    def advance(self):
        advance(lambda *args: self.commands.append(args), self.records, self.sdk, self.state)

    def response(self, request, **values):
        editors = [dict(row) for row in self.editors]
        editors[0].update(values)
        self.sdk.append({"kind": "native-editor-locate", "request": request, "editors": editors})

    def test_cold_keyboard_blocks_text_without_repeating_tap(self):
        self.advance()
        self.response("focus-empty-0")
        self.advance()
        self.assertTrue(all(command[0].startswith("sdk-") for command in self.commands))
        self.response("focus-empty-1", imeVisible=True)
        self.advance()
        self.assertEqual(self.commands[-1][1], ["shell", "input", "text", "x"])
        self.assertEqual(self.state["externalTestInputActions"], 2)

    def test_source_callback_and_actual_text_required_before_delete(self):
        self.state["editorControls"].append("typed-empty")
        self.advance()
        self.response("typed-empty-0", imeVisible=True, text="x")
        self.advance()
        self.assertFalse(any(command[0] == "input-empty-delete" for command in self.commands))
        self.records.append({"kind": "change-text", "field": 0, "value": "x"})
        self.response("typed-empty-1", imeVisible=True, text="x")
        self.advance()
        self.assertEqual(self.commands[-1][1], ["shell", "input", "keyevent", "KEYCODE_DEL"])
        self.assertEqual(self.state["externalTestInputActions"], 2)
        self.advance()
        self.assertEqual(sum(command[0] == "input-empty-delete" for command in self.commands), 1)

    def test_replaced_editor_rejects_before_typing(self):
        self.advance()
        self.response("focus-empty-0", imeVisible=True, nativeRef=999)
        with self.assertRaisesRegex(AssertionError, "editors replaced"): self.advance()
        self.assertEqual(self.state["externalTestInputActions"], 1)

    def test_missing_acknowledgment_expires_without_input_retry(self):
        with patch("editor_control.time.monotonic", return_value=10): self.advance()
        with patch("editor_control.time.monotonic", return_value=56):
            with self.assertRaisesRegex(AssertionError, "acknowledgment did not arrive"): self.advance()
        self.assertTrue(all(command[0].startswith("sdk-") for command in self.commands))


if __name__ == "__main__": unittest.main()
