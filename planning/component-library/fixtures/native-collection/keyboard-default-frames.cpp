#include "../../../../packages/react-native/cpp/CUIEditorKeyboardDefaultRegistry.h"
#include <cassert>
#include <iostream>
using namespace codon;
int main() {
  EditorKeyboardDefaultFrames frames;
  EditorKeyIdentity id{"owner", "field", "revision", 17, "window", 1};
  auto outer = frames.begin(id, 1, "down"); assert(outer);
  auto foreign = id; foreign.windowId = "foreign";
  assert(!frames.acknowledge(foreign, 1, "down", true, true));
  assert(!frames.acknowledge(id, 1, "up", true, true));
  auto inner = frames.begin(id, 2, "down"); assert(inner);
  assert(!frames.acknowledge(id, 1, "down", true, true));
  assert(frames.acknowledge(id, 2, "down", true, false));
  assert(!frames.acknowledge(id, 2, "down", true, true));
  assert(frames.end(outer, true) == EditorKeyDisposition::Retired);
  assert(frames.end(inner, true) == EditorKeyDisposition::Allowed);
  assert(frames.acknowledge(id, 1, "down", true, true));
  assert(frames.end(outer, true) == EditorKeyDisposition::Prevented);
  assert(!frames.acknowledge(id, 1, "down", true, true));
  auto missing = frames.begin(id, 3, "up");
  assert(frames.end(missing, true) == EditorKeyDisposition::Unacknowledged);
  auto cancel = frames.begin(id, 4, "cancel");
  assert(frames.acknowledge(id, 4, "cancel", true, true));
  assert(frames.end(cancel, true) == EditorKeyDisposition::Allowed);
  auto replaced = frames.begin(id, 5, "down");
  assert(frames.acknowledge(id, 5, "down", true, true));
  assert(frames.end(replaced, false) == EditorKeyDisposition::Retired);
  auto retired = frames.begin(id, 6, "down"); frames.retire();
  assert(frames.end(retired, true) == EditorKeyDisposition::Retired);
  auto invalid = id; invalid.target = 0; assert(frames.begin(invalid, 7, "down") == 0);
  auto first = std::make_shared<EditorKeyboardDefaultFrames>();
  auto second = std::make_shared<EditorKeyboardDefaultFrames>();
  registerEditorKeyboardDefaults("first", first); registerEditorKeyboardDefaults("second", second);
  auto owned = first->begin(id, 8, "down");
  assert(editorKeyboardDefaultsForLease("first") == first);
  assert(!editorKeyboardDefaultsForLease("second")->acknowledge(id, 8, "down", true, true));
  unregisterEditorKeyboardDefaults("first"); first->retire();
  assert(!editorKeyboardDefaultsForLease("first"));
  assert(first->end(owned, false) == EditorKeyDisposition::Retired);
  unregisterEditorKeyboardDefaults("second");
  std::cout << "editor-key-frame-models: pass; SDK dispatch/default verdicts: none\n";
}
