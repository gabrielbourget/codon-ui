"""Synthetic driver guards for the observed collapsed-scope failure; no native input."""
import unittest
from unittest.mock import patch

from editor_control import advance


class InputBounds(unittest.TestCase):
    def run_location(self, parent_height, commands=None):
        records = [{"kind": "phase-ready", "phase": "initial", "fields": [{"tag": 8}, {"tag": 12}]}]
        sdk = [{"kind": "native-editor-locate", "request": "locate-empty", "editors": [{
          "tag": 8, "screenPixels": [42, 63, 392, 36], "shown": True, "enabled": True, "focusable": True,
          "parents": [{"tag": 22, "screenPixels": [0, 0, 720, parent_height]}]}]}]
        state = {"externalTestInputActions": 0, "editorControls": ["locate-empty"]}
        if commands is None: commands = []
        with patch("editor_control.time.sleep"):
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
        self.assertEqual(len(commands), 3)
        self.assertEqual(state["externalTestInputActions"], 3)


if __name__ == "__main__": unittest.main()
