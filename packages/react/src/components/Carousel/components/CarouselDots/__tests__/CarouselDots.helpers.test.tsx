import { describe, expect, it } from "vitest"

import styles from "../CarouselDotsStyles.module.css"
import {
  CAROUSEL_DOTS_EDGE_BIAS__LEFT,
  CAROUSEL_DOTS_EDGE_BIAS__RIGHT,
  DOT_VARIANT__ACTIVE,
  DOT_VARIANT__DEFAULT,
  DOT_VARIANT__FAR,
  DOT_VARIANT__HIDDEN,
  DOT_VARIANT__NEAR,
  computeClassNameForItemIndex,
  computeDotStyles,
  computeDotVariantForIndex,
} from "../helpers"

describe("CarouselDots helper tests", () => {
  it("Returns hidden when an item falls outside the current window.", () => {
    expect(
      computeDotVariantForIndex({
        index: 0,
        selectedIndex: 5,
        windowStart: 2,
        visibleCount: 5,
      }),
    ).toBe(DOT_VARIANT__HIDDEN)
  })

  it("Returns active for the selected index.", () => {
    expect(
      computeDotVariantForIndex({
        index: 4,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
      }),
    ).toBe(DOT_VARIANT__ACTIVE)
  })

  it("Returns default for items inside the large zone.", () => {
    expect(
      computeDotVariantForIndex({
        index: 5,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
      }),
    ).toBe(DOT_VARIANT__DEFAULT)
  })

  it("Returns near and far for neighbors outside the large zone.", () => {
    expect(
      computeDotVariantForIndex({
        index: 2,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
      }),
    ).toBe(DOT_VARIANT__NEAR)

    expect(
      computeDotVariantForIndex({
        index: 1,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
      }),
    ).toBe(DOT_VARIANT__FAR)
  })

  it("Borrows the zone correctly when pinned to the left.", () => {
    expect(
      computeDotVariantForIndex({
        index: 2,
        selectedIndex: 1,
        windowStart: 0,
        visibleCount: 7,
        isPinnedLeft: true,
      }),
    ).toBe(DOT_VARIANT__DEFAULT)
  })

  it("Borrows the zone correctly when pinned to the right.", () => {
    expect(
      computeDotVariantForIndex({
        index: 7,
        selectedIndex: 8,
        windowStart: 3,
        visibleCount: 7,
        isPinnedRight: true,
      }),
    ).toBe(DOT_VARIANT__DEFAULT)
  })

  it("Supports edge bias toward the right.", () => {
    expect(
      computeDotVariantForIndex({
        index: 2,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
        edgeBias: CAROUSEL_DOTS_EDGE_BIAS__RIGHT,
      }),
    ).toBe(DOT_VARIANT__DEFAULT)
  })

  it("Supports edge bias toward the left.", () => {
    expect(
      computeDotVariantForIndex({
        index: 6,
        selectedIndex: 4,
        windowStart: 1,
        visibleCount: 7,
        edgeBias: CAROUSEL_DOTS_EDGE_BIAS__LEFT,
      }),
    ).toBe(DOT_VARIANT__DEFAULT)
  })

  it("Maps active and raised styles onto the expected CSS classes.", () => {
    const className = computeDotStyles({
      variant: DOT_VARIANT__ACTIVE,
      raised: true,
    })

    expect(className).toContain(styles.carouselDots__dot)
    expect(className).toContain(styles["carouselDots__dot--active"])
    expect(className).toContain(styles["carouselDots__dot--raised"])
  })

  it("Maps the computed class name for a far dot with raised styling.", () => {
    const className = computeClassNameForItemIndex({
      index: 1,
      selectedIndex: 4,
      raised: true,
      windowStart: 1,
      visibleCount: 7,
    })

    expect(className).toContain(styles.carouselDots__dot)
    expect(className).toContain(styles["carouselDots__dot--far"])
    expect(className).toContain(styles["carouselDots__dot--raised"])
  })
})
