import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description="Exercise the owned position-presence lifetime/admission code across two native images; this is not an RN runtime control.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--android-ndk", type=Path, help="Cross-compile the same controls for the existing x86_64/API24 target; root executes them separately")
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[4]
owned = root / "packages/react-native/cpp/input/PositionOwnership.h"
implementation = root / "packages/react-native/cpp/motion/PositionOwnership.cpp"
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
for name in ["YogaStylableProps.h", "YogaStylableProps.cpp"]:
    assert "cuiHasAuthoredPosition" not in (sdk / "ReactCommon/react/renderer/components/view" / name).read_text()
# Only the pointee is a double. All control-block metadata/admission/lifetime
# operations below execute the production header in producer and consumer images.
(output / "pointee.h").write_text(r'''
#pragma once
#include <memory>
namespace facebook::react {
class Props final {
 public:
  explicit Props(int *destroyed) : destroyed_(destroyed) {}
  ~Props() { ++*destroyed_; }
 private:
  int *destroyed_;
};
}
__attribute__((visibility("default"))) std::shared_ptr<const facebook::react::Props>
createPositionProps(bool authored, int *destroyed);
''')
(output / "producer.cpp").write_text(f'''#include "pointee.h"
#include "{owned}"
std::shared_ptr<const facebook::react::Props> createPositionProps(bool authored, int *destroyed) {{
  return codon::input::withNativePositionPresence(std::make_shared<facebook::react::Props>(destroyed), authored);
}}
''')
(output / "consumer.cpp").write_text(f'#include "pointee.h"\n#include "{owned}"\n' + r'''
#include <iostream>
#include <string>
int main() {
  using namespace codon::input;
  using facebook::react::Props;
  int checks = 0;
  const auto require = [&](bool value) {
    ++checks;
    if (!value) throw std::runtime_error("owned position control failed");
  };
  for (const bool authored : {false, true}) {
    int destroyed = 0;
    auto props = createPositionProps(authored, &destroyed);
    const auto *original = props.get();
    std::weak_ptr<const Props> weak = props;
    require(nativePositionPresence(props).has_value());
    require(requireNativePositionPresence(props) == authored);
    auto copied = props;
    auto mutableAlias = std::const_pointer_cast<Props>(copied);
    require(mutableAlias.get() == original);
    require(nativePositionPresence(mutableAlias) == authored);
    auto unchanged = withNativePositionPresence(props, authored);
    require(!unchanged.owner_before(props) && !props.owner_before(unchanged));
    props.reset();
    require(!weak.expired());
    require(destroyed == 0);
    mutableAlias.reset();
    copied.reset();
    require(!weak.expired());
    unchanged.reset();
    require(weak.expired());
    require(destroyed == 1);
  }
  int destroyed = 0;
  auto plain = std::make_shared<Props>(&destroyed);
  require(!nativePositionPresence(plain).has_value());
  bool rejected = false;
  try { requireNativePositionPresence(plain); }
  catch (const std::invalid_argument &error) {
    rejected = std::string(error.what()).find("NativeFocusView") != std::string::npos;
  }
  require(rejected);
  auto owned = createPositionProps(false, &destroyed);
  std::shared_ptr<const Props> foreignAlias(owned, plain.get());
  require(!nativePositionPresence(foreignAlias).has_value());
  rejected = false;
  try { withNativePositionPresence(nullptr, false); }
  catch (const std::invalid_argument &) { rejected = true; }
  require(rejected);
  std::cout << checks << " production ownership controls across producer/consumer images; opaque pointee double, no RN runtime or native acceptance\n";
}
''')
# Reuse every existing owned/foreign/alias/lifetime assertion in each local DSO.
local = (output / "consumer.cpp").read_text()
local = local.replace("int main() {", "static int localControls() {")
local = local.replace("createPositionProps(authored, &destroyed)", "withNativePositionPresence(std::make_shared<Props>(&destroyed), authored)")
local = local.replace("createPositionProps(false, &destroyed)", "withNativePositionPresence(std::make_shared<Props>(&destroyed), false)")
local = local[:local.index("  std::cout << checks")] + "  return checks;\n}\n"
with (output / "producer.cpp").open("a") as destination:
    destination.write(local + r'''
extern "C" {
__attribute__((visibility("default"))) void *producer_create(int authored, int *destroyed) {
  return new std::shared_ptr<const facebook::react::Props>(createPositionProps(authored != 0, destroyed));
}
__attribute__((visibility("default"))) void producer_drop(void *value) {
  delete static_cast<std::shared_ptr<const facebook::react::Props> *>(value);
}
__attribute__((visibility("default"))) int producer_read(const void *value) {
  const auto marker = codon::input::nativePositionPresence(*static_cast<const std::shared_ptr<const facebook::react::Props> *>(value));
  return marker ? (*marker ? 1 : 0) : -1;
}
__attribute__((visibility("default"))) int producer_controls() { return localControls(); }
__attribute__((visibility("default"))) const void *producer_reader() {
  return reinterpret_cast<const void *>(&codon::input::nativePositionPresence);
}
}
''')
(output / "independent-consumer.cpp").write_text(local + r'''
extern "C" {
__attribute__((visibility("default"))) int consumer_read(const void *value) {
  const auto marker = codon::input::nativePositionPresence(*static_cast<const std::shared_ptr<const facebook::react::Props> *>(value));
  return marker ? (*marker ? 1 : 0) : -1;
}
__attribute__((visibility("default"))) int consumer_controls() { return localControls(); }
__attribute__((visibility("default"))) void *consumer_retain(const void *value) {
  const auto &props = *static_cast<const std::shared_ptr<const facebook::react::Props> *>(value);
  return new std::shared_ptr<const facebook::react::Props>(std::const_pointer_cast<facebook::react::Props>(props));
}
__attribute__((visibility("default"))) void consumer_drop(void *value) {
  delete static_cast<std::shared_ptr<const facebook::react::Props> *>(value);
}
__attribute__((visibility("default"))) const void *consumer_reader() {
  return reinterpret_cast<const void *>(&codon::input::nativePositionPresence);
}
}
''')
android = args.android_ndk is not None
if android:
    toolchain = args.android_ndk.resolve() / "toolchains/llvm/prebuilt/darwin-x86_64"
    common = [str(toolchain / "bin/clang++"), "--target=x86_64-none-linux-android24", "--sysroot=" + str(toolchain / "sysroot"), "-std=c++20", "-Wall", "-Wextra", "-Werror", "-fexceptions", "-frtti", "-fPIC"]
else:
    common = ["clang++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-fvisibility=hidden", "-fvisibility-inlines-hidden", "-fsanitize=undefined"]
suffix = ".dylib" if sys.platform == "darwin" and not android else ".so"
owner = output / ("libposition-owner" + suffix)
library = output / ("libposition" + suffix)
independent = output / ("libposition-consumer" + suffix)
def shared_args(path):
    if suffix == ".dylib":
        return ["-dynamiclib", "-Wl,-install_name,@rpath/" + path.name]
    return ["-shared", "-fPIC", "-Wl,-soname," + path.name]
rpath = "-Wl,-rpath,$ORIGIN" if android else f"-Wl,-rpath,{output}"
commands = [
    common + shared_args(owner) + [str(implementation), "-o", str(owner)],
    common + shared_args(library) + [str(output / "producer.cpp"), str(owner), rpath, "-o", str(library)],
    common + [str(output / "consumer.cpp"), str(library), str(owner), rpath, "-o", str(output / "controls")],
    common + shared_args(independent) + [str(output / "independent-consumer.cpp"), str(owner), rpath, "-o", str(independent)],
    common + [str(Path(__file__).with_name("position-independent-dso.cpp")), "-ldl", rpath, "-o", str(output / "independent-controls")],
]
if not android:
    commands += [[str(output / "controls")], [str(output / "independent-controls"), str(library), str(independent)]]
results = []
for index, command in enumerate(commands):
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    (output / f"step-{index}.log").write_text(result.stdout + result.stderr)
    results.append({"argv": command, "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
    (output / "commands.json").write_text(json.dumps(results, indent=2) + "\n")
    assert result.returncode == 0, result.stderr
if android:
    import shutil
    shutil.copyfile(toolchain / "sysroot/usr/lib/x86_64-linux-android/libc++_shared.so", output / "libc++_shared.so")
    # The independent images must depend on the one owner, never on each other.
    for path in [library, independent, output / "independent-controls"]:
        dynamic = subprocess.run([str(toolchain / "bin/llvm-readelf"), "--dynamic", str(path)], capture_output=True, text=True, check=True).stdout
        (output / (path.name + ".dynamic.txt")).write_text(dynamic)
        needed = [line for line in dynamic.splitlines() if "NEEDED" in line]
        assert not any(library.name in line or independent.name in line for line in needed)
        if path != output / "independent-controls":
            assert any(owner.name in line for line in needed)
record = {
    "sdk": str(sdk),
    "ownedHeaderSHA256": hashlib.sha256(owned.read_bytes()).hexdigest(),
    "implementationSHA256": hashlib.sha256(implementation.read_bytes()).hexdigest(),
    "verifierSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "independentDriverSHA256": hashlib.sha256(Path(__file__).with_name("position-independent-dso.cpp").read_bytes()).hexdigest(),
    "commands": commands,
    "result": "ANDROID_CROSS_COMPILE_ONLY_NOT_EXECUTED" if android else result.stdout.strip(),
    "crossImageProductionOwnershipExecuted": not android,
    "independentLocalDSOExecuted": not android,
    "oneSharedImplementation": True,
    "actualRNParserOrDescriptorExecuted": False,
    "linkedSDKOrProductOrNativeAcceptance": False,
}
(output / "result.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
