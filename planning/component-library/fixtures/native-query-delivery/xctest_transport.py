"""Replay one frozen XCTest method; optional process probes never gate transport."""

import argparse
import hashlib
import json
import os
import signal
import subprocess
import time
from pathlib import Path


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def native_progress(result):
    # xcresult initialization writes files too; only session logs indicate transport progress.
    return tuple(
        (str(path), path.stat().st_size, path.stat().st_mtime_ns)
        for path in sorted(result.rglob("Session-*.log"))
    )


def stop_process_group(child):
    if child.poll() is not None:
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        child.wait(timeout=5)
        return
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=5)


def run_bounded(command, log_path, result, environment, total, silence, interval=1):
    started = time.monotonic()
    changed = started
    previous = None
    next_report = 20
    reason = None
    with log_path.open("xb") as log:
        child = subprocess.Popen(
            command, env=environment, stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        print(f"XCTest controller PID {child.pid}", flush=True)
        try:
            while child.poll() is None:
                now = time.monotonic()
                signature = (log_path.stat().st_size, native_progress(result))
                if signature != previous:
                    changed = now
                    previous = signature
                if now - started >= total:
                    reason = "total-cap"
                    break
                if now - changed >= silence:
                    # No ps/guest bridge/PID lookup is required or allowed to extend silence.
                    reason = "no-session-or-stdout-progress"
                    break
                if now - started >= next_report:
                    print(json.dumps({"elapsedSeconds": round(now - started),
                                      "silentSeconds": round(now - changed),
                                      "sessionLogs": len(signature[1])}), flush=True)
                    next_report += 20
                time.sleep(interval)
        finally:
            stop_process_group(child)
    return {"command": command, "pid": child.pid, "exitCode": child.returncode,
            "elapsedSeconds": round(time.monotonic() - started, 2), "stopReason": reason}


def callback_proof(summary, captures, method):
    if (summary.get("totalTestCount") != 1 or summary.get("passedTests") != 1
            or summary.get("failedTests") != 0):
        return False
    matches = [item for item in captures if isinstance(item, dict)
               and item.get("frames", {}).get("diag-transport-owner", {}).get("label") == "Transport 1"]
    return method.endswith("/testTransportPreflight") and len(matches) == 1


def completed_method_verdict(summary, method):
    if summary.get("totalTestCount") != 1:
        return False
    if summary.get("passedTests") == 1 and summary.get("failedTests") == 0:
        return True
    if summary.get("failedTests") != 1 or summary.get("passedTests") != 0:
        return False
    selected = "/".join(method.split("/")[-2:])
    identifiers = {method, method + "()", selected, selected + "()"}
    return any(failure.get("testIdentifierString") in identifiers
               for failure in summary.get("testFailures", []))


def replay_selection(xctestrun, project=None, scheme=None, derived_data=None):
    project_options = (project, scheme, derived_data)
    if any(project_options) and not all(project_options):
        raise ValueError("Private project replay requires project, scheme and derived data together")
    if project:
        if xctestrun.parent.resolve() != (derived_data / "Build/Products").resolve():
            raise ValueError("The frozen xctestrun must belong to the selected derived-data products")
        return ["-project", str(project.resolve()), "-scheme", scheme,
                "-derivedDataPath", str(derived_data.resolve()), "-sdk", "iphonesimulator"]
    return ["-xctestrun", str(xctestrun.resolve())]


def export_result(result, output, environment):
    commands = [
        ("summary", ["get", "test-results", "summary", "--path", str(result)]),
        ("attachments", ["export", "attachments", "--path", str(result),
                         "--output-path", str(output / "captures")]),
    ]
    exported = {}
    for name, arguments in commands:
        try:
            completed = subprocess.run(
                ["/usr/bin/xcrun", "xcresulttool", *arguments], env=environment,
                capture_output=True, timeout=60,
            )
            (output / (name + ".log")).write_bytes(completed.stdout + completed.stderr)
            exported[name] = {"exitCode": completed.returncode}
            if name == "summary" and completed.returncode == 0:
                exported["summaryData"] = json.loads(completed.stdout)
        except (subprocess.TimeoutExpired, ValueError) as error:
            exported[name] = {"error": str(error)}
    return exported


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xctestrun", required=True, type=Path)
    parser.add_argument("--device", required=True)
    parser.add_argument("--method", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--developer-dir", required=True, type=Path)
    parser.add_argument("--project", type=Path)
    parser.add_argument("--scheme")
    parser.add_argument("--derived-data", type=Path)
    parser.add_argument("--total-seconds", type=int, default=600)
    parser.add_argument("--silence-seconds", type=int, default=180)
    args = parser.parse_args()
    if not (0 < args.silence_seconds <= args.total_seconds <= 600):
        parser.error("Require 0 < silence <= total <= 600 seconds")
    if not args.xctestrun.is_file():
        parser.error("The frozen .xctestrun must exist")
    try:
        selection = replay_selection(args.xctestrun, args.project, args.scheme, args.derived_data)
    except ValueError as error:
        parser.error(str(error))
    if any((parent / "SEALED.json").exists() for parent in [args.output, *args.output.parents]):
        parser.error("Never write under a sealed evidence packet")
    args.output.mkdir(parents=True, exist_ok=False)
    environment = os.environ.copy()
    environment["DEVELOPER_DIR"] = str(args.developer_dir)
    result = args.output / "result.xcresult"
    command = [
        str(args.developer_dir / "usr/bin/xcodebuild"), "test-without-building", *selection,
        "-destination", "platform=iOS Simulator,id=" + args.device,
        "-parallel-testing-enabled", "NO",
        "-only-testing:" + args.method,
        "-resultBundlePath", str(result),
    ]
    receipt = {"device": args.device, "method": args.method,
               "xctestrun": str(args.xctestrun.resolve()),
               "xctestrunSHA256": hashlib.sha256(args.xctestrun.read_bytes()).hexdigest(),
               "startedAtUnix": time.time(), "totalCapSeconds": args.total_seconds,
               "silenceCapSeconds": args.silence_seconds, "automaticRetries": 0,
               "installerOrPIDProbeRequired": False, "command": command,
               "invocationMode": "private-project" if args.project else "xctestrun",
               "controllerSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    write_json(args.output / "attempt.json", receipt)
    try:
        receipt.update(run_bounded(command, args.output / "xcodebuild.log", result,
                                   environment, args.total_seconds, args.silence_seconds))
    except BaseException as error:
        receipt["controllerError"] = repr(error)
        raise
    finally:
        write_json(args.output / "attempt.json", receipt)
    if (result / "Info.plist").exists():
        receipt["exports"] = export_result(result, args.output, environment)
    summary = receipt.get("exports", {}).get("summaryData", {})
    captures = []
    for path in (args.output / "captures").glob("*.json"):
        try:
            captures.append(json.loads(path.read_text()))
        except ValueError:
            pass
    receipt["completedVerdict"] = completed_method_verdict(summary, args.method)
    receipt["nativeCallbackPassed"] = (
        receipt.get("exitCode") == 0 and not receipt.get("stopReason")
        and callback_proof(summary, captures, args.method)
    )
    write_json(args.output / "attempt.json", receipt)
    print(json.dumps(receipt), flush=True)
    if args.method.endswith("/testTransportPreflight"):
        return 0 if receipt["nativeCallbackPassed"] else 1
    return 0 if receipt.get("exitCode") == 0 and receipt["completedVerdict"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
