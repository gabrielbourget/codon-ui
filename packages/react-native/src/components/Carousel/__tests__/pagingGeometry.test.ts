import { measureNativeCarouselPages, nativeCarouselIndex, nearestNativeCarouselPage } from "../pagingGeometry"

const options = {
  items: [
    { x: 0, y: 0, width: 120, height: 80 },
    { x: 140, y: 100, width: 280, height: 180 },
    { x: 440, y: 300, width: 360, height: 300 },
  ],
  viewport: { x: 0, y: 0, width: 300, height: 200 },
  container: { x: 0, y: 0, width: 800, height: 600 },
  content: { width: 800, height: 600 },
  axis: "x" as const,
  align: "start" as const,
  isRTL: false,
}

it.each([
  ["start", [0, 140, 440]],
  ["center", [0, 130, 470]],
  ["end", [0, 120, 500]],
] as const)("measures unequal horizontal items and gaps with %s alignment", (align, expected) => {
  const measured = measureNativeCarouselPages({ ...options, align })!
  expect(measured.itemOffsets).toEqual(expected)
  expect(measured.snapOffsets).toEqual(expected)
  expect(measured.maximumOffset).toBe(500)
})

it.each([
  ["start", [0, 100, 300]],
  ["center", [0, 90, 350]],
  ["end", [0, 80, 400]],
] as const)("measures unequal vertical items with %s alignment independent of RTL", (align, expected) => {
  for (const isRTL of [false, true]) {
    const measured = measureNativeCarouselPages({ ...options, axis: "y", align, isRTL })!
    expect(measured.itemOffsets).toEqual(expected)
    expect(measured.maximumOffset).toBe(400)
  }
})

it.each([
  ["start", [500, 360, 60]],
  ["center", [500, 370, 30]],
  ["end", [500, 380, 0]],
] as const)("uses measured physical RTL positions with logical %s alignment", (align, expected) => {
  const items = options.items.map((item) => ({ ...item, x: 800 - item.x - item.width }))
  const measured = measureNativeCarouselPages({ ...options, items, align, isRTL: true })!
  expect(measured.itemOffsets).toEqual(expected)
  expect(measured.snapOffsets).toEqual([...expected].reverse())
})

it("keeps all logical items at coincident finite-edge snaps and honors an explicitly requested item", () => {
  const geometry = measureNativeCarouselPages({ ...options, content: { width: 300, height: 200 } })!
  expect(geometry.itemOffsets).toEqual([0, 0, 0])
  expect(geometry.snapOffsets).toEqual([0])
  expect(nearestNativeCarouselPage(geometry, 0, 2)).toBe(2)
  expect(nearestNativeCarouselPage(geometry, 0, 0)).toBe(0)
})

it("includes the original container offset and chooses the closest observed snap", () => {
  const geometry = measureNativeCarouselPages({ ...options, container: { ...options.container, x: 10 } })!
  expect(geometry.itemOffsets).toEqual([10, 150, 450])
  expect(nearestNativeCarouselPage(geometry, 170, 0)).toBe(1)
  expect(nearestNativeCarouselPage(geometry, 900, 0)).toBe(2)
  expect(nearestNativeCarouselPage(geometry, -100, 2)).toBe(0)
})

it("waits for finite native geometry and does not invent a default page size", () => {
  expect(measureNativeCarouselPages({ ...options, viewport: { ...options.viewport, width: 0 } })).toBeNull()
  expect(measureNativeCarouselPages({ ...options, content: { width: 0, height: 200 } })).toBeNull()
  expect(measureNativeCarouselPages({ ...options, items: [{ ...options.items[0], width: NaN }] })).toBeNull()
  expect(measureNativeCarouselPages({ ...options, items: [{ ...options.items[0], x: Infinity }] })).toBeNull()
  expect(measureNativeCarouselPages({ ...options, items: [] })?.itemOffsets).toEqual([])
})

it.each([
  [-1, 3, 0],
  [99, 3, 2],
  [1.8, 3, 1],
  [NaN, 3, 0],
  [2, 0, 0],
])("bounds a navigation request %s for %s items", (index, count, expected) => {
  expect(nativeCarouselIndex(index, count)).toBe(expected)
})
