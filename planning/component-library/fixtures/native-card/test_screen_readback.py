"""Synthetic PNG checks for the compiled host reader; no native/displayed proof."""
from pathlib import Path
import json
import struct
import subprocess
import sys
import tempfile
import zlib


def png(path, changed=False, blank=False):
    width, height = 1170, 2532
    data = bytearray(bytes([255, 255, 255, 255]) * width * height)
    def rectangle(x, y, w, h, color):
        row = bytes(color) * w
        for yy in range(y, y + h): data[(yy * width + x) * 4:(yy * width + x + w) * 4] = row
    rectangle(48, 312, 12, 24, [0, 0, 0, 255])
    if not blank:
        rectangle(117, 552, 360, 240, [224, 232, 240, 255])
        rectangle(693, 552, 360, 240, [224, 232, 240, 255])
    if changed: rectangle(800, 600, 1, 1, [1, 2, 3, 255])
    def chunk(kind, value): return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value) & 0xffffffff)
    rows = b"".join(b"\0" + data[y * width * 4:(y + 1) * width * 4] for y in range(height))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def run(binary):
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder); image = root / "original.png"; metadata = root / "ready.json"; result = root / "pixels.json"
        row = {"producer": "source", "nonce": "source:run", "pairIndex": 0, "step": 0, "profile": "solid-circular",
            "mode": "authored", "kind": "calibration", "control": "plain", "density": 3,
            "screen": {"width": 390, "height": 844}, "frames": [[39, 184, 120, 80], [231, 184, 120, 80], [16, 104, 32, 8]]}
        def read(expected_code=0):
            metadata.write_text(json.dumps(row)); result.unlink(missing_ok=True)
            child = subprocess.run([str(binary), str(image), str(metadata), str(result)], capture_output=True, timeout=20)
            assert (child.returncode == 0) == (expected_code == 0), child.stderr.decode(errors="replace")
            return json.loads(result.read_text()) if result.exists() else None
        png(image); observed = read()
        assert observed["markerMatched"] and observed["referenceControlPassed"] and observed["changedBytes"] == 0
        assert observed["nativeSHA256"] == observed["ownedSHA256"] and not observed["fullCard"]
        png(image, changed=True); observed = read()
        assert observed["changedBytes"] == 3 and observed["maximumChannelDifference"] > 0 and observed["nativeSHA256"] != observed["ownedSHA256"]
        png(image); row["step"] = 1; assert read(1) is None
        row["step"] = 0; png(image, blank=True); assert read(1) is None
        png(image); row["control"] = "outer-shadow"; observed = read()
        assert not observed["referenceControlPassed"] and observed["referenceOutsideInkPixels"] == 0
        print("PASS5 synthetic PNG/marker/difference/nonblank/shadow-control checks; no native verdict")


if __name__ == "__main__": run(Path(sys.argv[1]).resolve())
