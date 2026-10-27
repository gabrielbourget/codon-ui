#include "ForegroundFilters.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>
#include <stdexcept>

namespace codon::overlay {
namespace {
using TPixel = std::array<float, 4>;
struct TImage {
  int64_t x = 0, y = 0;
  size_t width, height;
  std::vector<TPixel> pixels;
};
void checkCurrent(const std::function<bool()> &current) {
  if (!current || !current()) throw std::runtime_error("Native foreground: transaction retired");
}
size_t count(size_t width, size_t height) {
  if (!width || !height || width > static_cast<size_t>(INT32_MAX) || height > static_cast<size_t>(INT32_MAX) ||
      width > std::numeric_limits<size_t>::max() / height / sizeof(TPixel))
    throw std::invalid_argument("Native foreground: invalid raster extent");
  return width * height;
}
int64_t coordinate(double value) {
  if (!std::isfinite(value) || value < INT32_MIN || value > INT32_MAX)
    throw std::invalid_argument("Native foreground: invalid raster coordinate");
  return static_cast<int64_t>(value);
}
TPixel sample(const TImage &image, int64_t x, int64_t y) {
  x -= image.x; y -= image.y;
  if (x < 0 || y < 0 || static_cast<size_t>(x) >= image.width || static_cast<size_t>(y) >= image.height) return {};
  return image.pixels[static_cast<size_t>(y) * image.width + static_cast<size_t>(x)];
}
TPixel sample(const TImage &image, double x, double y) {
  const auto left = coordinate(std::floor(x)), top = coordinate(std::floor(y));
  const double dx = x - left, dy = y - top;
  const auto a = sample(image, left, top), b = sample(image, left + 1, top);
  const auto c = sample(image, left, top + 1), d = sample(image, left + 1, top + 1);
  TPixel result;
  for (size_t channel = 0; channel < 4; channel++)
    result[channel] = static_cast<float>((a[channel] * (1-dx) + b[channel] * dx) * (1-dy) +
        (c[channel] * (1-dx) + d[channel] * dx) * dy);
  return result;
}
TImage empty(int64_t x, int64_t y, size_t width, size_t height) {
  return {x, y, width, height, std::vector<TPixel>(count(width, height))};
}
TImage blur(const TImage &image, double sigma, const std::function<bool()> &current) {
  if (sigma == 0) return image;
  const auto radius = coordinate(std::ceil(sigma * 6));
  const auto extent = static_cast<size_t>(radius);
  auto horizontal = empty(image.x - radius, image.y, image.width + 2 * extent, image.height);
  auto result = empty(horizontal.x, image.y - radius, horizontal.width, image.height + 2 * extent);
  std::vector<double> weights(2 * extent + 1);
  double sum = 0;
  for (int64_t tap = -radius; tap <= radius; tap++) {
    if ((tap & 4095) == 0) checkCurrent(current);
    const auto weight = std::exp(-0.5 * (tap / sigma) * (tap / sigma));
    weights[static_cast<size_t>(tap + radius)] = weight; sum += weight;
  }
  for (auto &weight : weights) weight /= sum;
  // Transparent extension is required here; backdrop's mirrored source-edge kernel is different.
  for (size_t y = 0; y < horizontal.height; y++) {
    checkCurrent(current);
    for (size_t x = 0; x < horizontal.width; x++) {
      std::array<double, 4> value{};
      const auto center = horizontal.x + static_cast<int64_t>(x);
      const auto first = std::max(-radius, image.x - center);
      const auto last = std::min(radius, image.x + static_cast<int64_t>(image.width) - 1 - center);
      for (auto tap = first; tap <= last; tap++) {
        const auto pixel = sample(image, center + tap, image.y + static_cast<int64_t>(y));
        const auto weight = weights[static_cast<size_t>(tap + radius)];
        for (size_t channel = 0; channel < 4; channel++) value[channel] += pixel[channel] * weight;
      }
      for (size_t channel = 0; channel < 4; channel++)
        horizontal.pixels[y * horizontal.width + x][channel] = static_cast<float>(value[channel]);
    }
  }
  for (size_t y = 0; y < result.height; y++) {
    checkCurrent(current);
    const auto center = result.y + static_cast<int64_t>(y);
    const auto first = std::max(-radius, image.y - center);
    const auto last = std::min(radius, image.y + static_cast<int64_t>(image.height) - 1 - center);
    for (size_t x = 0; x < result.width; x++) {
      std::array<double, 4> value{};
      for (auto tap = first; tap <= last; tap++) {
        const auto pixel = sample(horizontal, result.x + static_cast<int64_t>(x), center + tap);
        const auto weight = weights[static_cast<size_t>(tap + radius)];
        for (size_t channel = 0; channel < 4; channel++) value[channel] += pixel[channel] * weight;
      }
      for (size_t channel = 0; channel < 4; channel++)
        result.pixels[y * result.width + x][channel] = static_cast<float>(value[channel]);
    }
  }
  return result;
}
using TMatrix = std::array<std::array<double, 4>, 3>;
TMatrix matrix(const TForegroundFilter &filter) {
  const double a = filter.amount, bounded = std::clamp(a, 0.0, 1.0);
  switch (filter.kind) {
    case TForegroundFilterKind::Brightness: return {{{a,0,0,0}, {0,a,0,0}, {0,0,a,0}}};
    case TForegroundFilterKind::Contrast: {
      const double intercept = 0.5 * (1-a);
      return {{{a,0,0,intercept}, {0,a,0,intercept}, {0,0,a,intercept}}};
    }
    case TForegroundFilterKind::Invert:
      return {{{1-2*bounded,0,0,bounded}, {0,1-2*bounded,0,bounded}, {0,0,1-2*bounded,bounded}}};
    case TForegroundFilterKind::Grayscale:
    case TForegroundFilterKind::Saturate: {
      const double s = filter.kind == TForegroundFilterKind::Grayscale ? 1-bounded : a;
      if (filter.kind == TForegroundFilterKind::Grayscale)
        return {{{.2126+.7874*s,.7152-.7152*s,.0722-.0722*s,0},
            {.2126-.2126*s,.7152+.2848*s,.0722-.0722*s,0}, {.2126-.2126*s,.7152-.7152*s,.0722+.9278*s,0}}};
      return {{{.213+.787*s,.715-.715*s,.072-.072*s,0},
          {.213-.213*s,.715+.285*s,.072-.072*s,0}, {.213-.213*s,.715-.715*s,.072+.928*s,0}}};
    }
    case TForegroundFilterKind::Sepia:
      return {{{1-.607*bounded,.769*bounded,.189*bounded,0},
          {.349*bounded,1-.314*bounded,.168*bounded,0}, {.272*bounded,.534*bounded,1-.869*bounded,0}}};
    case TForegroundFilterKind::HueRotate: {
      const double angle = std::remainder(a, 360.0) * std::numbers::pi / 180;
      const double c = std::cos(angle), s = std::sin(angle);
      return {{{.213+.787*c-.213*s,.715-.715*c-.715*s,.072-.072*c+.928*s,0},
          {.213-.213*c+.143*s,.715+.285*c+.140*s,.072-.072*c-.283*s,0},
          {.213-.213*c-.787*s,.715-.715*c+.715*s,.072+.928*c+.072*s,0}}};
    }
    default: throw std::invalid_argument("Native foreground: invalid color operation");
  }
}
void color(TImage &image, const TForegroundFilter &filter, const std::function<bool()> &current) {
  if (filter.kind == TForegroundFilterKind::Opacity) {
    const auto amount = static_cast<float>(std::clamp(filter.amount, 0.0, 1.0));
    for (size_t y = 0; y < image.height; y++) {
      checkCurrent(current);
      for (size_t x = 0; x < image.width; x++)
        for (auto &channel : image.pixels[y * image.width + x]) channel *= amount;
    }
    return;
  }
  const auto transform = matrix(filter);
  for (size_t y = 0; y < image.height; y++) {
    checkCurrent(current);
    for (size_t x = 0; x < image.width; x++) {
      auto &pixel = image.pixels[y * image.width + x];
      const double alpha = pixel[3];
      if (alpha == 0) { pixel = {}; continue; }
      const std::array<double, 3> straight = {pixel[0]/alpha, pixel[1]/alpha, pixel[2]/alpha};
      for (size_t row = 0; row < 3; row++) {
        double result = transform[row][3];
        for (size_t column = 0; column < 3; column++) result += transform[row][column] * straight[column];
        pixel[row] = static_cast<float>(std::clamp(result, 0.0, 1.0) * alpha);
      }
    }
  }
}
TImage shadow(const TImage &image, const TForegroundFilter &filter, const std::function<bool()> &current) {
  auto alpha = blur(image, filter.amount, current);
  const auto left = std::min(image.x, coordinate(std::floor(alpha.x + filter.offsetX)));
  const auto top = std::min(image.y, coordinate(std::floor(alpha.y + filter.offsetY)));
  const auto right = std::max(image.x + static_cast<int64_t>(image.width),
      coordinate(std::ceil(alpha.x + alpha.width + filter.offsetX)));
  const auto bottom = std::max(image.y + static_cast<int64_t>(image.height),
      coordinate(std::ceil(alpha.y + alpha.height + filter.offsetY)));
  auto result = empty(left, top, static_cast<size_t>(right-left), static_cast<size_t>(bottom-top));
  for (size_t y = 0; y < result.height; y++) {
    checkCurrent(current);
    for (size_t x = 0; x < result.width; x++) {
      const auto pointX = result.x + static_cast<int64_t>(x), pointY = result.y + static_cast<int64_t>(y);
      const auto source = sample(image, pointX, pointY);
      const double shadowAlpha = sample(alpha, pointX-filter.offsetX, pointY-filter.offsetY)[3] * filter.color[3];
      auto &output = result.pixels[y * result.width + x];
      for (size_t channel = 0; channel < 3; channel++)
        output[channel] = static_cast<float>(source[channel] + shadowAlpha * filter.color[channel] * (1-source[3]));
      output[3] = static_cast<float>(source[3] + shadowAlpha * (1-source[3]));
    }
  }
  return result;
}
}
TForegroundRaster filterForeground(const uint8_t *rgba, size_t width, size_t height,
    const std::vector<TForegroundFilter> &filters, const std::function<bool()> &current) {
  checkCurrent(current);
  if (!rgba) throw std::invalid_argument("Native foreground: missing source pixels");
  auto image = empty(0, 0, width, height);
  for (size_t index = 0; index < image.pixels.size(); index++) {
    if (index % width == 0) checkCurrent(current);
    for (size_t channel = 0; channel < 4; channel++) {
      if (rgba[index*4+channel] > rgba[index*4+3])
        throw std::invalid_argument("Native foreground: source is not premultiplied RGBA");
      image.pixels[index][channel] = rgba[index*4+channel] / 255.0f;
    }
  }
  for (const auto &filter : filters) {
    if (!std::isfinite(filter.amount) || !std::isfinite(filter.offsetX) || !std::isfinite(filter.offsetY) ||
        (filter.kind != TForegroundFilterKind::HueRotate && filter.amount < 0))
      throw std::invalid_argument("Native foreground: invalid filter parameter");
    for (auto channel : filter.color)
      if (!std::isfinite(channel) || channel < 0 || channel > 1)
        throw std::invalid_argument("Native foreground: invalid shadow color");
    if (filter.kind == TForegroundFilterKind::Blur) image = blur(image, filter.amount, current);
    else if (filter.kind == TForegroundFilterKind::DropShadow) image = shadow(image, filter, current);
    else color(image, filter, current);
  }
  TForegroundRaster result{image.x, image.y, image.width, image.height, std::vector<uint8_t>(image.pixels.size()*4)};
  for (size_t index = 0; index < image.pixels.size(); index++) {
    if (index % image.width == 0) checkCurrent(current);
    const auto alpha = std::clamp(std::lround(image.pixels[index][3]*255), 0L, 255L);
    result.rgba[index*4+3] = static_cast<uint8_t>(alpha);
    for (size_t channel = 0; channel < 3; channel++)
      result.rgba[index*4+channel] = static_cast<uint8_t>(std::clamp(std::lround(image.pixels[index][channel]*255), 0L, alpha));
  }
  return result;
}
}
