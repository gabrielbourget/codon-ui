import { act, renderHook } from "@testing-library/react-native"

import { normalizeSelectCollection } from "../collection"
import type { TNativeSelectProps } from "../types"
import { useSelectState } from "../useSelectState"

const items = Object.freeze([
  { id: 0, name: "Numeric zero" },
  { id: "0", name: "String zero" },
  { id: "last", name: "Last" },
])
const base = {
  items,
  getKey: (item: (typeof items)[number]) => item.id,
  getTextValue: (item: (typeof items)[number]) => item.name,
  accessibilityLabel: "Choose",
  closeLabel: "Close",
} satisfies TNativeSelectProps<(typeof items)[number]>

it("preserves typed keys, snapshots without mutation and keeps source object identity", () => {
  const entries = normalizeSelectCollection(items, base.getKey, base.getTextValue)
  expect(entries.map((entry) => entry.encodedKey)).toEqual(["number:0", "string:0", "string:last"])
  expect(entries[0].item).toBe(items[0])
  expect(items).toHaveLength(3)
})

it.each([
  [
    { id: 1, name: "One" },
    { id: 1, name: "Again" },
  ],
  [{ id: NaN, name: "Invalid" }],
  [{ id: Infinity, name: "Invalid" }],
  [{ id: "empty", name: "  " }],
])("rejects ambiguous or inaccessible metadata: %p", (...invalid) => {
  expect(() => normalizeSelectCollection(invalid, base.getKey, base.getTextValue)).toThrow(TypeError)
})

it("initializes uncontrolled selection/open state once and selects then closes once", async () => {
  const calls: unknown[] = []
  const { result, rerender } = await renderHook(
    (props: TNativeSelectProps<(typeof items)[number]>) => useSelectState(props),
    {
      initialProps: {
        ...base,
        defaultValue: 0,
        defaultOpen: true,
        onChange: (key) => calls.push(key),
        onOpenChange: (open) => calls.push(open),
      },
    },
  )
  await act(() => result.current.activate("0"))
  expect(calls).toEqual(["0", false])
  expect(result.current.selectedEntry?.text).toBe("String zero")
  expect(result.current.open).toBe(false)
  await rerender({
    ...base,
    defaultValue: "last",
    defaultOpen: true,
    onChange: (key) => calls.push(key),
    onOpenChange: (open) => calls.push(open),
  })
  expect(result.current.selectedKey).toBe("0")
  expect(result.current.open).toBe(false)
})

it("waits for controlled echoes and distinguishes null from uncontrolled state", async () => {
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  const { result, rerender } = await renderHook(
    (props: TNativeSelectProps<(typeof items)[number]>) => useSelectState(props),
    {
      initialProps: { ...base, value: null, isOpen: true, onChange, onOpenChange },
    },
  )
  await act(() => result.current.activate(0))
  expect(onChange.mock.calls).toEqual([[0]])
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(result.current.selectedKey).toBeNull()
  expect(result.current.open).toBe(true)
  await rerender({ ...base, value: 0, isOpen: false })
  expect(result.current.selectedEntry?.text).toBe("Numeric zero")
})

it("retains removed values and restores their display after reorder/reinsertion without callbacks", async () => {
  const onChange = jest.fn()
  const { result, rerender } = await renderHook(
    (props: TNativeSelectProps<(typeof items)[number]>) => useSelectState(props),
    {
      initialProps: { ...base, defaultValue: 0, onChange },
    },
  )
  await rerender({ ...base, items: [items[2]], onChange })
  expect(result.current.selectedEntry).toBeUndefined()
  expect(result.current.selectedKey).toBe(0)
  await rerender({ ...base, items: [...items].reverse(), onChange })
  expect(result.current.selectedEntry?.text).toBe("Numeric zero")
  expect(onChange).not.toHaveBeenCalled()
})

it("cancels without selection, closes an existing selection quietly and blocks unavailable/read-only requests", async () => {
  const onChange = jest.fn()
  const { result, rerender } = await renderHook(
    (props: TNativeSelectProps<(typeof items)[number]>) => useSelectState(props),
    {
      initialProps: { ...base, value: 0, isOpen: true, disabledKeys: ["0"], onChange },
    },
  )
  await act(() => result.current.activate("0"))
  await act(() => result.current.activate("missing"))
  expect(onChange).not.toHaveBeenCalled()
  await act(() => result.current.activate(0))
  expect(onChange).not.toHaveBeenCalled()
  await rerender({ ...base, value: 0, isOpen: true, isReadOnly: true, onChange })
  await act(() => result.current.activate("last"))
  expect(result.current.selectedKey).toBe(0)
  expect(onChange).not.toHaveBeenCalled()
})

it("requests closure once on disabling even if controlled open is held, then allows a later cycle", async () => {
  const onOpenChange = jest.fn()
  const { result, rerender } = await renderHook(
    (props: TNativeSelectProps<(typeof items)[number]>) => useSelectState(props),
    {
      initialProps: { ...base, isOpen: true, isDisabled: true, onOpenChange },
    },
  )
  expect(onOpenChange.mock.calls).toEqual([[false]])
  await rerender({ ...base, isOpen: true, isDisabled: true, onOpenChange })
  await act(() => result.current.requestOpen(true))
  expect(onOpenChange).toHaveBeenCalledTimes(1)
  await rerender({ ...base, isOpen: false, isDisabled: false, onOpenChange })
  await rerender({ ...base, isOpen: true, isDisabled: true, onOpenChange })
  expect(onOpenChange.mock.calls).toEqual([[false], [false]])
})
