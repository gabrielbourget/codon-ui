"""Validate raw native-inspector logs; completion messages alone prove nothing."""
from pathlib import Path
import json
import math
import re
import sys

PREFIX = "CUI_NAV_PROBE "
CONFIGURATION = json.loads(Path(__file__).with_name("phases.json").read_text())


def parse_records(text):
    records = []
    for line in text.splitlines():
        if PREFIX not in line:
            continue
        payload = line.split(PREFIX, 1)[1]
        try:
            record, _ = json.JSONDecoder().raw_decode(payload)
        except (ValueError, TypeError):
            continue
        if record.get("probe") == CONFIGURATION["probe"]:
            records.append(record)
    return records


def validate(records, platform):
    assert platform in ("android", "ios"), "platform"
    phases = CONFIGURATION["phases"]
    begins = [r for r in records if r.get("kind") == "begin"]
    assert len(begins) == 1, "one actual app invocation"
    assert begins[0]["libraryProducer"] == CONFIGURATION["libraryProducer"], "library identity"
    assert begins[0]["phases"] == [p["id"] for p in phases], "phase contract"
    assert not [r for r in records if r.get("kind") in ("failure", "unexpected-page-request", "unexpected-size-request")], "fixture failure or fabricated owner action"
    completions = [r for r in records if r.get("kind") == "complete"]
    assert len(completions) == 1 and completions[0]["snapshots"] == len(phases) * 7, "complete native observation set"
    assert completions[0]["phases"] == len(phases), "all phases"
    requests = [r for r in records if r.get("kind") == "request"]
    assert [r["phase"] for r in requests] == [p["id"] for p in phases], "ordered single requests"
    assert [r["phase"] for r in records if r.get("kind") == "phase-complete"] == [p["id"] for p in phases], "ordered phase completion"
    snapshots = [r for r in records if r.get("kind") == "snapshot"]
    assert len(snapshots) == len(phases) * 7, "no missing/duplicate snapshots"
    expected_tags = None
    window = None
    owners = {}
    times = {}
    assertions = []

    def check(condition, identity, message):
        assert condition, identity + ": " + message
        assertions.append(identity)

    for phase, request in zip(phases, requests):
        name = phase["id"]
        tags = request["targets"]
        check(len(tags) == 7 and len(set(tags)) == 7 and all(type(t) is int and t > 0 for t in tags), name + ".actual-targets", "seven actual native refs")
        if expected_tags is None:
            expected_tags = tags
        check(tags == expected_tags, name + ".target-lifetime", "stable native root/button instances")
        session = request["session"]
        check(bool(session["windowId"]) and session["epoch"] > 0, name + ".native-session", "acknowledged native window")
        if window is None:
            window = session
        check(session == window, name + ".window-lifetime", "no unobserved window replacement")
        current = [r for r in snapshots if r["phase"] == name]
        check(len(current) == 7 and {r["actual"]["target"] for r in current} == set(tags), name + ".native-packets", "one packet per commanded target")
        by_tag = {r["actual"]["target"]: r["actual"] for r in current}
        for record in current:
            data = record["actual"]
            tag = data["target"]
            key = name + "." + str(tag)
            check(data["platform"] == platform and data["windowId"] == window["windowId"] and record["session"] == window, key + ".platform-window", "actual metadata platform/window")
            check(type(data["selected"]) is bool and isinstance(data["observedAt"], (int, float)) and math.isfinite(data["observedAt"]) and data["observedAt"] >= times.get(tag, 0), key + ".native-state-clock", "native state and monotonic observation time")
            check(bool(data["ownerId"]) and owners.get(tag, data["ownerId"]) == data["ownerId"], key + ".owner", "stable native owner")
            owners[tag] = data["ownerId"]
            times[tag] = data["observedAt"]
            for field in ["label", "hint", "value", "containerTitle", "roleDescription", "description", "details"]:
                check(isinstance(data[field], str), key + "." + field + ".type", "actual string field")
            if platform == "android":
                check(data["containerType"] == -1, key + ".unsupported-container-type", "unsupported field stays explicit")
            else:
                check(data["containerTitle"] == "" and data["roleDescription"] == "", key + ".unsupported-android-fields", "unsupported fields stay explicit")
        references = phase.get("referenceMode")
        shared_label = {"initial": "First Second", "changed": "Changed A Changed B", "returned": "Return A Return B"}.get(references)
        role = phase.get("role", "Navigation")
        for tag, family, fallback in [(tags[0], "pagination", "Probe pagination"), (tags[1], "breadcrumbs", "Probe trail")]:
            data = by_tag[tag]
            label = shared_label if shared_label is not None else phase.get("paginationLabel" if family == "pagination" else "breadcrumbLabel", fallback)
            key = name + "." + family
            check(data["selected"] is False, key + ".passive-root", "navigation roots are not selected controls")
            check(data["label"] == label or (platform == "android" and label and data["label"].startswith(label + ", ")), key + ".label", "native label/reference/fallback")
            navigation = family == "pagination" or not phase.get("breadcrumbDisabled", False)
            if platform == "ios":
                check(data["containerType"] == (3 if navigation else 0), key + ".landmark", "actual UIKit container type")
            else:
                check(data["roleDescription"] == (role if navigation else ""), key + ".role", "actual Android role description")
                check(data["containerTitle"] == (data["label"] if navigation else ""), key + ".container-title", "actual Android container title")
        numeric = {}
        for tag in tags[2:]:
            data = by_tag[tag]
            match = re.match(r"^Go To Page ([123])(?:,|$)", data["label"])
            if match:
                numeric[int(match[1])] = data
        check(set(numeric) == {1, 2, 3}, name + ".numeric-names", "all unchanged numeric names retained")
        for page, data in numeric.items():
            key = name + ".page-" + str(page)
            check(data["selected"] == (page == phase["page"]), key + ".selected", "caller page remains authoritative over aliases")
            wording = phase.get("currentText", "Current page") if page == phase["page"] else ""
            text = ", ".join(value for value in [phase.get("valueAlias", ""), wording] if value)
            if platform == "ios":
                check(data["value"] == text, key + ".value", "actual UIKit current-page value")
            elif text:
                check(data["label"].endswith(", " + text), key + ".value", "actual Android composed current-page value")
            else:
                check(data["label"].rstrip(", ") == "Go To Page " + str(page), key + ".value-cleared", "status removed while fixed name survives")
    return {"status": "PASS", "platform": platform, "phases": len(phases), "nativeSnapshots": len(snapshots), "nativeWindow": window, "assertionIDs": assertions, "limitations": ["No actual activation/veto, focus completion, passive core Text metadata, native numeric range, collection, Tab, pointer, viewport or physical acceptance is inferred."]}


if __name__ == "__main__":
    source, platform, destination = sys.argv[1:]
    records = parse_records(Path(source).read_text(errors="replace"))
    try:
        result = validate(records, platform)
    except (AssertionError, KeyError, TypeError, ValueError) as error:
        result = {"status": "FAIL", "platform": platform, "reason": str(error), "parsedRecords": len(records)}
    Path(destination).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "assertionIDs"}))
    raise SystemExit(0 if result["status"] == "PASS" else 1)
