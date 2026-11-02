#include <react/featureflags/ReactNativeFeatureFlags.h>
#include "../../../../packages/react-native/cpp/input/PositionDescriptor.h"
#include <react/renderer/core/RawPropsParser.h>
#include <memory>
#include <stdexcept>

// Compile against each locked SDK. Execution requires its own authorized native carrier.
int nativeTableStickyPositionPresenceControls() {
  using namespace facebook::react;
  ContextContainer container;
  const PropsParserContext context{-1, container};
  auto sharedContainer = std::make_shared<ContextContainer>();
  ComponentDescriptorParameters parameters{};
  parameters.contextContainer = sharedContainer;
  CUIOwnedFocusViewComponentDescriptor descriptor(parameters);
  const auto parse = [&](const Props::Shared &source, folly::dynamic values) {
    return descriptor.cloneProps(context, source, RawProps(values));
  };
  const auto authored = [](const Props::Shared &props) {
    return codon::input::requireNativePositionPresence(props);
  };
  const auto style = [](const Props::Shared &props) -> const CUIFocusViewProps & {
    return static_cast<const CUIFocusViewProps &>(*props);
  };
  int checks = 0;
  const auto require = [&](bool accepted) {
    checks++;
    if (!accepted) throw std::runtime_error("Table sticky: authored-position control failed");
  };
  const auto initial = parse(nullptr, folly::dynamic::object());
  require(!authored(initial));
  const auto omitted = parse(initial, folly::dynamic::object());
  require(!authored(omitted));
  for (const char *position : {"relative", "absolute", "static"}) {
    const auto selected = parse(initial, folly::dynamic::object("position", position)("top", 7));
    require(authored(selected));
    const auto partial = parse(selected, folly::dynamic::object("width", 53));
    require(authored(partial));
    require(style(partial).yogaStyle.positionType() == style(selected).yogaStyle.positionType());
    require(style(partial).yogaStyle.dimension(facebook::yoga::Dimension::Width).value().unwrap() == 53);
    require(style(partial).yogaStyle.position(facebook::yoga::Edge::Top).value().unwrap() == 7);
    const auto cleared = parse(partial, folly::dynamic::object("position", nullptr));
    require(!authored(cleared));
    require(style(cleared).yogaStyle.positionType() == style(initial).yogaStyle.positionType());
    require(style(cleared).yogaStyle.dimension(facebook::yoga::Dimension::Width).value().unwrap() == 53);
    require(authored(selected));
  }
  const auto relative = parse(initial, folly::dynamic::object("position", "relative"));
  require(style(relative).yogaStyle.positionType() == style(initial).yogaStyle.positionType());
  const auto temporary = parse(initial, folly::dynamic::object("position", "absolute"));
  const auto restored = parse(temporary, folly::dynamic::object("position", nullptr));
  require(!authored(restored));
  require(!authored(initial));
  bool rejected = false;
  try { authored(std::make_shared<CUIFocusViewProps>()); }
  catch (const std::invalid_argument &) { rejected = true; }
  require(rejected);
  return checks;
}
