#include "../../../../packages/react-native/cpp/overlay/ForegroundFilters.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <source_location>

using namespace codon::overlay;
int main() {
  size_t assertions = 0;
  const auto check = [&](bool value, std::source_location source = std::source_location::current()) { if (!value) std::cerr << "Failed assertion " << assertions << " at line " << source.line() << "\n"; assert(value); assertions++; };
  const auto live = [] { return true; };
  const auto pixel = [&](std::array<uint8_t,4> input, std::vector<TForegroundFilter> filters) {
    return filterForeground(input.data(), 1, 1, filters, live).rgba;
  };
  const auto near = [&](const std::vector<uint8_t> &actual, std::array<int,4> expected, int tolerance = 1) {
    check(actual.size() == 4);
    for (size_t index = 0; index < 4; index++) check(std::abs(actual[index]-expected[index]) <= tolerance);
  };
  near(pixel({64,32,16,128}, {}), {64,32,16,128}, 0);
  near(pixel({64,32,16,128}, {{TForegroundFilterKind::Brightness,2}}), {128,64,32,128});
  near(pixel({64,32,16,128}, {{TForegroundFilterKind::Contrast,0}}), {64,64,64,128});
  near(pixel({64,32,16,128}, {{TForegroundFilterKind::Invert,1}}), {64,96,112,128});
  near(pixel({64,32,16,128}, {{TForegroundFilterKind::Opacity,.25}}), {16,8,4,32});
  near(pixel({255,0,0,255}, {{TForegroundFilterKind::Grayscale,1}}), {54,54,54,255});
  near(pixel({255,0,0,255}, {{TForegroundFilterKind::Saturate,0}}), {54,54,54,255});
  near(pixel({255,0,0,255}, {{TForegroundFilterKind::Sepia,1}}), {100,89,69,255});
  near(pixel({255,0,0,255}, {{TForegroundFilterKind::HueRotate,90}}), {0,91,0,255});
  near(pixel({64,32,16,128}, {{TForegroundFilterKind::Grayscale,0}, {TForegroundFilterKind::HueRotate,360},
      {TForegroundFilterKind::Saturate,1}, {TForegroundFilterKind::Sepia,0}, {TForegroundFilterKind::Invert,0},
      {TForegroundFilterKind::Contrast,1}, {TForegroundFilterKind::Brightness,1}, {TForegroundFilterKind::Opacity,1},
      {TForegroundFilterKind::Blur,0}}), {64,32,16,128}, 0);
  // Straight RGB clamping happens at each authored stage, before the next operation.
  near(pixel({200,100,50,255}, {{TForegroundFilterKind::Brightness,2},{TForegroundFilterKind::Invert,1}}), {0,55,155,255});
  near(pixel({200,100,50,255}, {{TForegroundFilterKind::Invert,1},{TForegroundFilterKind::Brightness,2}}), {110,255,255,255});
  near(pixel({0,0,0,0}, {{TForegroundFilterKind::Invert,1},{TForegroundFilterKind::Contrast,0}}), {0,0,0,0}, 0);
  // Keep sub-byte alpha/color between stages rather than rounding every intermediate image.
  near(pixel({1,0,0,1}, {{TForegroundFilterKind::Opacity,.5},{TForegroundFilterKind::Brightness,0},
      {TForegroundFilterKind::Invert,1}}), {1,1,1,1}, 0);
  for (double sigma : {.2,.75,1.5}) {
    const int radius = static_cast<int>(std::ceil(sigma*6));
    const uint8_t input[] = {64,0,0,128, 0,32,0,64};
    const auto actual = filterForeground(input,2,1,{{TForegroundFilterKind::Blur,sigma}},live);
    check(actual.x == -radius && actual.y == -radius);
    check(actual.width == static_cast<size_t>(2+2*radius) && actual.height == static_cast<size_t>(1+2*radius));
    double sum = 0;
    for (int y=-radius;y<=radius;y++) for (int x=-radius;x<=radius;x++)
      sum += std::exp(-(x*x+y*y)/(2*sigma*sigma));
    for (size_t y=0;y<actual.height;y++) for (size_t x=0;x<actual.width;x++) {
      // Independent full two-dimensional transparent-extension convolution.
      double values[4]{};
      for (int source=0;source<2;source++) {
        const int dx = static_cast<int>(x)+actual.x-source, dy = static_cast<int>(y)+actual.y;
        if (std::abs(dx)>radius || std::abs(dy)>radius) continue;
        const double weight = std::exp(-(dx*dx+dy*dy)/(2*sigma*sigma))/sum;
        for (size_t channel=0;channel<4;channel++) values[channel] += input[source*4+channel]*weight;
      }
      for (size_t channel=0;channel<4;channel++) check(std::abs(actual.rgba[(y*actual.width+x)*4+channel]-std::lround(values[channel])) <= 1);
    }
    // A one-pixel foreground edge loses alpha into transparent surroundings, unlike backdrop reflection.
    if (sigma >= .75) check(actual.rgba[((-actual.y)*actual.width+(-actual.x))*4+3] < 128);
  }
  const uint8_t halfRed[] = {128,0,0,128};
  TForegroundFilter shadow{TForegroundFilterKind::DropShadow,0,2,-1,{0,0,1,.5}};
  auto result = filterForeground(halfRed,1,1,{shadow},live);
  check(result.x == 0 && result.y == -1 && result.width == 3 && result.height == 2);
  check(result.rgba[2*4+2] == 64 && result.rgba[2*4+3] == 64);
  check(result.rgba[3*4] == 128 && result.rgba[3*4+3] == 128);
  shadow.offsetX=0; shadow.offsetY=0;
  near(pixel({128,0,0,128},{shadow}), {128,0,32,160});
  shadow.offsetX=.5;
  result = filterForeground(halfRed,1,1,{shadow},live);
  check(result.width == 2 && result.height == 1);
  check(std::abs(result.rgba[2]-16)<=1 && std::abs(result.rgba[3]-144)<=1);
  check(result.rgba[6] == 32 && result.rgba[7] == 32);
  const auto shadowThenInvert = filterForeground(halfRed,1,1,{shadow,{TForegroundFilterKind::Invert,1}},live);
  const auto invertThenShadow = filterForeground(halfRed,1,1,{{TForegroundFilterKind::Invert,1},shadow},live);
  check(shadowThenInvert.rgba != invertThenShadow.rgba);
  for (size_t index=0;index<shadowThenInvert.rgba.size();index+=4)
    for (size_t channel=0;channel<3;channel++) check(shadowThenInvert.rgba[index+channel] <= shadowThenInvert.rgba[index+3]);
  for (double amount : {-1.0,std::numeric_limits<double>::infinity(),std::numeric_limits<double>::quiet_NaN()}) {
    try { filterForeground(halfRed,1,1,{{TForegroundFilterKind::Blur,amount}},live); check(false); }
    catch (const std::invalid_argument &) { check(true); }
  }
  const uint8_t invalid[] = {255,0,0,128};
  try { filterForeground(invalid,1,1,{},live); check(false); }
  catch (const std::invalid_argument &) { check(true); }
  int reads=0;
  try { filterForeground(halfRed,1,1,{{TForegroundFilterKind::Blur,8}},[&] { return ++reads<5; }); check(false); }
  catch (const std::runtime_error &) { check(true); }
  std::cout << assertions << " ordered foreground pixel/bounds/alpha/cancellation assertions passed\n";
}
