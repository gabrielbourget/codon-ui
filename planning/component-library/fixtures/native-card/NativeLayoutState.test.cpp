#include "NativeLayoutState.h"

#include <iostream>
#include <limits>
#include <string>

namespace y = facebook::yoga;
using namespace codon::motion;
namespace {
int assertions = 0;
void require(bool value, const char *message) {
  assertions++;
  if (!value) throw std::runtime_error(message);
}
template <typename T> void points(T value, float expected, const char *message) {
  require(value.isPoints() && value.value().unwrap() == expected, message);
}
template <typename T> void percent(T value, float expected, const char *message) {
  require(value.isPercent() && value.value().unwrap() == expected, message);
}
template <typename T> void rejects(T test, const char *reason) {
  try { test(); } catch (const std::exception &error) {
    require(std::string(error.what()).find(reason) != std::string::npos, "unexpected adopted-layout failure");
    return;
  }
  require(false, "expected adopted-layout failure");
}
} // namespace

int main() {
  y::Style authored;
  authored.setDimension(y::Dimension::Width, y::StyleSizeLength::percent(33.3f));
  authored.setDimension(y::Dimension::Height, y::StyleSizeLength::ofAuto());
  authored.setPadding(y::Edge::All, y::StyleLength::points(2));
  authored.setPadding(y::Edge::Start, y::StyleLength::percent(10));
  authored.setMargin(y::Edge::Top, y::StyleLength::points(12));
  const auto native = applyNativeViewportStyle(authored, {310.25f, 0});
  points(native.dimension(y::Dimension::Width), 310.25f, "native viewport width overrides stage percent");
  points(native.dimension(y::Dimension::Height), 0, "native zero viewport height is retained");
  require(native.positionType() == y::PositionType::Absolute, "native viewport remains absolute");
  points(native.margin(y::Edge::Top), 12, "native viewport preserves unrelated margin");
  percent(authored.dimension(y::Dimension::Width), 33.3f, "source style is never changed");
  const auto padding = applyNativeSafeAreaPadding(authored, {1.5f, 2.5f, 3.5f, 4.5f});
  points(padding.padding(y::Edge::Left), 1.5f, "safe-area state overrides physical left");
  points(padding.padding(y::Edge::Top), 2.5f, "safe-area state overrides physical top");
  points(padding.padding(y::Edge::Right), 3.5f, "safe-area state overrides physical right");
  points(padding.padding(y::Edge::Bottom), 4.5f, "safe-area state overrides physical bottom");
  percent(padding.padding(y::Edge::Start), 10, "safe-area state does not erase authored logical edges");
  points(padding.padding(y::Edge::All), 2, "safe-area state preserves shorthand storage");
  const auto negative = applyNativeSafeAreaPadding(authored, {-2, 0, 0, 0});
  points(negative.padding(y::Edge::Left), -2, "native signed values reach Yoga unchanged");
  requireNativeEditorLayoutAuthority(authored, authored);
  requireNativeEditorLayoutAuthority(y::Style(authored), authored);
  require(true, "independent non-layout props may retain exactly the same copied editor Yoga style");
  auto changedEditor = authored;
  changedEditor.setPadding(y::Edge::Start, y::StyleLength::points(2));
  rejects([&] { requireNativeEditorLayoutAuthority(changedEditor, authored); }, "editor layout props overrides");
  changedEditor = authored;
  changedEditor.setPadding(y::Edge::Start, y::StyleLength::undefined());
  rejects([&] { requireNativeEditorLayoutAuthority(changedEditor, authored); }, "editor layout props overrides");
  changedEditor = authored;
  changedEditor.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
  rejects([&] { requireNativeEditorLayoutAuthority(changedEditor, authored); }, "editor layout props overrides");

  constexpr y::Edge edges[]{y::Edge::Left, y::Edge::Top, y::Edge::Right, y::Edge::Bottom};
  const std::array<float, 4> insets{7, 11, 13, 17};
  for (const bool paddingMode : {false, true}) {
    for (int encoded = 0; encoded < 81; encoded++) {
      auto state = encoded;
      std::array<TNativeSafeAreaEdgeMode, 4> modes;
      for (auto &mode : modes) { mode = static_cast<TNativeSafeAreaEdgeMode>(state % 3); state /= 3; }
      const auto result = applyNativeSafeAreaContext(authored, insets, paddingMode, modes);
      for (size_t index = 0; index < 4; index++) {
        const auto original = paddingMode ? 2.0f : index == 1 ? 12.0f : 0.0f;
        const auto expected = modes[index] == TNativeSafeAreaEdgeMode::Off ? original :
            modes[index] == TNativeSafeAreaEdgeMode::Maximum ? std::fmax(original, insets[index]) : original + insets[index];
        points(paddingMode ? result.padding(edges[index]) : result.margin(edges[index]), expected, "pinned safe-area mode value");
      }
      percent(result.padding(y::Edge::Start), 10, "peer safe-area preserves raw logical edge semantics");
      percent(result.dimension(y::Dimension::Width), 33.3f, "peer safe-area preserves independent staged dimension");
    }
  }
  y::Style percentages;
  percentages.setPadding(y::Edge::Horizontal, y::StyleLength::percent(25));
  percentages.setPadding(y::Edge::Top, y::StyleLength::points(3));
  const auto peer = applyNativeSafeAreaContext(percentages, {7, 11, 13, 17}, true,
      {TNativeSafeAreaEdgeMode::Additive, TNativeSafeAreaEdgeMode::Maximum, TNativeSafeAreaEdgeMode::Off, TNativeSafeAreaEdgeMode::Additive});
  points(peer.padding(y::Edge::Left), 32, "pinned peer treats the percent's stored magnitude as points");
  points(peer.padding(y::Edge::Top), 11, "physical edge precedes axis and all");
  points(peer.padding(y::Edge::Right), 25, "off mode retains stored percent magnitude as points");
  points(peer.padding(y::Edge::Bottom), 17, "missing peer edge starts at zero");

  const auto svg = applyNativeSvgFillLayout(authored);
  require(svg.positionType() == y::PositionType::Absolute, "SVG constructor forces absolute positioning");
  points(svg.position(y::Edge::All), 0, "SVG constructor forces all-edge zero inset");
  percent(svg.dimension(y::Dimension::Width), 100, "SVG constructor forces width100percent");
  percent(svg.dimension(y::Dimension::Height), 100, "SVG constructor forces height100percent");
  points(svg.margin(y::Edge::Top), 12, "SVG constructor preserves unrelated style fields");
  for (const auto name : {"RNSVGCircle", "RNSVGFeGaussianBlur", "RNSVGText", "RNSVGUse"}) require(hasNativeSvgFillLayout(name), "SVG constructor name admitted");
  for (const auto name : {"RNSVGForeignObject", "RNSVGImage", "RNSVGSvgView", "RNSVGSvgViewAndroid", "RNSVGUnknown", "View"}) require(!hasNativeSvgFillLayout(name), "ordinary or unknown SVG constructor excluded");
  const auto portal = applyNativePortalLayout(authored, {201.25f, 401.5f});
  points(portal.dimension(y::Dimension::Width), 201.25f, "portal uses immutable native host width");
  points(portal.dimension(y::Dimension::Height), 401.5f, "portal uses immutable native host height");
  require(portal.positionType() == y::PositionType::Absolute, "portal host positioning remains absolute");
  rejects([&] { applyNativePortalLayout(authored, {0, 20}); }, "immutable portal host size unavailable");
  rejects([&] { applyNativePortalLayout(authored, {20, 0}); }, "immutable portal host size unavailable");
  rejects([&] { applyNativeViewportStyle(authored, {-1, 20}); }, "invalid adopted viewport");
  rejects([&] { applyNativeViewportStyle(authored, {std::numeric_limits<float>::infinity(), 20}); }, "non-finite");
  rejects([&] { applyNativeSafeAreaPadding(authored, {0, std::numeric_limits<float>::quiet_NaN(), 0, 0}); }, "non-finite");
  std::cout << "NativeLayoutState portable source assertions: " << assertions << '\n';
}
