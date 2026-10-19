#include "CUIFloatingScrollAnchorModel.h"
#include <iomanip>
#include <iostream>

int main() {
  double a, b, c, d, e, f, g, h, current, minimum, maximum;
  std::cout << std::setprecision(17);
  while (std::cin >> a >> b >> c >> d >> e >> f >> g >> h >> current >> minimum >> maximum) {
    auto anchor = cui::captureScrollAnchor(a, b, c, d);
    auto next = anchor ? cui::restoreScrollAnchor(*anchor, e, f, g, h, current, minimum, maximum) : std::nullopt;
    if (!next) return 2;
    std::cout << *next << '\n';
  }
  if (cui::captureScrollAnchor(0, -1, 0, 100) || cui::captureScrollAnchor(0, 1, NAN, 100)) return 3;
  return 0;
}
