#include "OwnedYogaLayout.h"
#include <yoga/Yoga.h>
#include <cmath>
#include <cstdio>
#include <stdexcept>

using namespace facebook;

static void check(bool accepted, const char *message) {
  if (!accepted) throw std::runtime_error(message);
}
static void near(float actual, float expected, const char *message) {
  check(std::abs(actual - expected) < 0.001f, message);
}

int main() {
  yoga::Config config(nullptr);
  config.setErrata(yoga::Errata::All);
  size_t checks = 0;
  for (const auto direction : {yoga::Direction::LTR, yoga::Direction::RTL}) {
    yoga::Node overlay(&config);
    auto &style = overlay.style();
    style.setPositionType(yoga::PositionType::Absolute);
    for (auto edge : {yoga::Edge::Left, yoga::Edge::Right, yoga::Edge::Top, yoga::Edge::Bottom})
      style.setPosition(edge, yoga::StyleLength::points(0));
    codon::overlay::layoutOwnedOverlayRoot(overlay, config, 1280, 720, direction);
    near(YGNodeLayoutGetWidth(&overlay), 1280, "default overlay must stretch to the actual viewport");
    near(YGNodeLayoutGetHeight(&overlay), 720, "default overlay height must stretch");
    check(overlay.getOwner() == nullptr, "temporary native owner must retire without retaining the original node");
    checks += 3;
    style.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(2000));
    style.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(900));
    overlay.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(overlay, config, 1280, 720, direction);
    near(YGNodeLayoutGetWidth(&overlay), 2000, "viewport owner must not impose an unauthored max-width");
    near(YGNodeLayoutGetHeight(&overlay), 900, "viewport owner must not impose an unauthored max-height");
    checks += 2;
    for (const auto width : {1280.f, 232.f, 212.f}) {
      yoga::Node plane(&config), body(&config);
      auto &planeStyle = plane.style();
      planeStyle.setPositionType(yoga::PositionType::Absolute);
      planeStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(width));
      planeStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(180));
      const float x = width == 1280 ? -40 : width == 232 ? 4 : 14;
      planeStyle.setPosition(yoga::Edge::Start,
          yoga::StyleLength::points(direction == yoga::Direction::RTL ? 240 - x - width : x));
      planeStyle.setPosition(yoga::Edge::Top, yoga::StyleLength::points(4));
      body.style().setPositionType(yoga::PositionType::Absolute);
      body.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::percent(50));
      body.style().setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(80));
      plane.insertChild(&body, 0);
      body.setOwner(&plane);
      codon::overlay::layoutOwnedOverlayRoot(plane, config, 240, 180, direction);
      near(YGNodeLayoutGetLeft(&plane), x, "owned plane must preserve physical offset in both directions");
      near(YGNodeLayoutGetWidth(&body), width / 2, "original body percentage must resolve against its actual owned containing block");
      check(plane.getChild(0) == &body && body.getOwner() == &plane,
          "the original body Yoga node and ownership must survive containing-block layout");
      checks += 3;
      plane.removeChild(&body);
      body.setOwner(nullptr);
    }
    yoga::Node transitionPlane(&config), originalTransitionBody(&config);
    transitionPlane.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(232));
    originalTransitionBody.style().setPositionType(yoga::PositionType::Absolute);
    transitionPlane.insertChild(&originalTransitionBody, 0);
    originalTransitionBody.setOwner(&transitionPlane);
    for (const float containingHeight : {172.f, 252.f}) {
      transitionPlane.style().setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(containingHeight));
      for (const float progress : {0.f, 0.5f, 1.f}) {
        auto &bodyStyle = originalTransitionBody.style();
        bodyStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(
            codon::overlay::resolvePanelTransitionLength(720 * (1 - progress), progress, containingHeight)));
        bodyStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(
            codon::overlay::resolvePanelTransitionLength(300 * (1 - progress), 0.5f * progress, 232)));
        originalTransitionBody.markDirtyAndPropagate();
        codon::overlay::layoutOwnedOverlayRoot(transitionPlane, config, 240, containingHeight + 8, direction);
        const auto expectedHeight = progress == 0 ? 720.f : progress == 1 ? containingHeight
            : containingHeight == 172 ? 446.f : 486.f;
        const auto expectedWidth = progress == 0 ? 300.f : progress == 1 ? 116.f : 208.f;
        near(YGNodeLayoutGetHeight(&originalTransitionBody), expectedHeight, "canonical height transition must retain its live actual containing-block basis");
        near(YGNodeLayoutGetWidth(&originalTransitionBody), expectedWidth, "canonical mixed width must use the actual padding box, not viewport width");
        check(transitionPlane.getChild(0) == &originalTransitionBody && originalTransitionBody.getOwner() == &transitionPlane,
            "transition and parent resizing must retain the original body Yoga node");
        checks += 3;
      }
    }
    originalTransitionBody.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(
        codon::overlay::resolvePanelTransitionLength(40, 0.25f, 232)));
    originalTransitionBody.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(transitionPlane, config, 240, 260, direction);
    near(YGNodeLayoutGetWidth(&originalTransitionBody), 98, "canonical percentage-to-number midpoint must retain both endpoint contributions");
    checks++;
    transitionPlane.removeChild(&originalTransitionBody); originalTransitionBody.setOwner(nullptr);
    yoga::Node block(&config), blockBody(&config), blockInput(&config);
    auto &blockStyle = block.style();
    blockStyle.setPositionType(yoga::PositionType::Absolute);
    blockStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(240));
    blockStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(180));
    blockStyle.setPadding(yoga::Edge::All, yoga::StyleLength::points(10));
    blockStyle.setBorder(yoga::Edge::All, yoga::StyleLength::points(4));
    blockStyle.setFlexDirection(yoga::FlexDirection::Row);
    blockStyle.setJustifyContent(yoga::Justify::FlexEnd);
    blockStyle.setAlignItems(yoga::Align::Center);
    auto &bodyStyle = blockBody.style();
    bodyStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(80));
    bodyStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(60));
    bodyStyle.setFlexBasis(yoga::StyleSizeLength::points(140));
    bodyStyle.setFlexGrow(yoga::FloatOptional{1});
    bodyStyle.setFlexShrink(yoga::FloatOptional{1});
    bodyStyle.setAlignSelf(yoga::Align::Center);
    blockInput.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(80));
    blockInput.style().setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(40));
    blockBody.insertChild(&blockInput, 0); blockInput.setOwner(&blockBody);
    block.insertChild(&blockBody, 0); blockBody.setOwner(&block);
    codon::overlay::layoutOwnedOverlayRoot(block, config, 1280, 720, direction);
    near(YGNodeLayoutGetWidth(&blockBody), 212, "explicit flex container must retain authored body growth");
    near(YGNodeLayoutGetTop(&blockBody), 60, "explicit flex container must retain authored cross alignment");
    checks += 2;
    // These are the default values emitted by the production JS block-container path.
    blockStyle.setFlexDirection(yoga::FlexDirection::Column);
    blockStyle.setJustifyContent(yoga::Justify::FlexStart);
    blockStyle.setAlignItems(yoga::Align::Stretch);
    codon::overlay::applyPanelBlockFlow(bodyStyle);
    blockBody.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(block, config, 1280, 720, direction);
    near(YGNodeLayoutGetWidth(&blockBody), 80, "block flow must ignore authored flex growth and basis");
    near(YGNodeLayoutGetTop(&blockBody), 14, "block flow must ignore flex alignment");
    near(YGNodeLayoutGetHeight(&blockBody), 60, "block flow must preserve authored body height");
    checks += 3;
    blockStyle.setFlexDirection(yoga::FlexDirection::Row);
    bodyStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(300));
    bodyStyle.setFlexShrink(yoga::FloatOptional{});
    codon::overlay::applyPanelFlexFlow(bodyStyle);
    blockBody.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(block, config, 1280, 720, direction);
    near(YGNodeLayoutGetWidth(&blockBody), 212, "explicit flex must use CSS's default shrink factor rather than native zero");
    checks++;
    blockStyle.setFlexDirection(yoga::FlexDirection::Column);
    bodyStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(80));
    codon::overlay::applyPanelBlockFlow(bodyStyle);
    blockStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::ofAuto());
    check(codon::overlay::panelCyclicLength("height", true, false, true, false) == codon::overlay::PanelCyclicLength::Auto,
        "a percentage-bearing height transition behaves as auto even at a zero percentage coefficient");
    bodyStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::ofAuto());
    blockBody.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(block, config, 1280, 720, direction);
    near(YGNodeLayoutGetHeight(&blockBody), 40, "canonical cyclic height must retain its original input intrinsic height");
    near(YGNodeLayoutGetHeight(&block), 68, "canonical auto parent includes the intrinsic body and real border/padding");
    blockStyle.setMinDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(200));
    block.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(block, config, 1280, 720, direction);
    near(YGNodeLayoutGetHeight(&block), 200, "parent min-height must remain independent of the cyclic body height");
    near(YGNodeLayoutGetHeight(&blockBody), 40, "parent min-height must not make an indefinite child percentage definite");
    check(block.getChild(0) == &blockBody && blockBody.getChild(0) == &blockInput,
        "block/flex/cyclic layout must retain original body and input nodes");
    checks += 6;
    block.removeChild(&blockBody); blockBody.setOwner(nullptr);
    blockBody.removeChild(&blockInput); blockInput.setOwner(nullptr);
    yoga::Node flow(&config), contents(&config), originalBody(&config), paint(&config);
    flow.style().setPositionType(yoga::PositionType::Absolute);
    flow.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(240));
    flow.style().setPosition(yoga::Edge::Left, yoga::StyleLength::points(40));
    flow.style().setPosition(yoga::Edge::Top, yoga::StyleLength::points(30));
    flow.style().setPadding(yoga::Edge::All, yoga::StyleLength::points(10));
    flow.style().setBorder(yoga::Edge::All, yoga::StyleLength::points(4));
    contents.style().setDisplay(yoga::Display::Contents);
    originalBody.style().setPositionType(yoga::PositionType::Relative);
    originalBody.style().setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::percent(50));
    originalBody.style().setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(80));
    paint.style().setPositionType(yoga::PositionType::Absolute);
    for (auto edge : {yoga::Edge::Start, yoga::Edge::End, yoga::Edge::Top, yoga::Edge::Bottom})
      paint.style().setPosition(edge, yoga::StyleLength::points(-4));
    contents.insertChild(&originalBody, 0);
    originalBody.setOwner(&contents);
    flow.insertChild(&paint, 0);
    paint.setOwner(&flow);
    flow.insertChild(&contents, 1);
    contents.setOwner(&flow);
    codon::overlay::layoutOwnedOverlayRoot(flow, config, 1280, 720, direction);
    near(YGNodeLayoutGetHeight(&flow), 108, "authored auto overlay height must include original in-flow body and real border/padding");
    near(YGNodeLayoutGetWidth(&originalBody), 106, "contents slot must not change the original body's percentage containing block");
    near(YGNodeLayoutGetWidth(&paint), 240, "owned paint must include the overlay's border box");
    near(YGNodeLayoutGetHeight(&paint), 108, "owned paint must follow intrinsic overlay height");
    near(YGNodeLayoutGetLeft(&paint), 0, "negative border offsets must not shift paint outside its original box");
    near(YGNodeLayoutGetTop(&paint), 0, "paint top must retain the overlay border-box origin");
    checks += 6;
    originalBody.style().setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(120));
    originalBody.markDirtyAndPropagate();
    codon::overlay::layoutOwnedOverlayRoot(flow, config, 1280, 720, direction);
    near(YGNodeLayoutGetHeight(&flow), 148, "original body updates must resize the auto overlay");
    near(YGNodeLayoutGetHeight(&paint), 148, "paint must retain the updated intrinsic height");
    check(contents.getChild(0) == &originalBody && originalBody.getOwner() == &contents,
        "normal flow must preserve the original body node and parent");
    checks += 3;
    flow.removeChild(&paint); paint.setOwner(nullptr);
    flow.removeChild(&contents); contents.setOwner(nullptr);
    contents.removeChild(&originalBody); originalBody.setOwner(nullptr);
  }
  std::printf("%zu original-node owned Yoga checks passed; not an installed Fabric/input/pixel qualification\n", checks);
}
