"""Reconcile the complete installed Placeholder style batch; visual review stays separate."""
import argparse
import json
from pathlib import Path

NAMES = ["light-style", "dark-and-reset", "narrow-pane"]
EXPECTED = {
    "light-style": ["light-default", "light-center", "light-custom", "light-final", "light-custom-restored", "light-computed-restored"],
    "dark-and-reset": ["dark-default", "dark-final", "light-explicit-retained", "light-after-provider", "empty-restored"],
    "narrow-pane": ["full-default", "full-final-deferred", "narrow-final-deferred", "narrow-after-first-action", "reset-default"],
}


def verify(raw, directory):
    if raw.get("operation") != "placeholder-g04-batch" or raw.get("nativeActionSucceeded") is not True:
        raise ValueError("Original native Placeholder batch did not complete")
    ready, component = raw.get("preNavigationReadiness", {}), raw.get("setup", {})
    if ready.get("status") != "READY" or ready.get("clearObservedMs", 0) < 30000 or ready.get("fixtureNavigationBeforeReady") != 0 or ready.get("testInputBeforeReady") != 0 or component.get("status") != "READY_FROM_ACTUAL_SINGLE_CONNECTION" or component.get("clearObservedMs", 0) < 30000:
        raise ValueError("Actual pre-navigation and component readiness did not both pass")
    cohorts = raw.get("cohorts", [])
    if [row.get("name") for row in cohorts] != NAMES:
        raise ValueError("Complete exact three-cohort coverage required")
    output = []
    for cohort in cohorts:
        if cohort.get("status") != "NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW" or not 0 < cohort["elapsedMs"] <= 1800000:
            raise ValueError("Failed or over-budget native cohort")
        observations = cohort["observations"]
        if [row["name"] for row in observations] != EXPECTED[cohort["name"]]:
            raise ValueError("Missing, duplicate or out-of-order original observation")
        for row in observations:
            name = row["name"]
            expected_color = 0xFF7E22CE if any(word in name for word in ["final", "explicit", "first-action"]) else 0xFFA66B00 if "custom" in name and "computed" not in name else 0xFF878787 if name == "dark-default" else 0xFF707070
            if row["expectedARGB"] & 0xFFFFFFFF != expected_color or row["opaquePixelCount"] < 5:
                raise ValueError("Exact intended opaque glyph color not observed")
            frame = row["frame"]
            if len(frame) != 4 or any(not isinstance(value, int) for value in frame) or min(frame[2:]) <= 0:
                raise ValueError("Positive original native integer frame required")
            if row["target"]["id"] != "library-placeholder" or row["state"]["rootTag"] <= 0 or row["state"]["refIdentity"] <= 0 or row["state"]["dropped"] != 0:
                raise ValueError("Wrong original target or lost binding/trace")
            image = directory / (name + ".png")
            if row["png"] != image.name or not image.is_file() or image.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError("Original complete PNG missing")
        output.append({"name": cohort["name"], "status": "NATIVE_AND_PACKET_ASSERTIONS_PASS_PENDING_VISUAL_REVIEW", "observations": len(observations), "nativeSeconds": cohort["elapsedMs"] / 1000})
    narrow = {row["name"]: row for row in cohorts[2]["observations"]}
    full, wrapped = narrow["full-final-deferred"]["frame"], narrow["narrow-final-deferred"]["frame"]
    if not wrapped[2] < full[2] or not wrapped[3] > full[3] * 1.5:
        raise ValueError("Same-font/content narrow wrap not demonstrated")
    after = narrow["narrow-after-first-action"]["state"]
    if after["actions"] != 1 or [row["kind"] for row in after["receipts"]] != ["pressIn", "pressOut", "press"]:
        raise ValueError("First original native action not reconciled")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--density", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(exist_ok=False)
    try:
        rows = verify(json.loads((args.input / "receipt.json").read_text()), args.input)
        result = {"status": "AUTOMATED_PLACEHOLDER_G04_PENDING_VISUAL_REVIEW", "cohorts": rows, "remaining": ["Independent original PNG review of italic face, full wrapped glyphs, alignment, padding and reachability; source/public and both-OS gate reconciliation"]}
    except Exception as error:
        result = {"status": "FAILED_OR_INCOMPLETE", "error": repr(error), "cohorts": []}
    (args.out / "terminal.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)
    raise SystemExit(0 if result["status"] == "AUTOMATED_PLACEHOLDER_G04_PENDING_VISUAL_REVIEW" else 1)
