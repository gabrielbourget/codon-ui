#include "NativeABI.h"
#include "NativeLayoutState.h"
#include "NativeStyle.h"

#include <react/renderer/components/inputaccessory/InputAccessoryState.h>
#include <react/renderer/components/modal/ModalHostViewState.h>
#include <react/renderer/components/safeareaview/SafeAreaViewState.h>
#include <react/renderer/components/safeareacontext/RNCSafeAreaViewState.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/TeleportViewSpec/RNTPortalViewState.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>
#include <react/renderer/core/ConcreteState.h>
#include <react/renderer/core/ShadowNode.h>
#include <typeinfo>

namespace codon::motion {
using namespace facebook::react;
namespace {
template <typename T> const T &stateData(const ShadowNode &node) {
  if (!node.getState()) throw std::runtime_error("Native motion: actual adopted native state unavailable");
  // Exact pinned component names select the corresponding public StateData ABI.
  return static_cast<const ConcreteState<T> &>(*node.getState()).getData();
}
std::array<float, 4> physicalInsets(const EdgeInsets &insets) {
  return {static_cast<float>(insets.left), static_cast<float>(insets.top),
      static_cast<float>(insets.right), static_cast<float>(insets.bottom)};
}
TNativeSafeAreaEdgeMode edgeMode(const std::string &value) {
  if (value == "off") return TNativeSafeAreaEdgeMode::Off;
  if (value == "maximum") return TNativeSafeAreaEdgeMode::Maximum;
  return TNativeSafeAreaEdgeMode::Additive;
}
} // namespace

TNativeLayoutState captureNativeLayoutState(const ShadowNode &node, const std::function<void()> &check) {
  if (check) check();
  TNativeLayoutState result;
  result.originalProps = node.getProps();
  if (!result.originalProps) throw std::runtime_error("Native motion: actual adopted props unavailable");
  const auto name = std::string_view(node.getComponentName());
  if (name == "SafeAreaView") {
    result.kind = TNativeLayoutStateKind::SafeAreaPadding;
    result.insets = physicalInsets(stateData<SafeAreaViewState>(node).padding);
  } else if (name == "ModalHostView") {
    const auto &size = stateData<ModalHostViewState>(node).screenSize;
    result.kind = TNativeLayoutStateKind::NativeViewport;
    result.size = {static_cast<float>(size.width), static_cast<float>(size.height)};
  } else if (name == "InputAccessoryView") {
    const auto &size = stateData<InputAccessoryState>(node).viewportSize;
    result.kind = TNativeLayoutStateKind::NativeViewport;
    result.size = {static_cast<float>(size.width), static_cast<float>(size.height)};
  } else if (name == "AndroidTextInput") {
    // RN0.86.3 adoption has already written actual themed padding into its
    // immutable props. Selected current color/font props must preserve that
    // complete adopted Yoga style and every alias below.
    result.kind = TNativeLayoutStateKind::AndroidEditor;
  } else if (name == "RNCSafeAreaView") {
    result.kind = TNativeLayoutStateKind::SafeAreaContext;
    result.insets = physicalInsets(stateData<RNCSafeAreaViewState>(node).insets);
  } else if (hasNativeSvgFillLayout(name)) result.kind = TNativeLayoutStateKind::SvgFill;
  else if (name == "PortalView") {
    result.kind = TNativeLayoutStateKind::Portal;
    const auto &state = stateData<PortalViewState>(node);
    result.size = {static_cast<float>(state.hostWidth), static_cast<float>(state.hostHeight)};
    result.portalOffset = {static_cast<float>(state.offsetX), static_cast<float>(state.offsetY)};
  } else if (name.starts_with("RNSVG") && name != "RNSVGForeignObject" && name != "RNSVGImage" &&
      name != "RNSVGSvgView" && name != "RNSVGSvgViewAndroid") {
    throw std::runtime_error("Native motion: unaudited native SVG layout constructor");
  }
  if (check) check();
  return result;
}

facebook::yoga::Style applyNativeLayoutState(const ShadowNode &source, const TNativeLayoutState &state,
    const std::shared_ptr<const Props> &selectedProps, bool swapLeftAndRight) {
  if (!dynamic_cast<const YogaLayoutableShadowNode *>(&source) || source.getProps() != state.originalProps)
    throw std::runtime_error("Native motion: actual Yoga node/props pair unavailable");
  const auto *selectedType = selectedProps.get();
  const auto *originalType = state.originalProps.get();
  if (!selectedType || !originalType || typeid(*selectedType) != typeid(*originalType))
    throw std::runtime_error("Native motion: independent stage props belong to another component");
  // Match the pinned Yoga node's props contract. Props-base RTTI is duplicated
  // across Android libraries; the exported node type supplies the authority.
  const auto &props = static_cast<const YogaStylableProps &>(*selectedProps);
  auto style = state.kind == TNativeLayoutStateKind::SafeAreaContext ? props.yogaStyle : copyNativeYogaStyle(props, false);
  if (state.kind == TNativeLayoutStateKind::AndroidEditor) {
    const auto &original = static_cast<const YogaStylableProps &>(*state.originalProps);
    requireNativeEditorLayoutAuthority(style, copyNativeYogaStyle(original, false));
  }
  if (state.kind == TNativeLayoutStateKind::SafeAreaPadding) style = applyNativeSafeAreaPadding(std::move(style), state.insets);
  else if (state.kind == TNativeLayoutStateKind::NativeViewport) style = applyNativeViewportStyle(std::move(style), state.size);
  else if (state.kind == TNativeLayoutStateKind::SvgFill) style = applyNativeSvgFillLayout(std::move(style));
  else if (state.kind == TNativeLayoutStateKind::SafeAreaContext) {
    const auto &safeArea = static_cast<const RNCSafeAreaViewProps &>(*selectedProps);
    const std::array modes{edgeMode(safeArea.edges.left), edgeMode(safeArea.edges.top),
        edgeMode(safeArea.edges.right), edgeMode(safeArea.edges.bottom)};
    style = applyNativeSafeAreaContext(std::move(style), state.insets, safeArea.mode == RNCSafeAreaViewMode::Padding, modes);
  } else if (state.kind == TNativeLayoutStateKind::Portal) {
    const auto &portal = static_cast<const PortalViewProps &>(*selectedProps);
    if (!portal.hostName.empty()) {
      for (const auto value : state.portalOffset) requireNativeLayoutStateNumber(value);
      // A zero native host dimension selects Teleport's mutable global registry.
      // No immutable registry authority is present in this retained input.
      style = applyNativePortalLayout(std::move(style), state.size);
    }
  }
  return swapLeftAndRight ? swapNativeYogaStyle(std::move(style)) : style;
}

} // namespace codon::motion
