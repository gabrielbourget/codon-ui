"""No SDK calls: exact installation and uncertain-command guard controls."""
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import NativeSimulatorInstallDiagnostic as diagnostic
from NativeSimulatorInstallDiagnostic import installed_identity, require_success


class Controls(unittest.TestCase):
    def test_exact_wrong_and_extra_installed_files(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "binary").write_bytes(b"prepared observer")
            expected = {"binary": hashlib.sha256(b"prepared observer").hexdigest()}
            self.assertTrue(installed_identity(root, expected)["exact"])
            (root / "binary").write_bytes(b"old observer")
            self.assertFalse(installed_identity(root, expected)["exact"])
            (root / "binary").write_bytes(b"prepared observer")
            (root / "extra").write_bytes(b"unexpected")
            self.assertEqual(installed_identity(root, expected)["differences"], ["extra"])

    def test_only_clean_terminal_command_can_continue(self):
        row = {"exitCode": 0, "ownedGroupGone": True, "timedOut": False}
        require_success(row)
        for change in [{"exitCode": 1}, {"exitCode": None}, {"timedOut": True}, {"ownedGroupGone": False}]:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                require_success({**row, **change})

    def test_timed_out_install_stops_and_cleans_without_launch_or_retry(self):
        import json
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            identity = root / "identity.json"
            identity.write_text(json.dumps({"product": "/prepared/observer.app", "filesSHA256": {"binary": "hash"}}))
            commands = []
            device = "12345678-1234-1234-1234-123456789ABC"
            def recorded(argv, output, cap, deadline, env):
                commands.append((output.name, argv))
                text = ""
                if output.name == "devices-before": text = json.dumps({"devices": {"runtime": []}})
                if output.name == "create": text = device
                if output.name == "devices-after": text = json.dumps({"devices": {"runtime": [{"udid": device, "state": "Shutdown"}]}})
                output.with_suffix(".stdout").write_text(text)
                return {"exitCode": -15 if output.name == "install-once" else 0, "timedOut": output.name == "install-once", "ownedGroupGone": True}
            argv = ["diagnostic", "--cell", "CAT.tag.G02", "--identity", str(identity), "--out", str(root / "run"), "--name", "unique diagnostic", "--device-type", "same type", "--runtime", "same runtime"]
            with mock.patch.object(diagnostic, "load_admission", return_value={"result": "PASS", "attempt": {"maximumSeconds": 1800, "cleanupReserveSeconds": 120}}), mock.patch.object(diagnostic, "verify_identity"), mock.patch.object(diagnostic, "recorded_command", side_effect=recorded), mock.patch.object(diagnostic.signal, "signal"), mock.patch.object(diagnostic.signal, "setitimer"), mock.patch.object(diagnostic.socket.socket, "connect_ex", return_value=1), mock.patch("sys.argv", argv):
                with self.assertRaises(SystemExit) as result: diagnostic.main()
            self.assertEqual(result.exception.code, 1)
            terminal = json.loads((root / "run/terminal.json").read_text())
            self.assertTrue(terminal["cleanupComplete"])
            names = [name for name, _ in commands]
            self.assertEqual(names.count("install-once"), 1)
            self.assertIn("shutdown", names)
            self.assertNotIn("registered-observer", names)
            self.assertFalse(any(any(word in argv for word in ["launch", "erase", "delete", "test-without-building"]) for _, argv in commands))


if __name__ == "__main__":
    unittest.main()
