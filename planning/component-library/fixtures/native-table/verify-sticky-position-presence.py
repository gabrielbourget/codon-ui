import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description="Exercise the owned position-presence lifetime/admission code across two native images; this is not an RN runtime control.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[4]
owned = root / "packages/react-native/cpp/input/PositionOwnership.h"
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
common = ["clang++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-fvisibility=hidden", "-fvisibility-inlines-hidden", "-fsanitize=undefined"]
if sys.platform == "darwin":
    library = output / "libposition.dylib"
    library_args = ["-dynamiclib", "-Wl,-install_name,@rpath/libposition.dylib"]
else:
    library = output / "libposition.so"
    library_args = ["-shared", "-fPIC"]
commands = [
    common + library_args + [str(output / "producer.cpp"), "-o", str(library)],
    common + [str(output / "consumer.cpp"), str(library), f"-Wl,-rpath,{output}", "-o", str(output / "controls")],
    [str(output / "controls")],
]
for index, command in enumerate(commands):
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    (output / f"step-{index}.log").write_text(result.stdout + result.stderr)
    assert result.returncode == 0, result.stderr
record = {
    "sdk": str(sdk),
    "ownedHeaderSHA256": hashlib.sha256(owned.read_bytes()).hexdigest(),
    "verifierSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "commands": commands,
    "result": result.stdout.strip(),
    "crossImageProductionOwnershipExecuted": True,
    "actualRNParserOrDescriptorExecuted": False,
    "linkedSDKOrProductOrNativeAcceptance": False,
}
(output / "result.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
