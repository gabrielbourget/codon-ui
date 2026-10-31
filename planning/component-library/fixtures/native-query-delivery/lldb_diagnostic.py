"""Session-local LLDB settings and fail-closed proof checks for the private iOS lab."""

import json
import re
import shlex


BASIC_PROFILE = (
    "settings set auto-confirm true",
    "settings set target.preload-symbols false",
    "settings set target.auto-import-clang-modules false",
    "settings set target.load-script-from-symbol-file false",
    "settings set symbols.enable-external-lookup false",
    "settings set symbols.load-on-demand true",
    "plugin disable instrumentation-runtime.BoundsSafety",
    "settings set target.experimental.inject-local-vars false",
)
IDENTITY_KEYS = ("pid", "uid", "start", "path")


def same_process(before, after):
    return all(key in before and key in after and before[key] == after[key]
               for key in IDENTITY_KEYS)


def require_owned_process(before, after, expected_path, expected_uid):
    if (not same_process(before, after) or before["path"] != expected_path
            or before["uid"] != expected_uid or before.get("traced")):
        raise ValueError("Target must retain its owned PID, UID, executable and birth identity")


def basic_read_commands(pid, protocol_log):
    if not isinstance(pid, int) or pid <= 0:
        raise ValueError("Require a positive, already verified target PID")
    return [
        *BASIC_PROFILE,
        "log enable -f " + shlex.quote(str(protocol_log)) + " lldb process host platform",
        "process attach --pid " + str(pid),
        'script print("CODON_LLDB_ATTACHED")',
        "register read rip",
        "memory read --format x --size 1 --count 16 $pc",
        'script print("CODON_LLDB_READ")',
        "process detach",
        'script print("CODON_LLDB_DETACHED")',
    ]


def completed_read_detach(exit_code, output, before, after):
    if (exit_code != 0 or not same_process(before, after)
            or after.get("traced", True) or after.get("status") == 4):
        return False
    markers = {"CODON_LLDB_ATTACHED", "CODON_LLDB_READ", "CODON_LLDB_DETACHED"}
    if not markers.issubset(set(output.splitlines())):
        return False
    if not re.search(r"^\s*rip = 0x[0-9a-fA-F]+", output, re.M):
        return False
    byte_rows = re.findall(r"^0x[0-9a-fA-F]+:\s*((?:0x[0-9a-fA-F]{2}\s*)+)", output, re.M)
    byte_count = sum(len(re.findall(r"0x[0-9a-fA-F]{2}", row)) for row in byte_rows)
    return byte_count >= 16 and "Process " + str(before["pid"]) + " detached" in output


def parse_nsstring_summary(summary):
    if not summary:
        return None
    if summary.startswith("@"):
        summary = summary[1:]
    try:
        value = json.loads(summary)
    except ValueError:
        return None
    return value if isinstance(value, str) else None
