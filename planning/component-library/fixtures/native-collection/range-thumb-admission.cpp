#include <cmath>
#include <cstdint>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <variant>
#include <vector>

// Input declarations only. The checked admission and ancestry functions are
// extracted unchanged from production; this does not compile a native backend.
namespace folly {
struct dynamic {
  using Object = std::map<std::string, dynamic>;
  std::variant<std::monostate, Object, double, std::string, bool> value;
  dynamic() = default;
  dynamic(Object object) : value(std::move(object)) {}
  dynamic(double number) : value(number) {}
  dynamic(const char *text) : value(std::string(text)) {}
  explicit dynamic(bool flag) : value(flag) {}
  bool isObject() const { return std::holds_alternative<Object>(value); }
  bool isNumber() const { return std::holds_alternative<double>(value); }
  size_t size() const { return std::get<Object>(value).size(); }
  const dynamic &at(const char *key) const { return std::get<Object>(value).at(key); }
  double asDouble() const { return std::get<double>(value); }
  bool operator!=(const char *text) const {
    return !std::holds_alternative<std::string>(value) || std::get<std::string>(value) != text;
  }
};
static dynamic decodedBinding;
static dynamic parseJson(const std::string &) { return decodedBinding; }
}
using Tag = int32_t;
enum class Role { None, Slider, Button };
struct CUIFocusViewProps {
  bool accessible = true;
  Role role = Role::None;
  std::string accessibilityRole = "adjustable";
};
struct CUIFieldBindingProps {
  std::string ownedControlBinding = "fixture", ownedEditorBinding, semanticBinding;
  Tag editorTarget = 6;
};
struct Node {
  std::string name;
  std::shared_ptr<CUIFocusViewProps> props = std::make_shared<CUIFocusViewProps>();
  const char *getComponentName() const { return name.c_str(); }
  std::shared_ptr<CUIFocusViewProps> getProps() const { return props; }
};
struct TFabricFormDocument {
  struct Entry { std::shared_ptr<Node> node; std::optional<size_t> parent; };
  std::vector<Entry> preorder;
  std::unordered_map<Tag, size_t> positions;
};
#include "range-thumb-production.inc"

static TFabricFormDocument document() {
  TFabricFormDocument result;
  for (const auto &[tag, name, parent] : std::vector<std::tuple<Tag, std::string, std::optional<size_t>>>{
      {1, "RootView", {}}, {4, "View", 0}, {6, "CUIFocusView", 1}, {5, "CUIFieldBinding", 2}, {9, "View", 0}}) {
    result.positions[tag] = result.preorder.size();
    result.preorder.push_back({std::make_shared<Node>(Node{name}), parent});
  }
  return result;
}
static void expect(bool condition) { if (!condition) throw std::runtime_error("range admission assertion failed"); }
int main() {
  int passed = 0;
  for (const std::string mode : {"valid", "role slider", "root focus host", "duplicate original", "mixed editor", "editor semantics", "unknown kind", "extra key", "boolean root", "fractional root", "foreign root", "self root", "root editor", "core view", "wrong role", "role precedence", "inaccessible", "sibling metadata", "self metadata", "missing original"}) {
    auto tree = document();
    CUIFieldBindingProps field;
    Tag metadata = 5;
    folly::dynamic::Object binding{{"kind", "range-thumb"}, {"rootTarget", 4.0}};
    auto &props = *tree.preorder[2].node->props;
    std::unordered_set<Tag> used;
    if (mode == "role slider") { props.role = Role::Slider; props.accessibilityRole = "button"; }
    if (mode == "root focus host") tree.preorder[1].node->name = "CUIFocusView";
    if (mode == "duplicate original") used.insert(6);
    if (mode == "mixed editor") field.ownedEditorBinding = "date-binding";
    if (mode == "editor semantics") field.semanticBinding = "editor-semantics";
    if (mode == "unknown kind") binding["kind"] = "checkbox";
    if (mode == "extra key") binding["value"] = "business-data";
    if (mode == "boolean root") binding["rootTarget"] = folly::dynamic(true);
    if (mode == "fractional root") binding["rootTarget"] = 4.5;
    if (mode == "foreign root") binding["rootTarget"] = 9.0;
    if (mode == "self root") binding["rootTarget"] = 6.0;
    if (mode == "root editor") tree.preorder[1].node->name = "TextInput";
    if (mode == "core view") tree.preorder[2].node->name = "View";
    if (mode == "wrong role") props.accessibilityRole = "button";
    if (mode == "role precedence") props.role = Role::Button;
    if (mode == "inaccessible") props.accessible = false;
    if (mode == "sibling metadata") tree.preorder[3].parent = 1;
    if (mode == "self metadata") metadata = 6;
    if (mode == "missing original") field.editorTarget = 99;
    folly::decodedBinding = folly::dynamic(binding);
    bool admitted = false;
    try { validateOwnedRangeThumb(tree, field, metadata, used); admitted = true; }
    catch (const std::exception &) {}
    const bool expected = mode == "valid" || mode == "role slider" || mode == "root focus host";
    expect(admitted == expected);
    if (admitted) expect(used.contains(6));
    passed++;
  }
  std::cout << passed << " extracted production C++ admission cases passed\n";
}
