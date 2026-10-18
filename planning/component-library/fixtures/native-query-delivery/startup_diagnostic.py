"""Proof checks for a private XCTest observer using a host-prelaunched app."""

import re
from pathlib import Path

from lldb_diagnostic import require_owned_process


def runner_bootstrap_failure(receipt, log):
    if (receipt.get("exitCode") != 65 or receipt.get("stopReason")
            or receipt.get("completedVerdict") is not False
            or receipt.get("selectedMethodStarted") is not False
            or receipt.get("typingBegins") != 0):
        return False
    return any(marker in log for marker in (
        "Timed out waiting for AX loaded notification",
        "Timed out while loading Accessibility.",
        'Busy ("Application failed preflight checks")',
    ))


def priority_callback_proof(summary, captures, method):
    if (not method.endswith("/testTransportPreflight")
            or summary.get("totalTestCount") != 1 or summary.get("passedTests") != 1
            or summary.get("failedTests") != 0):
        return False
    callbacks = [item for item in captures if isinstance(item, dict)
                 and item.get("protocol") == "controlled-open-veto"]
    if len(callbacks) != 1:
        return False
    owner = callbacks[0].get("owner")
    if not isinstance(owner, dict):
        return False
    requests = owner.get("requests")
    return (isinstance(requests, dict) and requests.get("opens") == 1
            and owner.get("scenario") == "veto" and owner.get("query") == "")


def launched_app_pid(output, bundle):
    matches = re.findall(r"^" + re.escape(bundle) + r":\s*([0-9]+)\s*$", output, re.M)
    if len(matches) != 1 or int(matches[0]) <= 0:
        raise ValueError("Require one explicit launch result for the expected bundle")
    return int(matches[0])


def installed_app_executable(container, metadata, bundle):
    path = Path(container)
    if not path.is_absolute() or not isinstance(metadata, dict) or metadata.get("CFBundleIdentifier") != bundle:
        raise ValueError("Require the verified installed container and expected bundle metadata")
    executable = metadata.get("CFBundleExecutable")
    if (not isinstance(executable, str) or not executable or executable in (".", "..")
            or "/" in executable or "\\" in executable):
        raise ValueError("Require an executable name inside the installed app container")
    return str(path / executable)


def new_app_after_launch(binding, expected_path, expected_uid, launched_at):
    try:
        require_owned_process(binding, binding, expected_path, expected_uid)
        seconds, microseconds = binding["start"]
        born_after_launch = seconds + microseconds / 1_000_000 >= launched_at
    except (ValueError, TypeError, KeyError):
        return False
    return (born_after_launch and binding.get("traced") is False
            and binding.get("status") in (2, 3))


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
