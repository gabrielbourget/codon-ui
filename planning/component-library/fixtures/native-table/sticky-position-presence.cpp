#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/core/RawPropsParser.h>
#include <memory>
#include <stdexcept>

// Compile against each locked SDK. Execution requires its own authorized native carrier.
int nativeTableStickyPositionPresenceControls() {
  using namespace facebook::react;
  ContextContainer container;
  const PropsParserContext context{-1, container};
  RawPropsParser parser;
  parser.prepare<YogaStylableProps>();
  const auto parse = [&](const YogaStylableProps &source, folly::dynamic values) {
    RawProps raw{values};
    raw.parse(parser);
    auto next = std::make_unique<YogaStylableProps>(context, source, raw);
    if (ReactNativeFeatureFlags::enableCppPropsIteratorSetter()) {
      for (const auto &entry : values.items()) {
        const auto &name = entry.first.getString();
        next->setProp(context, RAW_PROPS_KEY_HASH(name), name.c_str(), RawValue(entry.second));
      }
    }
    return next;
  };
  int checks = 0;
  const auto require = [&](bool accepted) {
    checks++;
    if (!accepted) throw std::runtime_error("Table sticky: authored-position control failed");
  };
  const YogaStylableProps initial;
  require(!initial.cuiHasAuthoredPosition);
  const auto omitted = parse(initial, folly::dynamic::object());
  require(!omitted->cuiHasAuthoredPosition);
  const auto relative = parse(initial, folly::dynamic::object("position", "relative")("top", 7));
  require(relative->cuiHasAuthoredPosition);
  require(relative->yogaStyle.positionType() == omitted->yogaStyle.positionType());
  const auto partial = parse(*relative, folly::dynamic::object("width", 53));
  require(partial->cuiHasAuthoredPosition);
  require(partial->yogaStyle.dimension(facebook::yoga::Dimension::Width).value().unwrap() == 53);
  require(partial->yogaStyle.position(facebook::yoga::Edge::Top).value().unwrap() == 7);
  const auto cleared = parse(*partial, folly::dynamic::object("position", nullptr));
  require(!cleared->cuiHasAuthoredPosition);
  require(cleared->yogaStyle.positionType() == initial.yogaStyle.positionType());
  require(cleared->yogaStyle.dimension(facebook::yoga::Dimension::Width).value().unwrap() == 53);
  require(relative->cuiHasAuthoredPosition);
  const auto absolute = parse(initial, folly::dynamic::object("position", "absolute"));
  require(absolute->cuiHasAuthoredPosition);
  require(absolute->yogaStyle.positionType() == facebook::yoga::PositionType::Absolute);
  const auto copied = parse(*absolute, folly::dynamic::object());
  require(copied->cuiHasAuthoredPosition);
  require(copied->yogaStyle.positionType() == facebook::yoga::PositionType::Absolute);
  YogaStylableProps iterator;
  iterator.setProp(context, CONSTEXPR_RAW_PROPS_KEY_HASH("position"), "position", RawValue(folly::dynamic("relative")));
  require(iterator.cuiHasAuthoredPosition);
  require(iterator.yogaStyle.positionType() == initial.yogaStyle.positionType());
  iterator.setProp(context, CONSTEXPR_RAW_PROPS_KEY_HASH("width"), "width", RawValue(folly::dynamic(61)));
  require(iterator.cuiHasAuthoredPosition);
  iterator.setProp(context, CONSTEXPR_RAW_PROPS_KEY_HASH("position"), "position", RawValue(folly::dynamic(nullptr)));
  require(!iterator.cuiHasAuthoredPosition);
  require(iterator.yogaStyle.dimension(facebook::yoga::Dimension::Width).value().unwrap() == 61);
  return checks;
}
