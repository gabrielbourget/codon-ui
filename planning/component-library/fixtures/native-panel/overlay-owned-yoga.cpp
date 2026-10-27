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
