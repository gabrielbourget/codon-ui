import { screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
} from "../../../../collection/__tests__/nativeReceipts"
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
  const acknowledge = async (active = true, epoch = 1, resetReady = true) => {
    for (const ready of resetReady ? [false, true] : [true]) {
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
  const within = async (id: string, focusedId: string | null, sequence = 1) => {
    const props = row(id).props
    const scope = row("host").props
    await act(() =>
      props.onNativeFocusWithin?.({
        nativeEvent: {
          ownerId: props.ownerId,
          bindingId: props.nativeFocusWithinBinding,
          target: findNodeHandle(target(id)),
          surfaceId: 11,
          windowId: "compact-window",
          scopeOwnerId: scope.ownerId,
          scopeEpoch: 1,
          sequence,
          attached: true,
          active: true,
          within: focusedId !== null,
          focusedTarget: focusedId ? findNodeHandle(target(focusedId)) : 0,
          textInputFocused: false,
          origin: "pointer",
          observedAt: sequence,
        },
      }),
    )
  }
  const observedKey = async (editor: TextInput, key: string) => {
    for (let step = 0; step < 2; step++) {
      const host = row("host").props
      await act(() =>
        host.onNativeObservationStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "compact-window",
            epoch: 1,
            observationRevision: host.observationRevision,
            ready: true,
            windowActive: true,
          },
        }),
      )
    }
    const host = row("host").props
    const ids = host.observations
      .filter((entry: { targetTag: number }) => entry.targetTag === findNodeHandle(editor))
      .map((entry: { id: string }) => entry.id)
    expect(ids.length).toBeGreaterThan(0)
    const preventDefault = jest.fn()
    await act(() =>
      host.onNativeObservedKey({
        preventDefault,
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "compact-window",
          epoch: 1,
          observationRevision: host.observationRevision,
          eventId: 1,
          observerIds: ids,
          target: findNodeHandle(hostRef.current),
          focusedTarget: findNodeHandle(editor),
          key,
          code: key,
          nativeCode: 21,
          legacyKeyCode: 37,
          location: 0,
          repeat: false,
          cancelled: false,
          isComposing: false,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          capsLock: false,
          nativeModifierData: "0",
          defaultCaptured: false,
          timestamp: 100,
        },
      }),
    )
    expect(preventDefault).not.toHaveBeenCalled()
  }
  return { hostRef, target, acknowledge, ready, within, observedKey }
}

export const pressCompact = async (target: Parameters<ReturnType<typeof userEvent.setup>["press"]>[0]) => {
  await userEvent.setup().press(target)
  await act(() => {})
}
