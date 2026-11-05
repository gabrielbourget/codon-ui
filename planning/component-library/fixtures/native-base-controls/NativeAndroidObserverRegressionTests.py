"""Replay saved Android observer failures without ADB, compilation or a guest."""

import copy
import json
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch


root = Path(__file__).parent
from NativeAndroidTestSupport import ClearSceneInterval, bounds, copy_node, focused_logcat_command, measured_bounds, parse_hierarchy, recorded_command, selected_scene, stop_owned_process

namespace = {"bounds": bounds, "copy_node": copy_node, "measured_bounds": measured_bounds}
data = json.loads((root / "NativeAndroidObserverRegressions.json").read_text())
checks = 0


def rejects(operation, *arguments):
    global checks
    try:
        operation(*arguments)
    except AssertionError:
        checks += 1
        return
    raise AssertionError("Invalid target or ambiguous action was admitted")


clipped = ET.Element("node", data["clippedBounds"]["node"])
viewport = namespace["bounds"](ET.Element("node", data["clippedBounds"]["viewport"]))
assert namespace["measured_bounds"](clipped, viewport) == [45, 1596, 674, 1558]
checks += 1
rejects(namespace["bounds"], clipped)
rejects(namespace["measured_bounds"], clipped)
rejects(namespace["measured_bounds"], ET.Element("node", bounds="[45,800][674,700]"), viewport)
rejects(namespace["bounds"], ET.Element("node", bounds="[45,800][45,800]"))
assert namespace["bounds"](ET.Element("node", bounds="[45,600][674,680]")) == [45, 600, 674, 680]
checks += 1

for case in data["selectionCases"]:
    result = namespace["copy_node"](ET.Element("hierarchy"), case["native"])
    assert (result is not None) == case["expectedCopy"], case["name"]
    if result is not None:
        assert result.get("text") == "Copy" and result.get("enabled") == "true"
        namespace["bounds"](result)
    checks += 1

positive = next(case["native"] for case in data["selectionCases"] if case["expectedCopy"])
separate = copy.deepcopy(positive)
container = next(row for row in separate["windowNodes"] if row.get("description") == "Copy")
container["windowId"] = -777
rejects(namespace["copy_node"], ET.Element("hierarchy"), separate)
disjoint = copy.deepcopy(positive)
container = next(row for row in disjoint["windowNodes"] if row.get("description") == "Copy")
container["bounds"] = "1 1 2 2"
rejects(namespace["copy_node"], ET.Element("hierarchy"), disjoint)
duplicate = copy.deepcopy(positive)
title = copy.deepcopy(next(row for row in duplicate["windowNodes"] if row.get("text") == "Copy"))
title["windowId"] = -888
duplicate["windowNodes"].append(title)
rejects(namespace["copy_node"], ET.Element("hierarchy"), duplicate)

for case in data["admissionCases"]:
    try:
        hierarchy = parse_hierarchy(case["raw"])
    except (AssertionError, ET.ParseError):
        assert case["parseAccepted"] is False, case["name"]
    else:
        assert case["parseAccepted"] is True, case["name"]
        assert selected_scene(hierarchy, "Text/Button scene") == case["sceneReady"], case["name"]
    checks += 1

interval = ClearSceneInterval()
for timestamp, ready, accepted in [(0, True, False), (14, True, False), (29, False, False), (30, True, False), (59, True, False), (60, True, True), (61, False, False), (71, True, False), (101, True, True)]:
    assert interval.observe(timestamp, ready) == accepted
    checks += 1

logging = focused_logcat_command("adb", "emulator-5568")
assert logging[-6:] == ["ActivityManager:E", "AndroidRuntime:E", "ReactNativeJS:E", "libc:F", "DEBUG:F", "*:S"]
assert "*:W" not in logging and "ResourcesManager" not in " ".join(logging)
checks += 1

receipts = Path(tempfile.mkdtemp(prefix="codon-native-observer-regressions-"))
success = recorded_command([sys.executable, "-c", "print('receipt-success')"], receipts / "success", 2, time.time() + 20)
assert success["exitCode"] == 0 and success["ownedGroupGone"] is True
assert (receipts / "success.stdout").read_text() == "receipt-success\n"
checks += 1
failed = recorded_command([sys.executable, "-c", "import sys;print('deliberate-failure', file=sys.stderr);sys.exit(7)"], receipts / "nonzero", 2, time.time() + 20)
assert failed["exitCode"] == 7 and failed["ownedGroupGone"] is True
assert "deliberate-failure" in (receipts / "nonzero.stderr").read_text()
checks += 1
timed_out = recorded_command([sys.executable, "-c", "import time;print('ready', flush=True);time.sleep(10)"], receipts / "timeout", 0.5, time.time() + 20)
assert timed_out["timedOut"] is True and timed_out["ownedGroupGone"] is True and timed_out["exitCode"] != 0
checks += 1
rejects(recorded_command, [sys.executable, "-c", "raise AssertionError('must not start')"], receipts / "past-deadline", 2, time.time() - 1)
not_started = json.loads((receipts / "past-deadline.json").read_text())
assert not_started["status"] == "NOT_STARTED" and "pid" not in not_started
with patch.object(subprocess.Popen, "communicate", side_effect=OSError("deliberate observer transport failure")):
    try:
        recorded_command([sys.executable, "-c", "import time;time.sleep(10)"], receipts / "transport-failure", 2, time.time() + 20)
    except OSError:
        pass
    else:
        raise AssertionError("Transport failure was hidden")
transport = json.loads((receipts / "transport-failure.json").read_text())
assert transport["status"] == "FAILED_TRANSPORT" and transport["ownedGroupGone"] is True
assert "deliberate observer transport failure" in transport["error"]
checks += 1

class ExitingLeader:
    pid = 777777
    reaped = False
    term_sent = False

    def poll(self):
        return -15 if self.reaped else None

    def wait(self, timeout):
        assert self.term_sent and timeout == 3
        self.reaped = True
        return -15


leader = ExitingLeader()
def exiting_group_probe(pid, signal_number):
    assert pid == leader.pid
    if signal_number == 15:
        leader.term_sent = True
    elif signal_number == 0:
        if leader.term_sent and not leader.reaped:
            raise PermissionError("Exiting owned group cannot be probed before reaping")
        if leader.reaped:
            raise ProcessLookupError()
    else:
        raise AssertionError("Unexpected signal")


with patch("NativeAndroidTestSupport.os.killpg", side_effect=exiting_group_probe):
    assert stop_owned_process(leader) is True and leader.reaped
checks += 1

with patch("NativeAndroidTestSupport.os.killpg", side_effect=PermissionError("Denied group probe")):
    try:
        stop_owned_process(ExitingLeader())
    except PermissionError:
        checks += 1
    else:
        raise AssertionError("Permission denial was hidden")

print(f"PASS: {checks} observer/admission/owned-command checks; no guest or native actions; receipts={receipts}")
