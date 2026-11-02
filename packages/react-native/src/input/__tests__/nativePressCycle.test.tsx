import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { Platform, TextInput, type View } from "react-native"

import { Button } from "../../components/Button/Button"
import * as focus from "../focus"
import { NativeKeyboardScope } from "../NativeKeyboardScope"
import { NativePressable } from "../NativePressable"
import {
  NativeButtonPressContext,
  type TNativeAdmittedPress,
  type TNativeButtonPressOptions,
} from "../nativePressCycle"
import { createNativeOrdinaryEditorKeys, NativeOrdinaryEditorKeysContext } from "../ordinaryEditorKeys"
import { Commands } from "../specs/CUIFocusViewNativeComponent"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
const event = (timestamp = 0) => ({
  persist: jest.fn(),
  currentTarget: 17,
  target: 17,
  nativeEvent: { target: 17, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
})
const button = () => screen.getByRole("button")
let optionLifetimes = 0
const options = (extra: Partial<TNativeButtonPressOptions> = {}): TNativeButtonPressOptions => ({
  lifetimeKey: `press-owner:${++optionLifetimes}`,
  originalEditor: () => null,
  canAct: () => true,
  onPressStart: jest.fn(),
  ...extra,
})
beforeEach(() => {
  jest.useFakeTimers()
  jest.replaceProperty(Platform, "OS", "ios")
  jest.clearAllMocks()
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("relays exact admitted event and original receiver with public callback order", async () => {
  const ref = createRef<View>()
  const order: string[] = []
  let admission: TNativeAdmittedPress | undefined
  const down = event()
  const value = options({
    onPressStart: (original, context) => {
      expect(original).toBe(down)
      admission = context
      order.push("private")
    },
  })
  await render(
    <NativeButtonPressContext.Provider value={value}>
      <Button
        ref={ref}
        onPressStart={() => order.push("start")}
        onPressChange={() => order.push("change")}
        onPressIn={() => order.push("in")}
      >
        Action
      </Button>
    </NativeButtonPressContext.Provider>,
  )
  await act(() => button().props.onResponderGrant(down))
  expect(order).toEqual(["start", "change", "in", "private"])
  expect(admission?.cohort).toBe("responder")
  expect(admission?.originalReceiver).toBe(ref.current)
  expect(admission?.isCurrent()).toBe(true)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(ref.current, button().props.ownerId)
  expect(down.nativeEvent).not.toHaveProperty("pointerType")
  await act(() => button().props.onResponderRelease(event(1)))
  expect(admission?.isCurrent()).toBe(false)
})

it("retains the actually observed original editor without requesting button focus", async () => {
  const editor = createRef<TextInput>()
  await render(
    <NativeButtonPressContext.Provider value={options({ originalEditor: () => editor.current })}>
      <TextInput ref={editor} value="raw draft" />
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>,
  )
  jest.spyOn(focus, "getNativeFocusedTarget").mockImplementation(() => editor.current)
  const original = editor.current
  await act(() => button().props.onResponderGrant(event()))
  expect(editor.current).toBe(original)
  expect(screen.getByDisplayValue("raw draft").props.value).toBe("raw draft")
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it.each(["guard", "editor"] as const)("rechecks original %s after caller callbacks", async (replacement) => {
  let canAct = true
  const first = {} as TextInput,
    second = {} as TextInput
  let editor = first
  const value = options({
    originalEditor: () => editor,
    canAct: () => canAct,
    onPressStart: () => {
      if (replacement === "guard") canAct = false
      else editor = second
    },
  })
  await render(
    <NativeButtonPressContext.Provider value={value}>
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>,
  )
  await act(() => button().props.onResponderGrant(event()))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("admits genuine release-time activation after Pressability delay then retires", async () => {
  const start = jest.fn(),
    press = jest.fn()
  await render(
    <NativeButtonPressContext.Provider value={options({ onPressStart: start })}>
      <Button unstable_pressDelay={1000} onPress={press}>
        Action
      </Button>
    </NativeButtonPressContext.Provider>,
  )
  const down = event(),
    up = event(1)
  await act(() => button().props.onResponderGrant(down))
  expect(start).not.toHaveBeenCalled()
  await act(() => button().props.onResponderRelease(up))
  expect(start).toHaveBeenCalledTimes(1)
  expect(start.mock.calls[0][0]).toBe(up)
  expect(start.mock.calls[0][1].isCurrent()).toBe(false)
  expect(press.mock.calls[0][0]).toBe(up)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

it("retires on guard cancellation and unmount without reviving old metadata", async () => {
  const start = jest.fn(),
    value = options({ onPressStart: start })
  const node = (pending = false) => (
    <NativeButtonPressContext.Provider value={value}>
      <Button isPending={pending}>Action</Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node())
  await act(() => button().props.onResponderGrant(event()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  await screen.rerender(node(true))
  expect(admission.isCurrent()).toBe(false)
  await screen.rerender(node())
  expect(admission.isCurrent()).toBe(false)
  await screen.unmount()
  expect(admission.isCurrent()).toBe(false)
})

it("does not invent Android cohort or change legacy iOS callback arity", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const start = jest.fn()
  await render(
    <NativeButtonPressContext.Provider value={options({ onPressStart: start })}>
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>,
  )
  await act(() => button().props.onResponderGrant(event()))
  expect(start).not.toHaveBeenCalled()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await screen.unmount()
  jest.replaceProperty(Platform, "OS", "ios")
  const legacy = jest.fn()
  await render(<NativePressable testID="legacy" onPressIn={legacy} />)
  const original = event()
  await act(() => screen.getByTestId("legacy").props.onResponderGrant(original))
  expect(legacy.mock.calls).toEqual([[original]])
})

const acknowledgeWindow = async () => {
  const host = screen.getByTestId("window").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
}

it("retires private admission when its provider is removed and does not revive on reenrollment", async () => {
  const start = jest.fn(),
    press = jest.fn(),
    value = options({ onPressStart: start }),
    ref = createRef<View>()
  const node = (context: TNativeButtonPressOptions | null) => (
    <NativeButtonPressContext.Provider value={context}>
      <Button ref={ref} onPress={press}>
        Action
      </Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node(value))
  const receiver = ref.current
  await act(() => button().props.onResponderGrant(event()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  expect(admission.isCurrent()).toBe(true)
  await screen.rerender(node(null))
  expect(ref.current).toBe(receiver)
  expect(admission.isCurrent()).toBe(false)
  await screen.rerender(node(value))
  expect(admission.isCurrent()).toBe(false)
  const up = event(1)
  await act(() => button().props.onResponderRelease(up))
  expect(press.mock.calls).toEqual([[up]])
})

it("retires private admission when another provider value owns the same original button", async () => {
  const first = options(),
    second = options(),
    ref = createRef<View>()
  const node = (value: TNativeButtonPressOptions) => (
    <NativeButtonPressContext.Provider value={value}>
      <Button ref={ref}>Action</Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node(first))
  const receiver = ref.current
  await act(() => button().props.onResponderGrant(event()))
  const admission = (first.onPressStart as jest.Mock).mock.calls[0][1] as TNativeAdmittedPress
  await screen.rerender(node(second))
  expect(ref.current).toBe(receiver)
  expect(admission.isCurrent()).toBe(false)
  await screen.rerender(node(first))
  expect(admission.isCurrent()).toBe(false)
})

it("retires private admission after a committed original-editor replacement even when the old editor returns", async () => {
  const first = {} as TextInput,
    second = {} as TextInput
  let editor: TextInput | null = first
  const start = jest.fn(),
    value = options({ originalEditor: () => editor, onPressStart: start })
  const node = () => (
    <NativeButtonPressContext.Provider value={value}>
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node())
  await act(() => button().props.onResponderGrant(event()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  editor = second
  await screen.rerender(node())
  expect(admission.isCurrent()).toBe(false)
  editor = first
  await screen.rerender(node())
  expect(admission.isCurrent()).toBe(false)
})

it("preserves private admission across a transient null-to-same-editor ref handoff and stable rerender", async () => {
  const original = {} as TextInput
  let editor: TextInput | null = original
  const start = jest.fn(),
    value = options({ originalEditor: () => editor, onPressStart: start })
  const node = () => (
    <NativeButtonPressContext.Provider value={value}>
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node())
  await act(() => button().props.onResponderGrant(event()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  editor = null
  editor = original
  await screen.rerender(node())
  expect(admission.isCurrent()).toBe(true)
  await act(() => button().props.onResponderRelease(event(1)))
  expect(admission.isCurrent()).toBe(false)
})

it("preserves private admission across callback replacement within the same provider lifetime", async () => {
  const start = jest.fn(),
    updated = jest.fn(),
    value = options({ onPressStart: start })
  const node = (context: TNativeButtonPressOptions) => (
    <NativeButtonPressContext.Provider value={context}>
      <Button>Action</Button>
    </NativeButtonPressContext.Provider>
  )
  await render(node(value))
  await act(() => button().props.onResponderGrant(event()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  await screen.rerender(node({ ...value, onPressStart: updated }))
  expect(admission.isCurrent()).toBe(true)
  await act(() => button().props.onResponderRelease(event(1)))
  expect(admission.isCurrent()).toBe(false)
  await act(() => button().props.onResponderGrant(event(2)))
  expect(start).toHaveBeenCalledTimes(1)
  expect(updated).toHaveBeenCalledTimes(1)
})
const producer = (cohort: string, phase = "start", extra: Record<string, unknown> = {}) => ({
  nativeEvent: {
    ownerId: button().props.ownerId,
    bindingId: button().props.nativeResponderCohortBinding,
    target: 9,
    sourceTarget: 17,
    surfaceId: 1,
    identifier: 0,
    cycleId: 1,
    cohort,
    phase,
    scopeOwnerId: screen.getByTestId("window").props.ownerId,
    windowId: "window",
    epoch: 1,
    ...extra,
  },
})
const androidEvent = () => {
  const original = event()
  return { ...original, nativeEvent: { ...original.nativeEvent, targetSurface: 1 } }
}

it.each(["touch", "pen", "unknown"])(
  "admits actual Android producer %s metadata and focuses only the original button",
  async (cohort) => {
    jest.replaceProperty(Platform, "OS", "android")
    const start = jest.fn(),
      ref = createRef<View>()
    await render(
      <NativeKeyboardScope captureEnabled testID="window">
        <NativeButtonPressContext.Provider value={options({ onPressStart: start })}>
          <Button ref={ref}>Action</Button>
        </NativeButtonPressContext.Provider>
      </NativeKeyboardScope>,
    )
    await acknowledgeWindow()
    const down = androidEvent()
    await act(() => button().props.onNativeResponderCohort(producer(cohort)))
    await act(() => button().props.onResponderGrant(down))
    expect(start.mock.calls[0][0]).toBe(down)
    expect(start.mock.calls[0][1].cohort).toBe(cohort === "unknown" ? "responder" : cohort)
    expect(start.mock.calls[0][1].nativeCohort).toBe(cohort)
    expect(start.mock.calls[0][1].originalReceiver).toBe(ref.current)
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(ref.current, button().props.ownerId)
    await act(() => button().props.onNativeResponderCohort(producer(cohort, "end")))
    expect(start.mock.calls[0][1].isCurrent()).toBe(true)
    await act(() => button().props.onResponderRelease(androidEvent()))
    expect(start.mock.calls[0][1].isCurrent()).toBe(false)
  },
)

it("uses Android producer mouse evidence and the editor's separate acknowledged epoch for its original focus request", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const editor = createRef<TextInput>(),
    start = jest.fn(),
    requested = jest.fn()
  const registry = createNativeOrdinaryEditorKeys("editor-owner", () => ({
    windowId: "window",
    epoch: 71,
    active: true,
  }))
  await render(
    <NativeKeyboardScope captureEnabled testID="window">
      <NativeOrdinaryEditorKeysContext.Provider value={registry}>
        <NativeButtonPressContext.Provider
          value={options({ originalEditor: () => editor.current, onPressStart: start })}
        >
          <TextInput ref={editor} value="draft" />
          <Button>Action</Button>
        </NativeButtonPressContext.Provider>
      </NativeOrdinaryEditorKeysContext.Provider>
    </NativeKeyboardScope>,
  )
  await acknowledgeWindow()
  const find = jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
  const lease = registry.register("editor", {
    original: editor.current!,
    current: () => editor.current,
    canAct: () => true,
    receive: () => {},
  })
  const binding = registry.bindings()[0]
  registry.acceptStatus({
    ...binding,
    ownerId: "editor-owner",
    target: 17,
    windowId: "window",
    epoch: 71,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const release = focus.registerNativeFocusTarget(editor.current!, {
    canFocus: () => true,
    focus: requested,
    blur: () => {},
  })
  try {
    const original = editor.current
    await act(() => button().props.onNativeResponderCohort(producer("mouse")))
    await act(() => button().props.onResponderGrant(androidEvent()))
    expect(start.mock.calls[0][1].cohort).toBe("mouse")
    expect(editor.current).toBe(original)
    expect(requested).toHaveBeenCalledTimes(1)
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  } finally {
    release()
    lease.unregister()
    find.mockRestore()
  }
})

it("rejects foreign Android producer/session data and retires on real window loss", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const start = jest.fn()
  await render(
    <NativeKeyboardScope captureEnabled testID="window">
      <NativeButtonPressContext.Provider value={options({ onPressStart: start })}>
        <Button>Action</Button>
      </NativeButtonPressContext.Provider>
    </NativeKeyboardScope>,
  )
  await acknowledgeWindow()
  for (const extra of [{ bindingId: "old" }, { scopeOwnerId: "foreign" }, { windowId: "other" }, { epoch: 2 }])
    await act(() => button().props.onNativeResponderCohort(producer("mouse", "start", extra)))
  await act(() => button().props.onResponderGrant(androidEvent()))
  expect(start).not.toHaveBeenCalled()
  await act(() => button().props.onResponderRelease(androidEvent()))
  await act(() => button().props.onNativeResponderCohort(producer("touch", "start", { cycleId: 2 })))
  await act(() => button().props.onResponderGrant(androidEvent()))
  const admission = start.mock.calls[0][1] as TNativeAdmittedPress
  const host = screen.getByTestId("window").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  expect(admission.isCurrent()).toBe(false)
})
