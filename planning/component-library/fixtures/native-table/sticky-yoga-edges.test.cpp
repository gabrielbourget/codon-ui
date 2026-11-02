#include <yoga/style/Style.h>
#include <react/renderer/graphics/Float.h>
#include <array>
#include <cmath>
#include <iostream>
#include <limits>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <variant>

static_assert(sizeof(facebook::react::Float) == EXPECTED_FLOAT_BYTES);

// These are input declarations only; all evaluated edge/alias/guard code below
// is extracted from the current production source, not implemented by this model.
namespace facebook::react {
struct YogaStylableProps {
  yoga::Style yogaStyle;
  yoga::StyleLength insetInlineEnd, insetInlineStart, insetBlockEnd, insetBlockStart;
  yoga::StyleLength marginInline, marginInlineStart, marginInlineEnd, marginBlock, marginBlockStart, marginBlockEnd;
  yoga::StyleLength paddingInline, paddingInlineStart, paddingInlineEnd, paddingBlock, paddingBlockStart, paddingBlockEnd;
  bool operator==(const YogaStylableProps &) const = default;
};
struct BaseViewProps : YogaStylableProps {
  bool operator==(const BaseViewProps &) const = default;
};
}
namespace folly {
struct dynamic {
  std::variant<std::monostate, double, std::string> value;
  std::map<std::string, dynamic> fields;
  dynamic() = default;
  dynamic(double number) : value(number) {}
  dynamic(const char *text) : value(std::string(text)) {}
  bool isNumber() const { return std::holds_alternative<double>(value); }
  bool isString() const { return std::holds_alternative<std::string>(value); }
  double asDouble() const { return std::get<double>(value); }
  const std::string &asString() const { return std::get<std::string>(value); }
  const dynamic &at(const char *key) const { return fields.at(key); }
};
}
namespace codon::motion {
namespace yoga = facebook::yoga;
using facebook::react::YogaStylableProps;
yoga::Style swapNativeYogaStyle(yoga::Style);
#include "normalization.inc"
}
namespace codon::table {
namespace y = facebook::yoga;
using namespace facebook::react;
#include "style.inc"
#include "presentation.inc"
}

int main() {
  namespace y = facebook::yoga;
  using facebook::react::BaseViewProps;
  using facebook::react::Float;
  using y::Edge;
  using L = y::StyleLength;
  int checks = 0;
  const auto require = [&](bool value) {
    ++checks;
    if (!value) throw std::runtime_error("sticky stock Yoga edge contract mismatch");
  };
  const auto near = [&](double actual, double expected) { require(std::abs(actual - expected) < 0.0001); };
  const auto rejected = [&](auto operation) {
    bool threw = false;
    try { operation(); } catch (const std::exception &) { threw = true; }
    require(threw);
  };
  const auto fallback = [](folly::dynamic top) {
    folly::dynamic value;
    value.fields.emplace("top", std::move(top));
    return value;
  };
  const std::array<Edge, 4> physical{Edge::Left, Edge::Top, Edge::Right, Edge::Bottom};
  for (const bool rtl : {false, true}) {
    const std::array<std::array<Edge, 4>, 4> precedence{{
        {rtl ? Edge::End : Edge::Start, Edge::Left, Edge::Horizontal, Edge::All},
        {Edge::Top, Edge::Vertical, Edge::All, Edge::All},
        {rtl ? Edge::Start : Edge::End, Edge::Right, Edge::Horizontal, Edge::All},
        {Edge::Bottom, Edge::Vertical, Edge::All, Edge::All}}};
    for (size_t edge = 0; edge < physical.size(); ++edge) {
      const auto levels = edge % 2 == 0 ? 4u : 3u;
      for (size_t winner = 0; winner <= levels; ++winner) {
        for (const auto value : {L::points(-7.25f), L::points(0), L::percent(25), L::ofAuto()}) {
          y::Style style;
          for (size_t level = winner; level < levels; ++level) {
            style.setPosition(precedence[edge][level], level == winner ? value : L::points(91 + level));
            style.setMargin(precedence[edge][level], level == winner ? value : L::points(91 + level));
          }
          const auto original = style;
          const auto actual = codon::table::selectedPosition(style, edge % 2 == 0, edge >= 2, rtl);
          require(actual == (winner < levels ? value : L::undefined()));
          near(codon::table::selectedMargin(style, edge % 2 == 0, edge >= 2, rtl, 320),
              winner == levels || value.isAuto() ? 0 : value.isPercent() ? 80 : value.value().unwrap());
          require(style == original);
        }
      }
    }
    for (const bool swap : {false, true}) {
      BaseViewProps props;
      props.yogaStyle.setPosition(Edge::Left, L::points(10));
      props.yogaStyle.setPosition(Edge::Right, L::points(20));
      props.yogaStyle.setPosition(Edge::Top, L::percent(25));
      props.yogaStyle.setPosition(Edge::Bottom, L::percent(-25));
      props.insetInlineStart = L::points(30);
      props.insetInlineEnd = L::points(40);
      props.yogaStyle.setMargin(Edge::Left, L::points(11));
      props.yogaStyle.setMargin(Edge::Right, L::points(21));
      props.marginInlineStart = L::points(31);
      props.marginInlineEnd = L::points(41);
      props.marginBlock = L::percent(25);
      props.marginBlockStart = L::percent(-25);
      const auto original = props;
      const auto insets = codon::table::nativeStickyInsets(props, fallback(99), rtl, swap, 320, 120);
      near(*insets[0], swap ? (rtl ? 20 : 10) : (rtl ? 40 : 30));
      near(*insets[1], 30);
      near(*insets[2], swap ? (rtl ? 10 : 20) : (rtl ? 30 : 40));
      near(*insets[3], -30);
      auto normalized = codon::motion::copyNativeYogaStyle(props, swap);
      near(codon::table::selectedMargin(normalized, true, false, rtl, 320), swap ? (rtl ? 21 : 11) : (rtl ? 41 : 31));
      near(codon::table::selectedMargin(normalized, false, false, rtl, 320), -80);
      near(codon::table::selectedMargin(normalized, false, true, rtl, 320), 80);
      require(props == original);
    }
  }
  BaseViewProps empty;
  auto result = codon::table::nativeStickyInsets(empty, fallback("25%"), false, false, 320, 120);
  require(!result[0] && !result[2] && !result[3]);
  near(*result[1], 30);
  require(empty.yogaStyle.position(Edge::Top).isUndefined());
  empty.yogaStyle.setPosition(Edge::Top, L::ofAuto());
  result = codon::table::nativeStickyInsets(empty, fallback("malformed"), false, false, 320, 120);
  require(!result[1]);
  empty.yogaStyle.setPosition(Edge::Top, L::points(0));
  result = codon::table::nativeStickyInsets(empty, fallback("malformed"), false, false, 320, 120);
  near(*result[1], 0);
  for (const auto &value : {folly::dynamic{}, folly::dynamic("12x%"), folly::dynamic("bad"), folly::dynamic(std::numeric_limits<double>::infinity())}) {
    rejected([&] { codon::table::nativeStickyInsets(BaseViewProps{}, fallback(value), false, false, 320, 120); });
  }
  for (const auto value : {std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(), -std::numeric_limits<double>::infinity()}) {
    rejected([&] { codon::table::nativeFloat(value); });
    rejected([&] { codon::table::nativeStickyInsets(empty, fallback(0.0), false, false, 320, value); });
  }
  if (sizeof(Float) < sizeof(double)) rejected([&] { codon::table::nativeFloat(std::numeric_limits<double>::max()); });
  std::cout << "PASS " << checks << " exact production edge/normalization/guard controls, Float bytes=" << sizeof(Float) << "; declaration-only Props/fallback inputs, no renderer or installed qualification\n";
}
