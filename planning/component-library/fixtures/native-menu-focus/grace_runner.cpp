#include "CUIMenuPointerGrace.h"
#include <iostream>
#include <string>

// Nonshipping runner of the production UIKit state; no SDK input/default result is inferred.
int main() {
  codon::MenuPointerGrace grace;
  double now = 10000;
  int handoffs = 0;
  bool enabled = true;
  codon::MenuPointerRect rectangle{};
  std::string operation;
  while (std::cin >> operation) {
    if (operation == "new") { grace = {}; now = 10000; handoffs = 0; enabled = true; }
    else if (operation == "rect" || operation == "position") {
      std::cin >> rectangle.left >> rectangle.top >> rectangle.right >> rectangle.bottom;
      if (operation == "rect") grace.setSubmenu(rectangle);
    } else if (operation == "modality") {
      int pointer; std::cin >> pointer;
      if (grace.setPointerMode(pointer == 1) && pointer == 1) grace.activateSubmenu(rectangle);
    } else if (operation == "enabled") {
      int value; std::cin >> value; enabled = value == 1;
      if (!enabled) grace.retire(); else grace.activateSubmenu(rectangle);
    } else if (operation == "retire") grace.retire();
    else if (operation == "move") {
      double x, y;
      codon::MenuPointerRect parent{};
      std::cin >> x >> y >> parent.left >> parent.top >> parent.right >> parent.bottom;
      if (enabled) grace.move(x, y, now, parent);
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
