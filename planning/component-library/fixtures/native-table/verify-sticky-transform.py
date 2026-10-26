import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description="Run sticky translation against the actual pinned SDK graphics and resolver source.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--sdk-headers", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
fixture = Path(__file__).resolve().parent
root = fixture.parents[3]


def extract(source, name):
    start = source.index(name)
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if not depth:
            return source[start:end + 1]
    raise AssertionError("Incomplete source block " + name)


base_path = sdk / "ReactCommon/react/renderer/components/view/BaseViewProps.cpp"
sticky_path = root / "packages/react-native/cpp/table/StickyStyle.cpp"
graphics_path = sdk / "ReactCommon/react/renderer/graphics/Transform.cpp"
base = base_path.read_text()
sticky = sticky_path.read_text()
notice = "// Copyright Meta Platforms, Inc. and affiliates. MIT; exact SDK source. See REACT_NATIVE_LICENSE.\n"
(output / "REACT_NATIVE_LICENSE").write_bytes((sdk / "LICENSE").read_bytes())
(output / "sdk-resolve.inc").write_text(notice + extract(base, "std::array<float, 3> getTranslateForTransformOrigin(") + "\n" + extract(base, "Transform BaseViewProps::resolveTransform(\n    const Size&"))
(output / "sticky-transform.inc").write_text(extract(sticky, "Float nativeFloat(") + "\n" + extract(sticky, "Transform nativeStickyTransform("))
binary = output / "sticky-transform"
command = ["clang++", "-std=c++20", "-DNDEBUG", "-DFOLLY_NO_CONFIG=1", "-DFOLLY_MOBILE=1", "-fsanitize=undefined",
    "-I" + str(sdk / "ReactCommon"), "-I" + str(sdk / "ReactCommon/react/renderer/graphics/platform/cxx"),
    "-I" + str(args.sdk_headers.resolve()), "-I" + str(output),
    str(fixture / "sticky-transform.test.cpp"), str(graphics_path), "-o", str(binary)]
compiled = subprocess.run(command, capture_output=True, text=True, timeout=60)
(output / "compile.log").write_text(compiled.stdout + compiled.stderr)
assert compiled.returncode == 0, compiled.stderr
executed = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
(output / "execution.log").write_text(executed.stdout + executed.stderr)
assert executed.returncode == 0, executed.stderr
record = {"command": command, "result": executed.stdout.strip(),
    "sourceSHA256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in [base_path, graphics_path, sticky_path, fixture / "sticky-transform.test.cpp"]},
    "scope": "Actual SDK graphics and exact resolver/helper bodies; declaration-only BaseViewProps boundary. No native view, renderer, pixel or guest proof."}
(output / "result.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
