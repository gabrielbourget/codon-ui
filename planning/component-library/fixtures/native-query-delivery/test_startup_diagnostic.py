import unittest

from startup_diagnostic import installed_app_executable, launched_app_pid, new_app_after_launch, prelaunched_callback_passed, priority_callback_proof, runner_bootstrap_failure


class RunnerBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.receipt = {"exitCode": 65, "stopReason": None, "completedVerdict": False,
                        "selectedMethodStarted": False, "typingBegins": 0}

    def test_only_observed_ax_and_busy_failures_are_bootstrap_conditions(self):
        for log in ["Timed out waiting for AX loaded notification",
                    "Timed out while loading Accessibility.",
                    'Busy ("Application failed preflight checks")']:
            with self.subTest(log=log):
                self.assertTrue(runner_bootstrap_failure(self.receipt, log))

    def test_rejected_configuration_must_not_trigger_a_warm_bootstrap_observation(self):
        log = "when UseDestinationArtifacts is set, the destination must be an iOS device"
        self.assertFalse(runner_bootstrap_failure(self.receipt, log))
        self.assertFalse(runner_bootstrap_failure(self.receipt, "Failed to build workspace"))

    def test_completed_started_typed_and_controller_stopped_conditions_fail_closed(self):
        for change in [{"completedVerdict": True}, {"selectedMethodStarted": True},
                       {"typingBegins": 1}, {"exitCode": 0}, {"stopReason": "total-cap"}]:
            with self.subTest(change=change):
                self.assertFalse(runner_bootstrap_failure(
                    {**self.receipt, **change}, "Timed out while loading Accessibility.",
                ))
        self.assertFalse(runner_bootstrap_failure({}, "Timed out while loading Accessibility."))


class PriorityCallbackTests(unittest.TestCase):
    def setUp(self):
        self.method = "Tests/Tests/testTransportPreflight"
        self.summary = {"totalTestCount": 1, "passedTests": 1, "failedTests": 0}
        self.capture = {"protocol": "controlled-open-veto", "owner": {
            "scenario": "veto", "query": "", "requests": {"opens": 1},
        }}

    def test_priority_veto_callback_uses_its_actual_owner_protocol(self):
        self.assertTrue(priority_callback_proof(self.summary, [self.capture], self.method))
        diagnostic = {"frames": {"diag-transport-owner": {"label": "Transport 1"}}}
        self.assertFalse(priority_callback_proof(self.summary, [diagnostic], self.method))

    def test_missing_duplicate_and_malformed_callback_fail_closed(self):
        for captures in [[], [self.capture, self.capture], [None],
                         [{**self.capture, "owner": None}],
                         [{**self.capture, "owner": {"requests": None}}]]:
            with self.subTest(captures=captures):
                self.assertFalse(priority_callback_proof(self.summary, captures, self.method))

    def test_initial_owner_and_another_scenario_do_not_prove_delivery(self):
        owner = self.capture["owner"]
        for change in [{"requests": {"opens": 0}}, {"requests": {"opens": 2}},
                       {"query": "changed"}, {"scenario": "query"}]:
            with self.subTest(change=change):
                self.assertFalse(priority_callback_proof(
                    self.summary, [{**self.capture, "owner": {**owner, **change}}], self.method,
                ))

    def test_only_a_single_completed_preflight_pass_can_validate_startup(self):
        for change in [{"totalTestCount": 2}, {"passedTests": 0}, {"failedTests": 1}]:
            with self.subTest(change=change):
                self.assertFalse(priority_callback_proof(
                    {**self.summary, **change}, [self.capture], self.method,
                ))
        self.assertFalse(priority_callback_proof(self.summary, [self.capture], "Tests/Tests/testPriorityAcceptance"))


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

    def test_installed_folder_name_does_not_replace_the_verified_executable_identity(self):
        metadata = {"CFBundleIdentifier": "dev.codon.app", "CFBundleExecutable": "App"}
        path = installed_app_executable("/owned/Renamed Fixture.app", metadata, "dev.codon.app")
        binding = {**self.identity, "path": "/owned/Renamed Fixture.app/App"}
        self.assertTrue(new_app_after_launch(binding, path, 501, 123.0))
        self.assertTrue(prelaunched_callback_passed(self.receipt, binding, binding, path, 501))
        self.assertFalse(new_app_after_launch(binding, "/owned/App.app/App", 501, 123.0))

    def test_installed_metadata_cannot_adopt_another_bundle(self):
        for metadata in [None, {}, {"CFBundleIdentifier": "other.app", "CFBundleExecutable": "App"}]:
            with self.subTest(metadata=metadata), self.assertRaises(ValueError):
                installed_app_executable("/owned/App.app", metadata, "dev.codon.app")

    def test_executable_must_stay_inside_an_absolute_installed_container(self):
        for executable in [None, "", ".", "..", "../Other", "/foreign/App", "nested/App", "nested\\App", 77]:
            with self.subTest(executable=executable), self.assertRaises(ValueError):
                installed_app_executable(
                    "/owned/App.app", {"CFBundleIdentifier": "dev.codon.app", "CFBundleExecutable": executable},
                    "dev.codon.app",
                )
        with self.assertRaises(ValueError):
            installed_app_executable(
                "relative/App.app", {"CFBundleIdentifier": "dev.codon.app", "CFBundleExecutable": "App"}, "dev.codon.app",
            )

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
