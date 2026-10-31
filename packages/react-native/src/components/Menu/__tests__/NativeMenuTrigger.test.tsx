import "../../../collection/__tests__/nativeReceipts"
import { createRef } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { Button } from "../../Button/Button"
import { Menu } from "../Menu"
import { MenuItem } from "../MenuItem"
import { NativeMenuTrigger, type TNativeMenuTriggerState, type TNativeMenuTriggerMode } from "../NativeMenuTrigger"
import { nativeMenuTriggerMessages } from "../triggerMessages"

const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const setup = (mode: TNativeMenuTriggerMode = "press", controlled = false) => {
  let state!: TNativeMenuTriggerState
  const changed = jest.fn(),
    host = createRef<RN.View>()
  const node = (nextMode = mode, disabled = false) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={host} testID="host">
          <NativeMenuTrigger
            triggerMode={nextMode}
            locale="fr-FR"
            isDisabled={disabled}
            isOpen={controlled ? false : undefined}
            onOpenChange={changed}
            trigger={(value) => {
              state = value
              return (
                <Button {...value.triggerProps} testID="trigger">
                  Open actions
                </Button>
              )
            }}
          >
            <Menu isNonModal>
              <MenuItem id="a">Alpha</MenuItem>
            </Menu>
          </NativeMenuTrigger>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  return { node, changed, state: () => state }
}
const gesture = () => ({
  target: 17,
  currentTarget: 17,
  persist: jest.fn(),
  isDefaultPrevented: () => false,
  nativeEvent: { target: 17, timestamp: 0, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
})
const start = async (type: "mouse" | "touch" | "pen") => {
  const target = row("trigger").props,
    event = gesture()
  await act(() =>
    target.onPointerDown({
      nativeEvent: { pointerType: type, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
      isDefaultPrevented: () => false,
    }),
  )
  await act(() => target.onResponderGrant(event))
  return { event, target }
}
const finish = async (record: Awaited<ReturnType<typeof start>>) =>
  act(() => record.target.onResponderRelease(record.event))

it.each(["mouse", "pen"] as const)(
  "opens %s on original press start and keeps release from toggling again",
  async (type) => {
    const f = setup()
    await render(f.node())
    const ref = f.state().triggerRef.current
    const held = await start(type)
    expect(f.state().isOpen).toBe(true)
    expect(f.changed.mock.calls).toEqual([[true]])
    await finish(held)
    expect(f.changed.mock.calls).toEqual([[true]])
    expect(f.state().triggerRef.current === ref).toBe(true)
  },
)
it("opens a touch trigger only on its original release", async () => {
  const f = setup()
  await render(f.node())
  const held = await start("touch")
  expect(f.state().isOpen).toBe(false)
  await finish(held)
  expect(f.state().isOpen).toBe(true)
  expect(f.changed.mock.calls).toEqual([[true]])
})
it("uses the native 500ms long-press threshold and preserves the localized description", async () => {
  const f = setup("longPress")
  await render(f.node())
  expect(row("trigger").props.accessibilityHint).toBe(nativeMenuTriggerMessages["fr-FR"])
  const held = await start("mouse")
  await act(() => jest.advanceTimersByTime(499))
  expect(f.state().isOpen).toBe(false)
  await act(() => jest.advanceTimersByTime(1))
  expect(f.state().isOpen).toBe(true)
  await finish(held)
  expect(f.changed.mock.calls).toEqual([[true]])
})
it.each(["disabled", "mode", "window"] as const)("retires a held trigger on %s replacement", async (reason) => {
  const f = setup("longPress")
  await render(f.node())
  await start("touch")
  if (reason === "disabled") await act(() => screen.rerender(f.node("longPress", true)))
  else if (reason === "mode") await act(() => screen.rerender(f.node("press")))
  else {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "retired-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: false,
          windowActive: false,
        },
      }),
    )
  }
  await act(() => jest.advanceTimersByTime(1000))
  expect(f.changed).not.toHaveBeenCalled()
  expect(f.state().isOpen).toBe(false)
})
it("captures only Alt arrows in long-press mode and repeats current owner-vetoed arrow requests", async () => {
  const f = setup("longPress", true)
  await render(f.node())
  expect(
    row("host").props.policies.some((policy: { tokens: string[] }) => policy.tokens.includes("0000:ArrowDown")),
  ).toBe(false)
  const send = async (key: string, altKey: boolean, repeat = false) => {
    const target = row("trigger").props
    await act(() =>
      target.onNativeKey({
        nativeEvent: {
          kind: "keyboard",
          ownerId: target.ownerId,
          target: 17,
          key,
          phase: "down",
          repeat,
          cancelled: false,
          nativeDefaultHandled: true,
          altKey,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
          capsLock: false,
          nativeCode: 40,
          nativeModifierData: "0",
          timestamp: 0,
        },
        preventDefault: jest.fn(),
        isDefaultPrevented: () => false,
        persist: jest.fn(),
      }),
    )
  }
  await send("Enter", false)
  await send("ArrowDown", false)
  expect(f.changed).not.toHaveBeenCalled()
  await send("ArrowDown", true)
  await send("ArrowDown", true, true)
  expect(f.changed.mock.calls).toEqual([[true], [true]])
  expect(f.state().isOpen).toBe(false)
})

it("does not let a terminal held cycle reopen later and removes the disabled description", async () => {
  const f = setup("longPress")
  await render(f.node())
  const held = await start("touch")
  await finish(held)
  await act(() => f.state().triggerProps.onLongPress?.(held.event as unknown as RN.GestureResponderEvent))
  expect(f.changed).not.toHaveBeenCalled()
  await act(() => screen.rerender(f.node("longPress", true)))
  expect(row("trigger").props.accessibilityHint).toBeUndefined()
})
