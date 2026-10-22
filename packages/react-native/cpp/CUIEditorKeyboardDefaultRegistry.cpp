#include "CUIEditorKeyboardDefaultRegistry.h"
#include <unordered_map>

namespace codon {
namespace {
std::mutex registryMutex;
std::unordered_map<std::string, std::weak_ptr<EditorKeyboardDefaultFrames>> registry;
}
void registerEditorKeyboardDefaults(const std::string &lease, const std::shared_ptr<EditorKeyboardDefaultFrames> &frames) {
  std::lock_guard lock(registryMutex);
  registry[lease] = frames;
}
void unregisterEditorKeyboardDefaults(const std::string &lease) {
  std::lock_guard lock(registryMutex);
  registry.erase(lease);
}
std::shared_ptr<EditorKeyboardDefaultFrames> editorKeyboardDefaultsForLease(const std::string &lease) {
  std::lock_guard lock(registryMutex);
  const auto found = registry.find(lease);
  return found == registry.end() ? nullptr : found->second.lock();
}
}
