import { act, renderHook } from "@testing-library/react-native"
import {
  useMenuTriggerState as usePinnedMenuTriggerState,
  useSubmenuTriggerState as usePinnedSubmenuTriggerState,
} from "react-stately/useMenuTriggerState"

import { useNativeMenuTriggerState, useNativeSubmenuTriggerState } from "../triggerState"

it("matches complete pinned root/submenu state surfaces and actual committed stack traces", async () => {
  const { result } = await renderHook(() => {
    const nativeRoot = useNativeMenuTriggerState({ defaultOpen: true })
    const sourceRoot = usePinnedMenuTriggerState({ defaultOpen: true })
    const nativeSubmenu = useNativeSubmenuTriggerState(0, nativeRoot)
    const sourceSubmenu = usePinnedSubmenuTriggerState({ triggerKey: 0 }, sourceRoot)
    return {
      native: { root: nativeRoot, submenu: nativeSubmenu },
      source: { root: sourceRoot, submenu: sourceSubmenu },
    }
  })
  expect(Object.keys(result.current.native.root).sort()).toEqual(Object.keys(result.current.source.root).sort())
  expect(Object.keys(result.current.native.submenu).sort()).toEqual(Object.keys(result.current.source.submenu).sort())
  type TState = Pick<typeof result.current.native, "submenu"> & {
    root: Omit<typeof result.current.native.root, "setOpen">
  }
  const record = (value: TState) => ({
    open: value.root.isOpen,
    strategy: value.root.focusStrategy,
    stack: value.root.expandedKeysStack,
    submenuOpen: value.submenu.isOpen,
    submenuStrategy: value.submenu.focusStrategy,
    level: value.submenu.submenuLevel,
  })
  const operations: ((value: TState) => void)[] = [
    (value) => value.submenu.open("first"),
    (value) => value.root.openSubmenu("nested", 1),
    (value) => value.root.closeSubmenu("0", 0),
    (value) => value.submenu.toggle("last"),
    (value) => value.submenu.open(),
    (value) => value.root.openSubmenu("0", 0),
    (value) => value.root.openSubmenu("gap", 3),
    (value) => value.submenu.close(),
    (value) => value.root.close(),
    (value) => value.root.open("last"),
    (value) => value.root.toggle("first"),
  ]
  for (const operation of operations) {
    await act(() => operation(result.current.native))
    await act(() => operation(result.current.source))
    expect(record(result.current.native)).toEqual(record(result.current.source))
  }
})

it("preserves typed sibling and nested stack identity, focus strategies and complete close behavior", async () => {
  const { result } = await renderHook(() => useNativeMenuTriggerState({ defaultOpen: true }))
  await act(() => result.current.openSubmenu(0, 0))
  await act(() => result.current.openSubmenu("nested", 1))
  expect(result.current.expandedKeysStack).toEqual([0, "nested"])
  await act(() => result.current.closeSubmenu("0", 0))
  expect(result.current.expandedKeysStack).toEqual([0, "nested"])
  await act(() => result.current.openSubmenu("0", 0))
  expect(result.current.expandedKeysStack).toEqual(["0"])
  await act(() => result.current.openSubmenu("gap", 3))
  expect(result.current.expandedKeysStack).toEqual(["0"])
  await act(() => result.current.open("last"))
  expect(result.current.focusStrategy).toBe("last")
  await act(() => result.current.close())
  expect(result.current.isOpen).toBe(false)
  expect(result.current.expandedKeysStack).toEqual([])
  await act(() => result.current.toggle("first"))
  expect(result.current.isOpen).toBe(true)
  expect(result.current.focusStrategy).toBe("first")
})

it("repeats owner-vetoed open and close requests without document or authoritative mutation", async () => {
  const onOpenChange = jest.fn()
  const { result, rerender } = await renderHook(useNativeMenuTriggerState, {
    initialProps: { isOpen: false, onOpenChange },
  })
  await act(() => result.current.open("first"))
  await act(() => result.current.open("first"))
  expect(onOpenChange.mock.calls).toEqual([[true], [true]])
  expect(result.current.isOpen).toBe(false)
  await rerender({ isOpen: true, onOpenChange })
  await act(() => result.current.openSubmenu("a", 0))
  await act(() => result.current.close())
  await act(() => result.current.close())
  expect(onOpenChange.mock.calls).toEqual([[true], [true], [false], [false]])
  expect(result.current.isOpen).toBe(true)
  expect(result.current.expandedKeysStack).toEqual([])
})

it("captures a submenu's original level and exposes the complete pinned overlay-compatible state", async () => {
  const { result } = await renderHook(() => {
    const root = useNativeMenuTriggerState({ defaultOpen: true })
    const submenu = useNativeSubmenuTriggerState(0, root)
    return { root, submenu }
  })
  await act(() => result.current.submenu.open("first"))
  expect(result.current.root.expandedKeysStack).toEqual([0])
  expect(result.current.submenu.isOpen).toBe(true)
  expect(result.current.submenu.focusStrategy).toBe("first")
  await act(() => result.current.root.openSubmenu("nested", 1))
  expect(result.current.submenu.submenuLevel).toBe(0)
  await act(() => result.current.submenu.toggle())
  expect(result.current.root.expandedKeysStack).toEqual([])
  expect(result.current.submenu.focusStrategy).toBeNull()
  await act(() => result.current.submenu.setOpen())
  expect(result.current.submenu.isOpen).toBe(false)
  await act(() => result.current.submenu.open())
  await act(() => result.current.submenu.closeAll())
  expect(result.current.root.isOpen).toBe(false)
})
