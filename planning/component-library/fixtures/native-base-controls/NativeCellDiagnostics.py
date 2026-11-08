"""Export a closed XCTest run's diagnostics or attachments without booting a guest."""
import argparse
import json
import os
from pathlib import Path
import time

from NativeAndroidTestSupport import recorded_command
from NativeCellVerification import driver_exit_code, load_admission


def export_commands(bundle, output, export_kind):
    if export_kind not in {"diagnostics", "attachments"}:
        raise ValueError("Unsupported closed-result export")
    tool = "/Applications/Xcode.app/Contents/Developer/usr/bin/xcresulttool"
    return [
        ("summary", [tool, "get", "test-results", "summary", "--path", str(bundle)]),
        (export_kind, [tool, "export", export_kind, "--path", str(bundle), "--output-path", str(output / export_kind)]),
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cell", required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--export-kind", choices=["diagnostics", "attachments"], default="diagnostics")
    args = parser.parse_args()
    admission = load_admission(__file__, args.cell, {"ios": [], "android": []})
    args.out.mkdir(exist_ok=False)
    deadline = time.time() + admission["attempt"]["maximumSeconds"] - admission["attempt"]["cleanupReserveSeconds"]
    env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
    results = []
    for name, argv in export_commands(args.bundle, args.out, args.export_kind):
        result = recorded_command(argv, args.out / name, None, deadline, env)
        results.append(result)
        if result.get("exitCode") != 0 or not result.get("ownedGroupGone"):
            break
    complete = len(results) == 2 and all(row.get("exitCode") == 0 and not row.get("timedOut") for row in results)
    clean = all(row.get("ownedGroupGone") is True and not row.get("cleanupError") for row in results)
    receipt = {"preflight": admission, "cell": args.cell, "status": "EXPORTED" if complete and clean else "INCOMPLETE", "exportKind": args.export_kind, "guestActions": 0, "steps": results}
    (args.out / "terminal.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "guestActions": 0}), flush=True)
    raise SystemExit(driver_exit_code(results[-1].get("exitCode"), complete, clean))
