import { act, renderHook } from "@testing-library/react-native"
import { useDraggableCollectionState as useSourceDragState } from "react-stately/useDraggableCollectionState"
import { useDroppableCollectionState as useSourceDropState } from "react-stately/useDroppableCollectionState"

import type { TNativeCollectionKey } from "../../snapshot"
import { SelectionManager } from "../../state/SelectionManager"
import { useMultipleSelectionState } from "../../state/useMultipleSelectionState"
import { NativeDragController } from "../controller"
import type { TNativeDropTarget, TNativeTextDropItem } from "../types"
import { useNativeDraggableCollectionState } from "../useNativeDraggableCollectionState"
import type { TNativeDraggableCollectionStateOptions } from "../useNativeDraggableCollectionState"
import { useNativeDroppableCollectionState } from "../useNativeDroppableCollectionState"
import type { TNativeDroppableCollectionStateOptions } from "../useNativeDroppableCollectionState"

import { dragCollection, dragValues } from "./fixtures"

const collection = dragCollection()
const selected = new Set<TNativeCollectionKey>([0, "", "folder", "child"])
const useManager = (keys = selected) =>
  new SelectionManager(
    collection,
    useMultipleSelectionState({
      selectionMode: "multiple",
      defaultSelectedKeys: keys,
    }),
  )

const usePinnedDragState = (props: TNativeDraggableCollectionStateOptions) =>
  useSourceDragState({
    ...props,
    preview: undefined,
    selectionManager: props.selectionManager as Parameters<typeof useSourceDragState>[0]["selectionManager"],
  })
const usePinnedDropState = (props: TNativeDroppableCollectionStateOptions) =>
  useSourceDropState({
    ...props,
    onDrop: undefined,
    onInsert: () => {},
    onRootDrop: () => {},
    onItemDrop: () => {},
    selectionManager: props.selectionManager as Parameters<typeof useSourceDropState>[0]["selectionManager"],
  })

it.each([0, "", "folder", "child", "not-selected"] as const)(
  "preserves actual pinned drag state/callback/value traces for key %p",
  async (key) => {
    const run = async (native: boolean) => {
      const useStateHook = native ? useNativeDraggableCollectionState : usePinnedDragState
      const trace: unknown[] = []
      const getItems = jest.fn((keys: Set<TNativeCollectionKey>, values: object[]) => {
        trace.push(["items", [...keys], values])
        return [
          { "text/plain": values.map((value) => dragValues.indexOf(value as (typeof dragValues)[number])).join(",") },
        ]
      })
      const view = await renderHook(() => {
        const props: TNativeDraggableCollectionStateOptions = {
          collection,
          selectionManager: useManager(),
          getItems,
          onDragStart: (event) => trace.push(["start", event.type, [...event.keys], event.x, event.y]),
          onDragMove: (event) => trace.push(["move", [...event.keys], event.x, event.y]),
          onDragEnd: (event) => trace.push(["end", [...event.keys], event.dropOperation, event.isInternal]),
        }
        return useStateHook(props)
      })
      const keys = [...view.result.current.getKeysForDrag(key)]
      await act(() => view.result.current.startDrag(key, { type: "dragstart", x: 0, y: 0 }))
      const data = view.result.current.getItems(key)
      const sourceValues = getItems.mock.calls[0][1]
      for (const value of sourceValues) expect(dragValues).toContain(value)
      await act(() => view.result.current.moveDrag({ type: "dragmove", x: 12, y: -3 }))
      await act(() =>
        view.result.current.endDrag({
          type: "dragend",
          keys: new Set(),
          isInternal: true,
          dropOperation: "move",
          x: 17,
          y: 5,
        }),
      )
      const ended = [...view.result.current.draggingKeys]
      await view.unmount()
      return { keys, data, trace, ended }
    }
    expect(await run(true)).toEqual(await run(false))
  },
)

it.each([
  { type: "root" },
  { type: "item", key: 0, dropPosition: "before" },
  { type: "item", key: "", dropPosition: "after" },
  { type: "item", key: "child", dropPosition: "on" },
  { type: "item", key: "folder", dropPosition: "on" },
] satisfies TNativeDropTarget[])(
  "matches actual pinned acceptance, target equivalence and callbacks for %p",
  async (target) => {
    const run = async (native: boolean) => {
      const useStateHook = native ? useNativeDroppableCollectionState : usePinnedDropState
      const trace: unknown[] = []
      const view = await renderHook(() => {
        const props: TNativeDroppableCollectionStateOptions = {
          collection,
          selectionManager: useManager(),
          acceptedDragTypes: ["text/plain"],
          onInsert: () => {},
          onReorder: () => {},
          onMove: () => {},
          onRootDrop: () => {},
          onItemDrop: () => {},
          onDropEnter: (event) => trace.push([event.type, event.target, event.x, event.y]),
          onDropExit: (event) => trace.push([event.type, event.target, event.x, event.y]),
        }
        return useStateHook(props)
      })
      const operations = []
      for (const isInternal of [false, true])
        for (const keys of [new Set<TNativeCollectionKey>(), new Set<TNativeCollectionKey>([0, "folder"])]) {
          operations.push(
            view.result.current.getDropOperation({
              target,
              types: new Set(["text/plain"]),
              allowedOperations: ["copy", "move"],
              isInternal,
              draggingKeys: keys,
            }),
          )
        }
      await act(() => view.result.current.setTarget(target))
      const equivalent = [
        view.result.current.isDropTarget(target),
        view.result.current.isDropTarget({ type: "item", key: 0, dropPosition: "after" }),
        view.result.current.isDropTarget({ type: "item", key: "", dropPosition: "before" }),
      ]
      await act(() => view.result.current.setTarget(target))
      await act(() => view.result.current.setTarget(null))
      await view.unmount()
      return { operations, equivalent, trace }
    }
    expect(await run(true)).toEqual(await run(false))
  },
)

it("uses the actual state at lift, invokes start before item lookup and rejects a retired original owner", async () => {
  const trace: string[] = []
  let live = true
  const view = await renderHook(() =>
    useNativeDraggableCollectionState({
      collection,
      selectionManager: useManager(),
      onDragStart: () => trace.push("start"),
      getItems: () => {
        trace.push("items")
        return [{ "text/plain": "", "application/x-native": "original" }]
      },
      getAllowedDropOperations: () => {
        trace.push("operations")
        return ["move"]
      },
      onDragEnd: () => trace.push("end"),
    }),
  )
  const controller = new NativeDragController()
  const owner = {
    identity: {},
    current: () => live,
    get state() {
      return view.result.current
    },
  }
  let payload: ReturnType<typeof controller.lift> | undefined
  await act(() => {
    payload = controller.lift("original-action", owner, 0, { type: "dragstart", x: 0, y: 0 })
  })
  expect(trace).toEqual(["start", "items", "operations"])
  expect(payload!.items).toEqual([{ "text/plain": "", "application/x-native": "original" }])
  expect([...payload!.session.keys]).toEqual([0, "", "folder"])
  live = false
  await act(() => controller.retire(owner.identity))
  expect(view.result.current.draggingKeys.size).toBe(0)
  expect(trace).not.toContain("end")
  expect(() => controller.lift("retired-action", owner, 0, { type: "dragstart", x: 0, y: 0 })).toThrow("authority")
})

it.each([false, true])(
  "retains async drop callback order after OS end and checks owner retirement=%s",
  async (retire) => {
    let live = true,
      resume!: () => void
    const trace: unknown[] = []
    const identity = {}
    const view = await renderHook(() => {
      const manager = useManager(new Set([0]))
      const props = {
        onItemDrop: async () => {
          trace.push("item-start")
          await new Promise<void>((done) => {
            resume = done
          })
          trace.push("item-end")
        },
        onMove: (event: { keys: Set<TNativeCollectionKey> }) => {
          trace.push(["move", [...event.keys]])
        },
      }
      return {
        drag: useNativeDraggableCollectionState({
          collection,
          selectionManager: manager,
          getItems: () => [{ "text/plain": "original" }],
          getAllowedDropOperations: () => ["move"],
          onDragEnd: (event) => trace.push(["end", event.isInternal]),
        }),
        drop: useNativeDroppableCollectionState({ ...props, collection, selectionManager: manager }),
        props,
      }
    })
    const source = {
      identity,
      current: () => live,
      get state() {
        return view.result.current.drag
      },
    }
    const target = {
      identity,
      current: () => live,
      get state() {
        return view.result.current.drop
      },
      get props() {
        return view.result.current.props
      },
    }
    const controller = new NativeDragController()
    await act(() => {
      controller.lift("original", source, 0, { type: "dragstart", x: 0, y: 0 })
    })
    await act(() => {
      expect(
        controller.targetAt(
          "original",
          target,
          { type: "item", key: "", dropPosition: "on" },
          new Set(["text/plain"]),
          ["move"],
        ),
      ).toBe("move")
    })
    const item: TNativeTextDropItem = {
      kind: "text",
      types: new Set(["text/plain"]),
      getText: async () => "original",
      release: () => {},
    }
    let pending!: Promise<void>
    await act(() => {
      pending = controller.drop("original", [item], { x: 0, y: 0 })
    })
    await act(() => {
      controller.end("original", { x: 0, y: 0 }, "move")
    })
    expect(controller.activeSession()).toBeNull()
    if (retire) live = false
    resume()
    await pending
    expect(trace).toEqual(
      retire ? ["item-start", ["end", true], "item-end"] : ["item-start", ["end", true], "item-end", ["move", [0]]],
    )
  },
)
