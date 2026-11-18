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
  const size_t stride = width * 4;
  std::vector<float> horizontal(count);
  std::vector<uint8_t> output(count);
  std::vector<double> rowValues(stride);
  auto *values = rowValues.data();
  for (size_t y = 0; y < height; y++) {
    check(current);
    const auto *row = pixels + y * stride;
    for (size_t i = 0; i < stride; i++) values[i] = row[i] * weights[0];
    // Walk contiguous channels for each tap. Only the edge pixels need reflection,
    // and all four channels share the same reflected coordinate.
    for (int64_t offset = 1; offset <= radius; offset++) {
      if (offset % 64 == 0) check(current);
      const auto distance = static_cast<size_t>(offset);
      const auto interiorStart = std::min(distance, width);
      const auto interiorEnd = std::max(interiorStart, width - interiorStart);
      const auto weight = weights[distance];
      const auto accumulateEdge = [&](size_t x) {
        const auto coordinate = static_cast<int64_t>(x);
        const auto *previous = row + mirror(coordinate - offset, width) * 4;
        const auto *next = row + mirror(coordinate + offset, width) * 4;
        for (size_t channel = 0; channel < 4; channel++)
          values[x * 4 + channel] += (previous[channel] + next[channel]) * weight;
      };
      for (size_t x = 0; x < interiorStart; x++) accumulateEdge(x);
      const size_t interiorChannels = (interiorEnd - interiorStart) * 4;
      if (interiorChannels) {
        const auto *previous = row + (interiorStart - distance) * 4;
        const auto *next = row + (interiorStart + distance) * 4;
        auto *interior = values + interiorStart * 4;
        for (size_t i = 0; i < interiorChannels; i++) interior[i] += (previous[i] + next[i]) * weight;
      }
      for (size_t x = interiorEnd; x < width; x++) accumulateEdge(x);
    }
    auto *filtered = horizontal.data() + y * stride;
    for (size_t i = 0; i < stride; i++) filtered[i] = static_cast<float>(values[i]);
  }
  for (size_t y = 0; y < height; y++) {
    check(current);
    const auto *row = horizontal.data() + y * stride;
    for (size_t i = 0; i < stride; i++) values[i] = row[i] * weights[0];
    for (int64_t offset = 1; offset <= radius; offset++) {
      if (offset % 64 == 0) check(current);
      const auto coordinate = static_cast<int64_t>(y);
      const auto *previous = horizontal.data() + mirror(coordinate - offset, height) * stride;
      const auto *next = horizontal.data() + mirror(coordinate + offset, height) * stride;
      const auto weight = weights[static_cast<size_t>(offset)];
      for (size_t i = 0; i < stride; i++) values[i] += (previous[i] + next[i]) * weight;
    }
    auto *filtered = output.data() + y * stride;
    for (size_t i = 0; i < stride; i++)
      filtered[i] = static_cast<uint8_t>(std::clamp(std::lround(values[i]), 0L, 255L));
  }
  check(current);
  return output;
}
}
