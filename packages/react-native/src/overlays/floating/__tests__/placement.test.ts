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
