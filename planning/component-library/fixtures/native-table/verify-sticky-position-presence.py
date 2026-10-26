import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


parser = argparse.ArgumentParser(description="Exercise the exact SDK position-presence edits with explicit parser/feature-flag doubles.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
header_path = sdk / "ReactCommon/react/renderer/components/view/YogaStylableProps.h"
source_path = sdk / "ReactCommon/react/renderer/components/view/YogaStylableProps.cpp"
header = header_path.read_text()
source = source_path.read_text()


def block(start):
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if depth == 0:
            return source[start:end + 1]
    raise AssertionError("Incomplete SDK source block")


constructor = block(source.index("YogaStylableProps::YogaStylableProps("))
conversion = block(source.index("template <typename T>"))
position_case = block(source.index('    case CONSTEXPR_RAW_PROPS_KEY_HASH("position")'))
field = re.search(r"bool cuiHasAuthoredPosition\{false\};", header)
assert field
excerpts = "\n".join([constructor, conversion, position_case])
notice = "// Copyright Meta Platforms, Inc. and affiliates. MIT; exact SDK excerpts. See REACT_NATIVE_LICENSE.\n"
(output / "REACT_NATIVE_LICENSE").write_bytes((sdk / "LICENSE").read_bytes())
(output / "sdk-excerpts.txt").write_text(notice + excerpts)
model = r'''
#include <functional>
#include <iostream>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#define CONSTEXPR_RAW_PROPS_KEY_HASH(name) 0
namespace facebook::react {
namespace yoga {
enum class PositionType { Relative, Absolute, Static };
struct Style {
  PositionType position{PositionType::Relative};
  int width{0};
  PositionType positionType() const { return position; }
  void setPositionType(PositionType value) { position = value; }
};
}
struct PropsParserContext {};
struct RawValue {
  std::optional<std::string> value;
  RawValue(const char *input) : value(input ? std::optional(std::string(input)) : std::nullopt) {}
  bool hasValue() const { return value.has_value(); }
};
struct RawProps {
  std::map<std::string, RawValue> values;
  const RawValue *at(const char *name, const char *, const char *) const {
    const auto found = values.find(name);
    return found == values.end() ? nullptr : &found->second;
  }
};
struct Props {
  void initialize(const PropsParserContext &, const Props &, const RawProps &,
      const std::function<bool(const std::string &)> &) {}
};
void fromRawValue(const PropsParserContext &, const RawValue &raw, yoga::PositionType &value) {
  value = *raw.value == "relative" ? yoga::PositionType::Relative :
      *raw.value == "absolute" ? yoga::PositionType::Absolute : yoga::PositionType::Static;
}
struct ReactNativeFeatureFlags {
  static inline bool iterator = false;
  static bool enableCppPropsIteratorSetter() { return iterator; }
};
yoga::Style convertRawProp(const PropsParserContext &context, const RawProps &raw, const yoga::Style &source) {
  auto next = source;
  if (const auto *value = raw.at("position", nullptr, nullptr)) {
    next.position = yoga::PositionType::Relative;
    if (value->hasValue()) fromRawValue(context, *value, next.position);
  }
  return next;
}
struct YogaStylableProps : Props {
  yoga::Style yogaStyle{};
  FIELD
  YogaStylableProps() = default;
  YogaStylableProps(const PropsParserContext &, const YogaStylableProps &, const RawProps &,
      const std::function<bool(const std::string &)> & = nullptr);
  void convertRawPropAliases(const PropsParserContext &, const YogaStylableProps &, const RawProps &) {}
  void applyPosition(const PropsParserContext &, const RawValue &);
};
CONSTRUCTOR
CONVERSION
void YogaStylableProps::applyPosition(const PropsParserContext &context, const RawValue &value) {
  const auto ygDefaults = yoga::Style{};
  switch (0) { POSITION_CASE }
}
}
int main() {
  using namespace facebook::react;
  int checks = 0;
  const auto require = [&](bool result) { checks++; if (!result) throw std::runtime_error("position-presence source control failed"); };
  const PropsParserContext context;
  for (const bool iterator : {false, true}) {
    ReactNativeFeatureFlags::iterator = iterator;
    const auto parse = [&](const YogaStylableProps &previous, const RawProps &raw) {
      YogaStylableProps next(context, previous, raw);
      if (iterator) if (const auto *value = raw.at("position", nullptr, nullptr)) next.applyPosition(context, *value);
      return next;
    };
    const YogaStylableProps initial;
    require(!initial.cuiHasAuthoredPosition);
    const auto omitted = parse(initial, {});
    require(!omitted.cuiHasAuthoredPosition);
    for (const char *name : {"relative", "absolute", "static"}) {
      const auto authored = parse(initial, {{{"position", RawValue(name)}}});
      require(authored.cuiHasAuthoredPosition);
      require(authored.yogaStyle.positionType() == (std::string(name) == "relative" ? yoga::PositionType::Relative :
          std::string(name) == "absolute" ? yoga::PositionType::Absolute : yoga::PositionType::Static));
      const auto partial = parse(authored, {{{"unrelated", RawValue("retained")}}});
      require(partial.cuiHasAuthoredPosition);
      require(partial.yogaStyle.positionType() == authored.yogaStyle.positionType());
      const auto cleared = parse(partial, {{{"position", RawValue(nullptr)}}});
      require(!cleared.cuiHasAuthoredPosition);
      require(cleared.yogaStyle.positionType() == initial.yogaStyle.positionType());
      require(authored.cuiHasAuthoredPosition);
    }
  }
  std::cout << checks << " exact-source controls with explicit parser/flag doubles; no SDK runtime or native acceptance\n";
}
'''
model = model.replace("FIELD", field.group()).replace("CONSTRUCTOR", constructor).replace("CONVERSION", conversion).replace("POSITION_CASE", position_case)
program = output / "position-presence-model.cpp"
binary = output / "position-presence-model"
program.write_text(notice + model)
compile_command = ["clang++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsanitize=undefined", str(program), "-o", str(binary)]
compiled = subprocess.run(compile_command, capture_output=True, text=True, timeout=60)
(output / "compile.log").write_text(compiled.stdout + compiled.stderr)
assert compiled.returncode == 0, compiled.stderr
executed = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
(output / "execution.log").write_text(executed.stdout + executed.stderr)
assert executed.returncode == 0, executed.stderr
record = {
    "sdk": str(sdk),
    "sources": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in [header_path, source_path]},
    "excerptsSHA256": hashlib.sha256(excerpts.encode()).hexdigest(),
    "verifierSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "compileCommand": compile_command,
    "result": executed.stdout.strip(),
    "actualRawPropsEngineExecuted": False,
    "linkedSDKOrProductOrNativeAcceptance": False,
}
(output / "result.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
