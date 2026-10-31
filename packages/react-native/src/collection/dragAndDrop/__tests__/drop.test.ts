import { dispatchNativeCollectionDrop } from "../drop"
import { NATIVE_DIRECTORY_DRAG_TYPE } from "../types"
import type {
  TNativeDropEvent,
  TNativeDropItem,
  TNativeDroppableCollectionProps,
  TNativeDropTarget,
  TNativeDragTypes,
} from "../types"

const text = (type: string): TNativeDropItem => ({
  kind: "text",
  types: new Set([type]),
  getText: async () => "original",
  release: jest.fn(),
})
const event = (dropPosition: "on" | "before" | "after" = "on"): TNativeDropEvent => ({
  type: "drop",
  target: { type: "item", key: "target", dropPosition },
  x: 0,
  y: 0,
  dropOperation: "move",
  items: [text("text/plain")],
})
it("gives original onDrop complete precedence without invoking utility predicates or handlers", async () => {
  const onDrop = jest.fn(),
    onInsert = jest.fn(),
    shouldAcceptItemDrop = jest.fn()
  const original = event("before")
  await dispatchNativeCollectionDrop(
    { onDrop, onInsert, shouldAcceptItemDrop, acceptedDragTypes: ["not-offered"] },
    original,
    false,
    new Set(),
    () => true,
  )
  expect(onDrop).toHaveBeenCalledWith(original)
  expect(onInsert).not.toHaveBeenCalled()
  expect(shouldAcceptItemDrop).not.toHaveBeenCalled()
})
it.each(["on", "before", "after"] as const)("retains internal item/move/reorder ordering at %s", async (position) => {
  const trace: string[] = []
  const props: TNativeDroppableCollectionProps = {
    onItemDrop: () => {
      trace.push("item")
    },
    onMove: () => {
      trace.push("move")
    },
    onReorder: () => {
      trace.push("reorder")
    },
    onInsert: () => {
      trace.push("insert")
    },
  }
  await dispatchNativeCollectionDrop(props, event(position), true, new Set([0, ""]), () => true)
  expect(trace).toEqual(position === "on" ? ["item", "move"] : ["move", "reorder"])
})
it("awaits an admitted callback after OS drag end but suppresses later handlers when its original owner retires", async () => {
  let current = true,
    resolve!: () => void
  const started = jest.fn(),
    moved = jest.fn()
  const pending = dispatchNativeCollectionDrop(
    {
      onItemDrop: async () => {
        started()
        await new Promise<void>((done) => {
          resolve = done
        })
      },
      onMove: moved,
    },
    event(),
    true,
    new Set([0]),
    () => current,
  )
  expect(started).toHaveBeenCalledTimes(1)
  current = false
  resolve()
  await pending
  expect(moved).not.toHaveBeenCalled()
})
it("filters each native item by its own types and applies item predicates only to on targets", async () => {
  const directory: TNativeDropItem = {
    kind: "directory",
    name: "original",
    getEntries: async function* () {},
    release: jest.fn(),
  }
  const file: TNativeDropItem = {
    kind: "file",
    name: "original.png",
    type: "image/png",
    getFile: jest.fn(),
    getText: jest.fn(),
    release: jest.fn(),
  }
  const original = { ...event(), items: [text("text/plain"), file, directory] }
  const onItemDrop = jest.fn(),
    predicate = jest.fn((_target: TNativeDropTarget, _types: TNativeDragTypes) => true)
  await dispatchNativeCollectionDrop(
    { onItemDrop, shouldAcceptItemDrop: predicate, acceptedDragTypes: ["image/png", NATIVE_DIRECTORY_DRAG_TYPE] },
    original,
    false,
    new Set(),
    () => true,
  )
  expect(onItemDrop.mock.calls[0][0].items).toEqual([file, directory])
  expect(predicate).toHaveBeenCalledTimes(2)
  expect(predicate.mock.calls[0][1].has("image/png")).toBe(true)
  expect(predicate.mock.calls[1][1].has(NATIVE_DIRECTORY_DRAG_TYPE)).toBe(true)
})
it("retains the first thrown business callback and does not dispatch later move/reorder callbacks", async () => {
  const failure = new Error("original callback failure"),
    moved = jest.fn()
  await expect(
    dispatchNativeCollectionDrop(
      {
        onItemDrop: () => {
          throw failure
        },
        onMove: moved,
      },
      event(),
      true,
      new Set([0]),
      () => true,
    ),
  ).rejects.toBe(failure)
  expect(moved).not.toHaveBeenCalled()
})
