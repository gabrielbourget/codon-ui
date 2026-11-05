"""Small admission gate; the existing driver remains the sole lifecycle owner."""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys

VERSION = "NATIVE-CELL-02"
CHECKLIST = Path(__file__).with_name("NativeCellVerificationChecklist.md")
RUBRIC = Path(__file__).resolve().parents[2] / "roadmap.md"
RISKS = {"fractional_geometry", "shadow", "antialiasing", "rotation", "scene_readiness", "cleanup"}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(value, message):
    if not value:
        raise ValueError(message)


def driver_exit_code(sdk_exit_code, coverage_complete, cleanup_complete):
    if sdk_exit_code != 0:
        return sdk_exit_code if isinstance(sdk_exit_code, int) and 0 < sdk_exit_code < 256 else 1
    return 0 if coverage_complete and cleanup_complete else 1


def bound_file(item):
    path = Path(item["path"]).resolve()
    require(path.is_file() and digest(path) == item["sha256"], "Missing or changed input: " + str(path))
    return path


def physical(rect):
    require(len(rect) == 4 and all(math.isfinite(v) for v in rect), "Invalid physical rectangle")
    return [math.floor(v + .5) for v in rect]


def contained(child, parent):
    x, y, width, height = physical(child)
    left, top, outer_width, outer_height = physical(parent)
    return width > 0 and height > 0 and x >= left and y >= top and x + width <= left + outer_width and y + height <= top + outer_height


def native_method(item):
    path = bound_file(item)
    limit = item["maximumSeconds"]
    require(0 < limit <= 180, "Native method limit must retain the existing 180-second ceiling")
    name = item["method"]
    if item["format"] == "xctest_log":
        text = path.read_text()
        prefix = r"Test Case '-\[[^\]]+ " + re.escape(name) + r"\]' "
        durations = re.findall(prefix + r"passed \(([0-9.]+) seconds\)\.", text)
        require(len(durations) == 1, "Missing/ambiguous passing method: " + name)
        require(not re.search(prefix + r"(?:failed|exceeded execution time allowance)", text), "Failed/timed-out native method: " + name)
        seconds = float(durations[0])
    elif item["format"] == "android_receipt":
        rows = [row for row in json.loads(path.read_text())["cohorts"] if row["name"] == name]
        require(len(rows) == 1 and rows[0]["status"] in ["NATIVE_ASSERTIONS_PASSED_PENDING_COLOR_AND_ROOT_REVIEW", "NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW"], "Native cohort not passing: " + name)
        seconds = rows[0]["elapsedMs"] / 1000
    else:
        raise ValueError("Unknown native method evidence format")
    require(math.isfinite(seconds) and 0 <= seconds <= limit, "Over-budget native method: " + name)
    return {"method": name, "seconds": seconds, "maximumSeconds": limit, "status": "PASS"}


def saved_data_controls():
    # Minimal values from the saved Indicator failures; these are host controls,
    # not execution of a component's Java/Swift observer or installed qualification.
    require(contained([0, 0, 17.0001220703125, 17.0001220703125], [0, 0, 17, 17]), "Fractional native crop")
    require(not contained([1, 0, 17, 17], [0, 0, 17, 17]), "Physical out-of-row negative")
    require(not contained([0, 0, 18, 17], [0, 0, 17, 17]), "Wrong native size negative")
    white = [255, 255, 255, 255]
    require(all(pixel == white for pixel in [white, white]), "Unpainted positive")
    require(not all(pixel == white for pixel in [white, [254, 254, 254, 255]]), "Shadow contamination negative")
    solid = [1, 2, 4, 5, 6, 7]
    target = [0, 7, 7, 4, 2, 2, 2, 2]
    reference = [1, 7, 7, 5, 2, 2, 2, 2]
    require(all(target[i] == reference[i] for i in solid), "Opaque band positive")
    wrong = reference.copy()
    wrong[2] = 2
    require(not all(target[i] == wrong[i] for i in solid), "Border width negative")
    require({"UIImage.left": 2}["UIImage.left"] != {"EXIF.left": 8}["EXIF.left"], "Orientation namespace control")
    viewport = [0, 0, 100, 100]
    require(contained([5, 5, 20, 20], viewport) and not contained([5, 95, 20, 20], viewport), "Visibility control")
    captured = {"accelerometer_rotation": "1", "user_rotation": "0"}
    restored = dict(captured)
    require(restored == captured, "Exact two-key cleanup positive")
    restored.pop("user_rotation")
    require(restored != captured, "Missing preference negative")
    return {"status": "PASS", "scope": "Host saved-data admission controls only; observer controls and risk evidence are separately bound", "controls": ["fractional_geometry", "physical_outside_negative", "shadow", "opaque_border", "width_negative", "orientation_namespace", "visibility", "exact_cleanup_key_set"]}


def validate(plan):
    require(re.fullmatch(r"CAT\.[a-z0-9-]+\.G0[1-9]", plan["cell"]), "One named cell required")
    ack = plan["checklist"]
    require("Version: " + VERSION in CHECKLIST.read_text(), "Checklist/code version mismatch")
    require(ack["version"] == VERSION and ack["sha256"] == digest(CHECKLIST), "Missing/stale checklist version or hash")
    require(ack.get("read") is True and ack.get("reader"), "Explicit checklist reading acknowledgment required")
    require(bound_file(plan["rubric"]) == RUBRIC.resolve(), "Current canonical rubric binding required")
    prepared = plan["preparation"]
    require(prepared.get("allChecksPrepared") is True and prepared.get("compatibleChecksBatched") is True, "Full-cell preparation/batching missing")
    for key in ["source", "fixture", "observer"]:
        require(plan["bindings"].get(key), "Missing " + key + " bindings")
        for item in plan["bindings"][key]:
            bound_file(item)
    for platform in ["ios", "android"]:
        row = plan["platforms"][platform]
        require(row.get("selectedCohorts", []) == plan["driver"]["cohorts"].get(platform, []), "Driver batch differs from prepared cohorts: " + platform)
        require(row.get("selectedCohorts") or row.get("reusedEvidence"), "Missing OS proof/plan: " + platform)
        require(isinstance(row.get("remaining"), list), "Remaining checks must be explicit")
        for item in row.get("reusedEvidence", []):
            require(item.get("claim"), "Reused evidence needs a scoped claim")
            require(item.get("kind") in ["native_method", "source", "product", "host_reconciliation", "control", "history"], "Reused evidence needs an explicit verification kind")
            bound_file(item)
            if item.get("kind") == "native_method":
                native_method(item)
    report = json.loads(bound_file(plan["observerControls"]).read_text())
    require(report["status"] == "PASS" and report.get("controls"), "Observer controls failed/missing")
    require(all(row.get("result") == "PASS" and row.get("kind") in ["executed", "static", "reused"] and row.get("scope") for row in report["controls"]), "Individual observer control failed or lacks an explicit scope")
    require(report["observerSHA256"] in {item["sha256"] for item in plan["bindings"]["observer"]}, "Controls belong to another observer")
    require(report["fixtureSHA256"] in {item["sha256"] for item in plan["bindings"]["fixture"]}, "Controls belong to another fixture")
    require(set(plan["riskControls"]) == RISKS, "Required risk dispositions missing")
    for name, row in plan["riskControls"].items():
        require(row["disposition"] in ["exercised", "reused", "unselected_by_risk"] and row.get("reason"), "Invalid risk disposition: " + name)
        require(row.get("evidence") or row["disposition"] == "unselected_by_risk", "Missing risk evidence: " + name)
        for item in row.get("evidence", []):
            bound_file(item)
    attempt = plan["attempt"]
    require(0 < attempt["maximumSeconds"] <= 1800 and 0 < attempt["cleanupReserveSeconds"] < attempt["maximumSeconds"], "Invalid cleanup-inclusive attempt bound")
    driver = bound_file(plan["driver"])
    require("codon-native-matrix" not in str(driver), "Sealed data is not executable")
    require(len(plan["driver"]["argv"]) >= 2 and Path(plan["driver"]["argv"][1]).resolve() == driver, "Driver argv binding mismatch")
    return saved_data_controls()


def load_admission(driver, cell, cohorts):
    path = os.environ.get("CODON_NATIVE_CELL_PREFLIGHT_RECEIPT")
    require(path, "Use NativeCellVerification.py before this driver")
    receipt = json.loads(Path(path).read_text())
    require(receipt["status"] == "PASS" and receipt["cell"] == cell, "Preflight did not admit this cell")
    require(receipt["checklistVersion"] == VERSION and receipt["checklistSHA256"] == digest(CHECKLIST), "Stale preflight checklist")
    require(receipt["driverSHA256"] == digest(driver) and receipt["ownerPID"] == os.getpid(), "Preflight belongs to another driver/owner")
    actual = [str(Path(sys.argv[0]).resolve()), *sys.argv[1:]]
    expected = [str(Path(receipt["driverArgv"][1]).resolve()), *receipt["driverArgv"][2:]]
    require(actual == expected and cohorts == receipt["driverCohorts"], "Actual driver argv/batch differs from admission")
    return {"path": path, "sha256": digest(path), "version": VERSION, "result": receipt["status"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    receipt = {"status": "REJECTED", "checklistVersion": VERSION, "checklistSHA256": digest(CHECKLIST), "ownerPID": os.getpid(), "checkedUTC": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        plan = json.loads(args.plan.read_text())
        receipt.update(cell=plan["cell"], planSHA256=digest(args.plan))
        receipt["savedDataControls"] = validate(plan)
        receipt.update(status="PASS", checklistAcknowledgment=plan["checklist"], driverSHA256=plan["driver"]["sha256"], driverArgv=plan["driver"]["argv"], driverCohorts=plan["driver"]["cohorts"], observerControls=plan["observerControls"], riskControls=plan["riskControls"], platforms=plan["platforms"])
    except (ValueError, KeyError, TypeError, OSError) as error:
        receipt["error"] = str(error)
    require(not args.receipt.exists(), "Do not overwrite an admission receipt")
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "receipt": str(args.receipt), "checklistVersion": VERSION}), flush=True)
    if receipt["status"] != "PASS":
        return 2
    if args.run:
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT": str(args.receipt.resolve())}
        os.execvpe(plan["driver"]["argv"][0], plan["driver"]["argv"], env)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
