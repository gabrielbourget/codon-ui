"""Independent data readback of original UIKit receiver rasters; never native execution."""
from pathlib import Path
import argparse
import hashlib
import json

from continuous_uikit_probe import DRAWING_PROFILES

WIDTH, HEIGHT, SCALE, MARGIN = 504, 384, 3, 24
PAIRS = [(name, mode) for name in DRAWING_PROFILES for mode in ["authored", "identity"]
    if mode == "authored" or not name.startswith("percentage-")]


def facts(reference, actual):
    alpha = reference[3::4]
    center = ((MARGIN + 40) * SCALE * WIDTH + (MARGIN + 60) * SCALE) * 4
    color = reference[center:center + 3]
    different = sum(alpha[index] == 255 and reference[index * 4:index * 4 + 3] != color for index in range(len(alpha)))
    outside = sum(value > 0 for index, value in enumerate(alpha)
        if index % WIDTH < MARGIN * SCALE or index % WIDTH >= (MARGIN + 120) * SCALE
        or index // WIDTH < MARGIN * SCALE or index // WIDTH >= (MARGIN + 80) * SCALE)
    equal = reference == actual
    return {"changedBytes": 0 if equal else sum(a != b for a, b in zip(reference, actual)),
        "maximumChannelDifference": 0 if equal else max(abs(a - b) for a, b in zip(reference, actual)),
        "referenceCenterAlpha": reference[center + 3], "referenceTransparentPixels": alpha.count(0),
        "referenceOpaquePixels": alpha.count(255), "referenceOpaqueDifferentPixels": different,
        "referenceOutsideAlphaPixels": outside}


def analyze(root, require_complete=True):
    rows = json.loads((root / "drawing-raster-observations.json").read_text())
    assert rows and [(row["profile"], row["mode"]) for row in rows] == PAIRS[:len(rows)], "Original ordered pairs required"
    assert len(rows) <= len(PAIRS)
    results = []
    for row in rows:
        assert [row[key] for key in ["width", "height", "bytesPerPixel", "scale", "margin"]] == [WIDTH, HEIGHT, 4, SCALE, MARGIN]
        buffers, digests = [], {}
        for side in ["native", "owned"]:
            name = "drawing-" + row["profile"] + "-" + row["mode"] + "-" + side + ".rgba"
            assert row[side + "File"] == name
            data = (root / name).read_bytes()
            assert len(data) == WIDTH * HEIGHT * 4, "Complete original raster bytes required"
            buffers.append(data); digests[side] = hashlib.sha256(data).hexdigest()
        observed = facts(*buffers)
        assert observed == row["facts"], "Native metrics must match independent original-byte readback"
        assert observed["referenceCenterAlpha"] == 255 and observed["referenceTransparentPixels"] > 0 and observed["referenceOpaquePixels"] > 43200
        name = row["profile"]
        control = "outline" if name.startswith("outline-") else "border" if name.startswith(("native-border-", "asymmetric-", "dashed-", "dotted-")) else "outer-shadow" if name.startswith(("outer-", "raised-")) else "inset-shadow" if name.startswith("inset-") else "plain"
        assert row["control"] == control
        if control in ["outline", "border", "inset-shadow"]: assert observed["referenceOpaqueDifferentPixels"] > 0
        if control in ["outline", "outer-shadow"]: assert observed["referenceOutsideAlphaPixels"] > 0
        results.append({"profile": name, "mode": row["mode"], "equal": buffers[0] == buffers[1], "facts": observed, "SHA256": digests})
    complete = len(rows) == len(PAIRS) and all(row["equal"] for row in results)
    if require_complete: assert complete, "The complete original native raster matrix has not passed"
    return {"status": "SCOPED_CPU_RASTER_PASS" if complete else "INCOMPLETE_OR_MISMATCH", "observedPairs": len(rows),
        "requiredPairs": len(PAIRS), "pairs": results, "fullCard": False, "fullGoal": False,
        "scope": "Original unmounted UIKit CPU buffers only; no GPU/mounted/full Card claim"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--allow-partial", action="store_true")
    args = parser.parse_args()
    print(json.dumps(analyze(args.root, not args.allow_partial), indent=2))
