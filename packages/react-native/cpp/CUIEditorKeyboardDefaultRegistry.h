#pragma once
#include "CUIEditorKeyboardDefaultFrames.h"
#include <memory>

namespace codon {
void registerEditorKeyboardDefaults(const std::string &lease, const std::shared_ptr<EditorKeyboardDefaultFrames> &frames);
void unregisterEditorKeyboardDefaults(const std::string &lease);
std::shared_ptr<EditorKeyboardDefaultFrames> editorKeyboardDefaultsForLease(const std::string &lease);
}
