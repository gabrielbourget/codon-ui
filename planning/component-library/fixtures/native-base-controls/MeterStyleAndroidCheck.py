import time
"""Reconcile Meter observations and original PNGs with the installed macOS image decoder."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess

NAMES = ["semantic", "fractional", "zero-width", "zero-height", "percentage", "auto-height", "physical-left", "vertical-up", "vertical-down", "orthogonal", "independent-radii", "primary", "explicit-colors", "registered-array", "post-custom-final", "native-color", "zero-opacity", "raised"]
SIZES = [(150, 10), (73.25, 13.75), (0, 10), (150, 0), (108, 20), (150, 0), (160, 20), (20, 140), (20, 140), (150, 10), (150, 24), (150, 20), (150, 20), (91, 20), (84, 20), (150, 20), (150, 10), (150, 20)]
EXPECTED = {"dimensions": NAMES[:6], "geometry": NAMES[6:12], "slots": NAMES[12:], "context-motion": ["dark-semantic", "dark-primary", "dark-post-custom-final", "dark-native-color", "before-compact", "compact", "live-restored", "reduced-value75", "motion-restored-value25", "explicit-reset"]}


def require(value, message):
    if not value:
        raise ValueError(message)


class Bitmap:
    def __init__(self, raw):
        require(raw[:2] == b"BM" and len(raw) >= 54, "Standard BMP header required")
        self.offset = struct.unpack_from("<I", raw, 10)[0]
        header, self.width, height, planes, bits, compression = struct.unpack_from("<IiiHHI", raw, 14)
        require(header == 40 and self.width > 0 and height != 0 and planes == 1 and bits == 24 and compression == 0, "Require uncompressed standard24-bit RGB BMP")
        self.height, self.top_down = abs(height), height < 0
        self.stride = (self.width * 3 + 3) // 4 * 4
        require(self.offset >= 54 and len(raw) >= self.offset + self.stride * self.height, "Truncated BMP rejected")
        self.raw = raw

    def row(self, y):
        require(0 <= y < self.height, "Pixel outside decoded image")
        return self.offset + (y if self.top_down else self.height - 1 - y) * self.stride

    def argb(self, point):
        x, y = point
        require(isinstance(x, int) and isinstance(y, int) and 0 <= x < self.width, "Integer pixel inside decoded image required")
        start = self.row(y) + x * 3
        b, g, r = self.raw[start:start + 3]
        return 0xff000000 | r << 16 | g << 8 | b

    def white(self, rect):
        left, top, right, bottom = rect
        require(0 <= left < right <= self.width and 0 <= top < bottom <= self.height, "Whole positive parent must be in PNG")
        expected = b"\xff" * ((right - left) * 3)
        for y in range(top, bottom):
            start = self.row(y) + left * 3
            require(self.raw[start:start + len(expected)] == expected, "Exact parent absence failed; stray paint or neighboring shadow retained")
        return (right - left) * (bottom - top)

    def matched_parents(self, actual, reference):
        ax, ay, ar, ab = actual
        bx, by, br, bb = reference
        require(0 <= ax < ar <= self.width and 0 <= bx < br <= self.width and 0 <= ay < ab <= self.height and 0 <= by < bb <= self.height, "Whole positive parents must be in PNG")
        require((ar - ax, ab - ay) == (br - bx, bb - by), "Matched physical parent dimensions required")
        count = nonwhite = 0
        for y in range(ab - ay):
            for x in range(ar - ax):
                color = self.argb([ax + x, ay + y])
                require(color == self.argb([bx + x, by + y]), "Exact whole-parent reference paint differs")
                count += 1
                nonwhite += color != 0xffffffff
        require(nonwhite > 0, "Retained bordered track must have nonwhite paint")
        return count, nonwhite


def geometry(row, original):
    state = row["state"]
    index = state["index"]
    require(state["case"] == NAMES[index], "Wrong fixture case")
    for key in ["rootTag", "attaches", "detaches"]:
        require(state[key] == original[key] and row["afterState"][key] == original[key], "Original public ref lifetime changed")
    require(state["rootTag"] > 0 and row["captureStartedEpochMs"] <= row["captureFinishedEpochMs"], "Actual root and bounded capture required")
    for key in ["index", "case", "value", "mode", "layouts"]:
        require(state[key] == row["afterState"][key], "Stale native/state/PNG join")
    scale = row["geometry"]["scale"]
    expected = [12, 17 if index == 14 else 12, *SIZES[index]]
    if index == 5:
        height = state["layouts"]["reference"]["layout"]["height"]
        require(math.isfinite(height) and height >= 0, "Finite independent automatic reference height required")
        expected[3] = height
    require(scale > 0 and row["geometry"]["expected"] == expected, "Wrong expected geometry")
    for owner in ["target", "reference"]:
        event = state["layouts"][owner]
        require(event["nativeTarget"] == event["currentTarget"] and event["nativeTarget"] > 0, "Original native layout payload required")
        if owner == "target":
            require(event["nativeTarget"] == state["rootTag"], "Layout belongs to another target")
        actual = [event["layout"][key] for key in ["x", "y", "width", "height"]]
        require(all(abs(a - b) * scale <= 1.00001 for a, b in zip(actual, expected)), "Frame exceeds one physical pixel")
    require(row["windows"]["windowRoots"] > 0, "No actual native window")
    require(not any("isn't responding" in (n.get("text") or "") for n in row["windows"]["windowNodes"]), "Native ANR")
    if index not in [2, 3, 5, 16]:
        native = row["nativeTarget"]
        require(native["id"] == "meter-style-target" and row["targetCount"] == 1 and native["visible"], "Exactly one visible native Meter target required")
        require(native["className"] == "android.view.View" and native["roleDescription"] == "Progress Bar", "Wrong actual native role")
        require(native["rangeInfo"]["min"] == 0 and native["rangeInfo"]["max"] == 100 and native["rangeInfo"]["current"] == state["value"], "Wrong native range")
        require(native["contentDescription"] == "Style meter, " + str(state["value"]) + "%", "Wrong native value text")
    return index


def reconcile(args):
    require(hashlib.sha256(args.image_decoder.read_bytes()).hexdigest() == args.decoder_sha256, "Image decoder changed")
    args.out.mkdir(exist_ok=False)
    receipt = json.loads((args.input / "receipt.json").read_text())
    selected = ["dimensions"] if getattr(args, "selected_cohorts", None) == "dimensions" else list(EXPECTED)
    require(receipt["operation"] == "meter-style-batch" and receipt["selectedMethods"] == selected and [row["name"] for row in receipt["cohorts"]] == selected, "Wrong native batch")
    results, errors = [], []
    for cohort in receipt["cohorts"]:
        observations, failures = [], []
        try:
            require(cohort["name"] in EXPECTED and cohort["status"] == "NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW" and 0 <= cohort["elapsedMs"] <= 180000, "Native method failed or exceeded180s")
            require([row["name"] for row in cohort["observations"]] == EXPECTED[cohort["name"]], "Incomplete selected observations")
        except Exception as error:
            failures.append(str(error))
        for row in cohort.get("observations", []):
            try:
                index = geometry(row, receipt["original"])
                require(Path(row["png"]).name == row["png"], "Original PNG basename required")
                png = args.input / row["png"]
                header = png.read_bytes()[:29]
                require(header[:8] == b"\x89PNG\r\n\x1a\n" and list(struct.unpack(">II", header[16:24])) == row["screenRect"][2:], "Native screenshot dimensions changed")
                bmp = args.out / (png.stem + ".bmp")
                require(args.deadline_unix - time.time() > 8, "Owner work deadline exhausted before image decode")
                process = subprocess.run([str(args.image_decoder), "-s", "format", "bmp", str(png), "--out", str(bmp)], capture_output=True, timeout=args.deadline_unix - time.time() - 8)
                (args.out / (png.stem + ".decode.stdout")).write_bytes(process.stdout)
                (args.out / (png.stem + ".decode.stderr")).write_bytes(process.stderr)
                require(process.returncode == 0, "Standard image decoder failed")
                decoded = Bitmap(bmp.read_bytes())
                require([decoded.width, decoded.height] == row["screenRect"][2:], "Decoded screen dimensions changed")
                if index == 16:
                    count = 0
                    for key in ["nativeParent", "nativeReferenceParent"]:
                        count += decoded.white(list(map(int, row[key]["bounds"].split())))
                    require(count == row["absencePixelsChecked"], "Independent entire-parent absence count differs")
                elif index in [2, 3, 5]:
                    count, nonwhite = decoded.matched_parents(*[list(map(int, row[key]["bounds"].split())) for key in ["nativeParent", "nativeReferenceParent"]])
                    require(count == row["wholeParentPixelsChecked"] and nonwhite == row["wholeParentNonWhitePixels"], "Independent exact parent/bordered-track counts differ")
                else:
                    require(len(row["samples"]) == (4 if index == 14 else 2), "Missing independent slot/border samples")
                    for sample in row["samples"]:
                        a, b = decoded.argb(sample["point"]), decoded.argb(sample["referencePoint"])
                        require(a == b == sample["argb"] & 0xffffffff == sample["referenceARGB"] & 0xffffffff, "Actual source PNG color differs from native sample/reference")
                    require(row["samples"][0]["argb"] != row["samples"][1]["argb"], "Vacuous native fill/track comparison")
                observations.append({"name": row["name"], "status": "PASS", "pngSHA256": hashlib.sha256(png.read_bytes()).hexdigest(), "nativeAndHostColorTolerance": 0})
            except Exception as error:
                failures.append({"name": row["name"], "error": repr(error)})
        if cohort["name"] == "context-motion":
            try:
                require(cohort["motionRestorationVerified"] is True, "Native motion preference restoration missing")
                observed = {row["name"]: row["state"] for row in cohort["observations"]}
                require(observed["compact"]["case"] == observed["before-compact"]["case"] == "percentage", "Constraint replaced component state")
                require(observed["reduced-value75"]["motionEvents"][-1] is True and observed["reduced-value75"]["value"] == 75, "Actual native motion event/current endpoint missing")
                require(observed["motion-restored-value25"]["motionEvents"][-1] is False and observed["explicit-reset"]["case"] == "semantic" and observed["explicit-reset"]["value"] == 25, "Motion restoration or explicit reset missing")
            except Exception as error:
                failures.append(str(error))
        results.append({"cohort": cohort["name"], "status": "PASS_PENDING_CONTOUR_SHADOW_REVIEW" if not failures else "FAILED_OR_INCOMPLETE", "observations": observations, "errors": failures})
    if not receipt.get("nativeActionSucceeded") or receipt.get("hasFailedCohorts") or len(results) != len(selected):
        errors.append("Native batch failed or incomplete; preserved valid independent observations retain their actual scopes")
    passed = not errors and all(not row["errors"] for row in results)
    terminal = {"status": "AUTOMATED_STYLE_ASSERTIONS_PASSED_PENDING_REVIEW" if passed else "FAILED_OR_INCOMPLETE", "cohorts": results, "errors": errors, "gatePromotions": 0, "remaining": "Original radius/edge/raised-shadow visual review and complete gate reconciliation. Motion proves public native events and actual endpoints; no unobserved intermediate/precise-duration or instant-reduction claim."}
    (args.out / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n")
    print(json.dumps({"status": terminal["status"], "cohortCount": len(results), "gatePromotions": 0}))
    return 0 if passed else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--image-decoder", type=Path, required=True)
    parser.add_argument("--decoder-sha256", required=True)
    parser.add_argument("--deadline-unix", type=float, required=True)
    parser.add_argument("--selected-cohorts", choices=["dimensions"])
    raise SystemExit(reconcile(parser.parse_args()))
