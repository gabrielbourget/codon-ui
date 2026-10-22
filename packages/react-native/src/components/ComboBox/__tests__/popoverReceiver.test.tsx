import "../../../collection/__tests__/nativeReceipts"

import { createRef, useContext, type ReactNode } from "react"
import { AccessibilityInfo, View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { NativeComboBoxPopover } from "../CollectionComboBoxPopover"
import {
  NativeComboBoxPopoverContext,
  NativeComboBoxLabelContext,
  NativeComboBoxButtonContext,
  NativeComboBoxInputContext,
  NativeComboBoxGroupContext,
  NativeComboBoxTextContext,
  NativeComboBoxStateContext,
  NATIVE_COMBO_BOX_POPOVER_CONTEXTS,
} from "../collectionContext"
import { collection } from "../state/__tests__/collection"
import { useComboBoxState } from "../state/useComboBoxState"

const hidden = { includeHiddenElements: true },
  frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let serial = 0
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++serial
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => {
  frames.clear()
  jest.clearAllTimers()
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const setup = () => {
  const host = createRef<View>(),
    anchor = createRef<View>(),
    popup = createRef<View>()
  const wrap = (children: ReactNode) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={host} testID="window">
          <NativeFocusHost ref={anchor} testID="anchor" />
          {children}
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const ready = async (anchorY = 40) => {
    const measure = (target: View, box: [number, number, number, number]) =>
      Object.defineProperty(target, "measureInWindow", {
        configurable: true,
        value: (callback: (...values: number[]) => void) => callback(...box),
      })
    measure(host.current!, [0, 0, 360, 640])
    measure(anchor.current!, [10, anchorY, 200, 48])
    measure(popup.current!, [0, 0, 200, 180])
    await fireEvent(screen.getByTestId("window"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    await fireEvent(screen.getByTestId("popup", hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 180 } },
    })
    for (const ready of [false, true])
      await act(() => {
        const props = screen.getByTestId("window").props
        props.onNativeScopeStatus({
          nativeEvent: {
            ownerId: props.ownerId,
            windowId: "physical-window",
            epoch: 1,
            policyRevision: props.policyRevision,
            ready,
            windowActive: true,
          },
        })
      })
    for (let turn = 0; turn < 5; turn++)
      await act(() => {
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach((callback) => callback(0))
      })
  }
  return { host, anchor, popup, wrap, ready }
}

it("renders through the original Animated native host/ref with measured placement and style/children/render order", async () => {
  const f = setup(),
    caller = createRef<View>(),
    values = jest.fn(),
    order: string[] = []
  const view = await render(
    f.wrap(
      <NativeComboBoxPopoverContext.Provider
        value={{
          ref: f.popup,
          triggerRef: f.anchor,
          isOpen: true,
          isNonModal: true,
          trigger: "ComboBox",
          style: { padding: 9 },
          offset: 5,
        }}
      >
        <NativeComboBoxPopover
          ref={caller}
          testID="popup"
          style={(state) => {
            order.push("style")
            expect(state.defaultStyle.padding).toBe(9)
            return { marginTop: 12 }
          }}
          render={(props, state) => {
            order.push("render")
            values(state)
            return <NativeFocusHost {...props} testID="popup" />
          }}
        >
          {(state) => {
            order.push("children")
            return <View testID={`content-${state.placement ?? "pending"}`} />
          }}
        </NativeComboBoxPopover>
      </NativeComboBoxPopoverContext.Provider>,
    ),
  )
  await f.ready()
  expect(caller.current).not.toBeNull()
  expect(caller.current === f.popup.current).toBe(true)
  expect(values.mock.calls.at(-1)?.[0]).toMatchObject({
    trigger: "ComboBox",
    placement: "bottom",
    isEntering: false,
    isExiting: false,
  })
  expect(screen.getByTestId("popup", hidden)).toHaveStyle({ padding: 9, top: 93, marginTop: 12 })
  expect(screen.getByTestId("content-bottom", hidden)).toBeOnTheScreen()
  expect(order.slice(-3)).toEqual(["style", "children", "render"])
  await view.unmount()
  expect([caller.current, f.popup.current]).toEqual([null, null])
})

it.each([
  [0, "bottom"],
  [12, "top"],
] as const)("uses dynamic margin %s in the actual placement calculation", async (marginTop, expected) => {
  const f = setup(),
    values = jest.fn()
  await render(
    f.wrap(
      <NativeComboBoxPopoverContext.Provider
        value={{ ref: f.popup, triggerRef: f.anchor, isOpen: true, isNonModal: true, placement: "bottom", offset: 5 }}
      >
        <NativeComboBoxPopover
          testID="popup"
          style={() => ({ marginTop })}
          render={(props, state) => {
            values(state)
            return <NativeFocusHost {...props} />
          }}
        >
          <View />
        </NativeComboBoxPopover>
      </NativeComboBoxPopoverContext.Provider>,
    ),
  )
  await f.ready(395)
  expect(values.mock.calls.at(-1)?.[0].placement).toBe(expected)
  expect(screen.getByTestId("popup", hidden)).toHaveStyle({ marginTop })
})

it("clears exactly the five source field contexts while retaining actual list/state ownership", async () => {
  const f = setup()
  let original!: React.ContextType<typeof NativeComboBoxStateContext>,
    captured: unknown[] = []
  const Probe = () => {
    captured = [
      useContext(NativeComboBoxLabelContext),
      useContext(NativeComboBoxButtonContext),
      useContext(NativeComboBoxInputContext),
      useContext(NativeComboBoxGroupContext),
      useContext(NativeComboBoxTextContext),
      useContext(NativeComboBoxStateContext),
    ]
    return <View />
  }
  const Harness = () => {
    const state = useComboBoxState({ collection: collection() })
    original = state
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxLabelContext.Provider value={{ nativeID: "label" }}>
          <NativeComboBoxButtonContext.Provider value={{ testID: "button" }}>
            <NativeComboBoxInputContext.Provider value={{ nativeID: "input" }}>
              <NativeComboBoxGroupContext.Provider value={{ isInvalid: true }}>
                <NativeComboBoxTextContext.Provider value={{ nativeID: "text" }}>
                  <NativeComboBoxPopoverContext.Provider
                    value={{
                      ref: f.popup,
                      triggerRef: f.anchor,
                      isOpen: true,
                      isNonModal: true,
                      clearContexts: NATIVE_COMBO_BOX_POPOVER_CONTEXTS,
                    }}
                  >
                    <NativeComboBoxPopover testID="popup">
                      <Probe />
                    </NativeComboBoxPopover>
                  </NativeComboBoxPopoverContext.Provider>
                </NativeComboBoxTextContext.Provider>
              </NativeComboBoxGroupContext.Provider>
            </NativeComboBoxInputContext.Provider>
          </NativeComboBoxButtonContext.Provider>
        </NativeComboBoxLabelContext.Provider>
      </NativeComboBoxStateContext.Provider>
    )
  }
  await render(f.wrap(<Harness />))
  await f.ready()
  expect(captured.slice(0, 5)).toEqual([null, null, null, null, null])
  expect(captured[5] === original).toBe(true)
})

it("merges contextual and caller close callbacks once and leaves original popup ownership controlled", async () => {
  const f = setup(),
    context = jest.fn(),
    caller = jest.fn()
  await render(
    f.wrap(
      <NativeComboBoxPopoverContext.Provider
        value={{ ref: f.popup, triggerRef: f.anchor, isOpen: true, isNonModal: true, onOpenChange: context }}
      >
        <NativeComboBoxPopover testID="popup" onOpenChange={caller}>
          <View />
        </NativeComboBoxPopover>
      </NativeComboBoxPopoverContext.Provider>,
    ),
  )
  await f.ready()
  await act(() => screen.getByTestId("popup", hidden).props.onAccessibilityEscape())
  expect(context.mock.calls).toEqual([[false]])
  expect(caller.mock.calls).toEqual([[false]])
  expect(screen.getByTestId("popup", hidden)).toBeOnTheScreen()
})

it("does not call visible style/children/render callbacks while a normal popup is closed", async () => {
  const f = setup(),
    style = jest.fn(() => ({})),
    children = jest.fn(() => <View />),
    renderHost = jest.fn((props) => <NativeFocusHost {...props} />)
  await render(
    f.wrap(
      <NativeComboBoxPopover triggerRef={f.anchor} isOpen={false} style={style} render={renderHost}>
        {children}
      </NativeComboBoxPopover>,
    ),
  )
  expect(style).not.toHaveBeenCalled()
  expect(children).not.toHaveBeenCalled()
  expect(renderHost).not.toHaveBeenCalled()
})
