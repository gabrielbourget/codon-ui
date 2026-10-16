import unittest

from lldb_diagnostic import (
    BASIC_PROFILE, basic_read_commands, completed_read_detach,
    parse_nsstring_summary, require_owned_process, same_process,
)


class DebuggerProofTests(unittest.TestCase):
    def setUp(self):
        self.before = {"pid": 77, "uid": 501, "path": "/owned/App", "start": [123, 4], "traced": False, "status": 2}
        self.after = dict(self.before)
        self.output = ("CODON_LLDB_ATTACHED\n     rip = 0x12345678\n"
                       "0x12345678: " + "0x90 " * 16 + "\nCODON_LLDB_READ\n"
                       "Process 77 detached\nCODON_LLDB_DETACHED\n")

    def test_real_reads_and_detach_prove_only_the_same_resumed_process(self):
        self.assertTrue(completed_read_detach(0, self.output, self.before, self.after))
        self.assertFalse(completed_read_detach(1, self.output, self.before, self.after))
        self.assertFalse(completed_read_detach(0, self.output, self.before, {**self.after, "traced": True}))
        self.assertFalse(completed_read_detach(0, self.output, self.before, {**self.after, "status": 4}))

    def test_pid_reuse_uid_and_path_changes_fail_closed(self):
        for change in [{"pid": 78}, {"uid": 502}, {"path": "/foreign/App"}, {"start": [124, 4]}]:
            with self.subTest(change=change):
                after = {**self.after, **change}
                self.assertFalse(same_process(self.before, after))
                self.assertFalse(completed_read_detach(0, self.output, self.before, after))
                with self.assertRaises(ValueError):
                    require_owned_process(self.before, after, "/owned/App", 501)

    def test_missing_identity_or_existing_debugger_is_rejected(self):
        after = dict(self.after)
        del after["uid"]
        self.assertFalse(same_process(self.before, after))
        with self.assertRaises(ValueError):
            require_owned_process({**self.before, "traced": True}, self.after, "/owned/App", 501)
        with self.assertRaises(ValueError):
            require_owned_process(self.before, self.after, "/foreign/App", 501)

    def test_command_echoes_and_missing_read_data_do_not_pass(self):
        echoes = "\n".join(basic_read_commands(77, "/private/protocol.log"))
        self.assertFalse(completed_read_detach(0, echoes, self.before, self.after))
        self.assertFalse(completed_read_detach(0, self.output.replace("0x90 ", ""), self.before, self.after))
        self.assertFalse(completed_read_detach(0, self.output.replace("Process 77", "Process 78"), self.before, self.after))

    def test_profile_defers_discovery_before_attach_without_target_expressions(self):
        commands = basic_read_commands(77, "/private/protocol with spaces.log")
        self.assertLess(commands.index(BASIC_PROFILE[3]), commands.index("process attach --pid 77"))
        self.assertTrue(all("expression " not in command and "sdk-path" not in command for command in commands))
        with self.assertRaises(ValueError):
            basic_read_commands(0, "/private/protocol.log")

    def test_string_summaries_are_data_and_cannot_be_guessed(self):
        self.assertEqual(parse_nsstring_summary('@"Native query text"'), "Native query text")
        self.assertEqual(parse_nsstring_summary('"Na"'), "Na")
        for value in [None, "", "<unavailable>", "123", "null"]:
            self.assertIsNone(parse_nsstring_summary(value))


if __name__ == "__main__":
    unittest.main()
