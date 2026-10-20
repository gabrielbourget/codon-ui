#include "NativeMeasuredEdges.h"
#include "ScratchYoga.h"
#include <iostream>
#include <limits>

using namespace codon::motion;
namespace y = facebook::yoga;
static int assertions = 0;
static void require(bool condition, const char *message) {
  assertions++;
  if (!condition) throw std::runtime_error(message);
}
static void near(double actual, double expected) {
  require(std::abs(actual - expected) < 0.001, "evaluated margin or native alias differs");
}
static double read(std::string_view name, const std::array<float, 4> &edges, bool rtl = false, bool swapped = false) {
  const auto selected = nativeMeasuredEdgeSelection(name, "margin", "", rtl, swapped);
  require(selected.has_value(), "native margin field not recognized");
  return nativeMeasuredEdgeValue(edges, *selected);
}
template <typename T> static void rejects(T action, std::string_view expected) {
  try { action(); } catch (const std::exception &error) {
    require(std::string_view(error.what()).find(expected) != std::string_view::npos, "wrong edge error");
    return;
  }
  throw std::runtime_error("expected evaluated edge rejection");
}
int main() {
  try {
    TNativeScratchNode root{1, {}};
    root.style.setAlignItems(y::Align::FlexStart);
    root.style.setPadding(y::Edge::All, y::StyleLength::points(20));
    root.style.setBorder(y::Edge::All, y::StyleLength::points(10));
    TNativeScratchNode child{2, {}};
    child.style.setDimension(y::Dimension::Width, y::StyleSizeLength::points(120));
    child.style.setDimension(y::Dimension::Height, y::StyleSizeLength::points(40));
    child.style.setMargin(y::Edge::All, y::StyleLength::percent(10));
    root.children.push_back(child);
    TNativeScratchConstraints constraints;
    constraints.minimumWidth = constraints.maximumWidth = 400;
    constraints.minimumHeight = constraints.maximumHeight = 300;
    constraints.direction = YGDirectionLTR;
    auto second = root;
    second.children[0].style.setMargin(y::Edge::All, y::StyleLength::percent(50));
    const auto evaluated = evaluateNativeScratchStages({{root, constraints}, {second, constraints}}, 2);
    const auto &firstMargin = evaluated[0][1].layout.margin;
    const auto &secondMargin = evaluated[1][1].layout.margin;
    for (const auto value : firstMargin) near(value, 34);
    for (const auto value : secondMargin) near(value, 170);
    for (const auto name : {"margin", "marginHorizontal", "marginVertical", "marginInline", "marginBlock"}) {
      near(read(name, firstMargin), 34);
      near(read(name, secondMargin), 170);
    }
    // Both vertical and horizontal percent margins use Yoga's actual inner width.
    auto narrower = constraints;
    narrower.minimumWidth = narrower.maximumWidth = 200;
    const auto small = evaluateNativeScratchStages({{root, narrower}}, 2)[0][1].layout.margin;
    near(read("marginTop", small), 14);
    near(read("marginLeft", small), 14);
    auto zero = root;
    zero.children[0].style.setMargin(y::Edge::All, y::StyleLength::points(0));
    near(read("margin", evaluateNativeScratchStages({{zero, constraints}}, 2)[0][1].layout.margin), 0);
    const std::array<float, 4> physical{3, 5, 7, 11};
    for (const bool rtl : {false, true}) for (const bool swapped : {false, true}) {
      near(read("marginLeft", physical, rtl, swapped), swapped ? 7 : 3);
      near(read("marginRight", physical, rtl, swapped), swapped ? 3 : 7);
      near(read("marginStart", physical, rtl, swapped), rtl ? 7 : 3);
      near(read("marginInlineEnd", physical, rtl, swapped), rtl ? 3 : 7);
      near(read("marginBlockStart", physical, rtl, swapped), 5);
      near(read("marginBottom", physical, rtl, swapped), 11);
    }
    rejects([&] { read("margin", physical); }, "ambiguous");
    rejects([&] { read("marginHorizontal", physical); }, "ambiguous");
    rejects([&] { read("marginLeft", {std::numeric_limits<float>::infinity(), 0, 0, 0}); }, "non-finite");
    require(!nativeMeasuredEdgeSelection("marginColor", "margin", "", false, false), "unknown margin accepted");
    require(!nativeMeasuredEdgeSelection("borderWidth", "margin", "", false, false), "unrelated metric accepted");
    require(!nativeMeasuredEdgeSelection("m", "margin", "", false, false), "short metric accepted");
    near(nativeMeasuredEdgeValue(physical, *nativeMeasuredEdgeSelection("paddingRight", "padding", "", false, true)), 3);
    near(nativeMeasuredEdgeValue(physical, *nativeMeasuredEdgeSelection("borderInlineStartWidth", "border", "Width", true, false)), 7);
    std::cout << "PASS " << assertions << " measured-edge assertions; actual pinned Yoga, synthetic trees; no native acceptance\n";
  } catch (const std::exception &error) { std::cerr << error.what() << '\n'; return 1; }
}
