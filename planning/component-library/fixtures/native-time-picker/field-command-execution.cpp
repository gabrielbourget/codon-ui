#include <future>
#include <iostream>
#include <stdexcept>
#include "../../../../packages/react-native/cpp/FieldInputCommandExecution.h"
using namespace codon;
int main() {
  int checks = 0, calls = 0; bool live = true;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("native execution capability assertion failed"); checks++; };
  FieldInputCommandAction action{1, 2, "focus", [&] { calls++; return FieldInputCommandResult{true, ""}; }, [] {}, [&] { return live; }};
  int64_t old = 0;
  {
    FieldInputCommandExecution scope(action); old = scope.token();
    check(FieldInputCommandExecution::current(old));
    check(!std::async(std::launch::async, [&] { return FieldInputCommandExecution::current(old); }).get());
    {
      FieldInputCommandExecution nested(action);
      check(!FieldInputCommandExecution::current(old) && FieldInputCommandExecution::current(nested.token()));
      check(FieldInputCommandExecution::perform(nested.token()).empty() && calls == 1);
      check(!FieldInputCommandExecution::perform(nested.token()).empty() && calls == 1);
    }
    check(FieldInputCommandExecution::current(old)); live = false;
    check(FieldInputCommandExecution::perform(old) == "field-input-command-execution-expired" && calls == 1);
  }
  check(!FieldInputCommandExecution::current(old));
  check(FieldInputCommandExecution::perform(old) == "field-input-command-execution-retired");
  live = true; action.perform = []() -> FieldInputCommandResult { throw std::logic_error("original failure"); };
  {
    FieldInputCommandExecution scope(action);
    check(FieldInputCommandExecution::perform(scope.token()) == "original failure");
    check(scope.result().error == "original failure");
    check(FieldInputCommandExecution::perform(scope.token()) == "field-input-command-execution-retired");
  }
  std::cout << checks << " actual UI-stack command execution assertions passed; no native/installed verdict\n";
}
