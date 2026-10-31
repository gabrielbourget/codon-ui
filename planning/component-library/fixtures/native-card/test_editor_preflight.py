"""Synthetic failure guards; no guest boot, app launch or native input."""
import unittest

from editor_preflight import LAUNCHER, wait_for_os
from editor_run import make_runner


class OSReadiness(unittest.TestCase):
    def observe(self, responses):
        now = [0]
        state = {"installAttempts": 0, "launchAttempts": 0}
        commands = []

        def device(name, args, cap, required):
            index = len(state["osReadiness"]["samples"])
            row = responses[min(index, len(responses) - 1)]
            commands.append(args)
            if args[-1] == "sys.boot_completed": return 0, b"1"
            if args[-1] == "displays": return 0, ("mCurrentFocus=" + row.get("focus", LAUNCHER)).encode()
            if args[-1] == "com.android.systemui": return 0, row.get("pid", b"886")
            return 0, row.get("anr", b"<no ANR has occurred since boot>")

        def sleep(seconds): now[0] += seconds

        return state, commands, lambda: wait_for_os(device, state, lambda: None, lambda: True, lambda: now[0], sleep)

    def test_current_boot_anr_stops_without_app_action(self):
        state, commands, run = self.observe([{"anr": b"ANR in com.android.systemui"}])
        with self.assertRaisesRegex(AssertionError, "Current-boot ANR"): run()
        self.assertEqual(len(state["osReadiness"]["samples"]), 1)
        self.assertEqual((state["installAttempts"], state["launchAttempts"]), (0, 0))
        self.assertTrue(all(args[0] == "shell" and args[1] in ["getprop", "dumpsys", "pidof"] for args in commands))

    def test_healthy_launcher_requires_twenty_seconds_of_actual_observations(self):
        state, commands, run = self.observe([{}])
        run()
        self.assertTrue(state["osReadiness"]["passed"])
        self.assertEqual(state["osReadiness"]["stableSeconds"], 20)
        self.assertEqual(len(commands), 20)

    def test_systemui_restart_resets_settling(self):
        state, _, run = self.observe([{}, {}, {"pid": b"999"}])
        run()
        self.assertEqual(state["osReadiness"]["samples"][-1]["elapsedSeconds"], 30)

    def test_wrong_window_or_missing_systemui_never_passes(self):
        for response in [{"focus": "com.android.systemui/OtherWindow"}, {"pid": b""}]:
            with self.subTest(response=response):
                state, _, run = self.observe([response])
                with self.assertRaisesRegex(AssertionError, "did not remain stable"): run()
                self.assertEqual((state["installAttempts"], state["launchAttempts"]), (0, 0))
                self.assertEqual(len(state["osReadiness"]["samples"]), 18)

    def test_anr_dialog_cannot_pass_with_empty_lastanr(self):
        _, _, run = self.observe([{"focus": "Application Not Responding: com.android.systemui"}])
        with self.assertRaisesRegex(AssertionError, "Current-boot ANR"): run()

    def test_generated_runner_uses_gate_before_its_single_install(self):
        source = make_runner()
        self.assertLess(source.index("wait_for_os(device"), source.index('"installAttempts": 1'))
        self.assertEqual(source.count('"launchAttempts": 1'), 1)
        self.assertIn('"cleanupReserveSeconds": 60', source)
        self.assertIn('"deadlineUnix": time.time() + 420', source)
        self.assertNotIn('"deadlineUnix": time.time() + 1200', source)


if __name__ == "__main__": unittest.main()
