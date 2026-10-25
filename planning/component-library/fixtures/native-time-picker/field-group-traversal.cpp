#include "../../../../packages/react-native/cpp/form/FieldGroupTraversal.h"
#include <iostream>

using namespace codon::form;

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("field-group traversal assertion failed"); ++assertions; };
  const auto rejects = [&](auto operation) {
    try { operation(); } catch (const std::invalid_argument &) { ++assertions; return; }
    throw std::runtime_error("invalid field-group document or originals admitted");
  };
  // Full immutable reading order includes literal/text nodes, authored controls,
  // an independent nested field, retained hidden content and an outside editor.
  const std::vector<TFieldGroupNode> nodes = {
    {1, 0}, {2, 1}, {3, 2}, {10, 3}, {11, 10}, {12, 3}, {13, 3}, {14, 13},
    {20, 2}, {21, 20}, {22, 2}, {30, 2}, {31, 30}, {32, 31}, {33, 31},
    {40, 2, true}, {41, 40}, {50, 1}
  };
  FieldGroupTraversal group(nodes, 2, 3);
  check(group.descendants() == std::vector<int32_t>({3,10,11,12,13,14,20,21,22,30,31,32,33,40,41}));
  check(group.groups(11) == std::vector<int32_t>({3,2}));
  check(group.groups(21) == std::vector<int32_t>({2}));
  check(group.groups(32) == std::vector<int32_t>({2}));
  check(group.groups(2) == std::vector<int32_t>({2}));
  check(group.groups(50).empty());
  check(!group.visible(41));
  check(group.visible(32));
  check(!group.visible(99));
  group.admit({{10, false, 30}, {13, true, 80}, {20, false, 50}, {22, false, 50}, {32, true, 100}, {33, true, 120}});
  check(group.first() == 10);
  check(group.logical(10, 1) == 13);
  check(group.logical(13, 1) == 20);
  check(group.logical(20, 1) == 22);
  check(group.logical(22, 1) == 32);
  check(group.logical(32, 1) == 33);
  check(group.logical(33, 1) == 0);
  check(group.logical(10, -1) == 0);
  check(group.logical(32, -1) == 22);
  check(group.logical(11, 1) == 13);
  check(group.logical(11, -1) == 10);
  check(group.logical(50, 1) == 10);
  check(group.logical(50, -1) == 33);
  check(group.logical(0, 1) == 10);
  check(group.logical(0, -1) == 33);
  // Physical nearest includes authored controls and retains the first reading
  // order tie. Rows at the same x never become their own neighbor.
  check(group.visual(30, 1) == 20);
  check(group.visual(80, -1) == 20);
  check(group.visual(50, 1) == 13);
  check(group.visual(50, -1) == 10);
  check(group.visual(30, -1) == 0);
  check(group.visual(120, 1) == 0);
  check(group.press(2) == 32);
  check(group.press(3) == 32);
  check(group.press(10) == 32);
  check(group.press(11) == 10);
  check(group.press(12) == 10);
  check(group.press(21) == 20);
  check(group.press(33) == 32);
  // A focusable tabindex=-1 target remains in logical focus order, while the
  // source's pointer and physical walkers request tabbable targets only.
  group.admit({{10, false, 30}, {13, true, 80}, {20, false, 50, false}, {22, false, 50}, {32, true, 100}, {33, true, 120}});
  check(group.logical(13, 1) == 20);
  check(group.visual(30, 1) == 22);
  check(group.press(21) == 13);
  group.admit({{10, true, 0}, {13, true, 10}, {20, false, 20}});
  check(group.press(2) == 20);
  check(group.press(20) == 10);
  group.admit({{10, true, 0}, {13, false, 10}, {20, true, 20}});
  check(group.press(2) == 20);
  group.admit({});
  check(group.first() == 0);
  check(group.logical(0, -1) == 0);
  check(group.visual(0, 1) == 0);
  check(group.press(2) == 0);
  rejects([&] { group.press(50); });
  rejects([&] { group.press(99); });
  rejects([&] { group.logical(10, 0); });
  rejects([&] { group.visual(0, 2); });
  rejects([&] { group.visual(std::numeric_limits<double>::quiet_NaN(), 1); });
  rejects([&] { group.admit({{13}, {10}}); });
  rejects([&] { group.admit({{10}, {10}}); });
  rejects([&] { group.admit({{41}}); });
  rejects([&] { group.admit({{50}}); });
  rejects([&] { group.admit({{2}}); });
  rejects([&] { group.admit({{99}}); });
  rejects([&] { group.admit({{10, false, std::numeric_limits<double>::infinity()}}); });
  rejects([&] { FieldGroupTraversal value({}, 2, 3); });
  rejects([&] { FieldGroupTraversal value(nodes, 2, 2); });
  rejects([&] { FieldGroupTraversal value(nodes, 3, 2); });
  rejects([&] { FieldGroupTraversal value(nodes, 2, 50); });
  rejects([&] { FieldGroupTraversal value(nodes, 2, 99); });
  rejects([&] { FieldGroupTraversal value({{1,0},{2,1},{3,2},{2,1}},2,3); });
  rejects([&] { FieldGroupTraversal value({{1,0},{2,1},{3,2},{4,1},{5,2}},2,3); });
  rejects([&] { FieldGroupTraversal value({{1,0},{2,1},{3,99}},2,3); });
  {
    const std::vector<TFieldGroupNode> logical = {{1,0},{2,1},{3,2},{10,3},{11,10},{20,2},{30,2},{50,1},{60,1}};
    const std::vector<TFieldGroupNativePosition> mounted = {
      {1,0,{}},{2,1,{0}},{3,2,{0,0}},{10,3,{0,0,0}},{20,60,{1,0}},{30,2,{0,1}},
      {50,3,{0,0,1}},{60,1,{1}}
    };
    FieldGroupTraversal events(logical, 2, 3);
    const auto physicalNodes = fieldGroupPhysicalNodes(logical, mounted);
    FieldGroupTraversal focus(physicalNodes, 2, 3);
    check(events.groups(20) == std::vector<int32_t>({2}));
    check(events.groups(50).empty());
    check(!focus.descendant(20, 2));
    check(focus.descendant(50, 3));
    check(focus.descendant(11, 10));
    focus.admit({{10,false,0},{50,false,10},{30,false,20}});
    check(focus.logical(20, 1) == 10);
    check(focus.logical(20, -1) == 30);
    check(focus.logical(10, 1) == 50);
    check(focus.logical(50, 1) == 30);
    check(focus.press(11) == 10);
    auto invalid = mounted;
    invalid.push_back(mounted.front());
    rejects([&] { fieldGroupPhysicalNodes(logical, invalid); });
    invalid = mounted; invalid[3].parent = 999;
    rejects([&] { fieldGroupPhysicalNodes(logical, invalid); });
    invalid = mounted; invalid[3].parent = 10;
    rejects([&] { fieldGroupPhysicalNodes(logical, invalid); });
  }
  rejects([&] { FieldGroupTraversal value({{1,0},{2,1},{3,3}},2,3); });
  rejects([&] { FieldGroupTraversal value({{1,0},{2,1},{0,2}},2,3); });
  std::cout << assertions << " actual C++ field-group traversal assertions passed\n";
}
