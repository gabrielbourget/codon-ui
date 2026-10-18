import { act, fireEvent, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, type View } from "react-native"

import * as focusRegistry from "../../../../input/focus"

export const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
export const advance = async () => {
  await act(() => jest.advanceTimersByTime(50))
}
export const installCompactNativeLayout = () => {
  const hostRef = createRef<View>()
  const targets = new Map<string, View>()
  const register = focusRegistry.registerNativeFocusTarget
  jest.spyOn(focusRegistry, "registerNativeFocusTarget").mockImplementation((target, binding) => {
    // Capture actual preset refs without changing production registration or cleanup.
    const id = (target as unknown as { props: { testID?: string } }).props.testID
    if (id) targets.set(id, target)
    const release = register(target, binding)
    return () => {
      release()
      if (id && targets.get(id) === target) targets.delete(id)
    }
  })
  const target = (id: string) => {
    const actual = id === "host" ? hostRef.current : targets.get(id)
    if (!actual) throw new Error(`Missing actual RN preset ref for ${id}`)
    return actual
  }
  const acknowledge = async (active = true, epoch = 1) => {
    for (const ready of [false, true]) {
      const host = row("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "compact-window",
            epoch,
            policyRevision: host.policyRevision,
            ready,
            windowActive: active,
          },
        }),
      )
    }
  }
  const ready = async () => {
    for (const [id, rect] of [
      ["host", [0, 0, 390, 844]],
      ["type-ahead-search-group", [15, 80, 300, 44]],
      ["type-ahead-search-popover", [0, 0, 300, 120]],
    ] as const) {
      const actual = target(id)
      expect(findNodeHandle(actual)).toBeGreaterThan(0)
      Object.defineProperty(actual, "measureInWindow", {
        configurable: true,
        value: jest.fn((callback) => callback(...rect)),
      })
    }
    await fireEvent(row("host"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } })
    await acknowledge()
    await advance()
    await acknowledge()
  }
  return { hostRef, target, acknowledge, ready }
}
