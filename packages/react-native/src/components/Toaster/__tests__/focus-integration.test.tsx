import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import * as RN from "react-native"
import { findNodeHandle } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { getNativeFocusedTarget, getNativePreviousFocusTarget } from "../../../input/focus"
import * as focusRegistry from "../../../input/focus"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeOverlayProvider, OverlayRegistryContext } from "../../../overlays/NativeOverlayProvider"
import { toast, ToasterObserver } from "../stateManagement"
import { Toaster } from "../Toaster"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const tag = (target: RN.View | RN.TextInput | null) => findNodeHandle(target)
const focusEvent = (id: string, target: RN.View | RN.TextInput, isFocused: boolean) => ({
  nativeEvent: {
    ownerId: row(id).props.ownerId,
    target: tag(target),
    isFocused,
    isFocusVisible: true,
    origin: "keyboard",
    timestamp: 100,
  },
})
const observe = async (id: string, target: RN.View | RN.TextInput, isFocused = true) => {
  await act(() => row(id).props.onNativeFocusChange(focusEvent(id, target, isFocused)))
}
const bubble = async (target: RN.View | RN.TextInput) =>
  fireEvent(row("toaster"), "focus", { nativeEvent: { target: tag(target) } })
const handshake = async (epoch = 1) => {
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "focus-window",
          epoch,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
}
const expand = async (target: RN.View | RN.TextInput) => {
  const host = row("host").props
  const policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes("0100:e"))
  expect(policy).toBeDefined()
  await act(() =>
    host.onNativeScopedKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        windowId: "focus-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        target: 17,
        focusedTarget: tag(target),
        key: "e",
        phase: "down",
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        nativeDefaultHandled: true,
        nativeCode: 33,
        timestamp: 100,
      },
    }),
  )
  const calls = jest.mocked(Commands.requestKeyboardFocus).mock.calls
  return calls[calls.length - 1][0] as RN.View
}
const enter = async (prior: RN.View, stack: RN.View) => {
  await observe("prior", prior, false)
  await observe("toaster-stack-top-right", stack)
  await bubble(stack)
}
beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(RN.AppState, "currentState", { configurable: true, get: () => "active" })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(async () => {
  await cleanup()
  ToasterObserver.dismiss()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("CAP.toaster.006 restores the actual prior ref after acknowledged entry and internal child handoff", async () => {
  const prior = createRef<RN.View>(),
    outside = createRef<RN.View>(),
    child = createRef<RN.View>(),
    caller = jest.fn()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeFocusView ref={prior} testID="prior" onFocus={caller} />
        <NativeFocusView ref={outside} testID="outside" />
        <Toaster />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  await act(() => {
    toast({
      id: 0,
      duration: "persistent",
      ToastIcon: <NativeFocusView ref={child} testID="child" style={{ width: 20, height: 20 }} />,
    })
  })
  await handshake()
  await observe("prior", prior.current!)
  const stack = await expand(prior.current!)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  await enter(prior.current!, stack)
  await observe("toaster-stack-top-right", stack, false)
  await observe("child", child.current!)
  await bubble(child.current!)
  await act(() => jest.advanceTimersByTime(20))
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  await observe("child", child.current!, false)
  await observe("outside", outside.current!)
  await fireEvent(row("toaster"), "blur", { nativeEvent: { target: tag(child.current) } })
  await act(() => jest.advanceTimersByTime(20))
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(prior.current, row("prior").props.ownerId)
  expect(caller).toHaveBeenCalledTimes(1)
  await observe("prior", prior.current!)
  expect(caller).toHaveBeenCalledTimes(2)
})
it("NATIVE.toaster.focus.009 captures registered pointer entry and restores on last-toast retirement", async () => {
  const prior = createRef<RN.View>(),
    child = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeFocusView ref={prior} testID="prior" />
        <Toaster />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  await act(() => {
    toast({ id: "", duration: "persistent", ToastIcon: <NativeFocusView ref={child} testID="pointer-child" /> })
  })
  await handshake()
  await observe("prior", prior.current!)
  await act(() => row("toaster").props.onTouchStartCapture({ nativeEvent: { target: 17 } }))
  await observe("prior", prior.current!, false)
  await observe("pointer-child", child.current!)
  await bubble(child.current!)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await act(() => ToasterObserver.dismiss(""))
  await act(() => jest.advanceTimersByTime(300))
  expect(screen.queryByTestId("toaster")).toBeNull()
  await act(() => jest.advanceTimersByTime(20))
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(prior.current, row("prior").props.ownerId)
})
it("NATIVE.toaster.focus.010 invalidates pending restoration when the native window epoch changes", async () => {
  const prior = createRef<RN.View>(),
    outside = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeFocusView ref={prior} testID="prior" />
        <NativeFocusView ref={outside} testID="outside" />
        <Toaster />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  await act(() => {
    toast({ id: 0, duration: "persistent" })
  })
  await handshake()
  await observe("prior", prior.current!)
  const stack = await expand(prior.current!)
  await enter(prior.current!, stack)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await observe("toaster-stack-top-right", stack, false)
  await observe("outside", outside.current!)
  await handshake(2)
  await act(() => jest.advanceTimersByTime(30))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.011 preserves a controlled raw TextInput and uses its unchanged focus method on Toaster-only unmount", async () => {
  const editor = createRef<RN.TextInput>(),
    onChangeText = jest.fn()
  const capture = jest.spyOn(focusRegistry, "captureNativeFocusTarget")
  const node = (show: boolean) => (
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <RN.TextInput ref={editor} value="held" onChangeText={onChangeText} testID="editor" />
        {show ? <Toaster /> : null}
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
  const { rerender } = await render(node(true))
  await act(() => {
    toast({ id: 0, duration: "persistent" })
  })
  await handshake()
  const target = editor.current!
  await fireEvent(row("editor"), "focus", { nativeEvent: { target: tag(target) } })
  expect(getNativeFocusedTarget()).toBe(target)
  expect(tag(target)).toBeGreaterThan(0)
  const restore = jest.spyOn(target, "focus")
  const write = jest.spyOn(target, "setNativeProps")
  const stack = await expand(target)
  expect(capture).toHaveBeenCalledWith(target)
  expect(capture.mock.results.at(-1)?.value?.()).toBe(true)
  await fireEvent(row("editor"), "blur", { nativeEvent: { target: tag(target) } })
  await observe("toaster-stack-top-right", stack)
  await bubble(stack)
  expect(getNativeFocusedTarget()).toBe(stack)
  await rerender(node(false))
  expect(restore).toHaveBeenCalledTimes(1)
  expect(write).not.toHaveBeenCalled()
  expect(row("editor").props.value).toBe("held")
  expect(onChangeText).not.toHaveBeenCalled()
})

it("NATIVE.toaster.focus.014 retires the observed host on native window loss and awaits a new acknowledgment", async () => {
  const prior = createRef<RN.View>(),
    caller = jest.fn()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeFocusView ref={prior} testID="prior" onFocus={caller} />
        <Toaster />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  await handshake()
  await observe("prior", prior.current!)
  expect(getNativeFocusedTarget()).toBe(prior.current)
  const host = row("host").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "focus-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  expect(getNativeFocusedTarget()).toBeNull()
  expect(getNativePreviousFocusTarget()).toBeNull()
  await handshake()
  expect(getNativeFocusedTarget()).toBeNull()
  expect(getNativePreviousFocusTarget()).toBeNull()
  expect(caller).toHaveBeenCalledTimes(1)
  await observe("prior", prior.current!)
  expect(getNativeFocusedTarget()).toBe(prior.current)
  expect(caller).toHaveBeenCalledTimes(2)
})

it("NATIVE.toaster.focus.015 a native Modal branch takeover retires pending restore even if it closes before the frame", async () => {
  const prior = createRef<RN.View>(),
    outside = createRef<RN.View>()
  let overlays: React.ContextType<typeof OverlayRegistryContext> = null
  const Probe = () => {
    overlays = useContext(OverlayRegistryContext)
    return null
  }
  await render(
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <Probe />
        <NativeFloatingLayerHost testID="host">
          <NativeFocusView ref={prior} testID="prior" />
          <NativeFocusView ref={outside} testID="outside" />
          <Toaster />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>,
  )
  await act(() => {
    toast({ id: 0, duration: "persistent" })
  })
  await handshake()
  await observe("prior", prior.current!)
  const stack = await expand(prior.current!)
  await enter(prior.current!, stack)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await observe("toaster-stack-top-right", stack, false)
  await observe("outside", outside.current!)
  await act(() => {
    overlays!.register("modal", null, false, true)
    overlays!.shown("modal")
    overlays!.request("modal", false)
    overlays!.dismissed("modal")
  })
  await act(() => jest.advanceTimersByTime(30))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.016 whole-window unmount never restores into the retiring native host", async () => {
  const prior = createRef<RN.View>()
  const { unmount } = await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <Toaster />
        <NativeFocusView ref={prior} testID="prior" />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  await act(() => {
    toast({ id: 0, duration: "persistent" })
  })
  await handshake()
  await observe("prior", prior.current!)
  const stack = await expand(prior.current!)
  await enter(prior.current!, stack)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await unmount()
  await act(() => jest.advanceTimersByTime(30))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
