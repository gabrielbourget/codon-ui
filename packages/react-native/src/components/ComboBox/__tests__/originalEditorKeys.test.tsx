import "./visibleCollections"

import { cleanup } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import { CompactTypeaheadSearch, TagComboBox, type TNativeComboBoxKeyboardEvent } from "../../../index"
import type { TNativeOrdinaryEditorKeyEvent } from "../../../input/ordinaryEditorKeys"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./visibleCollections"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
const mockNative = {
  getLease: () => "original-editor-module",
  acceptsField: jest.fn((_request: string) => true),
  settleField: jest.fn((_request: string) => true),
  moveFieldFocus: jest.fn(),
}
// These source controls retain original event/ref custody after native settlement is retired.

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
  const native = jest.requireActual<typeof RN>("react-native")
  const existingFind = native.findNodeHandle
  previousFind = jest.isMockFunction(existingFind) ? existingFind.getMockImplementation()! : existingFind
  const targets = new WeakMap<object, number>()
  let serial = 10000
  jest.spyOn(native, "findNodeHandle").mockImplementation((target) => {
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
  expect(mockNative.settleField).not.toHaveBeenCalled()
  return { ...result, input, inputID, node, binding, ownerId: host.ownerId, down, up, query, open, sources }
}

const originalKey = (f: Awaited<ReturnType<typeof setup>>, phase: "down" | "up", key = "z", composing = false) => {
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
      key,
      code: "KeyZ",
      location: 0,
      nativeCode: 29,
      characters: key,
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

describe.each(["compact", "tags"] as const)("%s original editor ordinary-event contract", (kind) => {
  it("delivers both original phases once without native text-default settlement", async () => {
    const f = await setup(kind)
    const down = originalKey(f, "down"),
      up = originalKey(f, "up")
    const original = f.input.current
    await deliver(f, down)
    await deliver(f, up)
    expect(f.down).toHaveBeenCalledTimes(1)
    expect(f.up).toHaveBeenCalledTimes(1)
    expect(f.down.mock.calls[0][0]).toBe(down)
    expect(f.up.mock.calls[0][0]).toBe(up)
    expect(f.down.mock.calls[0][0].target).toBe(original)
    expect(f.sources).toEqual([
      [original, original],
      [original, original],
    ])
    expect(f.input.current).toBe(original)
    expect(f.query).not.toHaveBeenCalled()
    expect(row(f.inputID).props.value).toBe("held")
    expect(down.defaultPrevented).toBe(true)
    expect(mockNative.settleField).not.toHaveBeenCalled()
  })
  it("rejects a foreign receiver and duplicate delivery of an original event", async () => {
    const f = await setup(kind)
    const foreign = originalKey(f, "down")
    foreign.currentTarget = {} as RN.TextInput
    await act(() => row(f.inputID).props.onNativeOrdinaryEditorKey(foreign))
    expect(f.down).not.toHaveBeenCalled()
    const original = originalKey(f, "down")
    await deliver(f, original)
    original.currentTarget = f.input.current!
    await deliver(f, original)
    expect(f.down).toHaveBeenCalledTimes(1)
    expect(mockNative.settleField).not.toHaveBeenCalled()
  })
  it("retires old event delivery after a guard replacement", async () => {
    const f = await setup(kind)
    const event = originalKey(f, "down")
    const previous = row(f.inputID).props.onNativeOrdinaryEditorKey
    await f.rerender(f.node(true))
    await act(() => previous(event))
    expect(f.down).not.toHaveBeenCalled()
    expect(mockNative.settleField).not.toHaveBeenCalled()
  })
  it("preserves composing key observations without starting navigation or suppressing their default", async () => {
    const f = await setup(kind, false)
    await deliver(f, originalKey(f, "down", "ArrowDown", true))
    expect(f.down).toHaveBeenCalledTimes(1)
    expect(f.down.mock.calls[0][0].nativeEvent.isComposing).toBe(true)
    expect(f.open).not.toHaveBeenCalled()
    expect(f.down.mock.calls[0][0].nativeEvent.nativeDefaultHandled).toBe(false)
    expect(mockNative.settleField).not.toHaveBeenCalled()
  })
})
