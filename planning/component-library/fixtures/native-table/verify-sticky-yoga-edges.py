import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description="Exercise exact owned sticky edge bodies against stock Yoga headers; no renderer or installed qualification.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--sdk-headers", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
headers = args.sdk_headers.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
fixture = Path(__file__).resolve().parent
root = fixture.parents[3]
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"


def extract(source, name):
    start = source.index(name)
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if not depth:
            return source[start:end + 1]
    raise AssertionError("Incomplete source block " + name)


paths = {
    "style": root / "packages/react-native/cpp/table/StickyStyle.cpp",
    "presentation": root / "packages/react-native/cpp/table/StickyPresentation.cpp",
    "normalization": root / "packages/react-native/cpp/motion/NativeStyle.cpp",
}
sources = {name: path.read_text() for name, path in paths.items()}
blocks = {
    "style": ["Float nativeFloat(", "y::StyleLength selectedPosition(", "y::StyleLength fallbackInset(", "std::array<std::optional<double>, 4> nativeStickyInsets("],
    "presentation": ["float selectedMargin("],
    "normalization": ["yoga::Style copyNativeYogaStyle(", "yoga::Style swapNativeYogaStyle("],
}
for name, names in blocks.items():
    (output / (name + ".inc")).write_text("\n".join(extract(sources[name], marker) for marker in names) + "\n")
records = []
for platform in ["android", "ios"]:
    binary = output / ("sticky-yoga-" + platform)
    command = ["clang++", "-std=c++20", "-O2", "-Wall", "-Wextra", "-Werror", "-fsanitize=undefined",
        "-DEXPECTED_FLOAT_BYTES=" + ("4" if platform == "android" else "8"),
        "-I" + str(sdk / "ReactCommon/react/renderer/graphics/platform" / platform), "-I" + str(headers),
        "-I" + str(output), str(fixture / "sticky-yoga-edges.test.cpp"), "-o", str(binary)]
    compiled = subprocess.run(command, capture_output=True, text=True, timeout=60)
    (output / (platform + "-compile.log")).write_text(compiled.stdout + compiled.stderr)
    assert compiled.returncode == 0, compiled.stderr
    executed = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
    (output / (platform + "-execution.log")).write_text(executed.stdout + executed.stderr)
    assert executed.returncode == 0, executed.stderr
    symbols = subprocess.run(["nm", "-u", str(binary)], capture_output=True, text=True, timeout=10)
    assert symbols.returncode == 0 and "fatalWithMessage" not in symbols.stdout, symbols.stdout
    records.append({"platformFloatHeader": platform, "command": command, "result": executed.stdout.strip(), "noFatalSymbolDependency": True})
paths.update({"fixture": fixture / "sticky-yoga-edges.test.cpp", "verifier": Path(__file__).resolve()})
for name in ["Style.h", "StyleLength.h", "StyleValuePool.h"]:
    paths[name] = headers / "yoga/style" / name
for platform in ["android", "ios"]:
    paths[platform + "Float"] = sdk / "ReactCommon/react/renderer/graphics/platform" / platform / "react/renderer/graphics/Float.h"
record = {
    "results": records,
    "sourceSHA256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths.values()},
    "exactFunctionBodiesSHA256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob("*.inc")},
    "scope": "Exact production selectors, inset/guard and normalization bodies with actual stock Yoga/Float headers; declaration-only Props and fallback-value input models. No real RN Props parser, native view, product link, pixels or installed behavior.",
}
(output / "result.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
