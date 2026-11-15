"""Check actual observer frame suppression with Foundation; no Simulator/UI actions."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import os

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--android", action="store_true", help="Run extracted Android capture/snapshot methods with deterministic Java view and matrix seams")
parser.add_argument("--baseline", type=Path, help="Original Android observer for byte/operation comparisons")
parser.add_argument("--java-home", type=Path, help="Existing JDK home; no installation")
parser.add_argument("--source", type=Path, help="Preserved observer source for a baseline comparison")
parser.add_argument("--compatibility-only", action="store_true", help="Compare original event semantics without the new performance assertion")
args = parser.parse_args()
fixture = Path(__file__).resolve().parent
repo = fixture.parents[3]
source_path = args.source or repo / ("packages/react-native/android/src/main/java/com/codonui/input/CUIMotionGeometryObserver.java" if args.android else "packages/react-native/ios/CUIMotionGeometryObserver.mm")
source = source_path.read_text()
output = args.output.resolve()
assert not any((parent / "SEALED.json").exists() for parent in [output, *output.parents])
output.mkdir(parents=True, exist_ok=False)


if args.android:
    if args.baseline is None:
        parser.error("--android requires --baseline for exact comparison")
    baseline = args.baseline.read_text()
    for begin, end in [("  private WritableMap envelope(", "  private void capture("), ("  @androidx.annotation.OptIn", None)]:
        original_section = baseline[baseline.index(begin):baseline.index(end)] if end else baseline[baseline.index(begin):]
        candidate_section = source[source.index(begin):source.index(end)] if end else source[source.index(begin):]
        assert original_section == candidate_section, "Event envelope/capture/coordinator boundaries must remain byte-identical"
    template_path = fixture / "motion-geometry-android-contract.java"
    template = template_path.read_text()
    def extracted(text, name):
        capture = text[text.index("  private WritableMap envelope("):text.index("  private static JSONArray numbers(")]
        geometry = text[text.index("  private static JSONArray numbers("):text.index("  @androidx.annotation.OptIn", text.index("  private static JSONArray numbers("))]
        configure = text[text.index("  void configure("):text.index("  private void connect(")]
        retirement = text[text.index("  void invalidate()"):text.index("  void query(")]
        body = configure + retirement + capture + geometry
        return "class " + name + " extends GeometryFixture.Owner {\n" + body.replace("CUIMotionGeometryObserver", name) + "\n}\n"
    generated = template.replace("// PRODUCTION_METHODS", extracted(baseline, "OriginalObserver") + extracted(source, "CandidateObserver"))
    java_source = output / "GeometryFixture.java"
    java_source.write_text(generated)
    java_home = args.java_home or Path(os.environ["JAVA_HOME"])
    compile_command = [str(java_home / "bin/javac"), "-d", str(output), str(java_source)]
    subprocess.run(compile_command, check=True, timeout=30)
    result = json.loads(subprocess.check_output([str(java_home / "bin/java"), "-cp", str(output), "GeometryFixture"] + (["--compatibility-only"] if args.compatibility_only else []), text=True, timeout=15))
    result.update({"sourceSHA256": hashlib.sha256(source_path.read_bytes()).hexdigest(), "baselineSHA256": hashlib.sha256(args.baseline.read_bytes()).hexdigest(), "contractSHA256": hashlib.sha256(template_path.read_bytes()).hexdigest(), "verifierSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "scope": "Extracted production Android envelope/capture/snapshot/ancestor/box/window methods; deterministic Java View/Matrix/JSON seams. Native Matrix implementation and installed performance/ANR resolution are not proven.", "compileCommand": compile_command})
    (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    raise SystemExit(0)


def between(start, end):
    offset = source.index(start)
    return source[offset:source.index(end, offset)]


comparison = between("// Keep JSON-distinct numeric", "static NSUInteger CUIGeometrySequence") if "CUIEqualGeometrySnapshot" in source else ""
comparison = "#define CUI_GEOMETRY_CACHE_CONTRACT " + ("1" if comparison else "0") + "\n" + comparison
ivars = between("@implementation CUIMotionGeometryObserver {", "\n- (instancetype)initWithRoot:").split("{", 1)[1].rsplit("}", 1)[0]
methods = [
    between("- (void)configureOwner:", "\n- (NSMutableDictionary *)envelope:"),
    between("- (void)captureKind:", "\n- (NSDictionary *)snapshotIdentity"),
    between("- (void)invalidate", "\n- (void)dealloc"),
]
if "- (void)resetFrame" in source:
    methods.insert(0, between("- (void)resetFrame", "\n- (void)configureOwner:"))
    assert '[self resetFrame];' in between("- (NSMutableDictionary *)envelope:", "+ (NSDictionary *)querySnapshotForView:")
else:
    methods.insert(0, '- (void)resetFrame { _lastFrame = nil; }')
for name, content in {"comparison": comparison, "ivars": ivars, "methods": "\n".join(methods)}.items():
    (output / ("owned-geometry-" + name + ".inc")).write_text(content)
executable = output / "motion-geometry-contract"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror",
    "-I" + str(output), str(fixture / "motion-geometry-contract.mm"),
    "-framework", "Foundation", "-o", str(executable),
], check=True, timeout=30)
command = [str(executable)] + (["--compatibility-only"] if args.compatibility_only else [])
result = json.loads(subprocess.check_output(command, text=True, timeout=8))
trace = json.dumps(result.pop("eventTrace"), sort_keys=True, separators=(",", ":"))
(output / "event-trace.json").write_text(trace + "\n")
result["eventTraceSHA256"] = hashlib.sha256(trace.encode()).hexdigest()
result.update({"sourceSHA256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
               "contractSHA256": hashlib.sha256((fixture / "motion-geometry-contract.mm").read_bytes()).hexdigest(),
               "verifierSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               "scope": "Production comparison/capture/configuration/retirement methods with Foundation; envelope and snapshot seams only. No UIKit geometry, CADisplayLink or installed Table proof."})
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
