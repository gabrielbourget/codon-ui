#include "ClampHost.h"

#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/components/view/ViewShadowNode.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <limits>
#include <mutex>
#include <stdexcept>
#include <string_view>
#include <unordered_map>

namespace codon::table {
using namespace facebook::react;
namespace {
std::atomic<uint64_t> nextOwner{1};
std::mutex planMutex;
std::unordered_map<uint64_t, std::weak_ptr<CUIClampPlan>> plans;
std::unordered_map<uint64_t, std::shared_ptr<CUIClampPlan>> presentedPlans;
}

void CUIClampPlan::present(Point offset) {
  if (!std::isfinite(offset.x) || !std::isfinite(offset.y)) throw std::runtime_error("Table clamp requires a finite original scroll position");
  const auto clipped = viewport.clipped && offset.x <= 0 && offset.y <= 0;
  for (const auto &participant : participants) {
    auto lastLine = clipped ? viewport.lastLine : std::vector<TClampFragment>{};
    for (auto &fragment : lastLine) {
      fragment.frame.origin.x -= participant.origin.x;
      fragment.frame.origin.y -= participant.origin.y;
      fragment.baseline -= participant.origin.y;
    }
    participant.capture->present({owner,
        {{offset.x - participant.origin.x, offset.y - participant.origin.y}, viewportSize},
        offset, std::move(lastLine), clipped, clipsContents});
  }
}
void CUIClampPlan::retire() noexcept {
  for (const auto &participant : participants) participant.capture->retire(owner);
}

void presentClampPlan(uint64_t owner, Point offset) {
  std::shared_ptr<CUIClampPlan> plan;
  {
    std::lock_guard lock(planMutex);
    const auto entry = plans.find(owner);
    if (entry != plans.end()) plan = entry->second.lock();
    if (!plan) throw std::runtime_error("Table clamp original native layout plan retired");
    presentedPlans[owner] = plan;
  }
  try { plan->present(offset); }
  catch (...) { retireClampPlan(owner); throw; }
}
void retireClampPlan(uint64_t owner) noexcept {
  std::shared_ptr<CUIClampPlan> plan;
  {
    std::lock_guard lock(planMutex);
    const auto entry = presentedPlans.find(owner);
    if (entry == presentedPlans.end()) return;
    plan = std::move(entry->second);
    presentedPlans.erase(entry);
  }
  plan->retire();
}

#ifdef ANDROID
folly::dynamic TClampHostState::getDynamic() const {
  if (!plan) return folly::dynamic::object();
  auto paragraphs = folly::dynamic::array();
  for (const auto &paragraph : plan->paragraphs) {
    paragraphs.push_back(folly::dynamic::object("tag", paragraph.tag)("lines", paragraph.lines)
        ("noWrap", paragraph.noWrap)
        ("props", std::to_string(reinterpret_cast<uintptr_t>(paragraph.props.get())))
        ("state", std::to_string(paragraph.stateIdentity)));
  }
  return folly::dynamic::object("owner", std::to_string(plan->owner))
      ("contentWidth", plan->contentSize.width)("contentHeight", plan->contentSize.height)
      ("viewportHeight", plan->viewportSize.height)("clipped", plan->viewport.clipped)
      ("paragraphs", std::move(paragraphs));
}
#endif

} // namespace codon::table

namespace facebook::react {
using namespace codon::table;
namespace {
bool atomicContent(std::string_view name) {
  return name == "TextInput" || name == "AndroidTextInput" || name == "Image" ||
      name == "ActivityIndicatorView" || name == "AndroidProgressBar" || name == "Switch" ||
      name == "AndroidSwitch" || name == "CUIDateSegment" || name == "AndroidHorizontalScrollView" || name == "ScrollView" ||
      name == "RNSVGSvgView" || name == "RNSVGSvgViewAndroid" || name == "CUIClampHost";
}
bool flowContainer(std::string_view name) {
  return name == "View" || name == "CUIFocusView" || name == "CUIFieldBinding" ||
      name == "CUICollectionRoot" || name == "CUICollectionNode" || name == "CUIFormRoot" ||
      name == "CUIKeyboardScope" || name == "SafeAreaView" || name == "RNCSafeAreaView" ||
      name == "CUIOverlayHost" || name == "CUIOverlaySlot" || name == "CUIOverlayViewport";
}
bool separateWindow(std::string_view name) {
  return name == "PortalView" || name == "ModalHostView" || name == "InputAccessoryView";
}
std::shared_ptr<ShadowNode> prepareContent(const ShadowNode &original, LayoutContext context, bool noWrap) {
  if (hasClampContentSource(original.getFamily())) return prepareClampContent(original, context, noWrap);
  auto clone = original.clone({});
  if (auto paragraph = std::dynamic_pointer_cast<ParagraphShadowNode>(clone)) {
    paragraph->cuiPrepareClampFlow(noWrap);
    return clone;
  }
  const auto name = std::string_view(original.getComponentName());
  if (separateWindow(name) || atomicContent(name)) return clone;
  const auto children = clone->getChildren();
  for (size_t index = 0; index < children.size(); index++)
    clone->replaceChild(*children[index], prepareContent(*children[index], context, noWrap), index);
  return clone;
}
void collectContent(const ShadowNode &node, Point offset, const CUIClampHostProps &props,
    LayoutContext context, CUIClampPlan &plan, std::vector<TClampFragment> &fragments) {
  const auto layout = dynamic_cast<const LayoutableShadowNode *>(&node);
  if (!layout || layout->getLayoutMetrics().displayType == DisplayType::None) return;
  const auto &metrics = layout->getLayoutMetrics();
  offset += metrics.frame.origin;
  const auto name = std::string_view(node.getComponentName());
  if (separateWindow(name)) return;
  if (const auto yoga = dynamic_cast<const YogaLayoutableShadowNode *>(&node)) {
    const auto &style = static_cast<const YogaStylableProps &>(*node.getProps()).yogaStyle;
    if (style.positionType() == yoga::PositionType::Absolute) return;
  }
  if (hasClampContentSource(node.getFamily())) {
    const auto family = node.getFamilyShared();
    auto capture = captureClampContent({family, node.getProps(), node.getState(), context, metrics,
        LayoutConstraints{.minimumSize = metrics.frame.size, .maximumSize = metrics.frame.size, .layoutDirection = metrics.layoutDirection},
        static_cast<uint64_t>(node.getState() ? node.getState()->getRevision() : 0), props.noWrap,
        props.windowId, props.epoch, [weak = std::weak_ptr<ShadowNodeFamily>(family)] {
          if (weak.expired()) throw std::runtime_error("Table clamp original family retired");
        }});
    auto supplied = capture->fragments();
    for (auto &fragment : supplied) {
      if (fragment.tag != node.getTag())
        throw std::runtime_error("Table clamp opaque fragment belongs to another original view");
      fragment.frame.origin += offset;
      fragment.baseline += offset.y;
      fragments.push_back(std::move(fragment));
    }
    plan.participants.push_back({std::move(capture), offset});
    return;
  }
  if (const auto paragraph = dynamic_cast<const ParagraphShadowNode *>(&node)) {
    const auto lines = paragraph->cuiClampFlowLines(context);
    for (size_t index = 0; index < lines.size(); index++) {
      auto frame = lines[index].frame;
      frame.origin += offset + Point{metrics.contentInsets.left, metrics.contentInsets.top};
      fragments.push_back({frame, frame.origin.y + lines[index].ascender, node.getTag(),
          static_cast<int>(index), static_cast<uint64_t>(node.getTag()), ClampFragmentKind::Line});
    }
    plan.paragraphs.push_back({node.getTag(), 0, props.noWrap, node.getProps(), node.getState(),
        reinterpret_cast<uintptr_t>(&paragraph->getStateData())});
    return;
  }
  if (atomicContent(name)) {
    auto baseline = metrics.frame.size.height;
    if (const auto yoga = dynamic_cast<const YogaLayoutableShadowNode *>(&node))
      baseline = yoga->baseline(context, metrics.frame.size);
    fragments.push_back({{offset, metrics.frame.size}, offset.y + baseline, node.getTag(), 0,
        static_cast<uint64_t>(node.getTag()), ClampFragmentKind::Atomic});
    return;
  }
  if (!flowContainer(name)) throw std::runtime_error("Table clamp requires registered opaque native content: " + std::string(name));
  for (const auto &child : node.getChildren()) collectContent(*child, offset, props, context, plan, fragments);
}
}

struct CUIOwnedClampHostShadowNode::TContent {
  std::shared_ptr<ShadowNode> child;
  std::shared_ptr<CUIClampPlan> plan;
};
CUIOwnedClampHostShadowNode::CUIOwnedClampHostShadowNode(const ShadowNodeFragment &fragment,
    const ShadowNodeFamily::Shared &family, ShadowNodeTraits traits)
    : ConcreteViewShadowNode(fragment, family, traits), authoredChildren_(getChildren()) {}
CUIOwnedClampHostShadowNode::CUIOwnedClampHostShadowNode(const ShadowNode &source, const ShadowNodeFragment &fragment)
    : ConcreteViewShadowNode(source, fragment), authoredChildren_(fragment.children ? *fragment.children
        : static_cast<const CUIOwnedClampHostShadowNode &>(source).authoredChildren_) {}
void CUIOwnedClampHostShadowNode::appendChild(const std::shared_ptr<const ShadowNode> &child) {
  authoredChildren_.push_back(child);
  ConcreteViewShadowNode::appendChild(child);
}
ShadowNodeTraits CUIOwnedClampHostShadowNode::BaseTraits() {
  auto traits = ConcreteViewShadowNode::BaseTraits();
  traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
  traits.set(ShadowNodeTraits::Trait::MeasurableYogaNode);
  traits.set(ShadowNodeTraits::Trait::FormsView);
  traits.set(ShadowNodeTraits::Trait::FormsStackingContext);
  return traits;
}
void CUIOwnedClampHostShadowNode::completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) {
  YogaLayoutableShadowNode::completeClone(source, fragment);
  if (fragment.children || fragment.props) dirtyLayout();
}

CUIOwnedClampHostShadowNode::TContent CUIOwnedClampHostShadowNode::resolveContent(
    const LayoutContext &context, const LayoutConstraints &constraints) const {
  const auto &props = getConcreteProps();
  if (props.ownerId.empty() || props.epoch.empty()) throw std::runtime_error("Table clamp requires its original owner epoch");
  if (authoredChildren_.size() != 1) throw std::runtime_error("Table clamp requires one stable original content root");
  const int limit = props.hasClamp && std::isfinite(props.maximumLines) && props.maximumLines > 0 &&
      props.maximumLines <= std::numeric_limits<int>::max() && std::floor(props.maximumLines) == props.maximumLines
      ? static_cast<int>(props.maximumLines) : 0;
  const bool active = limit > 0 || props.noWrap;
  auto child = active ? prepareContent(*authoredChildren_.front(), context, props.noWrap) : authoredChildren_.front()->clone({});
  auto layout = std::dynamic_pointer_cast<LayoutableShadowNode>(child);
  if (!layout) throw std::runtime_error("Table clamp requires its original native layout root");
  auto contentConstraints = constraints;
  contentConstraints.minimumSize.height = 0;
  contentConstraints.maximumSize.height = std::numeric_limits<Float>::infinity();
  layout->layoutTree(context, contentConstraints);
  auto metrics = layout->getLayoutMetrics();
  metrics.frame.origin = {};
  layout->setLayoutMetrics(metrics);
  auto plan = std::make_shared<CUIClampPlan>();
  plan->owner = codon::table::nextOwner.fetch_add(1);
  const auto naturalSize = metrics.frame.size;
  plan->contentSize = {
      std::max(naturalSize.width, naturalSize.width - metrics.overflowInset.right),
      std::max(naturalSize.height, naturalSize.height - metrics.overflowInset.bottom)};
  plan->clipsContents = props.hasClamp;
  std::vector<TClampFragment> fragments;
  if (active) collectContent(*child, {}, props, context, *plan, fragments);
  plan->viewport = resolveClampViewport(fragments, naturalSize.height, limit, context.pointScaleFactor);
  plan->viewportSize = {naturalSize.width, static_cast<Float>(plan->viewport.height)};
  for (auto &paragraph : plan->paragraphs) {
    if (props.noWrap) paragraph.lines = 1;
    if (plan->viewport.clipped) {
      for (const auto &fragment : plan->viewport.lastLine)
        if (fragment.tag == paragraph.tag && fragment.kind == ClampFragmentKind::Line)
          paragraph.lines = fragment.line + 1;
    }
  }
  return {std::move(child), std::move(plan)};
}

Size CUIOwnedClampHostShadowNode::measureContent(const LayoutContext &context, const LayoutConstraints &constraints) const {
  auto measurementContext = context;
  // Provisional native layout nodes die with this measurement; publish only the final retained tree.
  measurementContext.affectedNodes = nullptr;
  return constraints.clamp(resolveContent(measurementContext, constraints).plan->viewportSize);
}
void CUIOwnedClampHostShadowNode::layout(LayoutContext context) {
  const auto metrics = getLayoutMetrics();
  const auto frame = metrics.getContentFrame();
  LayoutConstraints constraints{.minimumSize = {frame.size.width, 0},
      .maximumSize = {frame.size.width, std::numeric_limits<Float>::infinity()},
      .layoutDirection = metrics.layoutDirection};
  auto content = resolveContent(context, constraints);
  content.plan->viewportSize = frame.size;
  auto childLayout = std::dynamic_pointer_cast<LayoutableShadowNode>(content.child);
  auto childMetrics = childLayout->getLayoutMetrics();
  childMetrics.frame.origin = frame.origin;
  childLayout->setLayoutMetrics(childMetrics);
  replaceChild(*getChildren().front(), content.child, 0);
  if (context.affectedNodes) context.affectedNodes->push_back(childLayout.get());
  {
    std::lock_guard lock(codon::table::planMutex);
    for (auto entry = codon::table::plans.begin(); entry != codon::table::plans.end();) {
      if (entry->second.expired()) entry = codon::table::plans.erase(entry);
      else ++entry;
    }
    codon::table::plans[content.plan->owner] = content.plan;
  }
  setStateData(TClampHostState(std::move(content.plan)));
}
} // namespace facebook::react
