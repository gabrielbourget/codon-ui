#pragma once

#include "FieldInputDispatchFrames.h"
#include <react/renderer/uimanager/NativeEventCommands.h>

namespace codon {
// Transfer the SDK-owned original operation into the original native frame's
// mailbox. No alternate command is issued when the frame or executor retires.
inline FieldInputCommandResult requestFieldInputOriginalCommand(FieldInputDispatchFrames &frames,
    const FieldInputDispatchFrames::Handle &ticket,
    const std::shared_ptr<facebook::react::NativeEventCommand> &command,
    std::function<FieldInputCommandResult()> perform) {
  if (!command) return {false, "field-input-original-command-required"};
  if (!perform) {
    command->cancel();
    return {false, "field-input-original-command-executor-required"};
  }
  try {
    auto action = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{
      command->surfaceId, command->target, command->name, std::move(perform), [command] { command->cancel(); }});
    return frames.requestCommand(ticket, std::move(action));
  } catch (...) { command->cancel(); throw; }
}
} // namespace codon
