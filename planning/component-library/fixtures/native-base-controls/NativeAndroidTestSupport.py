"""Small non-shipping Android observation and owned-command helpers."""

import datetime
import json
import os
import re
import signal
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

FOCUSED_LOGCAT_TAGS = ("ActivityManager:E", "AndroidRuntime:E", "ReactNativeJS:E", "libc:F", "DEBUG:F", "*:S")


def focused_logcat_command(adb, serial):
    return [str(adb), "-s", serial, "logcat", "-v", "threadtime", "-b", "main", "-b", "system", "-b", "crash", *FOCUSED_LOGCAT_TAGS]


def parse_hierarchy(raw):
    data = ET.fromstring(raw)
    assert data.tag == "hierarchy" and data.get("rotation") == "0", "An actual portrait hierarchy is required"
    assert next(data.iter("node"), None) is not None, "An empty hierarchy is not readiness"
    assert not any("isn't responding" in node.get("text", "") for node in data.iter("node")), "Preserve stock ANR; do not dismiss it"
    return data


def selected_scene(data, description):
    nodes = list(data.iter("node"))
    return data.tag == "hierarchy" and data.get("rotation") == "0" and not any("isn't responding" in node.get("text", "") for node in nodes) and any(node.get("content-desc") == description and node.get("selected") == "true" for node in nodes) and any(node.get("resource-id") == "showcase-scroll" for node in nodes)


class ClearSceneInterval:
    def __init__(self, seconds=30):
        self.seconds = seconds
        self.since = None
        self.last = None

    def observe(self, monotonic_time, ready):
        assert self.last is None or monotonic_time >= self.last
        self.last = monotonic_time
        if not ready:
            self.since = None
            return False
        if self.since is None:
            self.since = monotonic_time
        return monotonic_time - self.since >= self.seconds


def group_present(process, verify_reaped_group=None):
    # Reap our exited leader before probing the group.
    process.poll()
    if process.returncode is not None and verify_reaped_group is not None:
        if verify_reaped_group(process) is not True:
            raise ValueError("Reaped group absence is not verified")
        return False
    try:
        os.killpg(process.pid, 0)
        return True
    except ProcessLookupError:
        return False


def stop_owned_process(process, verify_reaped_group=None):
    if group_present(process, verify_reaped_group):
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        # Wait for the owned leader to become reapable before probing its exiting group.
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass
        if group_present(process, verify_reaped_group):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            until = time.monotonic() + 3
            while group_present(process, verify_reaped_group) and time.monotonic() < until:
                process.poll()
                time.sleep(0.02)
        if process.poll() is None:
            process.wait(timeout=0.1)
    return not group_present(process, verify_reaped_group)


def recorded_command(argv, prefix, cap_seconds, deadline_unix, env=None):
    prefix = Path(prefix)
    # Finish owned-child cleanup before the enclosing cohort owner reaches its cap.
    remaining = deadline_unix - time.time() - 8
    timeout = remaining if cap_seconds is None else min(cap_seconds, remaining)
    record = {"argv": list(map(str, argv)), "startedEpoch": time.time(), "capSeconds": timeout, "deadlineUnix": deadline_unix, "cleanupReserveSeconds": 8, "status": "NOT_STARTED"}
    record["startedUTC"] = datetime.datetime.fromtimestamp(record["startedEpoch"], datetime.timezone.utc).isoformat()
    process = None
    output = error = b""
    try:
        assert timeout > 0, "Work deadline exhausted; do not start another command"
        process = subprocess.Popen(record["argv"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        record.update(pid=process.pid, processGroup=process.pid, ownerPID=os.getpid(), status="RUNNING")
        prefix.with_suffix(".json").write_text(json.dumps(record, indent=2) + "\n")
        try:
            output, error = process.communicate(timeout=timeout)
            record["status"] = "TERMINAL"
        except subprocess.TimeoutExpired as failure:
            output, error = failure.stdout or b"", failure.stderr or b""
            record.update(status="HOST_TIMEOUT_GUEST_OUTCOME_UNCERTAIN", timedOut=True)
            stop_owned_process(process)
            output, error = process.communicate(timeout=3)
    except BaseException as failure:
        record["error"] = repr(failure)
        if record["status"] == "RUNNING":
            record["status"] = "FAILED_TRANSPORT"
        raise
    finally:
        if process is not None:
            try:
                record["ownedGroupGone"] = stop_owned_process(process)
            except BaseException as failure:
                record["cleanupError"] = repr(failure)
            record["exitCode"] = process.poll()
            for stream in (process.stdout, process.stderr):
                if stream is not None:
                    stream.close()
        record["endedEpoch"] = time.time()
        record["endedUTC"] = datetime.datetime.fromtimestamp(record["endedEpoch"], datetime.timezone.utc).isoformat()
        prefix.with_suffix(".stdout").write_bytes(output)
        prefix.with_suffix(".stderr").write_bytes(error)
        prefix.with_suffix(".json").write_text(json.dumps(record, indent=2) + "\n")
    return record


def measured_bounds(node, viewport=None):
    assert node is not None
    value = list(map(int, re.findall(r"-?\d+", node.get("bounds", ""))))
    assert len(value) == 4 and value[2] >= value[0], node.attrib
    # UiAutomator clips offscreen bottoms/tops independently; this is navigation metadata, never a touch target.
    assert value[3] >= value[1] or (viewport is not None and (value[1] >= viewport[3] or value[3] <= viewport[1])), node.attrib
    return value

def bounds(node):
    value = measured_bounds(node)
    assert value[2] > value[0] and value[3] > value[1], node.attrib
    return value

def copy_node(data, native_windows):
        candidates = [n for n in data.iter("node") if n.get("resource-id") == "android:id/copy"]
        if not candidates:
            candidates = [n for n in data.iter("node") if (n.get("text") or n.get("content-desc", "")).casefold() == "copy"]
        if not candidates:
            assert native_windows["windowRoots"] > 0 and native_windows["windowNodes"], native_windows
            for row in native_windows["windowNodes"]:
                if row["visible"] and (row.get("id") == "android:id/copy" or (row.get("text") or row.get("description") or "").casefold() == "copy"):
                    rect = list(map(int, row["bounds"].split()))
                    assert len(rect) == 4
                    candidates.append(ET.Element("node", {"resource-id": row.get("id") or "", "text": row.get("text") or "", "content-desc": row.get("description") or "", "enabled": str(row["enabled"]).lower(), "bounds": f"[{rect[0]},{rect[1]}][{rect[2]},{rect[3]}]", "native-window-id": str(row["windowId"])}))
        if len(candidates) == 2:
            # Stock floating toolbar exposes its labelled container and nested title as one action.
            titles = [n for n in candidates if n.get("resource-id") == "android:id/floating_toolbar_menu_item_text" and n.get("text").casefold() == "copy"]
            containers = [n for n in candidates if not n.get("text") and n.get("content-desc", "").casefold() == "copy"]
            if len(titles) == len(containers) == 1:
                title, container = titles[0], containers[0]
                inner, outer = bounds(title), bounds(container)
                if title.get("native-window-id") == container.get("native-window-id") and outer[0] <= inner[0] < inner[2] <= outer[2] and outer[1] <= inner[1] < inner[3] <= outer[3]:
                    candidates = titles
        assert len(candidates) <= 1, "Ambiguous native Copy action"
        return candidates[0] if candidates else None
