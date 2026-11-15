import { getNativeFloatingPlacement, intersectNativeFloatingRects, type TNativeFloatingPlacement } from "../placement"

const base = {
  host: { x: 0, y: 0, width: 300, height: 300 },
  anchor: { x: 100, y: 100, width: 40, height: 20 },
  content: { width: 60, height: 40 },
}
const placements: [TNativeFloatingPlacement, [number, number], [number, number]][] = [
  ["bottom", [90, 128], [90, 128]],
  ["bottom left", [100, 128], [100, 128]],
  ["bottom right", [80, 128], [80, 128]],
  ["bottom start", [100, 128], [80, 128]],
  ["bottom end", [80, 128], [100, 128]],
  ["top", [90, 52], [90, 52]],
  ["top left", [100, 52], [100, 52]],
  ["top right", [80, 52], [80, 52]],
  ["top start", [100, 52], [80, 52]],
  ["top end", [80, 52], [100, 52]],
  ["left", [32, 90], [32, 90]],
  ["left top", [32, 100], [32, 100]],
  ["left bottom", [32, 80], [32, 80]],
  ["start", [32, 90], [148, 90]],
  ["start top", [32, 100], [148, 100]],
  ["start bottom", [32, 80], [148, 80]],
  ["right", [148, 90], [148, 90]],
  ["right top", [148, 100], [148, 100]],
  ["right bottom", [148, 80], [148, 80]],
  ["end", [148, 90], [32, 90]],
  ["end top", [148, 100], [32, 100]],
  ["end bottom", [148, 80], [32, 80]],
]
it.each(placements)("places %s against concrete LTR/RTL native frames", (placement, ltr, rtl) => {
  for (const [direction, expected] of [
    ["ltr", ltr],
    ["rtl", rtl],
  ] as const) {
    const result = getNativeFloatingPlacement({ ...base, placement, direction })!
    expect([result.frame.x, result.frame.y]).toEqual(expected)
    expect(result.frame).toMatchObject({ width: 60, height: 40 })
    expect(result.didFlip).toBe(false)
  }
})
it("flips to available space and preserves explicit false by constraining the original side", () => {
  const input = { ...base, anchor: { ...base.anchor, y: 240 } }
  expect(getNativeFloatingPlacement(input)).toMatchObject({
    placement: "top",
    didFlip: true,
    frame: { y: 192, height: 40 },
  })
  expect(getNativeFloatingPlacement({ ...input, shouldFlip: false })).toMatchObject({
    placement: "bottom",
    didFlip: false,
    frame: { y: 268, height: 20 },
    maxHeight: 20,
  })
})
it("keeps explicit zero dimensions, gap, cross offset and max height", () => {
  const result = getNativeFloatingPlacement({
    ...base,
    content: { width: 0, height: 0 },
    offset: 0,
    crossOffset: 0,
    containerPadding: 0,
    maxHeight: 0,
  })!
  expect(result.frame).toEqual({ x: 120, y: 120, width: 0, height: 0 })
  expect(result.maxHeight).toBe(0)
})
it("translates measured window frames into a nonzero host origin", () => {
  expect(getNativeFloatingPlacement({ ...base, host: { x: 50, y: 50, width: 300, height: 300 } })).toMatchObject({
    frame: { x: 90, y: 128 },
    hostFrame: { x: 40, y: 78 },
  })
})
it("intersects explicit native visible boundaries and uses the resized keyboard viewport", () => {
  const visibleBoundary = { x: 0, y: 0, width: 300, height: 160 }
  const result = getNativeFloatingPlacement({ ...base, visibleBoundary })!
  expect(result).toMatchObject({ placement: "top", didFlip: true, frame: { y: 52, height: 40 } })
  expect(intersectNativeFloatingRects(base.host, { x: 25, y: 30, width: 500, height: 100 })).toEqual({
    x: 25,
    y: 30,
    width: 275,
    height: 100,
  })
  expect(intersectNativeFloatingRects(base.host, { x: 400, y: 400, width: 10, height: 10 })).toEqual({
    x: 400,
    y: 400,
    width: 0,
    height: 0,
  })
})
it("keeps the surface inside a keyboard viewport when its trigger is below that viewport", () => {
  const input = {
    host: { x: 0, y: 0, width: 411, height: 914 },
    anchor: { x: 26, y: 816, width: 359, height: 48 },
    content: { width: 240, height: 424 },
    margins: { bottom: 8 },
  }
  const keyboardHidden = getNativeFloatingPlacement({
    ...input,
    visibleBoundary: { x: 0, y: 44, width: 411, height: 846 },
  })!
  expect(keyboardHidden).toMatchObject({
    placement: "top",
    didFlip: true,
    frame: { x: 85.5, y: 376, width: 240, height: 432 },
  })
  const keyboardVisible = getNativeFloatingPlacement({
    ...input,
    visibleBoundary: { x: 0, y: 44, width: 411, height: 536 },
  })!
  expect(keyboardVisible.placement).toBe("top")
  expect(keyboardVisible.didFlip).toBe(true)
  expect(keyboardVisible.frame.height).toBe(432)
  expect(keyboardVisible.frame.y).toBeGreaterThanOrEqual(56)
  expect(keyboardVisible.frame.y + keyboardVisible.frame.height).toBeLessThanOrEqual(568)
})
it("keeps a bottom surface inside the viewport when its trigger is above the visible boundary", () => {
  const result = getNativeFloatingPlacement({
    ...base,
    anchor: { ...base.anchor, y: 0 },
    visibleBoundary: { x: 0, y: 100, width: 300, height: 200 },
    offset: 13,
    margins: { top: 7, bottom: 5 },
  })!
  expect(result).toMatchObject({ placement: "bottom", didFlip: false, frame: { width: 60, height: 52 } })
  expect(result.frame.y).toBeGreaterThanOrEqual(112)
  expect(result.frame.y + result.frame.height).toBeLessThanOrEqual(288)
})
it("bounds tall keyboard surfaces while preserving authored max height and disabled flipping", () => {
  const input = {
    host: { x: 20, y: 30, width: 300, height: 700 },
    anchor: { x: 120, y: 600, width: 40, height: 30 },
    visibleBoundary: { x: 20, y: 60, width: 300, height: 300 },
    content: { width: 120, height: 700 },
    placement: "top" as const,
    shouldFlip: false,
    containerPadding: 10,
    offset: 17,
    margins: { top: 3, bottom: 7 },
    maxHeight: 90,
  }
  const authoredHeight = getNativeFloatingPlacement(input)!
  expect(authoredHeight).toMatchObject({ placement: "top", didFlip: false, maxHeight: 90, frame: { height: 90 } })
  expect(authoredHeight.frame.y).toBeGreaterThanOrEqual(70)
  expect(authoredHeight.frame.y + authoredHeight.frame.height).toBeLessThanOrEqual(350)
  const availableHeight = getNativeFloatingPlacement({ ...input, maxHeight: undefined })!
  expect(availableHeight.frame.y).toBeGreaterThanOrEqual(70)
  expect(availableHeight.frame.y + availableHeight.frame.height).toBeLessThanOrEqual(350)
  expect(getNativeFloatingPlacement({ ...input, anchor: { ...input.anchor, y: 250 } })).toMatchObject({
    placement: "top",
    didFlip: false,
    maxHeight: 90,
    frame: { y: 143, height: 90 },
    positionStyle: { bottom: 497 },
  })
  expect(input.anchor.y).toBe(600)
  expect(input.content.height).toBe(700)
})
it("shifts cross-axis overflow, clamps the arrow and retains measured width", () => {
  const result = getNativeFloatingPlacement({
    ...base,
    anchor: { ...base.anchor, x: 0 },
    arrowSize: 10,
    arrowBoundaryOffset: 6,
  })!
  expect(result.frame.x).toBe(12)
  expect(result.arrowCrossOffset).toBe(6)
  expect(result.arrowSide).toBe("top")
  expect(getNativeFloatingPlacement({ ...base, content: { width: 400, height: 40 } })?.frame).toMatchObject({
    x: 12,
    width: 400,
  })
})
it("applies signed cross offset and a finite maxHeight without altering caller frames", () => {
  const input = Object.freeze({
    ...base,
    anchor: Object.freeze({ ...base.anchor }),
    content: Object.freeze({ ...base.content }),
    crossOffset: -5,
    maxHeight: 25,
  })
  expect(getNativeFloatingPlacement(input)?.frame).toEqual({ x: 85, y: 128, width: 60, height: 25 })
  expect(input.content.height).toBe(40)
  expect(input.anchor).toEqual(base.anchor)
})
it.each([NaN, Infinity, -Infinity])("rejects invalid native measurement %s before any drawing is admitted", (value) => {
  expect(getNativeFloatingPlacement({ ...base, anchor: { ...base.anchor, x: value } })).toBeNull()
  expect(getNativeFloatingPlacement({ ...base, content: { width: 60, height: value } })).toBeNull()
})
it.each([{ offset: NaN }, { containerPadding: -1 }, { maxHeight: Infinity }, { arrowSize: -1 }])(
  "rejects invalid authored geometry constraints %j",
  (props) => {
    expect(() => getNativeFloatingPlacement({ ...base, ...props })).toThrow(/finite/)
  },
)

it("does not admit overflowing finite native frame arithmetic", () => {
  expect(getNativeFloatingPlacement({ ...base, anchor: { x: 1e308, y: 0, width: 1e308, height: 10 } })).toBeNull()
  expect(
    getNativeFloatingPlacement({ ...base, host: { x: 1e308, y: 0, width: 0, height: 300 }, containerPadding: 1e308 }),
  ).toBeNull()
})

it("floors positioned main-axis edges in the host coordinate system", () => {
  const input = {
    ...base,
    anchor: { x: 100.25, y: 100.75, width: 40.5, height: 20.5 },
    content: { width: 60.5, height: 40.5 },
  }
  expect(getNativeFloatingPlacement({ ...input, placement: "bottom" })?.frame).toEqual({
    x: 90.25,
    y: 129,
    width: 60.5,
    height: 40.5,
  })
  expect(getNativeFloatingPlacement({ ...input, placement: "top" })?.frame).toEqual({
    x: 90.25,
    y: 52.5,
    width: 60.5,
    height: 40.5,
  })
  expect(getNativeFloatingPlacement({ ...input, placement: "right" })?.frame.x).toBe(148)
  expect(getNativeFloatingPlacement({ ...input, placement: "left" })?.frame.x).toBe(32.5)
})
it("keeps large cross offsets attached to the trigger before boundary adjustment", () => {
  expect(
    getNativeFloatingPlacement({ ...base, crossOffset: 100, arrowSize: 10, arrowBoundaryOffset: 6 })?.frame.x,
  ).toBe(124)
  expect(
    getNativeFloatingPlacement({ ...base, crossOffset: -100, arrowSize: 10, arrowBoundaryOffset: 6 })?.frame.x,
  ).toBe(56)
  expect(
    getNativeFloatingPlacement({ ...base, placement: "right", crossOffset: 100, arrowSize: 10, arrowBoundaryOffset: 6 })
      ?.frame.y,
  ).toBe(104)
})
it("computes horizontal height growth from the positioned cross-axis edge", () => {
  expect(getNativeFloatingPlacement({ ...base, placement: "right" })).toMatchObject({
    frame: { x: 148, y: 90, height: 40 },
    maxHeight: 198,
  })
  expect(getNativeFloatingPlacement({ ...base, placement: "right bottom" })).toMatchObject({
    frame: { x: 148, y: 80, height: 40 },
    maxHeight: 108,
  })
})
it("preserves authored width and its main-axis relationship when neither side can contain it", () => {
  expect(
    getNativeFloatingPlacement({ ...base, placement: "right", content: { width: 400, height: 40 } }),
  ).toMatchObject({ placement: "right", frame: { x: 148, width: 400 } })
})
it("constrains an opted-in oversized surface to the usable viewport including its margins", () => {
  const input = {
    ...base,
    content: { width: 600, height: 700 },
    visibleBoundary: { x: 20, y: 30, width: 240, height: 240 },
    margins: { left: 7, right: 9, top: 10 },
    constrainToViewport: true,
  }
  const result = getNativeFloatingPlacement(input)!
  expect(result.maxWidth).toBe(200)
  expect(result.frame).toMatchObject({ x: 32, width: 216 })
  expect(result.frame.x + result.frame.width).toBe(248)
  expect(result.maxHeight + result.frame.y + input.margins.top).toBe(258)
  expect(input.content.width).toBe(600)
  expect(getNativeFloatingPlacement({ ...input, constrainToViewport: false })?.frame.width).toBe(616)
})
it("caps side-placed surfaces to their chosen side and preserves explicit no-flip placement", () => {
  const result = getNativeFloatingPlacement({
    ...base,
    content: { width: 600, height: 40 },
    placement: "right",
    shouldFlip: false,
    constrainToViewport: true,
    margins: { left: 4, right: 6 },
  })!
  expect(result).toMatchObject({ placement: "right", didFlip: false, maxWidth: 130 })
  expect(result.frame).toMatchObject({ x: 148, width: 140 })
  expect(result.frame.x + result.frame.width).toBe(288)
})
it("exposes the actual overlay entry edge and arrow center as the animation origin", () => {
  expect(getNativeFloatingPlacement(base)?.anchorPoint).toEqual({ x: 30, y: 0 })
  expect(getNativeFloatingPlacement({ ...base, placement: "top" })?.anchorPoint).toEqual({ x: 30, y: 40 })
  expect(getNativeFloatingPlacement({ ...base, placement: "right", arrowSize: 10 })?.anchorPoint).toEqual({
    x: 0,
    y: 20,
  })
})
