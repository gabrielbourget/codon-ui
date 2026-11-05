import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { Button, TypeaheadSearch } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual<typeof import("react")>("react")
    .forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const React = jest.requireActual<typeof import("react")>("react")
      const { View } = jest.requireActual<typeof RN>("react-native")
      const bind = React.useCallback(
        (node: RN.View | null) => {
          if (node) mockRefs.set(props.ownerId, node)
          else mockRefs.delete(props.ownerId)
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        },
        [ref, props.ownerId],
      )
      return <View {...props} ref={bind} />
    }),
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
const mockRefs = new Map<string, RN.View>()
const originals = new Map<RN.View, number>()
const methods: { measureLayout: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  originals.clear()
  mockRefs.clear()
  let serial = 100
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return null
    if (!originals.has(target as RN.View)) originals.set(target as RN.View, ++serial)
    return originals.get(target as RN.View)!
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const items = [
  { id: 0, name: "Alpha" },
  { id: "0", name: "Beta" },
  { id: "", name: "Charlie" },
]
const row = (name: string) => screen.getByRole("radio", { name })

const scopeHost = () => screen.getByTestId("typeahead-search")
const acknowledgeScope = async () => {
  for (const ready of [false, true])
    await act(() => {
      const props = scopeHost().props
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "typeahead-source-window",
          epoch: 1,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      })
    })
  for (const ready of [false, true])
    await act(() => {
      const props = scopeHost().props
      props.onNativeObservationStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: props.acceptedWindowId,
          epoch: props.acceptedEpoch,
          observationRevision: props.observationRevision,
          ready,
          windowActive: true,
        },
      })
    })
}
let ordinarySequence = 0
const acknowledgeOrdinary = () =>
  act(() => {
    const props = scopeHost().props
    for (const binding of props.ordinaryEditorBindings)
      props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...binding,
          ownerId: props.ownerId,
          target: binding.targetTag,
          windowId: props.acceptedWindowId,
          epoch: props.acceptedEpoch,
          sequence: ++ordinarySequence,
          ready: true,
          windowActive: true,
          error: "",
        },
      })
  })
let observedId = 0
const observeTab = (shiftKey = false) =>
  act(() => {
    const props = scopeHost().props
    props.onNativeObservedKey({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: props.acceptedWindowId,
        epoch: props.acceptedEpoch,
        observationRevision: props.observationRevision,
        eventId: ++observedId,
        observerIds: props.observations.map((observer: { id: string }) => observer.id),
        target: 9000,
        focusedTarget: 9000,
        key: "Tab",
        code: "Tab",
        nativeCode: 61,
        legacyKeyCode: 9,
        location: 0,
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "",
        defaultCaptured: false,
        timestamp: observedId,
      },
    })
  })

const enterPackets = (original: RN.TextInput, dispatchId: number, extra = {}) => {
  const props = scopeHost().props
  const target = jest.requireActual<typeof RN>("react-native").findNodeHandle(original)!
  const binding = props.ordinaryEditorBindings.find(
    (entry: { targetTag: number; originalEditorAction?: boolean }) =>
      entry.targetTag === target && entry.originalEditorAction,
  )
  const policy = props.policies.find(
    (entry: { targetTag: number; originalEditorAction?: boolean }) =>
      entry.targetTag === target && entry.originalEditorAction,
  )
  expect(binding).toBeDefined()
  expect(policy).toBeDefined()
  const data = {
    kind: "keyboard",
    ownerId: props.ownerId,
    policyId: policy.id,
    target: 9,
    focusedTarget: target,
    windowId: props.acceptedWindowId,
    epoch: props.acceptedEpoch,
    policyRevision: props.policyRevision,
    key: "Enter",
    nativeCode: 66,
    characters: "\n",
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
    ...extra,
  }
  const frame = { ...data, ...binding, targetTag: target, dispatchId, admitted: true, isComposing: false, ...extra }
  return {
    internal: { nativeEvent: { ...data, originalEditorAction: JSON.stringify(frame) } },
    original: {
      target: original,
      currentTarget: original,
      persist: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        ...data,
        ...binding,
        target,
        eventId: dispatchId,
        code: "Enter",
        location: 0,
        isComposing: false,
        observerBindings: "[]",
        originalEditorAction: JSON.stringify(frame),
        ...extra,
      },
    },
  }
}

// Original-host status/key packets exercise the existing receiver; no installed keyboard authority is manufactured.
const receiver = (name: string) => {
  const host = row(name)
  const binding = JSON.parse(host.props.nativeKeyBinding) as { ownerId: string; descriptorRevision: string }
  const original = mockRefs.get(binding.ownerId)!
  expect(original).toBeDefined()
  const target = jest.requireActual<typeof RN>("react-native").findNodeHandle(original)!
  expect(target).toBeGreaterThan(0)
  let eventId = 0
  const frame = {
    ...binding,
    viewOwnerId: binding.ownerId,
    target,
    surfaceId: 1,
    windowId: "typeahead-source-window",
    epoch: 1,
    sequence: 1,
    scopeOwnerId: scopeHost().props.ownerId,
    scopeEpoch: scopeHost().props.acceptedEpoch,
    attached: true,
    active: true,
    enabled: true,
    focusedTarget: target,
    isComposing: false,
  }
  const packet = (kind: string, key: string, admitted = false, extra = {}) => ({
    target: original,
    currentTarget: original,
    persist: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...binding,
      kind,
      target,
      key,
      nativeCode: 17,
      characters: key,
      phase: "down",
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "",
      timestamp: 1,
      nativeDefaultHandled: admitted,
      localFrame: JSON.stringify({ ...frame, eventId: ++eventId, admitted }),
      ...extra,
    },
  })
  return {
    original,
    ready: () => act(() => host.props.onNativeKey(packet("key-status", ""))),
    key: (key: string, admitted = true, extra = {}) =>
      act(() => host.props.onNativeKey(packet("keyboard", key, admitted, extra))),
    observeFocus: () =>
      act(() =>
        host.props.onNativeFocusChange({
          nativeEvent: {
            ownerId: binding.ownerId,
            target,
            isFocused: true,
            isFocusVisible: true,
            origin: "keyboard",
            timestamp: 1,
          },
        }),
      ),
    retire: () =>
      act(() =>
        host.props.onNativeKey(
          packet("key-status", "", false, {
            localFrame: JSON.stringify({ ...frame, active: false, focusedTarget: 0, epoch: 2, sequence: 2 }),
          }),
        ),
      ),
  }
}
const positions = () => {
  const y = new Map(items.map((item, index) => [row(item.name).props.ownerId as string, index * 100]))
  methods.measureLayout.mockImplementation(function (this: RN.View, _relative, done) {
    done(0, y.get([...mockRefs].find(([, original]) => original === this)?.[0] ?? "") ?? 0, 200, 30)
  })
}

it("uses actual admitted row keys for measured focus, textValue search, single selection and Escape without query requests", async () => {
  const changed = jest.fn(),
    selected = jest.fn()
  await render(
    <TypeaheadSearch
      inputValue="held"
      onInputChange={changed}
      items={items}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
    />,
  )
  await acknowledgeScope()
  positions()
  const a = receiver("Alpha"),
    b = receiver("Beta"),
    c = receiver("Charlie")
  await a.ready()
  await b.ready()
  await c.ready()
  expect(row("Alpha").props.nativeTabStop).toBe(true)
  expect(row("Beta").props.nativeTabStop).toBe(false)
  await a.observeFocus()
  await a.key("ArrowDown", true, { target: -1 })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await a.key("ArrowDown")
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(b.original, row("Beta").props.ownerId)
  expect(selected).not.toHaveBeenCalled()
  await b.observeFocus()
  expect(row("Beta").props.nativeTabStop).toBe(true)
  expect(row("Alpha").props.nativeTabStop).toBe(false)
  await b.key("c", false)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(c.original, row("Charlie").props.ownerId)
  await b.key("Enter")
  const selectedB = receiver("Beta")
  await selectedB.ready()
  await selectedB.key("Enter", true, { repeat: true })
  expect(selected.mock.calls).toEqual([["0"]])
  await selectedB.key("Escape")
  const emptyB = receiver("Beta")
  await emptyB.ready()
  await emptyB.key("Escape", false)
  expect(JSON.parse(row("Beta").props.nativeKeyBinding).tokens).not.toContain("0000:Escape")
  expect(selected.mock.calls).toEqual([["0"], [null]])
  expect(changed).not.toHaveBeenCalled()
})

it("measures page targets and retires delayed focus on the same original row's window retirement", async () => {
  await render(
    <TypeaheadSearch inputValue="held" onInputChange={jest.fn()} items={items} getItemKey={(item) => item.id} />,
  )
  await acknowledgeScope()
  positions()
  await fireEvent(screen.getByTestId("typeahead-search-results-container"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 150 } },
  })
  await fireEvent(screen.getByTestId("typeahead-search-results-container"), "contentSizeChange", 200, 300)
  const a = receiver("Alpha"),
    c = receiver("Charlie")
  await a.ready()
  await a.key("PageDown")
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(c.original, row("Charlie").props.ownerId)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  const pending: (() => void)[] = []
  methods.measureLayout.mockImplementation((_relative, done) => pending.push(() => done(0, 200, 200, 30)))
  await a.key("End")
  expect(pending).toHaveLength(1)
  await a.retire()
  await act(() => pending.shift()?.())
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("requests the actual group container when the last focused row is removed, without a selection callback", async () => {
  const selected = jest.fn()
  const fixture = (current: typeof items) => (
    <TypeaheadSearch
      inputValue="held"
      onInputChange={jest.fn()}
      items={current}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
    />
  )
  const view = await render(fixture(items.slice(0, 1)))
  await acknowledgeScope()
  const a = receiver("Alpha")
  await a.observeFocus()
  await view.rerender(fixture([]))
  expect(Commands.requestContainerFocus).toHaveBeenCalledTimes(1)
  expect(jest.mocked(Commands.requestContainerFocus).mock.calls[0]![0].props.testID).toBe(
    "typeahead-search-results-list",
  )
  expect(screen.getByTestId("typeahead-search-results-list").props.nativeTabStop).toBe(true)
  expect(selected).not.toHaveBeenCalled()
})

it("uses actual uncaptured Tab direction for initial backward entry and preserves the observed row on reentry", async () => {
  const selected = jest.fn()
  await render(
    <TypeaheadSearch
      inputValue="held"
      onInputChange={jest.fn()}
      items={items}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
    />,
  )
  await acknowledgeScope()
  positions()
  const a = receiver("Alpha"),
    c = receiver("Charlie")
  await observeTab(true)
  await a.observeFocus()
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(c.original, row("Charlie").props.ownerId)
  expect(row("Alpha").props.nativeTabStop).toBe(true)
  await c.observeFocus()
  expect(row("Charlie").props.nativeTabStop).toBe(true)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await observeTab()
  await c.observeFocus()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(selected).not.toHaveBeenCalled()
})

it("leaves exhausted nonwrapping arrows and empty-selection Escape to the native default", async () => {
  await render(
    <TypeaheadSearch
      inputValue="held"
      onInputChange={jest.fn()}
      items={items}
      getItemKey={(item) => item.id}
      shouldFocusWrap={false}
    />,
  )
  await acknowledgeScope()
  const tokens = (name: string): string[] => JSON.parse(row(name).props.nativeKeyBinding).tokens
  expect(tokens("Alpha")).not.toContain("0000:ArrowUp")
  expect(tokens("Alpha")).toContain("0000:ArrowDown")
  expect(tokens("Charlie")).not.toContain("0000:ArrowDown")
  expect(tokens("Beta")).not.toContain("0000:Escape")
  const groupTokens: string[] = JSON.parse(
    screen.getByTestId("typeahead-search-results-list").props.nativeKeyBinding,
  ).tokens
  expect(groupTokens).not.toContain("1000:Home")
  const a = receiver("Alpha")
  await a.ready()
  await a.key("ArrowUp", false)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("submits each paired focused-editor Enter including modifiers/repeats, retains result selection and preserves unrelated stock observations", async () => {
  const editor = createRef<RN.TextInput>(),
    selected = jest.fn(),
    submit = jest.fn(),
    stock = jest.fn(),
    keyPress = jest.fn()
  const order: unknown[] = []
  await render(
    <TypeaheadSearch
      inputRef={editor}
      inputValue="  held query  "
      onInputChange={jest.fn()}
      items={items}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
      onSubmitQuery={(value) => {
        order.push(value)
        submit(value)
      }}
      inputProps={{
        onSubmitEditing: (event) => {
          order.push(event)
          stock(event)
        },
        onKeyPress: keyPress,
      }}
    />,
  )
  await acknowledgeScope()
  await acknowledgeOrdinary()
  const a = receiver("Alpha")
  await a.ready()
  await a.key("Enter")
  expect(selected.mock.calls).toEqual([[0]])
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByRole("radio", { name: "Alpha" })).toBeChecked()
  for (let mask = 0; mask < 16; mask++) {
    const packet = enterPackets(editor.current!, mask + 1, {
      shiftKey: !!(mask & 8),
      altKey: !!(mask & 4),
      ctrlKey: !!(mask & 2),
      metaKey: !!(mask & 1),
      repeat: mask > 0,
    })
    await act(() => scopeHost().props.onNativeScopedKey(packet.internal))
    expect(submit).toHaveBeenCalledTimes(mask)
    await act(() => screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(packet.original))
    await act(() => screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(packet.original))
    expect(submit).toHaveBeenCalledTimes(mask + 1)
  }
  expect(submit.mock.calls).toEqual(Array.from({ length: 16 }, () => ["held query"]))
  expect(stock).not.toHaveBeenCalled()
  expect(keyPress).not.toHaveBeenCalled()
  expect(selected.mock.calls).toEqual([[0]])
  const composing = enterPackets(editor.current!, 17, { isComposing: true, nativeDefaultHandled: false })
  await act(() => scopeHost().props.onNativeScopedKey(composing.internal))
  await act(() => screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(composing.original))
  expect(submit).toHaveBeenCalledTimes(16)
  const soft = { nativeEvent: { text: "soft payload", target: 7 } }
  await fireEvent(screen.getByTestId("typeahead-search-input"), "submitEditing", soft)
  expect(order.slice(-2)).toEqual([soft, "held query"])
  expect(stock.mock.calls[0]![0]).toBe(soft)
  expect(submit).toHaveBeenCalledTimes(17)
  const key = { nativeEvent: { key: "x" } }
  await fireEvent(screen.getByTestId("typeahead-search-input"), "keyPress", key)
  expect(keyPress.mock.calls[0]![0]).toBe(key)
  expect(submit).toHaveBeenCalledTimes(17)
})

it("retires unmatched editor Enter on callback/ref/disabled lifetime changes and preserves original callback-ref cleanup", async () => {
  const first = jest.fn(),
    second = jest.fn(),
    changed = jest.fn(),
    cleanup = jest.fn(),
    replacementCleanup = jest.fn()
  let editor: RN.TextInput | null = null
  const publicRef = jest.fn((target: RN.TextInput | null) => {
    editor = target
    if (target) return cleanup
  })
  const replacementRef = jest.fn((target: RN.TextInput | null) => {
    editor = target
    if (target) return replacementCleanup
  })
  const fixture = (submit = first, disabled = false, value = "  first  ", ref = publicRef) => (
    <TypeaheadSearch
      inputRef={ref}
      inputValue={value}
      onInputChange={changed}
      onSubmitQuery={submit}
      isDisabled={disabled}
    />
  )
  const view = await render(fixture())
  await acknowledgeScope()
  await acknowledgeOrdinary()
  const original = editor!,
    old = enterPackets(original, 1)
  await act(() => scopeHost().props.onNativeScopedKey(old.internal))
  await view.rerender(fixture(second, false, "  latest  "))
  expect(editor).toBe(original)
  expect(publicRef).toHaveBeenCalledTimes(1)
  await act(() => screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(old.original))
  expect(first).not.toHaveBeenCalled()
  expect(second).not.toHaveBeenCalled()
  await acknowledgeScope()
  await acknowledgeOrdinary()
  const current = enterPackets(original, 2)
  await act(() => scopeHost().props.onNativeScopedKey(current.internal))
  await act(() => screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(current.original))
  expect(second.mock.calls).toEqual([["latest"]])
  const beforeRefReplacement = enterPackets(original, 3)
  await act(() => scopeHost().props.onNativeScopedKey(beforeRefReplacement.internal))
  await view.rerender(fixture(second, false, "  latest  ", replacementRef))
  expect(editor).toBe(original)
  expect(cleanup).toHaveBeenCalledTimes(1)
  await act(() =>
    screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey(beforeRefReplacement.original),
  )
  expect(second).toHaveBeenCalledTimes(1)
  await acknowledgeScope()
  await acknowledgeOrdinary()
  const pending = enterPackets(original, 4)
  await act(() => scopeHost().props.onNativeScopedKey(pending.internal))
  const receive = screen.getByTestId("typeahead-search-input").props.onNativeOrdinaryEditorKey
  await view.rerender(fixture(second, true, "  latest  ", replacementRef))
  await act(() => receive(pending.original))
  expect(second).toHaveBeenCalledTimes(1)
  await view.unmount()
  await act(() => receive(pending.original))
  expect(second).toHaveBeenCalledTimes(1)
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(replacementCleanup).toHaveBeenCalledTimes(1)
})

it("attaches descendant Tab to the actual group, remembers truthful raw-zero ancestry and ignores temporary edge focus", async () => {
  const selected = jest.fn(),
    submit = jest.fn()
  await render(
    <TypeaheadSearch
      inputValue="held"
      onInputChange={jest.fn()}
      onSubmitQuery={submit}
      items={items}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
      renderItem={(item) =>
        item.name === "Beta" ? <Button accessibilityLabel="Nested Beta action">Beta action</Button> : item.name
      }
    />,
  )
  await acknowledgeScope()
  await acknowledgeOrdinary()
  const rows = screen.getAllByRole("radio"),
    group = screen.getByTestId("typeahead-search-results-list")
  const tag = (host: typeof group) =>
    jest.requireActual<typeof RN>("react-native").findNodeHandle(mockRefs.get(host.props.ownerId)!)!
  const a = rows[0]!,
    b = rows[1]!,
    child = screen.getByRole("button", { name: "Nested Beta action" })
  const props = scopeHost().props,
    binding = JSON.parse(props.toolbarBindings).find((entry: { rootTarget: number }) => entry.rootTarget === tag(group))
  expect(binding.tabOnly).toBe(true)
  expect(group.props.role).toBe("radiogroup")
  expect(group.props.onNativeOrdinaryEditorKeyCapture).toEqual(expect.any(Function))
  const status = {
    ...binding,
    ownerId: props.ownerId,
    windowId: props.acceptedWindowId,
    epoch: props.acceptedEpoch,
    sequence: 1,
    observationReady: true,
    ready: true,
    windowActive: true,
    nestedToolbar: false,
    error: "",
  }
  await act(() => props.onNativeToolbarStatus({ nativeEvent: { packet: JSON.stringify(status) } }))
  const focusA = () =>
    act(() =>
      a.props.onNativeFocusChange({
        nativeEvent: {
          ownerId: a.props.ownerId,
          target: tag(a),
          isFocused: true,
          isFocusVisible: true,
          origin: "programmatic",
          timestamp: 1,
        },
      }),
    )
  await focusA()
  const data = {
    ...status,
    target: 0,
    focusedTarget: 0,
    requestedTarget: tag(a),
    destinationTarget: tag(a),
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
    physicalPath: [tag(child), tag(b), tag(group)],
  }
  await act(() =>
    scopeHost().props.onNativeToolbarKeyboard({ nativeEvent: { packet: JSON.stringify(data) }, persist: jest.fn() }),
  )
  expect(screen.getAllByRole("radio")[1]!.props.nativeTabStop).toBe(true)
  await focusA()
  expect(screen.getAllByRole("radio")[1]!.props.nativeTabStop).toBe(true)
  expect(screen.getAllByRole("radio")[0]!.props.nativeTabStop).toBe(false)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(selected).not.toHaveBeenCalled()
  expect(submit).not.toHaveBeenCalled()
})
