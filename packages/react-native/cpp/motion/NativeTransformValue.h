#pragma once

// Adapted from Motion DOM 12.40.0 parse-transform.ts (MIT):
// https://github.com/motiondivision/motion/blob/38ebb9480e5b25a51e09e2ec866c101d01d82c60/packages/motion-dom/src/render/dom/parse-transform.ts
// The existing src/motion/kernel/LICENSE.motion-dom.md retains the MIT notice.
#include <array>
#include <cmath>
#include <cstddef>
#include <numbers>
#include <optional>
#include <stdexcept>
#include <string_view>

namespace codon::motion {

inline bool hasNativeMotionMatrixScalar(std::string_view name) {
  constexpr std::string_view names[]{
      "x", "y", "z", "translateX", "translateY", "translateZ", "scale", "scaleX",
      "scaleY", "rotate", "rotateX", "rotateY", "rotateZ", "skew", "skewX", "skewY"};
  for (const auto supported : names) if (name == supported) return true;
  return false;
}

inline double nativeMotionRadiansToDegrees(double radians) {
  return radians * 180 / std::numbers::pi_v<double>;
}

inline double nativeMotionRebaseAngle(double degrees) {
  auto angle = std::fmod(degrees, 360);
  if (angle < 0) angle += 360;
  return angle;
}

// The dimension is explicit. Native Fabric callers supply their resolved 4x4
// array; an affine-looking native matrix is never relabelled as a CSS 2d matrix.
// These are the pinned scalar probes, not a general matrix decomposition.
template <typename T, std::size_t N>
std::optional<double> readNativeMotionMatrixScalar(const std::array<T, N> &matrix, std::string_view name) {
  static_assert(N == 6 || N == 16, "Motion scalar readers require explicit 2d or 3d matrix inputs");
  if (!hasNativeMotionMatrixScalar(name)) return std::nullopt;
  for (const auto value : matrix)
    if (!std::isfinite(static_cast<double>(value)))
      throw std::runtime_error("Native motion initial value: non-finite native transform matrix");
  const auto coefficient = [&](std::size_t index) { return static_cast<double>(matrix[index]); };
  const auto rotation = [&](std::size_t y, std::size_t x) {
    return nativeMotionRebaseAngle(nativeMotionRadiansToDegrees(std::atan2(coefficient(y), coefficient(x))));
  };
  if constexpr (N == 6) {
    if (name == "x" || name == "translateX") return coefficient(4);
    if (name == "y" || name == "translateY") return coefficient(5);
    if (name == "scaleX") return coefficient(0);
    if (name == "scaleY") return coefficient(3);
    if (name == "scale") return (std::abs(coefficient(0)) + std::abs(coefficient(3))) / 2;
    if (name == "rotate" || name == "rotateZ") return rotation(1, 0);
    if (name == "skewX") return nativeMotionRadiansToDegrees(std::atan(coefficient(1)));
    if (name == "skewY") return nativeMotionRadiansToDegrees(std::atan(coefficient(2)));
    if (name == "skew") return (std::abs(coefficient(1)) + std::abs(coefficient(2))) / 2;
  } else {
    if (name == "x" || name == "translateX") return coefficient(12);
    if (name == "y" || name == "translateY") return coefficient(13);
    if (name == "z" || name == "translateZ") return coefficient(14);
    const auto scaleX = [&] { return std::sqrt(coefficient(0) * coefficient(0) + coefficient(1) * coefficient(1)); };
    const auto scaleY = [&] { return std::sqrt(coefficient(4) * coefficient(4) + coefficient(5) * coefficient(5)); };
    if (name == "scaleX") return scaleX();
    if (name == "scaleY") return scaleY();
    if (name == "scale") return (scaleX() + scaleY()) / 2;
    if (name == "rotateX") return rotation(6, 5);
    if (name == "rotateY")
      return nativeMotionRebaseAngle(nativeMotionRadiansToDegrees(std::atan2(-coefficient(2), coefficient(0))));
    if (name == "rotate" || name == "rotateZ") return rotation(1, 0);
    if (name == "skewX") return nativeMotionRadiansToDegrees(std::atan(coefficient(4)));
    if (name == "skewY") return nativeMotionRadiansToDegrees(std::atan(coefficient(1)));
    if (name == "skew") return (std::abs(coefficient(1)) + std::abs(coefficient(4))) / 2;
  }
  return std::nullopt;
}

} // namespace codon::motion
