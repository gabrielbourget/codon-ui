#include <react/renderer/graphics/Transform.h>
#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>

namespace facebook::react {
struct BaseViewProps {
  static Transform resolveTransform(const Size &, const Transform &, const TransformOrigin &);
};
#include "sdk-resolve.inc"
}
namespace codon::table {
using namespace facebook::react;
#include "sticky-transform.inc"
}

int main() {
  using namespace facebook::react;
  int checks = 0;
  const auto require = [&](bool value) {
    checks++;
    if (!value) throw std::runtime_error("sticky transform/source preservation mismatch");
  };
  const auto near = [&](Float actual, Float expected) {
    const double scale = std::max({1.0, std::abs(static_cast<double>(actual)), std::abs(static_cast<double>(expected))});
    require(std::abs(actual - expected) <= 64 * std::numeric_limits<Float>::epsilon() * scale);
  };
  std::vector<Transform> transforms{Transform{}};
  Transform percent;
  percent.operations.push_back({TransformOperationType::Translate,
      ValueUnit(50, UnitType::Percent), ValueUnit(-25, UnitType::Percent), ValueUnit(4, UnitType::Point)});
  transforms.push_back(percent);
  transforms.push_back(Transform::Rotate(0.2, -0.3, 0.8) * Transform::Scale(1.5, 0.4, 2));
  Transform matrix;
  matrix.matrix = (Transform::Rotate(0.2, -0.3, 0.8) * Transform::Scale(1.5, 0.4, 2)).matrix;
  matrix.operations = {{TransformOperationType::Arbitrary, {}, {}, {}}};
  transforms.push_back(matrix);
  transforms.push_back(Transform::Perspective(800) * Transform::Rotate(0.2, 0.5, -0.3) * percent);
  transforms.push_back(Transform::Skew(0.2, -0.1) * percent);
  for (const auto &source : transforms) {
    const auto original = source;
    for (const auto size : {Size{80, 40}, Size{300, 210}}) {
      for (const auto origin : {TransformOrigin{}, TransformOrigin{{ValueUnit(30, UnitType::Percent), ValueUnit(70, UnitType::Percent)}, 5}}) {
        for (const auto offset : {Point{0, 0}, Point{12.5, -3.25}, Point{-18, 240}}) {
          const auto projected = codon::table::nativeStickyTransform(source, offset.x, offset.y);
          const auto actual = BaseViewProps::resolveTransform(size, projected, origin);
          const auto expected = Transform::Translate(offset.x, offset.y, 0) * BaseViewProps::resolveTransform(size, source, origin);
          for (size_t index = 0; index < 16; index++) near(actual.matrix[index], expected.matrix[index]);
          for (const auto point : {Vector{0, 0, 0, 1}, Vector{17, -9, 3, 1}, Vector{-45, 70, -2, 1}}) {
            const auto a = actual * point, b = expected * point;
            near(a.x, b.x); near(a.y, b.y); near(a.z, b.z); near(a.w, b.w);
          }
          require(source == original);
        }
      }
    }
  }
  std::cout << "PASS " << checks << " actual SDK graphics/source transform controls; no native view or pixel qualification\n";
}
