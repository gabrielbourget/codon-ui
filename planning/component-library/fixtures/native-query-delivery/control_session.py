"""Describe XCTest control replies without treating them as callback readiness."""

import re


def control_session_requests(log):
    requests = []
    pending = None
    reply_time = None
    candidate = False
    previous_time = None
    day = 0
    socket = None
    for number, line in enumerate(log.splitlines(), 1):
        timestamp = re.match(r"^(\d{2}):(\d{2}):(\d{2}\.\d+)\s", line)
        now = None
        if timestamp:
            hours, minutes, seconds = map(float, timestamp.groups())
            raw = hours * 3600 + minutes * 60 + seconds
            if previous_time is not None and previous_time - raw > 43200:
                day += 86400
            previous_time = raw
            now = day + raw
        connected = re.search(r"Connected socket (\d+) to testmanagerd", line)
        if connected:
            socket = int(connected[1])
        if "Initiating control session with IDE capabilities:" in line:
            overlapping = pending is not None
            if pending:
                pending["ambiguous"] = True
            pending = {"startLine": number, "socket": socket, "startSeconds": now,
                       "replyLine": None, "replySucceeded": False,
                       "elapsedSeconds": None, "timedOut": False,
                       "nativeTimeoutSeconds": None, "ambiguous": overlapping}
            requests.append(pending)
            candidate = False
        timeout = re.search(r"Timed out after ([0-9.]+)s while initiating control session with daemon", line)
        if timeout and pending:
            pending["timedOut"] = True
            pending["nativeTimeoutSeconds"] = float(timeout[1])
        if "Got reply to control session initiation request (result:error):" in line:
            if not pending:
                continue
            reply_time = now
            pending["replyLine"] = number
            candidate = "<XCTCapabilities:" in line
            if candidate:
                continue
        elif not (candidate and line.strip().startswith("}:")):
            continue
        if not pending:
            continue
        elapsed = None
        if reply_time is not None and pending["startSeconds"] is not None:
            elapsed = round(reply_time - pending["startSeconds"], 6)
        pending["elapsedSeconds"] = elapsed
        pending["replySucceeded"] = (candidate and line.strip() == "}: (null)"
                                     and not pending["ambiguous"])
        pending = None
        candidate = False
    for request in requests:
        elapsed = request["elapsedSeconds"]
        request["completedWithoutRecordedTimeout"] = (
            request["replySucceeded"] and not request["timedOut"]
            and elapsed is not None and elapsed >= 0
        )
    return requests
