"""Proof checks for a private XCTest observer using a host-prelaunched app."""

import re

from lldb_diagnostic import require_owned_process


def launched_app_pid(output, bundle):
    matches = re.findall(r"^" + re.escape(bundle) + r":\s*([0-9]+)\s*$", output, re.M)
    if len(matches) != 1 or int(matches[0]) <= 0:
        raise ValueError("Require one explicit launch result for the expected bundle")
    return int(matches[0])


def prelaunched_callback_passed(receipt, before, after, expected_path, expected_uid):
    try:
        require_owned_process(before, after, expected_path, expected_uid)
    except ValueError:
        return False
    if any(state.get("traced") is not False or state.get("status") not in (2, 3)
           for state in (before, after)):
        return False
    return (receipt.get("exitCode") == 0 and not receipt.get("stopReason")
            and receipt.get("completedVerdict") is True
            and receipt.get("nativeCallbackPassed") is True)
