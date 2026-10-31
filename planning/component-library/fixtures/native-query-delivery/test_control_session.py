import unittest

from control_session import control_session_requests


START = "Initiating control session with IDE capabilities: <XCTCapabilities: 0x1>: {"
REPLY = "Got reply to control session initiation request (result:error):"
CAPABILITIES = '<XCTCapabilities: 0x2>: {\n    "automation mode" = 1;\n}: (null)'


class ControlSessionTests(unittest.TestCase):
    def test_connected_socket_and_orphan_reply_do_not_prove_a_control_request(self):
        log = "17:04:52.958 Connected socket 30 to testmanagerd\n"
        self.assertEqual(control_session_requests(log), [])
        self.assertEqual(control_session_requests(log + "17:04:52.964 " + REPLY + CAPABILITIES), [])

    def test_complete_capabilities_reply_records_measured_latency(self):
        log = ("17:04:52.958 Connected socket 30 to testmanagerd\n"
               + "17:04:52.960 " + START + "\n17:04:52.964 " + REPLY + " " + CAPABILITIES)
        request, = control_session_requests(log)
        self.assertEqual(request["socket"], 30)
        self.assertEqual(request["elapsedSeconds"], 0.004)
        self.assertTrue(request["completedWithoutRecordedTimeout"])

    def test_native_timeout_and_later_reconnection_remain_distinct(self):
        log = ("23:19:32.421 " + START
               + '\n23:21:32.947 Timed out after 120.0s while initiating control session with daemon.'
               + '\n23:21:33.453 ' + REPLY + ' (null): Error Domain=DTXProxyChannel Code=1 "Channel disconnected"'
               + '\n23:22:45.525 ' + START + '\n23:22:45.529 ' + REPLY + ' ' + CAPABILITIES)
        failed, recovered = control_session_requests(log)
        self.assertTrue(failed["timedOut"])
        self.assertEqual(failed["nativeTimeoutSeconds"], 120)
        self.assertFalse(failed["completedWithoutRecordedTimeout"])
        self.assertTrue(recovered["completedWithoutRecordedTimeout"])
        self.assertEqual(recovered["elapsedSeconds"], 0.004)

    def test_truncated_capabilities_block_cannot_pass(self):
        log = "17:04:52.960 " + START + "\n17:04:52.964 " + REPLY + " <XCTCapabilities: 0x2>: {"
        request, = control_session_requests(log)
        self.assertFalse(request["replySucceeded"])
        self.assertFalse(request["completedWithoutRecordedTimeout"])

    def test_nonnull_error_and_late_reply_cannot_pass(self):
        for suffix in ['}: Error Domain=XCTDaemonErrorDomain Code=1', '}: (null)']:
            log = ("17:04:52.960 " + START
                   + "\n17:06:52.960 Timed out after 120.0s while initiating control session with daemon."
                   + "\n17:06:53.000 " + REPLY + " <XCTCapabilities: 0x2>: {\n" + suffix)
            with self.subTest(suffix=suffix):
                request, = control_session_requests(log)
                self.assertFalse(request["completedWithoutRecordedTimeout"])

    def test_latency_does_not_invent_a_missing_native_timeout(self):
        log = "17:04:52.000 " + START + "\n17:06:55.000 " + REPLY + " " + CAPABILITIES
        request, = control_session_requests(log)
        self.assertEqual(request["elapsedSeconds"], 123)
        self.assertIsNone(request["nativeTimeoutSeconds"])
        self.assertFalse(request["timedOut"])
        self.assertTrue(request["completedWithoutRecordedTimeout"])

    def test_midnight_crossing_keeps_positive_latency(self):
        log = "23:59:59.998 " + START + "\n00:00:00.002 " + REPLY + " " + CAPABILITIES
        request, = control_session_requests(log)
        self.assertEqual(request["elapsedSeconds"], 0.004)
        self.assertTrue(request["completedWithoutRecordedTimeout"])

    def test_overlapping_requests_are_ambiguous(self):
        log = ("17:04:52.960 " + START + "\n17:04:52.961 " + START
               + "\n17:04:52.964 " + REPLY + " " + CAPABILITIES)
        requests = control_session_requests(log)
        self.assertTrue(all(request["ambiguous"] for request in requests))
        self.assertFalse(any(request["completedWithoutRecordedTimeout"] for request in requests))


if __name__ == "__main__":
    unittest.main()
