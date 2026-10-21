#include "CUIMenuPointerGrace.h"
#include <iostream>
#include <string>

// Nonshipping runner of the production UIKit state; no SDK input/default result is inferred.
int main() {
  codon::MenuPointerGrace grace;
  double now = 10000;
  int handoffs = 0;
  std::string operation;
  while (std::cin >> operation) {
    if (operation == "new") { grace = {}; now = 10000; handoffs = 0; }
    else if (operation == "rect") {
      codon::MenuPointerRect rectangle{};
      std::cin >> rectangle.left >> rectangle.top >> rectangle.right >> rectangle.bottom;
      grace.setSubmenu(rectangle);
    } else if (operation == "retire") grace.retire();
    else if (operation == "move") {
      double x, y;
      codon::MenuPointerRect rectangle{};
      std::cin >> x >> y >> rectangle.left >> rectangle.top >> rectangle.right >> rectangle.bottom;
      grace.move(x, y, now, rectangle);
    } else if (operation == "wait") {
      double delta;
      std::cin >> delta;
      double until = now + delta;
      while (grace.deadline() >= 0 && grace.deadline() <= until) {
        now = grace.deadline(); if (grace.expire(now)) handoffs++;
      }
      now = until;
    } else if (operation == "read") std::cout << grace.suppressed() << " " << handoffs << '\n';
    else return 1;
  }
}
