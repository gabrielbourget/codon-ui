#include "../../../../packages/react-native/cpp/form/FieldSemanticIds.h"
#include <iostream>

using codon::form::FieldSemanticIds;

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("semantic ID assertion failed"); assertions++; };
  const auto rejects = [&](auto operation) {
    try { operation(); } catch (const std::invalid_argument &) { assertions++; return; }
    throw std::runtime_error("ambiguous/foreign semantic ID was admitted");
  };
  FieldSemanticIds current({{1, "caller-input"}, {2, "label"}, {3, "duplicate"}, {4, "duplicate"}});
  current.addAlias("generated-input", 1);
  current.addAlias("generated-label", 2);
  check(current.resolve("caller-input") == 1);
  check(current.resolve("generated-input") == 1);
  check(current.resolve("generated-label") == 2);
  current.addAlias("generated-input", 1);
  check(current.resolve("generated-input") == 1);
  rejects([&] { current.resolve("duplicate"); });
  current.addAlias("caller-input", 2);
  rejects([&] { current.resolve("caller-input"); });
  rejects([&] { current.resolve(""); });
  rejects([&] { current.resolve("missing"); });
  rejects([&] { current.addAlias("foreign", 99); });
  rejects([&] { current.addAlias("", 1); });
  FieldSemanticIds replacement({{1, "replacement-input"}, {2, "label"}});
  rejects([&] { replacement.resolve("generated-input"); });
  check(replacement.resolve("replacement-input") == 1);
  FieldSemanticIds anotherDocument({{11, "label"}});
  check(anotherDocument.resolve("label") == 11);
  rejects([&] { anotherDocument.addAlias("foreign-root", 2); });
  rejects([&] { FieldSemanticIds invalid({{1, "first"}, {1, "second"}}); });
  std::cout << assertions << " actual C++ semantic ID assertions passed\n";
}
