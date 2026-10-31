import "../../../collection/__tests__/nativeReceipts"

import { act as rendererAct, cleanup } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { CompactTypeaheadSearch, TagComboBox, type TNativeComboBoxKeyboardEvent } from "../../../index"
import type { TNativeFieldInputPlan } from "../../../input/fieldInputBinding"
import type { TNativeOrdinaryEditorKeyEvent } from "../../../input/ordinaryEditorKeys"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
const mockFieldEnrollment = jest.fn()
// These are source models of normal native events, not installed event delivery.
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: (_plan: TNativeFieldInputPlan | null, enabled = true) => {
    mockFieldEnrollment(enabled)
    return {
      scope: null,
      metadata: { binding: () => "", commit: () => {}, receive: () => {} },
      status: { ready: false, pending: false, error: "" },
    }
  },
}))

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
]
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
let previousFind: typeof RN.findNodeHandle
let eventId = 0
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  previousFind = RN.findNodeHandle
  const targets = new WeakMap<object, number>()
  let serial = 10000
  jest.spyOn(RN, "findNodeHandle").mockImplementation((target) => {
    const known = previousFind(target)
    if (known != null && known > 0) return known
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!targets.has(target)) targets.set(target, ++serial)
    return targets.get(target)!
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

const setup = async (kind: "compact" | "tags", prevent = true) => {
  const input = createRef<RN.TextInput>()
  const sources: unknown[][] = []
  const down = jest.fn((event: TNativeComboBoxKeyboardEvent) => {
    sources.push([event.target, event.currentTarget])
    if (prevent) event.preventDefault()
  })
  const up = jest.fn((event: TNativeComboBoxKeyboardEvent) => {
    sources.push([event.target, event.currentTarget])
  })
  const inputDown = jest.fn()
  const change = jest.fn()
  const selection = jest.fn()
  const submit = jest.fn()
  const inputProps = { onKeyDown: inputDown, onChange: change, onSelectionChange: selection, onSubmitEditing: submit }
  const query = jest.fn()
  const open = jest.fn()
  const wrap = (child: ReactNode) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="editor-host">{child}</NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const node = (readOnly = false) =>
    wrap(
      kind === "compact" ? (
        <CompactTypeaheadSearch
          items={items}
          getItemKey={(item) => item.id}
          inputRef={input}
          accessibilityLabel="Search"
          inputValue="held"
          onInputChange={query}
          onOpenChange={open}
          onKeyDown={down}
          onKeyUp={up}
          inputProps={inputProps}
          isReadOnly={readOnly}
        />
      ) : (
        <TagComboBox
          items={items}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          onSelectedItemsChange={() => {}}
          inputRef={input}
          accessibilityLabel="Search"
          inputValue="held"
          onInputChange={query}
          onOpenChange={open}
          onKeyDown={down}
          onKeyUp={up}
          inputProps={inputProps}
          isReadOnly={readOnly}
        />
      ),
    )
  const result = await render(node())
  for (const ready of [false, true, true]) {
    const host = row("editor-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "original-editor-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const host = row("editor-host").props
  const binding = host.ordinaryEditorBindings.find(
    (value: { targetTag: number }) => value.targetTag === RN.findNodeHandle(input.current),
  )
  expect(binding).toBeDefined()
  await act(() =>
    host.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        target: binding.targetTag,
        ownerId: host.ownerId,
        windowId: "original-editor-window",
        epoch: 1,
        sequence: 1,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
  expect(input.current).not.toBeNull()
  const inputID = kind === "compact" ? "type-ahead-search-input" : "combo-box-input"
  expect(row(inputID).props.onNativeOrdinaryEditorKey).toEqual(expect.any(Function))
  expect(row(inputID).props.onNativeFieldKey).toBeUndefined()
  expect(mockFieldEnrollment).toHaveBeenCalled()
  expect(mockFieldEnrollment.mock.calls.every(([enabled]) => !enabled)).toBe(true)
  return {
    ...result,
    input,
    inputID,
    node,
    binding,
    ownerId: host.ownerId,
    down,
    up,
    query,
    open,
    sources,
    inputDown,
    change,
    selection,
    submit,
  }
}

const originalKey = (f: Awaited<ReturnType<typeof setup>>, phase: "down" | "up", composing = false) => {
  const serial = ++eventId
  let prevented = false
  return {
    nativeEvent: {
      ...f.binding,
      target: f.binding.targetTag,
      ownerId: f.ownerId,
      windowId: "original-editor-window",
      epoch: 1,
      kind: "keyboard",
      eventId: serial,
      key: "z",
      code: "KeyZ",
      location: 0,
      nativeCode: 29,
      characters: "z",
      phase,
      repeat: false,
      cancelled: false,
      isComposing: composing,
      shiftKey: false,
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "1",
      nativeDefaultHandled: false,
      timestamp: serial,
    },
    target: f.input.current,
    currentTarget: f.input.current,
    get defaultPrevented() {
      return prevented
    },
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: jest.fn(),
    isDefaultPrevented: () => prevented,
    isPropagationStopped: () => false,
    persist: jest.fn(),
  } as unknown as TNativeOrdinaryEditorKeyEvent
}
const deliver = async (f: Awaited<ReturnType<typeof setup>>, event: TNativeOrdinaryEditorKeyEvent) =>
  act(() => row(f.inputID).props.onNativeOrdinaryEditorKey(event))

describe.each(["compact", "tags"] as const)("%s ordinary editor keys", (kind) => {
  it("preserves actual events, editor refs, composing data and controlled text without native settlement", async () => {
    const f = await setup(kind)
    const original = f.input.current,
      down = originalKey(f, "down", true),
      up = originalKey(f, "up")
    await deliver(f, down)
    await deliver(f, up)
    expect(f.down.mock.calls[0][0]).toBe(down)
    expect(f.up.mock.calls[0][0]).toBe(up)
    expect(f.inputDown.mock.calls[0][0]).toBe(down)
    expect(f.down.mock.invocationCallOrder[0]).toBeLessThan(f.inputDown.mock.invocationCallOrder[0])
    expect(f.sources).toEqual([
      [original, original],
      [original, original],
    ])
    expect(down.nativeEvent.isComposing).toBe(true)
    expect(down.nativeEvent.ctrlKey).toBe(true)
    expect(down.defaultPrevented).toBe(true)
    expect(f.input.current).toBe(original)
    expect(row(f.inputID).props.value).toBe("held")
    expect(f.open).not.toHaveBeenCalled()
    expect(f.query).not.toHaveBeenCalled()
    const changeEvent = { nativeEvent: { text: "heldz", eventCount: 1 }, target: original, currentTarget: original }
    const selectionEvent = {
      nativeEvent: { selection: { start: 1, end: 3 } },
      target: original,
      currentTarget: original,
    }
    const submitEvent = { nativeEvent: { text: "held" }, target: original, currentTarget: original }
    await act(() => {
      row(f.inputID).props.onChange(changeEvent)
      row(f.inputID).props.onSelectionChange(selectionEvent)
      row(f.inputID).props.onSubmitEditing(submitEvent)
    })
    expect(f.change.mock.calls[0][0]).toBe(changeEvent)
    expect(f.selection.mock.calls[0][0]).toBe(selectionEvent)
    expect(f.submit.mock.calls[0][0]).toBe(submitEvent)
    // Ordinary editing proceeds independently of a previous JS preventDefault.
    await act(() => row(f.inputID).props.onChangeText("heldz"))
    expect(f.query).toHaveBeenCalledWith("heldz")
    expect(row(f.inputID).props.value).toBe("held")
  })
  it("rejects duplicate, foreign and stale guard deliveries", async () => {
    const f = await setup(kind)
    const foreign = originalKey(f, "down")
    foreign.currentTarget = {} as RN.TextInput
    await deliver(f, foreign)
    expect(f.down).not.toHaveBeenCalled()
    const event = originalKey(f, "down")
    await deliver(f, event)
    await deliver(f, event)
    expect(f.down).toHaveBeenCalledTimes(1)
    const previous = row(f.inputID).props.onNativeOrdinaryEditorKey
    const stale = originalKey(f, "down")
    await f.rerender(f.node(true))
    await act(() => previous(stale))
    expect(f.down).toHaveBeenCalledTimes(1)
  })
  it("retires callbacks on window epoch loss and unmount", async () => {
    const f = await setup(kind)
    const previous = row(f.inputID).props.onNativeOrdinaryEditorKey
    const event = originalKey(f, "down")
    const host = row("editor-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "original-editor-window",
          epoch: 2,
          policyRevision: host.policyRevision,
          ready: false,
          windowActive: false,
        },
      }),
    )
    await act(() => previous(event))
    expect(f.down).not.toHaveBeenCalled()
    await f.unmount()
    await rendererAct(() => previous(event))
    expect(f.down).not.toHaveBeenCalled()
  })
})
