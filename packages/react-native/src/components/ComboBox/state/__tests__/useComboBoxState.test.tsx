import { act, renderHook } from "@testing-library/react-native"
import { useComboBoxState as usePinnedComboBoxState } from "react-stately/useComboBoxState"

import { getNativeCollectionMetadataIdentity } from "../../../../collection/snapshot"
import type { TSourceManagerSurface } from "../../../../collection/state/types"
import type { ComboBoxState, ComboBoxStateOptions } from "../types"
import { useComboBoxState } from "../useComboBoxState"

import { collection, ITEMS, sectionCollection, type TItem } from "./collection"

type TState = Omit<ComboBoxState<TItem>, "selectionManager"> & {
  selectionManager: Pick<TSourceManagerSurface, "focusedKey" | "isFocused" | "selectedKeys" | "setFocusedKey">
}
type THook = (props: ComboBoxStateOptions<TItem>) => TState
const observe = (state: TState) => ({
  methods: Object.keys(state)
    .filter((key) => typeof state[key as keyof TState] === "function")
    .sort(),
  value: state.value,
  defaultValue: state.defaultValue,
  inputValue: state.inputValue,
  defaultInputValue: state.defaultInputValue,
  selectedKey: state.selectedKey,
  defaultSelectedKey: state.defaultSelectedKey,
  selectedItem: state.selectedItem?.key ?? null,
  selectedItems: state.selectedItems.map((node) => [node.key, node.value]),
  keys: [...state.collection.getKeys()],
  nodes: [...state.collection].map((node) => [node.key, node.index, node.prevKey, node.nextKey, node.textValue]),
  size: state.collection.size,
  open: state.isOpen,
  focused: state.isFocused,
  focusStrategy: state.focusStrategy,
  managerFocused: state.selectionManager.isFocused,
  focusedKey: state.selectionManager.focusedKey,
  selectedKeys: [...state.selectionManager.selectedKeys],
  disabledKeys: [...state.disabledKeys],
  realtime: state.realtimeValidation,
  display: state.displayValidation,
})
const trace = async (hook: THook, controlled: boolean) => {
  const original = collection()
  const events: unknown[][] = []
  const { result, unmount } = await renderHook(() =>
    hook({
      collection: original,
      defaultItems: ITEMS,
      defaultValue: 0,
      value: controlled ? null : undefined,
      inputValue: controlled ? "held" : undefined,
      defaultFilter: (label, input) => label.toLowerCase().includes(input.toLowerCase()),
      onChange: (value) => events.push(["value", value]),
      onSelectionChange: (key) => events.push(["legacy", key]),
      onInputChange: (value) => events.push(["input", value]),
      onOpenChange: (open, trigger) => events.push(["open", open, trigger]),
    }),
  )
  const observations = [observe(result.current)]
  const operations: ((state: TState) => void)[] = [
    (state) => state.setFocused(true),
    (state) => state.setInputValue("be"),
    (state) => state.open(null, "manual"),
    (state) => state.selectionManager.setFocusedKey("b"),
    (state) => state.commit(),
    (state) => state.setInputValue("changed"),
    (state) => state.revert(),
    (state) => state.setFocused(false),
  ]
  for (const operation of operations) {
    await act(() => operation(result.current))
    observations.push(observe(result.current))
  }
  await unmount()
  return { events, observations }
}

it.each([false, true])("preserves the complete pinned state trace with controlled=%s", async (controlled) => {
  expect(await trace(useComboBoxState, controlled)).toEqual(await trace(usePinnedComboBoxState, controlled))
})

it("repeats owner-vetoed value requests after separate native commits without changing owner input", async () => {
  const value = jest.fn(),
    input = jest.fn()
  const { result } = await renderHook(() =>
    useComboBoxState({
      collection: collection(),
      value: null,
      inputValue: "held",
      onChange: value,
      onInputChange: input,
    }),
  )
  await act(() => result.current.setValue(0))
  await act(() => result.current.setValue(0))
  expect(value.mock.calls).toEqual([[0], [0]])
  expect(input).not.toHaveBeenCalled()
  expect(result.current.value).toBeNull()
  expect(result.current.inputValue).toBe("held")
})

it("freezes only owned filtered nodes and retains their original descriptor and caller value identities", async () => {
  const original = collection()
  const { result } = await renderHook(() =>
    useComboBoxState({
      collection: original,
      defaultItems: ITEMS,
      defaultFilter: (label, input) => label.toLowerCase().includes(input.toLowerCase()),
    }),
  )
  await act(() => result.current.setInputValue("be"))
  await act(() => result.current.open())
  const node = result.current.collection.getItem("b")!
  expect([...result.current.collection.getKeys()]).toEqual(["b"])
  expect(node).not.toBe(original.getItem("b"))
  expect(Object.isFrozen(node)).toBe(true)
  expect(Object.isFrozen(result.current.collection)).toBe(true)
  expect(node.value).toBe(ITEMS[2])
  expect(getNativeCollectionMetadataIdentity(node)).toBe(getNativeCollectionMetadataIdentity(original.getItem("b")!))
  expect(Object.isFrozen(ITEMS[2])).toBe(false)
})

it("retains multiple-value ownership and exact original selected objects", async () => {
  const owner = [0, "b"],
    change = jest.fn()
  const { result } = await renderHook(() =>
    useComboBoxState<TItem, "multiple">({
      collection: collection(),
      selectionMode: "multiple",
      value: owner,
      onChange: change,
    }),
  )
  expect(result.current.selectedItems.map((node) => node.value)).toEqual([ITEMS[0], ITEMS[2]])
  expect(result.current.selectedItems[0].value).toBe(ITEMS[0])
  await act(() => result.current.setValue([""]))
  await act(() => result.current.setValue([""]))
  expect(change.mock.calls).toEqual([[[""]], [[""]]])
  expect(result.current.value).toBe(owner)
  expect(owner).toEqual([0, "b"])
})

it("keeps realtime validation separate from displayed validation and preserves input through reset", async () => {
  const data = collection()
  const { result } = await renderHook(() =>
    useComboBoxState({
      collection: data,
      validationBehavior: "native",
      validate: ({ inputValue }) => (inputValue === "invalid" ? "Client invalid" : null),
    }),
  )
  await act(() => result.current.setInputValue("invalid"))
  expect(result.current.realtimeValidation.isInvalid).toBe(true)
  expect(result.current.displayValidation.isInvalid).toBe(false)
  await act(() => result.current.commitValidation())
  expect(result.current.displayValidation.validationErrors).toEqual(["Client invalid"])
  await act(() => result.current.resetValidation())
  expect(result.current.displayValidation.isInvalid).toBe(false)
  expect(result.current.realtimeValidation.isInvalid).toBe(true)
  expect(result.current.inputValue).toBe("invalid")
})

it("retains pinned filtered section traversal, indices, counts and immutable child membership", async () => {
  const data = sectionCollection()
  const inspect = async (hook: THook) => {
    const { result, unmount } = await renderHook(() =>
      hook({
        collection: data,
        defaultItems: ITEMS,
        defaultFilter: (text, query) => text.toLowerCase().includes(query.toLowerCase()),
      }),
    )
    await act(() => result.current.setInputValue("bet"))
    await act(() => result.current.open())
    const state = observe(result.current)
    const children = [...result.current.collection.getChildren!("section")].map((node) => node.key)
    await unmount()
    return { state, children }
  }
  const native = await inspect(useComboBoxState)
  expect(native).toEqual(await inspect(usePinnedComboBoxState))
  expect(native.children).toEqual(["b"])
  expect(native.state.keys).toEqual(["section", "b"])
  expect(native.state.size).toBe(2)
  expect([...data.getChildren("section")].map((node) => node.key)).toEqual([0, "", "b"])
})
