#pragma once

#include "../motion/NativeABI.h"
#include <react/renderer/components/view/BaseViewProps.h>
#include <react/renderer/core/ShadowNode.h>
#include <array>
#include <optional>

namespace codon::table {

struct TStickyAuthoredStyle {
  folly::dynamic fields;
  facebook::react::Transform transform;
};

const facebook::react::BaseViewProps &nativeStickyViewProps(
    const facebook::react::ShadowNode &node, const facebook::react::Props::Shared &props);
TStickyAuthoredStyle captureNativeStickyStyle(const facebook::react::BaseViewProps &props);
facebook::react::Props::Shared cloneNativeStickyStyle(
    const facebook::react::ShadowNode &node, const facebook::react::Props::Shared &source,
    const folly::dynamic &fields, const facebook::react::Transform &transform);
folly::dynamic nativeStickyPresentationFields(const facebook::react::BaseViewProps &props,
    const folly::dynamic &fallback, const facebook::react::LayoutMetrics &metrics, double x, double y);
facebook::react::Transform nativeStickyTransform(
    const facebook::react::Transform &authored, double x, double y);
std::array<std::optional<double>, 4> nativeStickyInsets(
    const facebook::react::BaseViewProps &props, const folly::dynamic &fallback,
    bool rightToLeft, bool swapLeftAndRight, double viewportWidth, double viewportHeight);

} // namespace codon::table
