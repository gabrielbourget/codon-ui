#include "../../../../packages/react-native/cpp/table/StickyConstraints.h"
#include <iostream>
#include <limits>

using codon::table::TStickyAxis;
using codon::table::nativeStickyAxisOffset;
int checks = 0;
const auto equal = [](double actual, double expected) {
  checks++;
  if (std::abs(actual - expected) > 0.000001) throw std::runtime_error("sticky constraint mismatch");
};

int main() {
  try {
  // W3C's300px/100px scrollport,200px box and20px top inset examples.
  equal(nativeStickyAxisOffset({-50, 200, -100, 1000, 0, 300, 0, 0, 20, std::nullopt}), 70);
  equal(nativeStickyAxisOffset({-50, 200, -100, 1000, 0, 100, 0, 0, 20, std::nullopt}), 70);
  // Ordinary Table header remains in flow, sticks, then releases at the Table's end.
  equal(nativeStickyAxisOffset({50, 40, 50, 1000, 0, 200, 0, 0, 0, std::nullopt}), 0);
  equal(nativeStickyAxisOffset({-150, 40, -150, 1000, 0, 200, 0, 0, 0, std::nullopt}), 150);
  equal(nativeStickyAxisOffset({-980, 40, -980, 1000, 0, 200, 0, 0, 0, std::nullopt}), 960);
  equal(nativeStickyAxisOffset({-1050, 40, -1050, 1000, 0, 200, 0, 0, 0, std::nullopt}), 960);
  // Auto insets impose no sticky adjustment; top-only never moves upwards.
  equal(nativeStickyAxisOffset({250, 40, 0, 1000, 0, 200, 0, 0, std::nullopt, std::nullopt}), 0);
  equal(nativeStickyAxisOffset({250, 40, 0, 1000, 0, 200, 0, 0, 0, std::nullopt}), 0);
  equal(nativeStickyAxisOffset({250, 40, 0, 1000, 0, 200, 0, 0, std::nullopt, 0}), -90);
  // Both explicit edges, negative inset, nonzero native scrollport origin and subpixels.
  equal(nativeStickyAxisOffset({-20, 40, -100, 1000, 0, 200, 0, 0, 12, 16}), 32);
  equal(nativeStickyAxisOffset({-20, 40, -100, 1000, 0, 200, 0, 0, -12, std::nullopt}), 8);
  equal(nativeStickyAxisOffset({2.25, 40, -100, 1000, 10.5, 200, 0, 0, 0.25, std::nullopt}), 8.5);
  // RTL reduces the physical left inset when an inline box exceeds its viewport.
  equal(nativeStickyAxisOffset({40, 200, -1000, 2000, 0, 100, 0, 0, std::nullopt, 20, true}), -160);
  // A position box preserves its applicable ending margin at containing-block release.
  equal(nativeStickyAxisOffset({-50, 40, -200, 240, 0, 200, 0, 10, 0, std::nullopt}), 40);
  // One axis is translationally invariant and always retains a top-only nonnegative shift.
  for (int index = 0; index < 100; index++) {
    const double translation = index * 0.25 - 10;
    equal(nativeStickyAxisOffset({-150 + translation, 40, -150 + translation, 1000,
        translation, 200, 0, 0, 0, std::nullopt}), 150);
  }
  bool rejected = false;
  try { nativeStickyAxisOffset({0, 40, 0, 1000, 0, std::numeric_limits<double>::quiet_NaN(), 0, 0, 0, std::nullopt}); }
  catch (const std::invalid_argument &) { rejected = true; }
  if (!rejected) throw std::runtime_error("nonfinite geometry was admitted");
  checks++;
  std::cout << "PASS " << checks << " source/model sticky constraints; no native layout/scroll claim\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
