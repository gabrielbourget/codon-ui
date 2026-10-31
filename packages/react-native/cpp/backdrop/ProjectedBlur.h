#pragma once

#include "Gaussian.h"
#include <array>

namespace codon::backdrop {
struct TPoint { double x, y; };
using TQuad = std::array<TPoint, 4>;
// Row-major homogeneous mapping; divide the first two rows by the last row.
using TProjection = std::array<double, 9>;

// Quads are TL, TR, BR, BL in physical screen pixels, including native transforms.
TProjection rectangleProjection(double width, double height, const TQuad &quad);
TPoint project(const TProjection &projection, TPoint point);
std::vector<uint8_t> projectedBlur(const uint8_t *pixels, size_t width, size_t height,
    const TQuad &source, size_t outputWidth, size_t outputHeight, const TQuad &receiver,
    double sigma, const std::function<bool()> &current);
}
