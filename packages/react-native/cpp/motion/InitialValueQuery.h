#pragma once

#include "NativeABI.h"
#include <react/renderer/components/view/ViewProps.h>
#include <react/renderer/core/LayoutMetrics.h>
#include <react/renderer/uimanager/UIManager.h>
#include <folly/dynamic.h>
#include <functional>
#include <string>

namespace codon::motion {

using TNativeInitialColorReader = std::function<folly::dynamic(facebook::react::SharedColor)>;

// Platform facades call on their UI thread under the actual owner's current
// color trait environment, and validate the original ref/window lease again.
std::string queryNativeInitialValue(
    const facebook::react::UIManager &manager, int target,
    const std::string &owner, const std::string &binding,
    const std::string &nativeViewRevision, const std::string &name,
    const TNativeInitialColorReader &readColor = {});

// Separately exposed for focused immutable-props tests; never performs layout.
folly::dynamic readNativeInitialViewValue(
    const facebook::react::ViewProps &props,
    const facebook::react::LayoutMetrics &metrics, const std::string &name,
    const TNativeInitialColorReader &readColor = {});

} // namespace codon::motion
