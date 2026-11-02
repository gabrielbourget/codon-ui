import { act, cleanup, fireEvent, render, renderHook, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { AccessibilityInfo, Animated, Dimensions, findNodeHandle, StyleSheet, type TextInput, View } from "react-native"

import { ComboBox, NativeMotionConfig, NativeThemeProvider, type TNativeComboBoxKey } from "../../.."
import { useComboBoxState } from "../useComboBoxState"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

beforeEach(() => {
  jest.useFakeTimers()
  // Stable source-renderer identities, never a native receiver/qualification claim.
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const tags = new WeakMap<object, number>()
  let next = 1000
  jest.spyOn(native, "findNodeHandle").mockImplementation((receiver) => {
    if (!receiver || typeof receiver !== "object") return typeof receiver === "number" ? receiver : null
    if (!tags.has(receiver)) tags.set(receiver, ++next)
    return tags.get(receiver)!
  })
})
afterEach(async () => {
  await cleanup()
  await act(() => jest.runOnlyPendingTimers())
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps the original editor and independent owners through a deferred explicit-item response and host changes", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    requests: unknown[][] = [],
    raw = jest.fn(),
    selection = jest.fn(),
    end = jest.fn(),
    submit = jest.fn()
  const Owner = () => {
    const [items, setItems] = useState([
      { key: 0, text: "Zero" },
      { key: "0", text: "String zero" },
    ])
    return (
      <ComboBox
        ref={root}
        inputRef={editor}
        items={items}
        getKey={(item) => item.key}
        getTextValue={(item) => item.text}
        accessibilityLabel="Choose"
        inputLabel="Original query"
        closeLabel="Close query"
        value={0}
        inputValue="held owner"
        isOpen
        onInputChange={(value) => {
          requests.push(["query", value])
          setTimeout(
            () =>
              setItems([
                { key: "0", text: "Returned string zero" },
                { key: 0, text: "Returned zero" },
              ]),
            50,
          )
        }}
        onChange={(value: TNativeComboBoxKey | null) => requests.push(["selection", value])}
        onOpenChange={(value) => requests.push(["open", value])}
        inputProps={{ onChange: raw, onSelectionChange: selection, onEndEditing: end, onSubmitEditing: submit }}
      />
    )
  }
  const fixture = (mode: "light" | "dark") => (
    <NativeThemeProvider mode={mode}>
      <Owner />
    </NativeThemeProvider>
  )
  const { rerender, unmount } = await render(fixture("light"))
  const originalRoot = root.current,
    originalEditor = editor.current
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(originalEditor).not.toBe(originalRoot)
  const input = () => screen.getByLabelText("Original query")
  const changed = { nativeEvent: { text: "に", eventCount: 1, target: 7 } },
    selected = { nativeEvent: { selection: { start: 1, end: 1 }, target: 7 } },
    ended = { nativeEvent: { text: "日本", target: 7 } }
  await fireEvent(input(), "change", changed)
  await fireEvent(input(), "selectionChange", selected)
  await fireEvent.changeText(input(), "日本")
  await act(() => jest.advanceTimersByTime(50))
  await rerender(fixture("dark"))
  const previousWindow = Dimensions.get("window"),
    previousScreen = Dimensions.get("screen")
  try {
    await act(() =>
      Dimensions.set({
        window: { width: 844, height: 390, scale: 1, fontScale: 2 },
        screen: { width: 844, height: 390, scale: 1, fontScale: 2 },
      }),
    )
    expect(root.current).toBe(originalRoot)
    expect(editor.current).toBe(originalEditor)
    expect(input().props.value).toBe("held owner")
    expect(screen.getByRole("radio", { name: "Returned zero" })).toBeChecked()
    await fireEvent(input(), "endEditing", ended)
    await fireEvent(input(), "submitEditing", ended)
    await readyWindow(originalEditor!)
    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTimeAsync })
      .press(screen.getByRole("radio", { name: "Returned string zero" }))
    expect(requests).toEqual([
      ["query", "に"],
      ["query", "日本"],
      ["selection", "0"],
      ["open", false],
    ])
    expect(input().props.value).toBe("held owner")
    expect(editor.current).toBe(originalEditor)
    expect(raw.mock.calls[0][0]).toBe(changed)
    expect(selection.mock.calls[0][0]).toBe(selected)
    expect(end.mock.calls[0][0]).toBe(ended)
    expect(submit.mock.calls[0][0]).toBe(ended)
    expect([raw, selection, end, submit].map((observer) => observer.mock.calls.length)).toEqual([1, 1, 1, 1])
    await unmount()
    expect(root.current).toBeNull()
    expect(editor.current).toBeNull()
  } finally {
    await act(() => Dimensions.set({ window: previousWindow, screen: previousScreen }))
  }
})

it("retains the canonical group name without combining or renaming its independent controls", async () => {
  const props = {
    items: [{ key: "a", text: "Alpha" }],
    getKey: (item: { key: string }) => item.key,
    getTextValue: (item: { text: string }) => item.text,
    accessibilityLabel: "Show choices",
    inputLabel: "Original query",
    closeLabel: "Close choices",
  }
  const { rerender } = await render(<ComboBox {...props} />)
  const group = () => screen.getByTestId("combo-box-group")
  expect(group().props).toMatchObject({
    accessible: false,
    role: "group",
    accessibilityLabel: "ComboBox Input Button Group",
  })
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: "Localized controls" }} />)
  expect(group().props.accessibilityLabel).toBe("Localized controls")
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: "" }} />)
  expect(group().props.accessibilityLabel).toBe("")
  expect(group().props.accessible).toBe(false)
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: undefined }} />)
  expect(group().props.accessibilityLabel).toBeUndefined()
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
})

const choices = [
  { key: 0, text: "Zero" },
  { key: "blocked", text: "Unavailable" },
  { key: "0", text: "String zero" },
]
const keyboardProps = {
  items: choices,
  getKey: (item: (typeof choices)[number]) => item.key,
  getTextValue: (item: (typeof choices)[number]) => item.text,
  accessibilityLabel: "Choose",
  inputLabel: "Keyboard query",
  closeLabel: "Close keyboard query",
  value: 0,
  inputValue: "Zero",
  isOpen: true,
  disabledKeys: ["blocked"],
}
const windowHost = () => screen.getByTestId("combo-box-floating-host")
const queryEditor = () => screen.getByTestId("combo-box-input")
let receiptSequence = 0
const readyWindow = async (original: TextInput) => {
  for (const ready of [false, true]) {
    const props = windowHost().props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "combo-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: props.policyRevision,
        },
      }),
    )
  }
  const props = windowHost().props
  const binding = props.ordinaryEditorBindings.find(
    (entry: { originalEditorAction?: boolean }) => entry.originalEditorAction,
  )
  expect(binding).toBeDefined()
  await act(() =>
    props.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        ownerId: props.ownerId,
        target: findNodeHandle(original),
        windowId: "combo-window",
        epoch: 1,
        sequence: ++receiptSequence,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
}
const editorPacket = (original: TextInput, key: string, dispatchId: number, composing = false) => {
  const props = windowHost().props
  const binding = props.ordinaryEditorBindings.find(
    (entry: { originalEditorAction?: boolean }) => entry.originalEditorAction,
  )
  const policy = props.policies.find(
    (entry: { originalEditorAction?: boolean; tokens: string[] }) =>
      entry.originalEditorAction && entry.tokens.includes(`0000:${key}`),
  )
  expect(policy).toBeDefined()
  const target = findNodeHandle(original)
  const data = {
    kind: "keyboard",
    ownerId: props.ownerId,
    policyId: policy.id,
    policyRevision: props.policyRevision,
    windowId: "combo-window",
    epoch: 1,
    target,
    focusedTarget: target,
    key,
    nativeCode: key === "Enter" ? 66 : 20,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "0",
    nativeDefaultHandled: true,
    timestamp: dispatchId,
  }
  const frame = { ...data, ...binding, targetTag: target, dispatchId, admitted: true, isComposing: composing }
  return {
    action: { nativeEvent: { ...data, originalEditorAction: JSON.stringify(frame) } },
    ordinary: {
      target: original,
      currentTarget: original,
      persist: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        ...data,
        ...binding,
        eventId: dispatchId,
        code: key,
        location: 0,
        isComposing: composing,
        observerBindings: "[]",
        originalEditorAction: JSON.stringify(frame),
      },
    },
  }
}
const deliver = async (original: TextInput, key: string, id: number, composing = false) => {
  const packet = editorPacket(original, key, id, composing)
  await act(() => windowHost().props.onNativeScopedKey(packet.action))
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(packet.ordinary))
  return packet
}

it("keeps SDK pointer, hover and focus composition on the original row with current window and readonly guards", async () => {
  const original = createRef<TextInput>(),
    trace: unknown[] = [],
    states = new Map<TNativeComboBoxKey, unknown>()
  const tree = (readonly = false) => (
    <ComboBox
      {...keyboardProps}
      isReadOnly={readonly}
      inputRef={original}
      renderItem={(item, state) => {
        states.set(item.key, state)
        return item.text
      }}
      onChange={(key) => trace.push(["select", key])}
      onOpenChange={(open) => trace.push(["open", open])}
    />
  )
  const { rerender } = await render(tree())
  const option = screen.getByRole("radio", { name: "String zero" })
  expect(option.props.onResponderGrant).toEqual(expect.any(Function))
  expect(option.props.onResponderRelease).toEqual(expect.any(Function))
  const event = {
    persist: jest.fn(),
    stopPropagation: jest.fn(),
    target: 17,
    currentTarget: 17,
    nativeEvent: {
      target: 17,
      timestamp: 100,
      identifier: 1,
      pageX: 1,
      pageY: 1,
      locationX: 1,
      locationY: 1,
      touches: [],
      changedTouches: [],
    },
  }
  await readyWindow(original.current!)
  const inactive = windowHost().props
  await act(() =>
    inactive.onNativeScopeStatus({
      nativeEvent: {
        ownerId: inactive.ownerId,
        windowId: "combo-window",
        epoch: 1,
        ready: true,
        windowActive: false,
        policyRevision: inactive.policyRevision,
      },
    }),
  )
  await act(() => {
    option.props.onResponderGrant(event)
    option.props.onResponderRelease(event)
  })
  expect(trace).toEqual([])
  expect(states.get("0")).toMatchObject({ isPressed: false })
  await readyWindow(original.current!)
  const pointer = { persist: jest.fn(), nativeEvent: { pointerType: "mouse", target: 17 } }
  await act(() => option.props.onPointerEnter(pointer))
  expect(states.get("0")).toMatchObject({ isHovered: true })
  await act(() => option.props.onPointerLeave(pointer))
  expect(states.get("0")).toMatchObject({ isHovered: false })
  await act(() =>
    option.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: option.props.ownerId,
        target: 17,
        isFocused: true,
        origin: "keyboard",
        isFocusVisible: true,
        timestamp: 0,
      },
    }),
  )
  expect(states.get("0")).toMatchObject({ isFocused: true })
  await act(() => option.props.onResponderGrant(event))
  expect(states.get("0")).toMatchObject({ isPressed: true })
  expect(screen.getByRole("radio", { name: "String zero" })).toBe(option)
  await act(() => jest.advanceTimersByTime(150))
  await act(() => option.props.onResponderRelease(event))
  expect(states.get("0")).toMatchObject({ isPressed: false })
  expect(trace).toEqual([
    ["select", "0"],
    ["open", false],
  ])
  expect(screen.getByRole("radio", { name: "Zero" })).toBeChecked()
  expect(queryEditor().props.value).toBe("Zero")
  const release = option.props.onResponderRelease
  await act(() => option.props.onResponderGrant(event))
  expect(states.get("0")).toMatchObject({ isPressed: true })
  await rerender(tree(true))
  await act(() => release(event))
  expect(states.get("0")).toMatchObject({ isPressed: false, isReadOnly: true })
  expect(trace).toHaveLength(2)
  await rerender(tree())
  await readyWindow(original.current!)
  await act(() => option.props.onResponderGrant(event))
  expect(states.get("0")).toMatchObject({ isPressed: true })
  const scope = windowHost().props
  await act(() =>
    scope.onNativeScopeStatus({
      nativeEvent: {
        ownerId: scope.ownerId,
        windowId: "combo-window",
        epoch: 1,
        ready: true,
        windowActive: false,
        policyRevision: scope.policyRevision,
      },
    }),
  )
  expect(states.get("0")).toMatchObject({ isPressed: false })
  await act(() => release(event))
  expect(trace).toHaveLength(2)
  await readyWindow(original.current!)
  const activation = {
    nativeEvent: {
      kind: "activation",
      ownerId: option.props.ownerId,
      activationId: 2,
      scopeOwnerId: windowHost().props.ownerId,
      windowId: "combo-window",
      epoch: 1,
      source: "ios-accessibility-activate",
      target: 17,
      observedAt: 1,
    },
  }
  await act(() =>
    option.props.onNativeActivation({
      nativeEvent: { ...activation.nativeEvent, activationId: 1, windowId: "stale-window" },
    }),
  )
  expect(trace).toHaveLength(2)
  await act(() => option.props.onNativeActivation(activation))
  expect(trace).toEqual([
    ["select", "0"],
    ["open", false],
    ["select", "0"],
    ["open", false],
  ])
  expect(original.current).not.toBeNull()
})

it("uses its actual modal window and paired original editor receipts for navigation and Enter", async () => {
  const original = createRef<TextInput>(),
    trace: unknown[] = []
  await render(
    <ComboBox
      {...keyboardProps}
      inputRef={original}
      onChange={(key) => trace.push(["select", key])}
      onOpenChange={(open) => trace.push(["open", open])}
    />,
  )
  const editor = original.current!
  expect(
    windowHost().props.policies.some((policy: { originalEditorAction?: boolean }) => policy.originalEditorAction),
  ).toBe(true)
  const focus = jest.spyOn(editor, "focus")
  expect(focus).not.toHaveBeenCalled()
  await readyWindow(editor)
  expect(focus).toHaveBeenCalledTimes(1)
  await deliver(editor, "ArrowDown", 1)
  // Typed zero and string zero stay distinct, and the disabled middle row is skipped.
  expect(screen.getByRole("radio", { name: "String zero" })).toHaveStyle({ outlineWidth: 1.5 })
  expect(queryEditor().props.value).toBe("Zero")
  expect(original.current).toBe(editor)
  const enter = editorPacket(editor, "Enter", 2)
  await act(() => windowHost().props.onNativeScopedKey(enter.action))
  expect(trace).toEqual([])
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(enter.ordinary))
  expect(trace).toEqual([
    ["select", "0"],
    ["open", false],
  ])
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(enter.ordinary))
  expect(trace).toHaveLength(2)
  await deliver(editor, "Enter", 3, true)
  expect(trace).toHaveLength(2)
  await deliver(editor, "ArrowDown", 4)
  expect(screen.getByRole("radio", { name: "Zero" })).toHaveStyle({ outlineWidth: 1.5 })
})

it("navigates Home and End, wraps, preserves the editor cursor path and reverts Escape through current selection", async () => {
  const original = createRef<TextInput>(),
    trace: unknown[] = []
  await render(
    <ComboBox
      {...keyboardProps}
      inputRef={original}
      inputValue="pending query"
      onInputChange={(query) => trace.push(["query", query])}
      onOpenChange={(open) => trace.push(["open", open])}
    />,
  )
  const editor = original.current!
  await readyWindow(editor)
  await deliver(editor, "End", 1)
  expect(screen.getByRole("radio", { name: "String zero" })).toHaveStyle({ outlineWidth: 1.5 })
  await deliver(editor, "Home", 2)
  expect(screen.getByRole("radio", { name: "Zero" })).toHaveStyle({ outlineWidth: 1.5 })
  await deliver(editor, "ArrowUp", 3)
  expect(screen.getByRole("radio", { name: "String zero" })).toHaveStyle({ outlineWidth: 1.5 })
  const cursor = editorPacket(editor, "ArrowDown", 4).ordinary
  cursor.nativeEvent.key = "ArrowLeft"
  cursor.nativeEvent.code = "ArrowLeft"
  cursor.nativeEvent.nativeDefaultHandled = false
  cursor.nativeEvent.originalEditorAction = ""
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(cursor))
  expect(
    StyleSheet.flatten(screen.getByRole("radio", { name: "String zero" }).props.style).outlineWidth,
  ).toBeUndefined()
  expect(queryEditor().props.value).toBe("pending query")
  expect(original.current).toBe(editor)
  await readyWindow(editor)
  await deliver(editor, "Escape", 5)
  expect(trace).toEqual([
    ["query", "Zero"],
    ["open", false],
  ])
})

it("keeps genuine soft submit observers first and retires old keyboard receipts on ownership changes", async () => {
  const original = createRef<TextInput>(),
    trace: unknown[] = [],
    submit = jest.fn((event) => trace.push(event))
  const tree = (readonly = false) => (
    <ComboBox
      {...keyboardProps}
      isReadOnly={readonly}
      inputRef={original}
      inputProps={{ onSubmitEditing: submit }}
      onChange={(key) => trace.push(["select", key])}
      onOpenChange={(open) => trace.push(["open", open])}
    />
  )
  const { rerender } = await render(tree())
  const editor = original.current!
  await readyWindow(editor)
  await deliver(editor, "ArrowDown", 1)
  const pending = editorPacket(editor, "Enter", 2)
  await act(() => windowHost().props.onNativeScopedKey(pending.action))
  await rerender(tree(true))
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(pending.ordinary))
  expect(trace).toEqual([])
  expect(original.current).toBe(editor)
  await rerender(tree())
  await readyWindow(editor)
  await act(() => queryEditor().props.onNativeOrdinaryEditorKey(pending.ordinary))
  expect(trace).toEqual([])
  const event = { nativeEvent: { target: findNodeHandle(editor), text: "Zero" } }
  await fireEvent(queryEditor(), "submitEditing", event)
  expect(submit.mock.calls[0][0]).toBe(event)
  expect(trace).toEqual([event, ["select", "0"], ["open", false]])
})

it("uses current model callbacks and guards retained commands through readonly, close and unmount", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    closed = jest.fn()
  const initialProps = { ...keyboardProps, onChange: first, onOpenChange: closed, isReadOnly: false }
  const { result, rerender, unmount } = await renderHook((props: typeof initialProps) => useComboBoxState(props), {
    initialProps,
  })
  const old = result.current
  await rerender({ ...keyboardProps, onChange: next, onOpenChange: closed, isReadOnly: false })
  await act(() => old.activate("0"))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith("0")
  await rerender({ ...keyboardProps, onChange: next, onOpenChange: closed, isReadOnly: true })
  next.mockClear()
  closed.mockClear()
  await act(() => old.activate("0"))
  expect(next).not.toHaveBeenCalled()
  await unmount()
  await act(() => old.requestOpen(false))
  expect(closed).not.toHaveBeenCalled()
})

it("retains rotate-X endpoints, custom icon identity and live border animation preferences", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener")
  const preference = (value: boolean) => {
    const registered: readonly (readonly unknown[])[] = subscriptions.mock.calls
    for (const [name, receive] of registered)
      if (name === "reduceMotionChanged" && typeof receive === "function") receive(value)
  }
  const tree = (open: boolean, invalid = false) => (
    <NativeThemeProvider>
      <NativeMotionConfig skipAnimations>
        <ComboBox {...keyboardProps} isOpen={open} errorState={invalid} ComponentIcon={<View testID="caller-icon" />} />
      </NativeMotionConfig>
    </NativeThemeProvider>
  )
  const { rerender } = await render(tree(false))
  const icon = screen.getByTestId("caller-icon", { includeHiddenElements: true })
  expect(screen.getByTestId("combo-box-icon", { includeHiddenElements: true })).toHaveStyle({
    transform: [],
  })
  await rerender(tree(true))
  await act(() => jest.advanceTimersByTime(500))
  expect(screen.getByTestId("combo-box-icon", { includeHiddenElements: true })).toHaveStyle({
    transform: [{ rotateX: "180deg" }],
  })
  expect(screen.getByTestId("caller-icon", { includeHiddenElements: true })).toBe(icon)
  await rerender(tree(false, true))
  await act(() => jest.advanceTimersByTime(500))
  expect(screen.getByTestId("combo-box-icon", { includeHiddenElements: true })).toHaveStyle({
    transform: [],
  })
  const timing = jest.spyOn(Animated, "timing")
  expect(StyleSheet.flatten(screen.getByTestId("combo-box-group").props.style).borderColor).toBeDefined()
  await act(() => {
    preference(false)
  })
  await rerender(tree(false, false))
  expect(timing.mock.calls.some(([, options]) => options.duration === 250)).toBe(true)
  await act(() => {
    preference(true)
  })
  timing.mockClear()
  await rerender(tree(false, true))
  expect(timing.mock.calls.some(([, options]) => options.duration === 250)).toBe(false)
})

it("commits Tab once through the real modal collection boundary while leaving native Tab default intact", async () => {
  const original = createRef<TextInput>(),
    trace: unknown[] = []
  await render(
    <ComboBox
      {...keyboardProps}
      inputRef={original}
      onChange={(key) => trace.push(["select", key])}
      onOpenChange={(open) => trace.push(["open", open])}
    />,
  )
  await readyWindow(original.current!)
  await deliver(original.current!, "ArrowDown", 1)
  const host = windowHost().props
  const binding = JSON.parse(host.toolbarBindings).find((value: { tabOnly?: boolean }) => value.tabOnly)
  expect(binding).toBeDefined()
  const status = {
    ...binding,
    ownerId: host.ownerId,
    windowId: "combo-window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    nestedToolbar: false,
    error: "",
  }
  await act(() => windowHost().props.onNativeToolbarStatus({ nativeEvent: { packet: JSON.stringify(status) } }))
  const event = {
    nativeEvent: {
      packet: JSON.stringify({
        ...status,
        target: findNodeHandle(original.current),
        focusedTarget: findNodeHandle(original.current),
        requestedTarget: binding.rootTarget,
        destinationTarget: binding.rootTarget,
        focusObserved: true,
        eventId: 1,
        key: "Tab",
        nativeCode: 61,
        characters: "\t",
        phase: "down",
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        nativeDefaultHandled: false,
        disposition: "tab",
        timestamp: 1,
        physicalPath: [findNodeHandle(original.current), binding.rootTarget],
      }),
    },
    persist: jest.fn(),
  }
  await act(() => windowHost().props.onNativeToolbarKeyboard(event))
  expect(trace).toEqual([
    ["select", "0"],
    ["open", false],
  ])
  expect(JSON.parse(event.nativeEvent.packet).nativeDefaultHandled).toBe(false)
  await act(() => windowHost().props.onNativeToolbarKeyboard(event))
  expect(trace).toHaveLength(2)
})
