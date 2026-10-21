import { createRef } from "react"
import type { View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  screen,
} from "../../../../collection/__tests__/nativeReceipts"
import { NativeComboBoxGroupContext, NativeComboBoxPopoverContext } from "../../../ComboBox/collectionContext"

// Explicit geometry/native-status models for the private same-window picker.
// They establish no installed layout, native input or accessibility proof.
export const createFilterComboBoxFixture = () => {
  const host = createRef<View>(),
    anchor = createRef<View>(),
    popup = createRef<View>()
  const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
  let sequence = 0
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (typeof id === "number") frames.delete(id)
  })
  const Provider = ({ children }: { children: React.ReactNode }) => (
    <NativeComboBoxGroupContext.Provider value={{ ref: anchor }}>
      <NativeComboBoxPopoverContext.Provider value={{ ref: popup }}>{children}</NativeComboBoxPopoverContext.Provider>
    </NativeComboBoxGroupContext.Provider>
  )
  const ready = async () => {
    const measure = (target: View | null, box: number[]) => {
      if (!target) throw new Error("Original filter picker ref missing")
      Object.defineProperty(target, "measureInWindow", {
        configurable: true,
        value: (callback: (...values: number[]) => void) => callback(...box),
      })
    }
    measure(host.current, [0, 0, 360, 640])
    measure(anchor.current, [10, 40, 260, 48])
    measure(popup.current, [0, 0, 260, 180])
    await fireEvent(screen.getByTestId("native-floating-layer-host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    await fireEvent(screen.getByTestId("combo-box-popover", { includeHiddenElements: true }), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
    })
    for (const nativeReady of [false, true]) {
      const props = screen.getByTestId("native-floating-layer-host").props
      await act(() =>
        props.onNativeScopeStatus({
          nativeEvent: {
            ownerId: props.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            policyRevision: props.policyRevision,
            ready: nativeReady,
            windowActive: true,
          },
        }),
      )
    }
    for (let turn = 0; turn < 3; turn++)
      await act(() => {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(0))
      })
  }
  return { host, Provider, ready }
}
