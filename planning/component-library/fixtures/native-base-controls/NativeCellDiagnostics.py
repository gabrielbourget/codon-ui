"""Export a closed XCTest run's diagnostics without booting a guest."""
import argparse
import json
import os
from pathlib import Path
import time

from NativeAndroidTestSupport import recorded_command
from NativeCellVerification import driver_exit_code, load_admission


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cell", required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    admission = load_admission(__file__, args.cell, {"ios": [], "android": []})
    args.out.mkdir(exist_ok=False)
    deadline = time.time() + 180
    env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
    tool = "/Applications/Xcode.app/Contents/Developer/usr/bin/xcresulttool"
    results = []
    for name, argv in [
        ("summary", [tool, "get", "test-results", "summary", "--path", str(args.bundle)]),
        ("diagnostics", [tool, "export", "diagnostics", "--path", str(args.bundle), "--output-path", str(args.out / "diagnostics")]),
    ]:
        result = recorded_command(argv, args.out / name, 60, deadline, env)
        results.append(result)
        if result.get("exitCode") != 0 or not result.get("ownedGroupGone"):
            break
    complete = len(results) == 2 and all(row.get("exitCode") == 0 and not row.get("timedOut") for row in results)
    clean = all(row.get("ownedGroupGone") is True and not row.get("cleanupError") for row in results)
    receipt = {"preflight": admission, "cell": args.cell, "status": "EXPORTED" if complete and clean else "INCOMPLETE", "guestActions": 0, "steps": results}
    (args.out / "terminal.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "guestActions": 0}), flush=True)
    raise SystemExit(driver_exit_code(results[-1].get("exitCode"), complete, clean))
