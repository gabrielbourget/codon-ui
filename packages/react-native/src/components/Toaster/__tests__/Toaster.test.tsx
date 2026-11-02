import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ComponentPropsWithRef } from "react"
import * as RN from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { NativeFocusView } from "../../../input/NativeFocusView"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardEvent } from "../../../input/types"
import { toast, ToasterObserver } from "../stateManagement"
import { Toaster } from "../Toaster"
import { AVAILABLE_TOAST_POSITIONS, type TNativeExternalToast, type TNativeToasterProps } from "../types"

import { acknowledgeToasterKeyboard, observeToasterKey } from "./keyboardPackets"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext({ top: 10, bottom: 12, left: 0, right: 0 }),
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const root = () => row("toaster")
const stack = () => row("toaster-stack-top-right")
const advance = async (time: number) => act(() => jest.advanceTimersByTime(time))
const publish = async (...toasts: TNativeExternalToast[]) =>
  act(() => {
    for (const payload of toasts) toast({ duration: "persistent", ...payload })
  })
const node = (props: ComponentPropsWithRef<typeof Toaster> = {}) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost testID="host">
      <Toaster {...props} />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
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

it("CAP.toaster.002/.012 stays absent when empty, forwards the actual native ref and consumes root aliases", async () => {
  const ref = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost>
        <Toaster
          ref={ref}
          accessibilityLabel=""
          ariaLabel="Alias"
          customRootStyles={{ marginTop: 5 }}
          style={{ marginBottom: 10 }}
          nativeID="notifications"
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  expect(screen.queryByTestId("toaster")).toBeNull()
  await publish({ id: 0, titleText: "Original" })
  expect(root().props.accessibilityLabel).toBe(" - alt+E")
  expect(root().props.nativeID).toBe("notifications")
  expect(root()).toHaveStyle({ marginTop: 5, marginBottom: 10 })
  expect(typeof ref.current?.measureInWindow).toBe("function")
  expect(root().props.ariaLabel).toBeUndefined()
  expect(root().props.customRootStyles).toBeUndefined()
  expect(screen.getByText("Original")).toBeOnTheScreen()
})
it("CAP.toaster.003 root duration retires the rendered toast after its own deadline", async () => {
  await render(node({ duration: 10 }))
  await act(() => {
    toast({ id: "timed" })
  })
  await advance(9)
  expect(row("toast-string-timed").props.pointerEvents).toBe("auto")
  await advance(1)
  expect(row("toast-string-timed").props.pointerEvents).toBe("none")
  await advance(250)
  expect(screen.queryByTestId("toaster")).toBeNull()
})
it.each(AVAILABLE_TOAST_POSITIONS)("CAP.toaster.004 positions %s with safe-area offsets", async (position) => {
  await render(node({ position, offset: 30 }))
  await publish({ id: 0 })
  const [vertical, horizontal] = position.split("-")
  expect(row(`toaster-stack-${position}`)).toHaveStyle({ [vertical]: 30 })
  expect(row(`toaster-stack-${position}`)).toHaveStyle(horizontal === "center" ? { left: "50%" } : { [horizontal]: 30 })
})
it("CAP.toaster.001 held pointer expansion, cancelable collapse and bridge re-entry use current state", async () => {
  await render(node())
  await publish({ id: 0 }, { id: "" })
  const current = () => row("toast-number-0")
  const scale = () => RN.StyleSheet.flatten(current().props.style).transform[1].scale
  await fireEvent(stack(), "pointerEnter", {})
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerDown", {})
  await fireEvent(stack(), "pointerLeave", {})
  await advance(150)
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerUp", {})
  await fireEvent(stack(), "pointerLeave", {})
  await advance(60)
  await fireEvent(row("toaster-bridge-number:0"), "pointerEnter", {})
  await advance(150)
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerLeave", {})
  await advance(120)
  expect(scale()).toBe(0.95)
})
it("CAP.toaster.007/.008 renders expanded-by-default independently and hides overflow from hit testing/accessibility", async () => {
  await render(node({ expandByDefault: true, maxVisibleToasts: 1 }))
  await publish({ id: 0 }, { id: "" })
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  expect(row("toast-number-0").props.accessibilityElementsHidden).toBe(true)
  expect(row("toast-string-").props.pointerEvents).toBe("auto")
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 1 })
})
it("CAP.toaster.009/.010/.011/.013 keeps zero gap/offset and all root/stack/bridge owners independent", async () => {
  await render(
    node({
      toastGap: 0,
      offset: 0,
      customRootStyles: { marginTop: 2 },
      customStyles: { backgroundColor: "red", borderWidth: 1 },
      customStackStyles: { backgroundColor: "gold" },
      customToastBridgeStyles: { backgroundColor: "pink" },
    }),
  )
  await publish({ id: 0 }, { id: "" })
  expect(root()).toHaveStyle({ marginTop: 2 })
  expect(stack()).toHaveStyle({ top: 10, right: 0, backgroundColor: "gold", borderWidth: 1 })
  expect(row("toaster-bridge-number:0")).toHaveStyle({ height: 1, backgroundColor: "pink" })
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[0]).toEqual({ translateY: 0 })
})
it("CAP.toaster.016 updates rendered IDs in place without confusing typed aliases", async () => {
  await render(node())
  await publish({ id: 0, titleText: "Numeric" }, { id: "0", titleText: "String" }, { id: "", titleText: "Empty" })
  await publish({ id: 0, titleText: "Updated", bodyText: "New body" })
  expect(screen.queryByText("Numeric")).toBeNull()
  expect(screen.getByText("Updated")).toBeOnTheScreen()
  expect(screen.getByText("String")).toBeOnTheScreen()
  expect(screen.getByText("Empty")).toBeOnTheScreen()
  expect(screen.getAllByTestId(/^toast-(number|string)-/, { includeHiddenElements: true })).toHaveLength(3)
})
it("CAP.toaster.017 preserves same-turn publish/dismiss ordering and 250ms programmatic retirement", async () => {
  await render(node())
  const onDismiss = jest.fn()
  await act(() => {
    toast({ id: 0, duration: "persistent", onDismiss })
    ToasterObserver.dismiss(0)
  })
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  await advance(249)
  expect(row("toast-number-0")).toBeOnTheScreen()
  await advance(1)
  expect(screen.queryByTestId("toaster")).toBeNull()
  expect(onDismiss).not.toHaveBeenCalled()
})
it("CAP.toaster.005 native focused dismissal uses current key configuration without invented user callbacks", async () => {
  await render(node({ dismissalHotkey: ["KeyQ"] }))
  const onDismiss = jest.fn()
  await publish({ id: 0, onDismiss })
  await acknowledgeToasterKeyboard()
  const observer = row("host").props.observations.find((entry: { targetTag: number }) => entry.targetTag > 0)
  expect(observer).toBeDefined()
  await observeToasterKey({ key: "a", code: "KeyQ", altKey: false, repeat: true }, observer.targetTag)
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  await advance(250)
  expect(screen.queryByTestId("toaster")).toBeNull()
  expect(onDismiss).not.toHaveBeenCalled()
})
it("CAP.toaster.006 observes physical expand keys and repeats without requesting native capture", async () => {
  await render(node())
  await publish({ id: 0 }, { id: "" })
  await acknowledgeToasterKeyboard()
  expect(row("host").props.policies.some((entry: { tokens: string[] }) => entry.tokens.includes("0100:e"))).toBe(false)
  await observeToasterKey({ key: "e", code: "KeyQ" })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await observeToasterKey()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 1 })
  await observeToasterKey({ repeat: true })
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 0.95 })
})
it.each([{ expandToggleHotkey: [] }, { expandToggleHotkey: ["altKey"] }, { expandToggleHotkey: ["constructor"] }])(
  "keeps the complete hotkey predicate live with an empty queue: %j",
  async ({ expandToggleHotkey }) => {
    await render(node({ expandToggleHotkey }))
    await acknowledgeToasterKeyboard()
    await observeToasterKey()
    await publish({ id: 0 }, { id: "" })
    expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 0.95 })
  },
)
it("NATIVE.toaster.004 unmount retires subscriptions and pending collapse before later publications", async () => {
  const { unmount } = await render(node())
  await publish({ id: 0 }, { id: "" })
  await fireEvent(stack(), "pointerEnter", {})
  await fireEvent(stack(), "pointerLeave", {})
  await unmount()
  await advance(1000)
  await publish({ id: "later" })
  expect(screen.queryByTestId("toaster")).toBeNull()
})
it("CAP.toaster.012 maps native relationship aliases, localized captions and explicit empty IDs", async () => {
  const { rerender } = await render(
    node({
      ariaLabelledBy: " heading\tsection ",
      ariaDescribedBy: "summary explanation",
      ariaDetails: "full-details",
      labels: { descriptionLabel: "Résumé", detailsLabel: "Détails" },
    }),
  )
  await publish({ id: 0 })
  expect(root().props).toMatchObject({
    nativeLabelledBy: ["heading", "section"],
    nativeDescribedBy: ["summary", "explanation"],
    nativeDetailsBy: ["full-details"],
    nativeDescriptionLabel: "Résumé",
    nativeDetailsLabel: "Détails",
  })
  expect(root().props.ariaLabelledBy).toBeUndefined()
  expect(root().props.ariaDescribedBy).toBeUndefined()
  expect(root().props.ariaDetails).toBeUndefined()
  expect(root().props.labels).toBeUndefined()
  await rerender(node({ "aria-labelledby": "", ariaLabelledBy: "ignored", "aria-describedby": "", "aria-details": "" }))
  expect(root().props).toMatchObject({ nativeLabelledBy: [], nativeDescribedBy: [], nativeDetailsBy: [] })
  await rerender(
    node({ accessibilityLabelledBy: ["native-a", "native-b"], "aria-labelledby": "aria", ariaLabelledBy: "alias" }),
  )
  expect(root().props.nativeLabelledBy).toEqual(["native-a", "native-b"])
})

it("CAP.toaster.root-capture preserves authored touch capture and current native root identity", async () => {
  const ref = createRef<RN.View>()
  const first = jest.fn()
  const current = jest.fn()
  const props = (onTouchStartCapture: RN.ViewProps["onTouchStart"]) => ({ ref, onTouchStartCapture })
  const view = await render(node(props(first)))
  await publish({ id: "capture", titleText: "Held" })
  const originalHost = root()
  const originalRef = ref.current
  const event = { nativeEvent: { target: 17, identifier: 3 }, target: 17, currentTarget: 17 }
  await act(() => originalHost.props.onTouchStartCapture(event))
  expect(first.mock.calls).toEqual([[event]])
  expect(first.mock.calls[0][0]).toBe(event)
  await view.rerender(node(props(current)))
  const next = { nativeEvent: { target: 18, identifier: 4 }, target: 18, currentTarget: 18 }
  await act(() => root().props.onTouchStartCapture(next))
  expect(first).toHaveBeenCalledTimes(1)
  expect(current.mock.calls).toEqual([[next]])
  expect(current.mock.calls[0][0]).toBe(next)
  expect(root()).toBe(originalHost)
  expect(ref.current).toBe(originalRef)
  expect(screen.getByText("Held")).toBeOnTheScreen()
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("CAP.toaster.root-events forwards stock native event slots on the original host", async () => {
  const fields = [
    "onTouchStartCapture",
    "onTouchMoveCapture",
    "onTouchCancelCapture",
    "onClick",
    "onClickCapture",
    "onPointerOver",
    "onPointerOverCapture",
    "onPointerOut",
    "onPointerOutCapture",
    "onGotPointerCapture",
    "onGotPointerCaptureCapture",
    "onLostPointerCapture",
    "onLostPointerCaptureCapture",
  ] as const satisfies readonly (keyof TNativeToasterProps)[]
  const callbacks = Object.fromEntries(fields.map((key) => [key, jest.fn()]))
  const ref = createRef<RN.View>()
  await render(node({ ...callbacks, ref }))
  await publish({ id: "events" })
  const original = ref.current
  for (const field of fields) {
    const event = { nativeEvent: { target: "17", identifier: "3", pointerId: 7, pointerType: "mouse" } }
    await act(() => root().props[field](event))
    expect(callbacks[field].mock.calls).toEqual([[event]])
    expect(callbacks[field].mock.calls[0][0]).toBe(event)
    expect(ref.current).toBe(original)
  }
})

it("CAP.toaster.root-focus forwards original focus phases without promising direct-owner metadata", async () => {
  const ref = createRef<RN.View>()
  const first = { onFocus: jest.fn(), onBlur: jest.fn(), onFocusCapture: jest.fn(), onBlurCapture: jest.fn() }
  const current = { onFocus: jest.fn(), onBlur: jest.fn(), onFocusCapture: jest.fn(), onBlurCapture: jest.fn() }
  const view = await render(node({ ...first, ref }))
  await publish({ id: "focus-phases", titleText: "Original focus" })
  const original = ref.current
  const fields = ["onFocusCapture", "onFocus", "onBlurCapture", "onBlur"] as const
  for (const field of fields) {
    const event = { nativeEvent: { target: 17 }, target: 17, currentTarget: 23 }
    await act(() => root().props[field](event))
    expect(first[field].mock.calls).toEqual([[event]])
    expect(first[field].mock.calls[0][0]).toBe(event)
  }
  await view.rerender(node({ ...current, ref }))
  for (const field of fields) {
    const event = { nativeEvent: { target: 18 }, target: 18, currentTarget: 23 }
    await act(() => root().props[field](event))
    expect(first[field]).toHaveBeenCalledTimes(1)
    expect(current[field].mock.calls).toEqual([[event]])
    expect(current[field].mock.calls[0][0]).toBe(event)
    expect(ref.current).toBe(original)
  }
  expect(screen.getByText("Original focus")).toBeOnTheScreen()
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("CAP.toaster.root-keys observes original descendant phases without taking native defaults or changing editor refs", async () => {
  const known = new WeakMap<object, number>()
  let serial = 10000
  const previousFind = RN.findNodeHandle
  jest.spyOn(RN, "findNodeHandle").mockImplementation((target) => {
    const native = previousFind(target)
    if (native != null && native > 0) return native
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!known.has(target)) known.set(target, ++serial)
    return known.get(target)!
  })
  const ref = createRef<RN.View>()
  const editor = createRef<RN.TextInput>()
  const changes = jest.fn()
  const order: string[] = []
  const captureDown = jest.fn((_event: TNativeKeyboardEvent) => order.push("capture-down"))
  const down = jest.fn((_event: TNativeKeyboardEvent) => order.push("down"))
  const currentDown = jest.fn((_event: TNativeKeyboardEvent) => order.push("current-down"))
  const captureUp = jest.fn((_event: TNativeKeyboardEvent) => order.push("capture-up"))
  const up = jest.fn((_event: TNativeKeyboardEvent) => order.push("up"))
  const props = { ref, onKeyDownCapture: captureDown, onKeyDown: down, onKeyUpCapture: captureUp, onKeyUp: up }
  const view = await render(node(props))
  await publish({
    id: "root-keys",
    ToastIcon: <RN.TextInput ref={editor} testID="root-key-editor" value="held" onChangeText={changes} />,
  })
  await acknowledgeToasterKeyboard()
  const original = ref.current!
  const originalEditor = editor.current
  const host = row("host").props
  expect(host).toMatchObject({ acceptedWindowId: "toaster-window", acceptedEpoch: 1 })
  expect(originalEditor).not.toBeNull()
  const binding = host.ordinaryEditorBindings.find(
    (entry: { targetTag: number }) => entry.targetTag === RN.findNodeHandle(original),
  )
  expect(binding).toBeDefined()
  await act(() =>
    host.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        target: binding.targetTag,
        ownerId: host.ownerId,
        windowId: host.acceptedWindowId,
        epoch: host.acceptedEpoch,
        sequence: 1,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
  const event = (phase: "down" | "up", eventId: number) => ({
    target: originalEditor,
    currentTarget: original,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...binding,
      ownerId: host.ownerId,
      observerBindings: JSON.stringify([binding]),
      target: RN.findNodeHandle(originalEditor),
      windowId: host.acceptedWindowId,
      epoch: host.acceptedEpoch,
      kind: "keyboard",
      key: "q",
      code: "KeyQ",
      nativeCode: 45,
      location: 0,
      characters: "q",
      phase,
      eventId,
      repeat: false,
      cancelled: false,
      isComposing: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: false,
      timestamp: 100,
    },
  })
  const dispatch = async (originalEvent: ReturnType<typeof event>) =>
    act(() => {
      root().props.onNativeOrdinaryEditorKeyCapture(originalEvent)
      root().props.onNativeOrdinaryEditorKey(originalEvent)
    })
  const first = event("down", 1)
  await dispatch(first)
  const release = event("up", 2)
  await dispatch(release)
  expect(first.persist).toHaveBeenCalled()
  expect(order).toEqual(["capture-down", "down", "capture-up", "up"])
  expect(captureDown.mock.calls[0]).toEqual([first])
  expect(down.mock.calls[0][0]).toBe(first)
  expect(captureUp.mock.calls[0][0]).toBe(release)
  expect(up.mock.calls[0][0]).toBe(release)
  expect(first.preventDefault).not.toHaveBeenCalled()
  expect(first.stopPropagation).not.toHaveBeenCalled()
  await view.rerender(node({ ...props, onKeyDown: currentDown }))
  const next = event("down", 3)
  await dispatch(next)
  expect(down).toHaveBeenCalledTimes(1)
  expect(currentDown.mock.calls[0][0]).toBe(next)
  const stale = event("down", 4)
  stale.nativeEvent.observerBindings = JSON.stringify([{ ...binding, bindingRevision: "retired" }])
  await dispatch(stale)
  expect(currentDown).toHaveBeenCalledTimes(1)
  const wrongRoot = { ...event("down", 5), currentTarget: originalEditor }
  await dispatch(wrongRoot as ReturnType<typeof event>)
  expect(currentDown).toHaveBeenCalledTimes(1)
  expect(ref.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  expect(row("root-key-editor").props.value).toBe("held")
  expect(changes).not.toHaveBeenCalled()
  // Source transport through the existing date-key slot; native date delivery is a separate obligation.
  const date = event("down", 6)
  await act(() => {
    root().props.onNativeDateKeyCapture(date)
    root().props.onNativeDateKey(date)
  })
  expect(captureDown.mock.calls.at(-1)?.[0]).toBe(date)
  expect(currentDown.mock.calls.at(-1)?.[0]).toBe(date)
  expect(currentDown).toHaveBeenCalledTimes(2)
  const independentSegmentEpoch = event("down", 7)
  independentSegmentEpoch.nativeEvent.epoch = host.acceptedEpoch + 11
  await act(() => {
    root().props.onNativeDateKeyCapture(independentSegmentEpoch)
    root().props.onNativeDateKey(independentSegmentEpoch)
  })
  expect(Object.is(currentDown.mock.calls.at(-1)?.[0], independentSegmentEpoch)).toBe(true)
  expect(currentDown).toHaveBeenCalledTimes(3)
  const invalidSegmentEpoch = event("down", 8)
  invalidSegmentEpoch.nativeEvent.epoch = 0
  await act(() => {
    root().props.onNativeDateKeyCapture(invalidSegmentEpoch)
    root().props.onNativeDateKey(invalidSegmentEpoch)
  })
  const retiredWindow = event("down", 9)
  retiredWindow.nativeEvent.windowId = "retired-window"
  await act(() => {
    root().props.onNativeDateKeyCapture(retiredWindow)
    root().props.onNativeDateKey(retiredWindow)
  })
  expect(currentDown).toHaveBeenCalledTimes(3)
  const savedCapture = root().props.onNativeOrdinaryEditorKeyCapture
  const savedBubble = root().props.onNativeOrdinaryEditorKey
  await view.unmount()
  await act(() => {
    savedCapture(event("down", 10))
    savedBubble(event("down", 10))
  })
  expect(currentDown).toHaveBeenCalledTimes(3)
  expect(ref.current).toBeNull()
  expect(editor.current).toBeNull()
})

it("CAP.toaster.root-ref preserves caller cleanup on the unchanged keyboard-observed host", async () => {
  const cleanupRef = jest.fn()
  const receiveRef = jest.fn((_target: RN.View | null) => cleanupRef)
  const view = await render(node({ ref: receiveRef, onKeyDown: jest.fn() }))
  await publish({ id: "callback-ref" })
  expect(receiveRef).toHaveBeenCalledTimes(1)
  expect(typeof receiveRef.mock.calls[0][0]!.measureInWindow).toBe("function")
  await view.rerender(node({ ref: receiveRef, onKeyDown: jest.fn() }))
  expect(receiveRef).toHaveBeenCalledTimes(1)
  expect(cleanupRef).not.toHaveBeenCalled()
  await view.unmount()
  expect(cleanupRef).toHaveBeenCalledTimes(1)
  expect(receiveRef).toHaveBeenCalledTimes(1)
})

it("CAP.toaster.root-modal maps the existing iOS alias without replacing authored native precedence", async () => {
  const view = await render(node({ "aria-modal": true }))
  await publish({ id: "modal-alias" })
  expect(root().props.accessibilityViewIsModal).toBe(true)
  expect(root().props["aria-modal"]).toBeUndefined()
  await view.rerender(node({ "aria-modal": true, accessibilityViewIsModal: false }))
  expect(root().props.accessibilityViewIsModal).toBe(false)
})

it("CAP.toaster.root-region preserves the named landmark and localized prose with original child actions", async () => {
  const ref = createRef<RN.View>()
  const view = await render(node({ ref, labels: { descriptionLabel: "Description", detailsLabel: "Details" } }))
  await publish({ id: "region" })
  const original = ref.current
  expect(root().props.role).toBe("region")
  expect(root().props.nativeNavigation).toBe(true)
  expect(root().props.nativeNavigationLabel).toBe("Region")
  expect(root().props.accessible).toBe(false)
  expect(screen.getByRole("button", { name: "Close Toast" })).toBeOnTheScreen()
  await view.rerender(
    node({
      ref,
      labels: {
        regionRoleDescription: "Zone des notifications",
        descriptionLabel: "Description",
        detailsLabel: "Details",
      },
    }),
  )
  expect(root().props.nativeNavigationLabel).toBe("Zone des notifications")
  expect(root().props.nativeDescriptionLabel).toBe("Description")
  expect(root().props.nativeDetailsLabel).toBe("Details")
  await view.rerender(node({ ref, labels: { regionRoleDescription: "" } }))
  expect(root().props.nativeNavigationLabel).toBe("")
  expect(ref.current).toBe(original)
})

it("CAP.toaster.root-role preserves caller overrides and common native accessibility", async () => {
  const ref = createRef<RN.View>()
  const action = jest.fn()
  const actions = [{ name: "activate", label: "Inspect" }]
  const common = {
    ref,
    accessibilityState: { disabled: false, selected: true },
    accessibilityValue: { text: "Ready" },
    accessibilityActions: actions,
    onAccessibilityAction: action,
    "aria-live": "polite" as const,
  }
  const view = await render(node({ ...common, role: "region" }))
  await publish({ id: "caller-role" })
  const original = ref.current
  for (const role of ["none", "presentation", "button", "navigation"] as const) {
    await view.rerender(node({ ...common, role }))
    expect(root().props.role).toBe(role)
    expect(root().props.nativeNavigation).toBe(false)
    expect(ref.current).toBe(original)
  }
  await view.rerender(node({ ...common, accessibilityRole: "button" }))
  expect(root().props.role).toBeUndefined()
  expect(root().props.accessibilityRole).toBe("button")
  expect(root().props.nativeNavigation).toBe(false)
  expect(root().props.accessibilityState).toMatchObject({ disabled: false, selected: true })
  expect(root().props.accessibilityValue).toMatchObject({ text: "Ready" })
  expect(root().props.accessibilityLiveRegion).toBe("polite")
  expect(root().props.accessibilityActions).toBe(actions)
  const event = { nativeEvent: { actionName: "activate" } }
  await act(() => root().props.onAccessibilityAction(event))
  expect(action.mock.calls).toEqual([[event]])
  expect(action.mock.calls[0][0]).toBe(event)
})

it("CAP.toaster.root-child-key shares one original packet through capture, child, nonfocusable group and bubble", async () => {
  const ref = createRef<RN.View>(),
    child = createRef<RN.View>(),
    group = createRef<RN.View>()
  const trace: Array<{ receiver: string; event: unknown; target: unknown; current: unknown }> = []
  const receive = (receiver: string) => (event: TNativeKeyboardEvent) =>
    trace.push({ receiver, event, target: event.target, current: event.currentTarget })
  const childKey = jest.fn(receive("child"))
  const view = await render(node({ ref, onKeyDownCapture: receive("capture"), onKeyDown: receive("bubble") }))
  await publish({
    id: "one-key",
    ToastIcon: (
      <NativeFocusView ref={group} testID="key-group" focusable={false} onKeyDown={receive("group")}>
        <NativeFocusView ref={child} testID="key-child" onKeyDown={childKey} />
      </NativeFocusView>
    ),
  })
  await acknowledgeToasterKeyboard()
  const original = ref.current!,
    originalChild = child.current!,
    originalGroup = group.current!
  const host = row("host").props
  const bindings = host.ordinaryEditorBindings
  const targetBinding = bindings.find(
    (entry: { targetTag: number }) => entry.targetTag === RN.findNodeHandle(originalChild),
  )
  const groupBinding = bindings.find(
    (entry: { targetTag: number }) => entry.targetTag === RN.findNodeHandle(originalGroup),
  )
  expect(targetBinding).toBeDefined()
  expect(groupBinding).toMatchObject({ subtree: true })
  for (const binding of bindings)
    await act(() =>
      row("host").props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...binding,
          target: binding.targetTag,
          ownerId: host.ownerId,
          windowId: host.acceptedWindowId,
          epoch: host.acceptedEpoch,
          sequence: 1,
          ready: true,
          windowActive: true,
          error: "",
        },
      }),
    )
  const event = {
    target: originalChild,
    currentTarget: original,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...targetBinding,
      ownerId: host.ownerId,
      observerBindings: JSON.stringify(bindings.filter((entry: { subtree?: boolean }) => entry.subtree)),
      target: RN.findNodeHandle(originalChild),
      windowId: host.acceptedWindowId,
      epoch: host.acceptedEpoch,
      kind: "keyboard",
      key: "q",
      code: "KeyQ",
      nativeCode: 45,
      location: 0,
      characters: "q",
      phase: "down",
      eventId: 1,
      repeat: false,
      cancelled: false,
      isComposing: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: false,
      timestamp: 100,
    },
  }
  const direct = {
    ...event,
    currentTarget: originalChild,
    nativeEvent: { ...event.nativeEvent, ownerId: row("key-child").props.ownerId },
  }
  await act(() => row("key-child").props.onNativeKey(direct))
  expect(childKey).not.toHaveBeenCalled()
  await act(() => {
    root().props.onNativeOrdinaryEditorKeyCapture(event)
    event.currentTarget = originalChild
    row("key-child").props.onNativeOrdinaryEditorKey(event)
    event.currentTarget = originalGroup
    row("key-group").props.onNativeOrdinaryEditorKey(event)
    event.currentTarget = original
    root().props.onNativeOrdinaryEditorKey(event)
  })
  expect(trace.map((entry) => entry.receiver)).toEqual(["capture", "child", "group", "bubble"])
  expect(trace.every((entry) => entry.event === event && entry.target === originalChild)).toBe(true)
  expect(trace.map((entry) => entry.current)).toEqual([original, originalChild, originalGroup, original])
  expect(event.preventDefault).not.toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
  expect(ref.current).toBe(original)
  expect(child.current).toBe(originalChild)
  expect(group.current).toBe(originalGroup)
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(child.current).toBeNull()
  expect(group.current).toBeNull()
})

it("CAP.toaster.root-child-press retains the original native Enter activation under root observation", async () => {
  const ref = createRef<RN.View>(),
    button = createRef<RN.View>()
  const press = jest.fn(),
    capture = jest.fn(),
    bubble = jest.fn()
  const view = await render(node({ ref, onKeyDownCapture: capture, onKeyUp: bubble }))
  await publish({
    id: "observed-button",
    ToastIcon: (
      <Button ref={button} testID="observed-button" onPress={press}>
        Action
      </Button>
    ),
  })
  await acknowledgeToasterKeyboard()
  const original = ref.current!,
    target = button.current!
  const host = row("host").props,
    bindings = host.ordinaryEditorBindings
  const targetBinding = bindings.find((entry: { targetTag: number }) => entry.targetTag === RN.findNodeHandle(target))
  expect(targetBinding).toBeDefined()
  for (const binding of bindings)
    await act(() =>
      row("host").props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...binding,
          target: binding.targetTag,
          ownerId: host.ownerId,
          windowId: host.acceptedWindowId,
          epoch: host.acceptedEpoch,
          sequence: 1,
          ready: true,
          windowActive: true,
          error: "",
        },
      }),
    )
  const event = (phase: "down" | "up", eventId: number) => ({
    target,
    currentTarget: original,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    isPropagationStopped: () => false,
    isDefaultPrevented: () => false,
    nativeEvent: {
      ...targetBinding,
      ownerId: host.ownerId,
      observerBindings: JSON.stringify(bindings.filter((entry: { subtree?: boolean }) => entry.subtree)),
      target: RN.findNodeHandle(target),
      windowId: host.acceptedWindowId,
      epoch: host.acceptedEpoch,
      kind: "keyboard",
      key: "Enter",
      code: "Enter",
      nativeCode: 66,
      location: 0,
      characters: "\n",
      phase,
      eventId,
      repeat: false,
      cancelled: false,
      isComposing: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 100,
    },
  })
  const dispatch = async (packet: ReturnType<typeof event>) =>
    act(() => {
      root().props.onNativeOrdinaryEditorKeyCapture(packet)
      packet.currentTarget = target
      row("observed-button").props.onNativeOrdinaryEditorKey(packet)
      packet.currentTarget = original
      root().props.onNativeOrdinaryEditorKey(packet)
    })
  const down = event("down", 1),
    up = event("up", 2)
  await dispatch(down)
  await dispatch(up)
  expect(capture.mock.calls[0][0]).toBe(down)
  expect(bubble.mock.calls[0][0]).toBe(up)
  expect(press).toHaveBeenCalledTimes(1)
  expect(press.mock.calls[0][0]).toBe(up)
  expect(down.preventDefault).not.toHaveBeenCalled()
  expect(up.preventDefault).not.toHaveBeenCalled()
  expect(ref.current).toBe(original)
  expect(button.current).toBe(target)
  await view.unmount()
})
