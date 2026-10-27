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
  }
  std::printf("%zu original-node owned Yoga checks passed; not an installed Fabric/input/pixel qualification\n", checks);
}
