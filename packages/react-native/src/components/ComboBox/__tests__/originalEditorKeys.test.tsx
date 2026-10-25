import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { CompactTypeaheadSearch, TagComboBox, type TNativeComboBoxKeyboardEvent } from "../../../index"
import type { TNativeFieldInputScope, TNativeFieldKeyEvent } from "../../../input/fieldInput"
import type { TNativeFieldInputPlan } from "../../../input/fieldInputBinding"
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
const mockPlans = new Map<string, TNativeFieldInputPlan>()
const mockNative = {
  getLease: () => "original-editor-module",
  acceptsField: jest.fn((_request: string) => true),
  settleField: jest.fn((_request: string) => true),
  moveFieldFocus: jest.fn(),
}
// The native frame is an explicit model; these cases prove receiver wiring,
// original event/ref custody and acknowledgements, not installed defaults.
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: (plan: TNativeFieldInputPlan | null, enabled = true) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const committed = React.useRef<TNativeFieldInputPlan | null>(null)
    React.useInsertionEffect(() => {
      committed.current = enabled ? plan : null
      if (enabled && plan) mockPlans.set(plan.bindingId, plan)
    })
    React.useInsertionEffect(
      () => () => {
        committed.current = null
      },
      [],
    )
    const scope = React.useMemo<TNativeFieldInputScope | null>(
      () =>
        plan && enabled
          ? {
              bindingId: plan.bindingId,
              bindingRevision: plan.bindingRevision,
              current: () => committed.current === plan,
              native: mockNative,
            }
          : null,
      [plan, enabled],
    )
    return {
      scope,
      metadata: { binding: () => "", commit: () => {}, receive: () => {} },
      status: { ready: !!scope, pending: false, error: "" },
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
  mockPlans.clear()
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
  const plan = [...mockPlans.values()].at(-1)!
  expect(plan).toBeDefined()
  expect(input.current).not.toBeNull()
  const inputID = kind === "compact" ? "type-ahead-search-input" : "combo-box-input"
  expect(row(inputID).props.onNativeFieldKey).toEqual(expect.any(Function))
  return { ...result, input, inputID, node, plan, down, up, query, open, sources }
}
const originalKey = (f: Awaited<ReturnType<typeof setup>>, phase: "down" | "up", key = "z", composing = false) => {
  const { plan } = f
  const serial = ++eventId
  const packet = {
    moduleLease: mockNative.getLease(),
    token: serial,
    eventId: serial,
    phase,
    identity: {
      ownerId: plan.bindingId,
      bindingId: plan.bindingId,
      bindingRevision: plan.bindingRevision,
      metadataTarget: 17,
      outerTarget: plan.outerTarget,
      inputTarget: plan.inputTarget,
      surfaceId: 11,
      target: plan.originalTarget,
      documentId: "original-editor-document",
      documentRevision: "1",
      windowId: "original-editor-window",
      mountRevision: "1",
      outerInstance: "original-root",
      inputInstance: "original-input",
      nativeInstance: "original-editor",
      editorInstance: "original-sdk-editor",
      epoch: 1,
    },
    groups: [plan.inputTarget, plan.outerTarget].map((target) => ({
      target,
      bindingId: plan.bindingId,
      bindingRevision: plan.bindingRevision,
      scopeTarget: plan.outerTarget,
      containsTarget: true,
    })),
  }
  let prevented = false,
    stopped = false
  return {
    nativeEvent: {
      kind: "keyboard",
      ownerId: plan.bindingId,
      target: plan.originalTarget,
      key,
      code: "KeyZ",
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
      fieldDispatch: JSON.stringify(packet),
    },
    target: f.input.current,
    currentTarget: f.input.current,
    get defaultPrevented() {
      return prevented
    },
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
    isDefaultPrevented: () => prevented,
    isPropagationStopped: () => stopped,
    persist: jest.fn(),
  } as unknown as TNativeFieldKeyEvent & TNativeComboBoxKeyboardEvent
}
const deliver = async (f: Awaited<ReturnType<typeof setup>>, event: ReturnType<typeof originalKey>) => {
  await act(() => {
    row(f.inputID).props.onNativeFieldKey(event)
    if (event.isPropagationStopped()) return
    for (const target of [f.plan.input, f.plan.outer]) {
      ;(event as TNativeFieldKeyEvent).currentTarget = target
      const id = f.inputID === "type-ahead-search-input" ? "type-ahead-search" : "combo-box"
      row(target === f.plan.input ? `${id}-group` : id).props.onNativeFieldKey(event)
    }
  })
}

describe.each(["compact", "tags"] as const)("%s original editor key contract", (kind) => {
  it("delivers both original phases once and acknowledges the caller's text-default veto", async () => {
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
    const acknowledgements = mockNative.settleField.mock.calls.map(([request]) => JSON.parse(request))
    expect(acknowledgements.map(({ phase, preventDefault }) => [phase, preventDefault])).toEqual([
      ["down", true],
      ["up", false],
    ])
  })
  it("rejects a foreign editor receiver and duplicate delivery of a settled original event", async () => {
    const f = await setup(kind)
    const foreign = originalKey(f, "down")
    foreign.currentTarget = {} as RN.TextInput
    await act(() => row(f.inputID).props.onNativeFieldKey(foreign))
    expect(f.down).not.toHaveBeenCalled()
    const original = originalKey(f, "down")
    await deliver(f, original)
    original.currentTarget = f.input.current!
    await deliver(f, original)
    expect(f.down).toHaveBeenCalledTimes(1)
    expect(mockNative.settleField).toHaveBeenCalledTimes(1)
  })
  it("retires old event delivery after a guard replacement", async () => {
    const f = await setup(kind)
    const event = originalKey(f, "down")
    const previous = row(f.inputID).props.onNativeFieldKey
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
    expect(JSON.parse(mockNative.settleField.mock.calls[0][0]).preventDefault).toBe(false)
  })
})
