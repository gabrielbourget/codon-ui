import { resolveNativeTheme } from "../../../theme/defaults"
import {
  getNativeCarouselDotsCalibration,
  getNativeCarouselDotStyle,
  getNativeCarouselDotsViewport,
  getNativeCarouselDotVariant,
  type TNativeCarouselDotVariantInput,
} from "../dotsModel"

const cases: { name: string; input: TNativeCarouselDotVariantInput; variant: string }[] = [
  { name: "outside", input: { index: 0, selectedIndex: 5, windowStart: 2, visibleCount: 5 }, variant: "hidden" },
  { name: "selected", input: { index: 4, selectedIndex: 4, windowStart: 1, visibleCount: 7 }, variant: "active" },
  { name: "large zone", input: { index: 5, selectedIndex: 4, windowStart: 1, visibleCount: 7 }, variant: "default" },
  { name: "near neighbor", input: { index: 2, selectedIndex: 4, windowStart: 1, visibleCount: 7 }, variant: "near" },
  { name: "far neighbor", input: { index: 1, selectedIndex: 4, windowStart: 1, visibleCount: 7 }, variant: "far" },
  {
    name: "borrow left",
    input: { index: 2, selectedIndex: 1, windowStart: 0, visibleCount: 7, isPinnedLeft: true },
    variant: "default",
  },
  {
    name: "borrow right",
    input: { index: 7, selectedIndex: 8, windowStart: 3, visibleCount: 7, isPinnedRight: true },
    variant: "default",
  },
  {
    name: "bias right",
    input: { index: 2, selectedIndex: 4, windowStart: 1, visibleCount: 7, edgeBias: "right" },
    variant: "default",
  },
  {
    name: "bias left",
    input: { index: 6, selectedIndex: 4, windowStart: 1, visibleCount: 7, edgeBias: "left" },
    variant: "default",
  },
]

it.each(cases)("maps canonical $name classification", ({ input, variant }) => {
  const owner = Object.freeze(input)
  expect(getNativeCarouselDotVariant(owner)).toBe(variant)
  expect(owner).toEqual(input)
})

it.each([0, 1, 3, 6, 7, 9, 40])(
  "keeps maxVisible %s within the canonical seven-minimum/item-count limit",
  (maxVisible) => {
    expect(
      getNativeCarouselDotsCalibration({ itemCount: 10, selectedIndex: 0, focusIndex: 0, maxVisible }),
    ).toMatchObject({
      visibleCount: Math.min(10, Math.max(7, maxVisible)),
      initialWindowStart: 0,
      neighbors: 2,
      largeZoneCount: 3,
      minPinned: 1,
    })
  },
)

it.each([0, 1, 2, 6])("retains small/empty itemCount %s without manufacturing seven items", (itemCount) => {
  expect(getNativeCarouselDotsCalibration({ itemCount, selectedIndex: 0, focusIndex: 0 })).toMatchObject({
    visibleCount: itemCount,
    maxStart: 0,
    initialWindowStart: 0,
  })
})

it("uses focus only for interactive auto anchoring, preserving authoritative selection and explicit false", () => {
  const owner = Object.freeze({ itemCount: 20, selectedIndex: 2, focusIndex: 14 })
  expect(getNativeCarouselDotsCalibration(owner)).toMatchObject({ anchorIndex: 14, initialWindowStart: 11 })
  expect(getNativeCarouselDotsCalibration({ ...owner, activationMode: "manual" })).toMatchObject({
    anchorIndex: 2,
    initialWindowStart: 0,
  })
  expect(getNativeCarouselDotsCalibration({ ...owner, interactive: false })).toMatchObject({
    anchorIndex: 2,
    initialWindowStart: 0,
  })
  expect(owner).toEqual({ itemCount: 20, selectedIndex: 2, focusIndex: 14 })
})

it.each(["light", "dark"] as const)("maps all native visual variants and existing raised styles in %s mode", (mode) => {
  const theme = resolveNativeTheme(mode)
  const active = getNativeCarouselDotStyle(theme, "active", true)
  expect(active).toMatchObject({
    width: 8,
    height: 8,
    backgroundColor: theme.colors.controlSelectedBackground,
    opacity: 1,
    transform: [{ scale: 1.15 }],
    shadowRadius: 3,
    shadowOpacity: 0.24,
    elevation: 2,
  })
  expect(getNativeCarouselDotStyle(theme, "default")).toMatchObject({
    backgroundColor: theme.colors.controlBorder,
    transform: [{ scale: 1 }],
    opacity: 1,
  })
  expect(getNativeCarouselDotStyle(theme, "near")).toMatchObject({ transform: [{ scale: 0.8 }], opacity: 1 })
  expect(getNativeCarouselDotStyle(theme, "far")).toMatchObject({ transform: [{ scale: 0.65 }], opacity: 0.9 })
  expect(getNativeCarouselDotStyle(theme, "hidden")).toMatchObject({ transform: [{ scale: 0.4 }], opacity: 0 })
  expect(getNativeCarouselDotStyle(theme, "sentinel")).toMatchObject({
    width: 6,
    height: 6,
    opacity: 0.4,
    backgroundColor: "#ffffff",
  })
  expect(getNativeCarouselDotStyle(theme, "default").elevation).toBeUndefined()
})

it("uses current provider roles and canonical far/raised composition without mutating the theme", () => {
  const theme = resolveNativeTheme("dark", { colors: { controlSelectedBackground: "orange", controlBorder: "purple" } })
  expect(getNativeCarouselDotStyle(theme, "active").backgroundColor).toBe("orange")
  expect(getNativeCarouselDotStyle(theme, "far", true)).toMatchObject({
    backgroundColor: "purple",
    transform: [{ scale: 0.65 }],
    shadowRadius: 3,
  })
  expect(theme.colors.controlBorder).toBe("purple")
})

it("retains default/zero spacing and viewport clamping independently of an interactive target", () => {
  expect(getNativeCarouselDotsViewport(7, 2, 5)).toEqual({ width: 86, translateX: -26, paddingVertical: 5 })
  expect(getNativeCarouselDotsViewport(7, 2, 0)).toEqual({ width: 56, translateX: -16, paddingVertical: 0 })
  expect(getNativeCarouselDotsViewport(0, 0, 5)).toEqual({ width: 0, translateX: -0, paddingVertical: 5 })
})
