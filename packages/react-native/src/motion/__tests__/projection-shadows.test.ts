import { PlatformColor, type BoxShadowValue, type ViewStyle } from "react-native"

import { nativeProjectionStyles } from "../projection/nativeStyles"
import type { IProjectionNode } from "../projection/node/types"
import type { ResolvedValues, VisualElement } from "../projection/types"

const processBoxShadow = jest.requireActual<{
  default: (value: ViewStyle["boxShadow"]) => unknown[]
}>("react-native/Libraries/StyleSheet/processBoxShadow").default
const reference = jest.requireActual<{
  version: string
  results: { id: string; value: string; x: number; y: number; expected: string }[]
}>("./fixtures/shadow-projection-reference.json")

// Direct projection-parameter model. The companion owner/geometry suite tests actual publication.
const project = (
  boxShadow: ViewStyle["boxShadow"],
  x: number,
  y: number,
  latest: ResolvedValues = {},
  lead?: ViewStyle["boxShadow"],
) => {
  const axis = (scale: number) => ({ translate: 0, scale, origin: 0.5, originPoint: 0 })
  const delta = { x: axis(x), y: axis(y) }
  const node: IProjectionNode = {
    isVisible: true,
    needsReset: false,
    projectionDelta: delta,
    projectionDeltaWithTransform: delta,
    layout: {},
    target: { x: { min: 0, max: 100 }, y: { min: 0, max: 50 } },
    treeScale: { x: 1, y: 1 },
    latestValues: latest,
    options: {},
    applyTransformsToTarget: () => {},
    getLead: () => node,
  } as unknown as IProjectionNode
  if (lead !== undefined)
    node.options.visualElement = { props: { style: { boxShadow: lead } } } as unknown as VisualElement
  return nativeProjectionStyles(node, { boxShadow }).boxShadow
}

it.each(reference.results)(
  "matches the actual pinned Motion shadow correction for $id",
  ({ value, x, y, expected }) => {
    expect(reference.version).toBe("12.40.0")
    const result = project(value, x, y)
    expect(result).toBe(expected)
    expect(processBoxShadow(result)).toEqual(processBoxShadow(expected))
  },
)

it("preserves optional field presence, inset, native color identity and frozen authored lists", () => {
  const color = PlatformColor("labelColor")
  const first = Object.freeze({ offsetX: 2, offsetY: 4, color })
  const second = Object.freeze({
    offsetX: "4px",
    offsetY: "-6px",
    blurRadius: "8px",
    spreadDistance: "-2px",
    inset: true,
    color: "navy",
  })
  const source = Object.freeze([first, second])
  const result = project(source, 2, 0.5) as BoxShadowValue[]
  expect(result[0]).toEqual({ offsetX: 1, offsetY: 8, color })
  expect(result[0].color).toBe(color)
  expect(Object.hasOwn(result[0], "blurRadius")).toBe(false)
  expect(Object.hasOwn(result[0], "spreadDistance")).toBe(false)
  expect(result[1]).toEqual({
    offsetX: 2,
    offsetY: -12,
    blurRadius: 6.4,
    spreadDistance: -1.6,
    inset: true,
    color: "navy",
  })
  expect(source[0]).toBe(first)
  expect(source[1]).toBe(second)
  expect(processBoxShadow(result)).toHaveLength(2)
})

it("uses live animated string values before authored shadows", () => {
  const result = project("2px 4px 8px red", 0.5, 1, { boxShadow: "4px 6px 12px blue" })
  expect(processBoxShadow(result)).toEqual(processBoxShadow("8px 6px 16px blue"))
})

it("uses the shared lead's original native list and preserves an absent shadow", () => {
  const result = project([{ offsetX: 2, offsetY: 4, color: "red" }], 0.5, 1, {}, [
    { offsetX: 8, offsetY: 10, color: "blue" },
  ])
  expect(result).toEqual([{ offsetX: 16, offsetY: 10, color: "blue" }])
  expect(project(undefined, 0.5, 1)).toBeUndefined()
  expect(project([], 0.5, 1)).toEqual([])
})

it("leaves invalid authored lengths invalid for the original SDK instead of inventing valid shadow paint", () => {
  const source = [{ offsetX: "20%", offsetY: 4, color: "red" }]
  const result = project(source, 0.5, 1)
  expect(result).toEqual(source)
  expect(processBoxShadow(result)).toEqual([])
})
