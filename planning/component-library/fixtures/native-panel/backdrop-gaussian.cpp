#include "../../../../packages/react-native/cpp/backdrop/Gaussian.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>

int main() {
  size_t assertions = 0;
  const auto check = [&](bool value) { assert(value); assertions++; };
  const auto live = [] { return true; };
  for (size_t width : {1, 2, 5}) for (size_t height : {1, 3, 6}) {
    std::vector<uint8_t> pixels(width * height * 4);
    for (size_t index = 0; index < pixels.size(); index++) pixels[index] = index % 4 == 3 ? 255 : (index * 37) % 256;
    check(codon::backdrop::gaussianBlur(pixels.data(), width, height, 0, live) == pixels);
    for (double sigma : {0.2, 0.75, 2.0, 4.5}) {
      const auto actual = codon::backdrop::gaussianBlur(pixels.data(), width, height, sigma, live);
      const int radius = static_cast<int>(std::ceil(6 * sigma));
      // Independent two-dimensional reference, reflecting at pixel boundaries.
      const auto reflect = [](int coordinate, int extent) {
        while (coordinate < 0 || coordinate >= extent) {
          if (coordinate < 0) coordinate = -coordinate - 1;
          else coordinate = 2 * extent - coordinate - 1;
        }
        return coordinate;
      };
      for (int y = 0; y < static_cast<int>(height); y++) for (int x = 0; x < static_cast<int>(width); x++) {
        double channels[4]{}, sum = 0;
        for (int dy = -radius; dy <= radius; dy++) for (int dx = -radius; dx <= radius; dx++) {
          const double weight = std::exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
          const size_t source = (reflect(y + dy, height) * width + reflect(x + dx, width)) * 4;
          sum += weight;
          for (size_t channel = 0; channel < 4; channel++) channels[channel] += pixels[source + channel] * weight;
        }
        for (size_t channel = 0; channel < 4; channel++)
          check(std::abs(actual[(y * width + x) * 4 + channel] - std::lround(channels[channel] / sum)) <= 1);
      }
    }
  }
  const uint8_t transparentRed[] = {0, 0, 0, 0, 255, 0, 0, 255};
  const auto blended = codon::backdrop::gaussianBlur(transparentRed, 2, 1, 1, live);
  check(blended[0] == blended[3] && blended[4] == blended[7]);
  check(blended[1] == 0 && blended[2] == 0 && blended[5] == 0 && blended[6] == 0);
  for (double sigma : {-1.0, std::numeric_limits<double>::infinity(), std::numeric_limits<double>::quiet_NaN()}) {
    try { codon::backdrop::gaussianBlur(transparentRed, 2, 1, sigma, live); check(false); }
    catch (const std::invalid_argument &) { check(true); }
  }
  int reads = 0;
  try { codon::backdrop::gaussianBlur(transparentRed, 2, 1, 1, [&] { return ++reads < 3; }); check(false); }
  catch (const std::runtime_error &) { check(true); }
  std::cout << assertions << " shared Gaussian pixel/cancellation assertions passed\n";
}
