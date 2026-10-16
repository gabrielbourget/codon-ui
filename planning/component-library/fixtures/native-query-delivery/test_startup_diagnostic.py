import unittest

from startup_diagnostic import launched_app_pid, new_app_after_launch, prelaunched_callback_passed


class PrelaunchedStartupTests(unittest.TestCase):
    def setUp(self):
        self.identity = {"pid": 77, "uid": 501, "start": [123, 4],
                         "path": "/owned/App", "traced": False, "status": 2}
        self.receipt = {"exitCode": 0, "completedVerdict": True,
                        "nativeCallbackPassed": True, "stopReason": None}

    def passed(self, receipt=None, after=None):
        return prelaunched_callback_passed(
            self.receipt if receipt is None else receipt, self.identity,
            self.identity if after is None else after, "/owned/App", 501,
        )

    def test_launch_result_must_name_the_exact_bundle_and_one_positive_pid(self):
        self.assertEqual(launched_app_pid("dev.codon.app: 77\n", "dev.codon.app"), 77)
        for output in ["devXcodonXapp: 77", "other.app: 77", "dev.codon.app: 0",
                       "dev.codon.app: 77\ndev.codon.app: 78", "77"]:
            with self.subTest(output=output), self.assertRaises(ValueError):
                launched_app_pid(output, "dev.codon.app")

    def test_real_callback_and_same_live_process_are_both_required(self):
        self.assertTrue(self.passed())
        self.assertTrue(self.passed(after={**self.identity, "status": 3}))
        for change in [{"exitCode": 65}, {"completedVerdict": False},
                       {"nativeCallbackPassed": False}, {"stopReason": "total-cap"}]:
            with self.subTest(change=change):
                self.assertFalse(self.passed(receipt={**self.receipt, **change}))

    def test_late_process_can_only_be_considered_after_the_recorded_launch(self):
        self.assertTrue(new_app_after_launch(self.identity, "/owned/App", 501, 123.0))
        self.assertFalse(new_app_after_launch(self.identity, "/owned/App", 501, 123.000005))
        self.assertFalse(new_app_after_launch(self.identity, "/foreign/App", 501, 123.0))
        self.assertFalse(new_app_after_launch(self.identity, "/owned/App", 502, 123.0))
        for change in [{"start": []}, {"start": None}, {"status": 4}, {"traced": True}]:
            with self.subTest(change=change):
                self.assertFalse(new_app_after_launch({**self.identity, **change}, "/owned/App", 501, 123.0))

    def test_replacement_process_or_wrong_owner_cannot_validate_startup(self):
        for change in [{"pid": 78}, {"start": [124, 4]}, {"uid": 502},
                       {"path": "/foreign/App"}]:
            with self.subTest(change=change):
                self.assertFalse(self.passed(after={**self.identity, **change}))

    def test_stopped_traced_and_missing_process_state_fail_closed(self):
        for change in [{"status": 4}, {"status": 5}, {"status": None},
                       {"traced": True}, {"traced": None}]:
            with self.subTest(change=change):
                self.assertFalse(self.passed(after={**self.identity, **change}))
        missing = dict(self.identity)
        del missing["uid"]
        self.assertFalse(self.passed(after=missing))


if __name__ == "__main__":
    unittest.main()
