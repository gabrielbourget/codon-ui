import { createNativeBreadcrumbNodes, type TNativeBreadcrumbItem } from "../model"

const items = (count: number): readonly TNativeBreadcrumbItem[] =>
  Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({ id: String(index), href: `#${index}`, content: String(index), disabled: false }),
    ),
  )
const shape = (nodes: ReturnType<typeof createNativeBreadcrumbNodes>) =>
  nodes.map((node) => (node.kind === "item" ? node.item.id : node.items.map((item) => item.id)))

it("preserves the canonical default/right consolidation and source object identity without a local item mirror", () => {
  const input = items(6)
  const nodes = createNativeBreadcrumbNodes(input)
  expect(shape(nodes)).toEqual(["0", "1", "2", ["3", "4"], "5"])
  const all = nodes.flatMap((node) => (node.kind === "item" ? [node.item] : node.items))
  expect(all).toEqual(input)
  all.forEach((item, index) => expect(item).toBe(input[index]))
})
it.each([0, 1, 2, 3, 4])(
  "retains all %i items without consolidation and keeps the last passive item available",
  (count) => {
    const input = items(count)
    expect(shape(createNativeBreadcrumbNodes(input))).toEqual(input.map((item) => item.id))
  },
)
it.each([3, 4, 5, 6, 7, 8])(
  "uses exact native maxVisibleItems=%i on both sides, with the overflow control additional to the visible item count",
  (maximum) => {
    const input = items(10)
    for (const side of ["left", "right"] as const) {
      const nodes = createNativeBreadcrumbNodes(input, maximum, side)
      expect(nodes).toHaveLength(maximum + 1)
      expect(nodes[0]).toEqual({ kind: "item", item: input[0] })
      expect(nodes.at(-1)).toEqual({ kind: "item", item: input[9] })
      const overflow = nodes.find((node) => node.kind === "overflow")
      expect(overflow?.kind === "overflow" && overflow.items.length).toBe(10 - maximum)
      expect(nodes.flatMap((node) => (node.kind === "item" ? [node.item] : node.items))).toEqual(input)
      expect(nodes.findIndex((node) => node.kind === "overflow")).toBe(side === "left" ? 1 : maximum - 1)
    }
  },
)
it("preserves explicit empty IDs/URLs/labels and false guards, and follows caller relabel/reorder/removal", () => {
  const empty = Object.freeze({ id: "", href: "", content: "", disabled: false })
  const next = Object.freeze({ id: "next", href: "#next", content: "Next", disabled: true })
  expect(createNativeBreadcrumbNodes([empty, next])).toEqual([
    { kind: "item", item: empty },
    { kind: "item", item: next },
  ])
  const renamed = { ...next, content: "Renamed" }
  expect(createNativeBreadcrumbNodes([renamed, empty])).toEqual([
    { kind: "item", item: renamed },
    { kind: "item", item: empty },
  ])
  expect(createNativeBreadcrumbNodes([empty])).toEqual([{ kind: "item", item: empty }])
})
it.each([0, 2, 9, -1, 3.5, NaN, Infinity])(
  "rejects unsupported maximum %s rather than silently replacing the owner value",
  (value) => {
    expect(() => createNativeBreadcrumbNodes(items(6), value)).toThrow(RangeError)
  },
)
it("rejects ambiguous duplicate IDs and invalid untyped item fields without normalizing caller values", () => {
  const original = items(2)
  expect(() => createNativeBreadcrumbNodes([original[0], original[0]])).toThrow(/unique/)
  for (const override of [{ id: 0 }, { href: null }, { content: false }, { disabled: null }]) {
    // @ts-expect-error Runtime validation must also reject an untyped caller.
    expect(() => createNativeBreadcrumbNodes([{ ...original[0], ...override }])).toThrow(/requires/)
  }
})

it("rejects an unsupported untyped placement instead of silently selecting another side", () => {
  // @ts-expect-error Runtime callers must obey the declared placement contract.
  expect(() => createNativeBreadcrumbNodes(items(6), 4, "center")).toThrow(/unsupported/)
})
