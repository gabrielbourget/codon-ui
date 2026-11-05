"""Check receipts only for newly staged PASS cells; Markdown remains authoritative."""
import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

LEDGER = "planning/component-library/experiments.md"
BASE = "planning/component-library/fixtures/native-base-controls/"
INDEX = BASE + "NativeCellAdoptions.json"
CHECKLIST = BASE + "NativeCellVerificationChecklist.md"
GATE = BASE + "NativeCellVerification.py"


def require(value, message):
    if not value:
        raise ValueError(message)


def ledger_cells(text):
    lines = text.splitlines()
    starts = [i for i, line in enumerate(lines) if line.startswith("|") and [part.strip() for part in line.split("|")[1:3]] == ["Catalogue ID", "3.1.1 Contract"]]
    require(len(starts) == 1, "Expected one canonical catalogue ledger table")
    cells = {}
    for line in lines[starts[0] + 2:]:
        if not line.startswith("|"):
            break
        fields = [part.strip() for part in line.split("|")[1:-1]]
        require(len(fields) >= 10 and re.fullmatch(r"`CAT\.[a-z0-9-]+`", fields[0]), "Malformed catalogue row")
        component = fields[0].strip("`")
        for gate, value in enumerate(fields[1:10], 1):
            cell = component + ".G" + str(gate).zfill(2)
            require(cell not in cells, "Duplicate ledger cell: " + cell)
            require(re.fullmatch(r"(?:PASS|FAIL|BLOCKED|OPEN|N/A|OWNER-DEFERRED)(?:\(.*\))?", value), "Malformed cell status: " + cell)
            cells[cell] = value.split("(", 1)[0]
    require(len(cells) == 477, "Preserve the canonical53-row/477-cell ledger")
    return cells


def newly_passing(before, after):
    old, new = ledger_cells(before), ledger_cells(after)
    require(old.keys() == new.keys(), "Catalogue/gate identities changed")
    return sorted(cell for cell in new if new[cell] == "PASS" and old[cell] != "PASS")


def bound_json(binding, read_bytes):
    require(isinstance(binding, dict) and isinstance(binding.get("path"), str), "Bound receipt path required")
    require(re.fullmatch(r"[0-9a-f]{64}", binding.get("sha256", "")), "Bound receipt SHA256 required")
    data = read_bytes(binding["path"])
    require(hashlib.sha256(data).hexdigest() == binding["sha256"], "Receipt hash mismatch: " + binding["path"])
    value = json.loads(data)
    require(isinstance(value, dict), "Receipt must be an object")
    return value


def validate_promotions(cells, index, version, checklist_sha, read_bytes, native_method):
    require(index.get("schemaVersion") == 1 and isinstance(index.get("cells"), dict), "Invalid non-authoritative adoption index")
    verified = []
    for cell in cells:
        row = index["cells"].get(cell)
        require(isinstance(row, dict) and "completion" in row, "New PASS lacks a bound completion receipt: " + cell)
        done = bound_json(row["completion"], read_bytes)
        require(done.get("kind") == "native_cell_completion" and done.get("schemaVersion") == 1, "Admission alone is not a completion receipt: " + cell)
        require(done.get("cell") == cell and done.get("status") == "PASS", "Completion does not pass this exact cell: " + cell)
        require(done.get("criteriaComplete") is True and done.get("cleanupVerified") is True, "Incomplete criteria or uncertain cleanup: " + cell)
        require(done.get("checklistVersion") == version and done.get("checklistSHA256") == checklist_sha, "Stale completion checklist: " + cell)
        admitted = bound_json(done.get("preflight"), read_bytes)
        require(admitted.get("cell") == cell and admitted.get("status") == "PASS", "Preflight did not admit this exact cell: " + cell)
        require(admitted.get("checklistVersion") == version and admitted.get("checklistSHA256") == checklist_sha, "Stale preflight checklist: " + cell)
        for key in ["planSHA256", "driverSHA256"]:
            require(re.fullmatch(r"[0-9a-f]{64}", done.get(key, "")) and done[key] == admitted.get(key), "Completion/preflight binding mismatch: " + key)
        finished = datetime.datetime.fromisoformat(done["finishedUTC"])
        checked = datetime.datetime.fromisoformat(admitted["checkedUTC"])
        require(finished.utcoffset() is not None and checked.utcoffset() is not None and finished >= checked, "Completion must follow admitted preflight")
        methods = done.get("nativeMethods", [])
        claimed = done.get("nativeMethodEvidenceClaimed")
        require(isinstance(claimed, bool) and isinstance(methods, list) and bool(methods) == claimed, "Native method claim/list mismatch: " + cell)
        for method in methods:
            require(method.get("kind") == "native_method" and method.get("claim"), "Explicit native method evidence/scope required")
            native_method(method)
        driver = done.get("driver", {})
        driver_path = Path(driver.get("path", ""))
        require(driver.get("path") and not driver_path.is_absolute() and ".." not in driver_path.parts, "Completion needs a maintained repository driver")
        require(driver.get("sha256") == done["driverSHA256"] and hashlib.sha256(read_bytes(driver["path"])).hexdigest() == done["driverSHA256"], "Maintained driver bytes differ from admitted driver")
        required_formats = {"G02": {"xctest_log", "android_receipt"}, "G04": {"xctest_log", "android_receipt"}, "G07": {"android_receipt"}, "G08": {"xctest_log"}, "G09": {"xctest_log", "android_receipt"}}.get(cell.rsplit(".", 1)[1], set())
        require({method.get("format") for method in methods} >= required_formats, "Native gate lacks its required platform evidence: " + cell)
        verified.append(cell)
    return verified


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    repo = args.repository.resolve()

    def git_bytes(spec):
        return subprocess.check_output(["git", "show", spec], cwd=repo, timeout=15)

    cells = newly_passing(git_bytes("HEAD:" + LEDGER).decode(), git_bytes(":" + LEDGER).decode())
    if not cells:
        print("[native-ledger] no newly promoted PASS cells; historical passes unchanged")
        return 0

    def read_bytes(name):
        path = Path(name)
        if path.is_absolute():
            return path.read_bytes()
        require(".." not in path.parts, "Receipt path escapes repository")
        return git_bytes(":" + path.as_posix())

    checklist = git_bytes(":" + CHECKLIST)
    matches = re.findall(r"^Version: (\S+)$", checklist.decode(), re.MULTILINE)
    require(len(matches) == 1, "Current checklist version missing/ambiguous")
    version = matches[0]
    gate_source = git_bytes(":" + GATE)
    require(gate_source == (repo / GATE).read_bytes(), "Stage the exact current native verifier before promoting a cell")
    # Reuse existing proof readers; no SDK, native job or component assertion is executed.
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("codon_native_cell_proof", repo / GATE)
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    require(gate.VERSION == version, "Checklist/verifier version mismatch")

    def native_method(item):
        bound = dict(item)
        if not Path(bound["path"]).is_absolute():
            staged = read_bytes(bound["path"])
            path = repo / bound["path"]
            require(staged == path.read_bytes(), "Stage the exact claimed native evidence")
            bound["path"] = str(path)
        return gate.native_method(bound)

    verified = validate_promotions(cells, json.loads(git_bytes(":" + INDEX)), version, hashlib.sha256(checklist).hexdigest(), read_bytes, native_method)
    print("[native-ledger] bound completion verified: " + ", ".join(verified))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as error:
        print("[native-ledger] REJECTED: " + str(error), file=sys.stderr)
        raise SystemExit(1)
