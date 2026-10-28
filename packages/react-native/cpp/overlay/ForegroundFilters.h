#pragma once
#include <array>
#include <cstdint>
#include <functional>
#include <vector>

namespace codon::overlay {
enum class TForegroundFilterKind {
  Blur, Brightness, Contrast, Grayscale, HueRotate, Invert, Opacity, Saturate, Sepia, DropShadow
};
struct TForegroundFilter {
  TForegroundFilterKind kind;
  double amount = 0;
  double offsetX = 0;
  double offsetY = 0;
  std::array<double, 4> color = {0, 0, 0, 1};
};
struct TForegroundRaster {
  int64_t x = 0;
  int64_t y = 0;
  size_t width = 0;
  size_t height = 0;
  std::vector<uint8_t> rgba;
};
// Source/output are premultiplied RGBA8/sRGB. Lengths and returned bounds are physical pixels.
// Floating premultiplied storage survives between stages; color matrices operate on straight RGB.
TForegroundRaster filterForeground(const uint8_t *rgba, size_t width, size_t height,
    const std::vector<TForegroundFilter> &filters, const std::function<bool()> &current);
}
