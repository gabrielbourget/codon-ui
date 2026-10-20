import { act, renderHook } from "@testing-library/react-native"
import type { MultipleSelectionStateProps } from "react-stately/useMultipleSelectionState"

import { useListState, useMultipleSelectionState, useTreeState } from "../state"

type TValue = { id: string }
type TCollection = NonNullable<Parameters<typeof useListState<TValue>>[0]["collection"]>
type TNode = NonNullable<ReturnType<TCollection["getItem"]>>

const collection = () => {
  const nodes: TNode[] = ["a", "b", "c"].map((key, index) => ({
    type: "item",
    key,
    value: { id: key },
    level: 0,
    index,
    hasChildNodes: false,
    childNodes: [],
    rendered: key,
    textValue: key,
    props: {},
    parentKey: null,
    prevKey: null,
    nextKey: null,
    shouldInvalidate: () => false,
  }))
  const byKey = new Map(nodes.map((node) => [node.key, node]))
  const keys = nodes.map((node) => node.key)
  const logicalCollection: TCollection = {
    size: nodes.length,
    [Symbol.iterator]: () => nodes[Symbol.iterator](),
    getKeys: () => byKey.keys(),
    getItem: (key) => byKey.get(key) ?? null,
    at: (index) => nodes[index] ?? null,
    getChildren: () => [],
    getKeyBefore: (key) => keys[keys.indexOf(key) - 1] ?? null,
    getKeyAfter: (key) => keys[keys.indexOf(key) + 1] ?? null,
    getFirstKey: () => keys[0] ?? null,
    getLastKey: () => keys.at(-1) ?? null,
    getTextValue: (key) => byKey.get(key)?.textValue ?? "",
  }
  return logicalCollection
}

it("runs the native React instance with the full supplied list and owner-vetoed selection", async () => {
  const logicalCollection = collection()
  const selectedKeys = new Set(["a"])
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useListState({
      collection: logicalCollection,
      selectionMode: "multiple",
      selectedKeys,
      onSelectionChange: request,
    }),
  )
  expect(result.current.collection).toBe(logicalCollection)
  await act(() => result.current.selectionManager.replaceSelection("c"))
  expect([...result.current.selectionManager.selectedKeys]).toEqual(["a"])
  expect([...selectedKeys]).toEqual(["a"])
  expect([...request.mock.calls[0][0]]).toEqual(["c"])
  expect(result.current.selectionManager.isSelected("c")).toBe(false)
})

it("retains numeric keys, complete tree state and controlled expansion requests", async () => {
  const logicalCollection = collection()
  const expandedKeys = new Set<string | number>([0])
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useTreeState({ collection: logicalCollection, expandedKeys, onExpandedChange: request, selectionMode: "multiple" }),
  )
  expect(result.current.collection).toBe(logicalCollection)
  await act(() => result.current.toggleKey("a"))
  expect([...result.current.expandedKeys]).toEqual([0])
  expect([...expandedKeys]).toEqual([0])
  expect([...request.mock.calls[0][0]]).toEqual([0, "a"])
  expect(typeof result.current.selectionManager.extendSelection).toBe("function")
})

it("keeps all-selection and synchronous focus state with current callbacks", async () => {
  const first = jest.fn()
  const current = jest.fn()
  const initialProps: MultipleSelectionStateProps = {
    selectionMode: "multiple",
    selectedKeys: "all",
    disabledKeys: [0, "a"],
    disabledBehavior: "selection",
    onSelectionChange: first,
  }
  const { result, rerender } = await renderHook(useMultipleSelectionState, { initialProps })
  expect(result.current.selectedKeys).toBe("all")
  expect([...result.current.disabledKeys]).toEqual([0, "a"])
  expect(result.current.disabledBehavior).toBe("selection")
  await act(() => {
    result.current.setFocused(true)
    result.current.setFocusedKey(0, "last")
    expect(result.current.isFocused).toBe(true)
    expect(result.current.focusedKey).toBe(0)
    expect(result.current.childFocusStrategy).toBe("last")
  })
  await rerender({ ...initialProps, onSelectionChange: current })
  await act(() => result.current.setSelectedKeys(new Set(["b"])))
  expect(first).not.toHaveBeenCalled()
  expect([...current.mock.calls[0][0]]).toEqual(["b"])
  expect(result.current.selectedKeys).toBe("all")
})
