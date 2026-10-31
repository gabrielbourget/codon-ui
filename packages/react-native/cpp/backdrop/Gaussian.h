#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

namespace codon::backdrop {
// Packed, premultiplied RGBA8 in sRGB. Sigma is expressed in physical pixels.
std::vector<uint8_t> gaussianBlur(const uint8_t *pixels, size_t width, size_t height,
    double sigma, const std::function<bool()> &current);
}
