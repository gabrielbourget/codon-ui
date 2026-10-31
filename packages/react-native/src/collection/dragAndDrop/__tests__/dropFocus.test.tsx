import { act, renderHook } from "@testing-library/react-native"

import { SelectionManager } from "../../state/SelectionManager"
import { useMultipleSelectionState } from "../../state/useMultipleSelectionState"
import { captureNativeDropFocus, reconcileNativeDropFocus } from "../dropFocus"
import { useNativeDroppableCollectionState } from "../useNativeDroppableCollectionState"

import { dragCollection } from "./fixtures"

it("keeps application selection/focus changes authoritative while restoring collection focus", async () => {
  const collection = dragCollection()
  const view = await renderHook(() => {
    const manager = new SelectionManager(
      collection,
      useMultipleSelectionState({ selectionMode: "multiple", defaultSelectedKeys: [0] }),
    )
    return useNativeDroppableCollectionState({ collection, selectionManager: manager, onItemDrop: () => {} })
  })
  await act(() => view.result.current.selectionManager.setFocusedKey(0))
  const snapshot = captureNativeDropFocus(
    view.result.current,
    { type: "item", key: "", dropPosition: "on" },
    true,
    new Set([0]),
  )
  await act(() => {
    view.result.current.selectionManager.setFocusedKey("folder")
    view.result.current.selectionManager.setSelectedKeys(new Set(["folder"]))
  })
  await act(() => {
    reconcileNativeDropFocus(snapshot, view.result.current)
  })
  expect(view.result.current.selectionManager.focusedKey).toBe("folder")
  expect([...view.result.current.selectionManager.selectedKeys]).toEqual(["folder"])
  expect(view.result.current.selectionManager.isFocused).toBe(true)
})
it("focuses an existing on-item target without replacing held selected keys", async () => {
  const collection = dragCollection()
  const view = await renderHook(() => {
    const manager = new SelectionManager(
      collection,
      useMultipleSelectionState({ selectionMode: "multiple", selectedKeys: new Set([0]) }),
    )
    return useNativeDroppableCollectionState({ collection, selectionManager: manager, onItemDrop: () => {} })
  })
  const snapshot = captureNativeDropFocus(
    view.result.current,
    { type: "item", key: "", dropPosition: "on" },
    true,
    new Set([0]),
  )
  await act(() => {
    reconcileNativeDropFocus(snapshot, view.result.current)
  })
  expect(view.result.current.selectionManager.focusedKey).toBe("")
  expect([...view.result.current.selectionManager.selectedKeys]).toEqual([0])
})
it.each([false, true])(
  "requests inserted-item selection without replacing an owner's changed selection=%s",
  async (ownerChanged) => {
    const collection = dragCollection()
    const before = Object.create(collection) as typeof collection
    Object.defineProperties(before, {
      size: { value: 1 },
      getItem: { value: (key: string | number) => (key === 0 ? collection.getItem(0) : null) },
    })
    const onSelectionChange = jest.fn()
    const view = await renderHook(
      ({ items, selected }: { items: typeof collection; selected: Set<string | number> }) => {
        const manager = new SelectionManager(
          items,
          useMultipleSelectionState({ selectionMode: "multiple", selectedKeys: selected, onSelectionChange }),
        )
        return useNativeDroppableCollectionState({ collection: items, selectionManager: manager, onRootDrop: () => {} })
      },
      { initialProps: { items: before, selected: new Set<string | number>([0]) } },
    )
    await act(() => view.result.current.selectionManager.setFocusedKey(0))
    const snapshot = captureNativeDropFocus(view.result.current, { type: "root" }, false, new Set())
    await view.rerender({ items: collection, selected: new Set<string | number>(ownerChanged ? ["folder"] : [0]) })
    await act(() => {
      reconcileNativeDropFocus(snapshot, view.result.current)
    })
    if (ownerChanged) {
      expect(onSelectionChange).not.toHaveBeenCalled()
      expect(view.result.current.selectionManager.focusedKey).toBe(0)
    } else {
      expect([...onSelectionChange.mock.calls[0][0]]).toEqual(["", "folder", "child"])
      expect(view.result.current.selectionManager.focusedKey).toBe("")
    }
    expect([...view.result.current.selectionManager.selectedKeys]).toEqual(ownerChanged ? ["folder"] : [0])
  },
)
