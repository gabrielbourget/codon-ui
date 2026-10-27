#include "Gaussian.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace codon::backdrop {
namespace {
size_t mirror(int64_t coordinate, size_t extent) {
  if (extent == 1) return 0;
  const auto period = static_cast<int64_t>(extent * 2);
  auto value = coordinate % period;
  if (value < 0) value += period;
  return static_cast<size_t>(value < static_cast<int64_t>(extent) ? value : period - value - 1);
}
void check(const std::function<bool()> &current) {
  if (!current || !current()) throw std::runtime_error("Native backdrop: frame retired");
}
}

std::vector<uint8_t> gaussianBlur(const uint8_t *pixels, size_t width, size_t height,
    double sigma, const std::function<bool()> &current) {
  if (!pixels || !width || !height || !std::isfinite(sigma) || sigma < 0 ||
      width > static_cast<size_t>(INT64_MAX / 4) || height > static_cast<size_t>(INT64_MAX / 4) ||
      width > std::numeric_limits<size_t>::max() / 4 / height)
    throw std::invalid_argument("Native backdrop: invalid image or sigma");
  check(current);
  const size_t count = width * height * 4;
  if (sigma == 0 || (width == 1 && height == 1)) return {pixels, pixels + count};
  // The omitted Gaussian tail is below 2e-9; normalize the retained discrete kernel.
  const double support = std::ceil(sigma * 6);
  if (support > static_cast<double>(INT64_MAX / 4))
    throw std::length_error("Native backdrop: Gaussian support exceeds addressable range");
  const auto radius = static_cast<int64_t>(std::max(1.0, support));
  std::vector<double> weights(static_cast<size_t>(radius) + 1);
  double sum = 0;
  for (int64_t offset = 0; offset <= radius; offset++) {
    if (offset % 4096 == 0) check(current);
    const auto distance = static_cast<double>(offset) / sigma;
    const auto weight = std::exp(-0.5 * distance * distance);
    weights[static_cast<size_t>(offset)] = weight;
    sum += offset ? weight * 2 : weight;
  }
  for (auto &weight : weights) weight /= sum;
  std::vector<float> horizontal(count);
  std::vector<uint8_t> output(count);
  for (size_t y = 0; y < height; y++) {
    check(current);
    for (size_t x = 0; x < width; x++) {
      for (size_t channel = 0; channel < 4; channel++) {
        double value = pixels[(y * width + x) * 4 + channel] * weights[0];
        for (int64_t offset = 1; offset <= radius; offset++)
          value += (pixels[(y * width + mirror(static_cast<int64_t>(x) - offset, width)) * 4 + channel] +
                    pixels[(y * width + mirror(static_cast<int64_t>(x) + offset, width)) * 4 + channel]) *
              weights[static_cast<size_t>(offset)];
        horizontal[(y * width + x) * 4 + channel] = static_cast<float>(value);
      }
    }
  }
  for (size_t y = 0; y < height; y++) {
    check(current);
    for (size_t x = 0; x < width; x++) {
      for (size_t channel = 0; channel < 4; channel++) {
        double value = horizontal[(y * width + x) * 4 + channel] * weights[0];
        for (int64_t offset = 1; offset <= radius; offset++)
          value += (horizontal[(mirror(static_cast<int64_t>(y) - offset, height) * width + x) * 4 + channel] +
                    horizontal[(mirror(static_cast<int64_t>(y) + offset, height) * width + x) * 4 + channel]) *
              weights[static_cast<size_t>(offset)];
        output[(y * width + x) * 4 + channel] = static_cast<uint8_t>(std::clamp(std::lround(value), 0L, 255L));
      }
    }
  }
  check(current);
  return output;
}
}
