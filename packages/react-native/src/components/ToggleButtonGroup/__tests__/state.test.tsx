import { act, renderHook } from "@testing-library/react-native"

import {
  NATIVE_TOGGLE_GROUP_SELECTION_MODES,
  useNativeToggleGroupState,
  type TNativeToggleGroupStateOptions,
} from "../state"

it("preserves numeric, string and empty keys without mutating the initial collection", async () => {
  const defaults = Object.freeze([0, "0", ""])
  const { result } = await renderHook(() =>
    useNativeToggleGroupState({ selectionMode: "multiple", defaultSelectedKeys: defaults }),
  )
  expect([...result.current.selectedKeys]).toEqual([0, "0", ""])
  await act(() => result.current.toggleKey("0"))
  expect([...result.current.selectedKeys]).toEqual([0, ""])
  await act(() => result.current.toggleKey("0"))
  expect([...result.current.selectedKeys]).toEqual([0, "", "0"])
  expect(defaults).toEqual([0, "0", ""])
})

it("reads an uncontrolled default once and toggles a single selected key off", async () => {
  const initialProps: TNativeToggleGroupStateOptions = { defaultSelectedKeys: [0] }
  const { result, rerender } = await renderHook(
    (props: TNativeToggleGroupStateOptions) => useNativeToggleGroupState(props),
    { initialProps },
  )
  expect(result.current.selectionMode).toBe("single")
  expect(result.current.isDisabled).toBe(false)
  await act(() => result.current.toggleKey("0"))
  await rerender({ defaultSelectedKeys: ["later"] })
  expect([...result.current.selectedKeys]).toEqual(["0"])
  await act(() => result.current.toggleKey("0"))
  expect([...result.current.selectedKeys]).toEqual([])
})

it("retains controlled output through repeated vetoes and accepts only owner echoes", async () => {
  const request = jest.fn()
  const owner = new Set([0])
  const initialProps: TNativeToggleGroupStateOptions = { selectedKeys: owner, onSelectionChange: request }
  const { result, rerender } = await renderHook(
    (props: TNativeToggleGroupStateOptions) => useNativeToggleGroupState(props),
    { initialProps },
  )
  await act(() => result.current.toggleKey("0"))
  await act(() => result.current.toggleKey("0"))
  expect([...result.current.selectedKeys]).toEqual([0])
  expect(request.mock.calls.map(([keys]) => [...keys])).toEqual([["0"], ["0"]])
  await rerender({ selectedKeys: new Set(["0"]), onSelectionChange: request })
  expect([...result.current.selectedKeys]).toEqual(["0"])
  expect([...owner]).toEqual([0])
  expect(request).toHaveBeenCalledTimes(2)
})

it.each(NATIVE_TOGGLE_GROUP_SELECTION_MODES)(
  "preserves same-content requests when %s selection cannot become empty",
  async (selectionMode) => {
    const request = jest.fn()
    const { result } = await renderHook(() =>
      useNativeToggleGroupState({
        selectionMode,
        selectedKeys: [0],
        disallowEmptySelection: true,
        onSelectionChange: request,
      }),
    )
    await act(() => result.current.toggleKey(0))
    await act(() => result.current.toggleKey(0))
    expect([...result.current.selectedKeys]).toEqual([0])
    expect(request.mock.calls.map(([keys]) => [...keys])).toEqual([[0], [0]])
    expect(request.mock.calls[0][0]).not.toBe(request.mock.calls[1][0])
  },
)

it("suppresses a same-value setter while preserving ordered membership changes", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useNativeToggleGroupState({ selectionMode: "multiple", onSelectionChange: request }),
  )
  await act(() => result.current.setSelected(0, true))
  await act(() => result.current.setSelected(0, true))
  await act(() => result.current.setSelected("0", true))
  await act(() => result.current.setSelected(0, false))
  expect(request.mock.calls.map(([keys]) => [...keys])).toEqual([[0], [0, "0"], ["0"]])
  expect([...result.current.selectedKeys]).toEqual(["0"])
})

it("keeps disabled metadata separate from programmatic state requests and direct replacement", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useNativeToggleGroupState({ isDisabled: true, disallowEmptySelection: true, onSelectionChange: request }),
  )
  await act(() => result.current.setSelected(0, true))
  await act(() => result.current.setSelectedKeys(new Set()))
  expect(result.current.isDisabled).toBe(true)
  expect([...result.current.selectedKeys]).toEqual([])
  expect(request.mock.calls.map(([keys]) => [...keys])).toEqual([[0], []])
})

it("retains direct Set identity and suppresses only repeated identical replacement objects", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() => useNativeToggleGroupState({ onSelectionChange: request }))
  const first = new Set([0])
  await act(() => result.current.setSelectedKeys(first))
  await act(() => result.current.setSelectedKeys(first))
  const replacement = new Set([0])
  await act(() => result.current.setSelectedKeys(replacement))
  expect(result.current.selectedKeys).toBe(replacement)
  expect(request.mock.calls).toEqual([[first], [replacement]])
})
