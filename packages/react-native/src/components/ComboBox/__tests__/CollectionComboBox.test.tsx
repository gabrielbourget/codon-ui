import "../../../collection/__tests__/nativeReceipts"

import { act as actWithoutNativeCollections } from "@testing-library/react-native"
import { createRef, useContext, useState } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { DefaultNativeCollectionRenderer, NativeCollectionRendererContext } from "../../../collection/renderer"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { TagComboBox } from "../../TagComboBox/TagComboBox"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import {
  NativeComboBoxContext,
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
  NativeComboBoxStateContext,
} from "../collectionContext"
import type { TNativeCollectionComboBoxStyleState } from "../collectionTypes"
import { NativeComboBoxItem } from "../ComboBoxItem"
import { NativeComboBoxHeader, NativeComboBoxSection } from "../ComboBoxSection"
import { FormValidationContext } from "../state/useFormValidationState"

const ITEMS = [
  { id: 0, label: "Zero" },
  { id: "", label: "Empty" },
  { id: "b", label: "Beta" },
]
const hidden = { includeHiddenElements: true }
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let sequence = 0
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => {
  frames.clear()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const setup = () => {
  const host = createRef<RN.View>(),
    anchor = createRef<RN.View>(),
    popup = createRef<RN.View>()
  const node = (child: React.ReactNode) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="host" ref={host}>
          <NativeComboBoxGroupContext.Provider value={{ ref: anchor }}>
            <NativeComboBoxPopoverContext.Provider value={{ ref: popup }}>
              {child}
            </NativeComboBoxPopoverContext.Provider>
          </NativeComboBoxGroupContext.Provider>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const ready = async (resetScope = true) => {
    const measure = (target: RN.View, box: [number, number, number, number]) =>
      Object.defineProperty(target, "measureInWindow", {
        configurable: true,
        value: (callback: (...values: number[]) => void) => callback(...box),
      })
    measure(host.current!, [0, 0, 360, 640])
    measure(anchor.current!, [10, 40, 260, 48])
    measure(popup.current!, [0, 0, 260, 180])
    await fireEvent(screen.getByTestId("host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    await fireEvent(screen.getByTestId("combo-box-popover", hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
    })
    for (const ready of resetScope ? [false, true] : [true]) {
      const scope = screen.getByTestId("host").props
      await act(() =>
        scope.onNativeScopeStatus({
          nativeEvent: {
            ownerId: scope.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            policyRevision: scope.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
    }
    for (let turn = 0; turn < 3; turn++)
      await act(() => {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(0))
      })
  }
  return { node, ready }
}
const press = async (id: string) => {
  const row = screen.getByTestId(id, hidden)
  const event = {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => row.props.onResponderGrant(event))
  await act(() => row.props.onResponderRelease(event))
}

// Original window packets below are explicit component models, not installed SDK input evidence.
it.each([
  "select",
  "outside",
  "cancel",
  "query",
  "query-restore",
  "disabled",
  "disabled-restore",
  "read-only",
  "unmount",
  "window",
  "prevented",
  "pen",
  "late-query",
  "late-read-only",
  "pending",
  "input-origin",
] as const)(
  "admits trigger-to-option mouse release only while its original ownership is current: %s",
  async (scenario) => {
    const native = jest.requireActual<typeof import("react-native")>("react-native")
    const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
    const targets = new WeakMap<object, number>()
    let nextTarget = 850000
    jest.mocked(native.findNodeHandle).mockImplementation((view) => {
      const existing = inherited(view)
      if (existing || !view || typeof view !== "object") return existing
      if (!targets.has(view)) targets.set(view, ++nextTarget)
      return targets.get(view)!
    })
    const f = setup(),
      editor = createRef<RN.TextInput>(),
      option = createRef<RN.View>(),
      changes = jest.fn()
    let retire!: () => void
    let restore!: () => void
    const Harness = () => {
      const [open, setOpen] = useState(scenario === "input-origin"),
        [retired, setRetired] = useState(false)
      retire = () => setRetired(true)
      restore = () => setRetired(false)
      if (retired && scenario === "unmount") return null
      return (
        <NativeCollectionComboBox
          items={ITEMS}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          inputLabel="Query"
          inputRef={editor}
          closeLabel="Close"
          isOpen={open}
          onOpenChange={setOpen}
          onChange={changes}
          dependencies={scenario === "pending" ? [retired] : undefined}
          isDisabled={retired && scenario.startsWith("disabled")}
          isReadOnly={retired && (scenario === "read-only" || scenario === "late-read-only")}
        >
          {(item) => (
            <NativeComboBoxItem
              id={item.id}
              ref={item.id === 0 ? option : undefined}
              textValue={item.label}
              isPending={retired && scenario === "pending"}
            >
              {item.label}
            </NativeComboBoxItem>
          )}
        </NativeCollectionComboBox>
      )
    }
    await render(f.node(<Harness />))
    const acknowledge = async () => {
      const host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            policyRevision: host.policyRevision,
            ready: true,
            windowActive: true,
          },
        }),
      )
      const committed = screen.getByTestId("host").props
      await act(() =>
        committed.onNativePointerStatus({
          nativeEvent: {
            ownerId: committed.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            revision: committed.pointerRevision,
            ready: true,
            error: "",
          },
        }),
      )
    }
    await acknowledge()
    const initial = screen.getByTestId("host").props
    const triggerTarget = initial.pointerRegistrations[0].targetTag
    const packet = (phase: "start" | "end" | "cancel", hitTarget: number) => {
      const host = screen.getByTestId("host").props
      return {
        persist: jest.fn(),
        isDefaultPrevented: () => false,
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          sequence: ++sequence,
          phase,
          pointerId: 7,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: phase === "start" ? 1 : 0,
          nativeButtons: "0",
          nativeModifiers: "0",
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          pageX: 20,
          pageY: 50,
          timestamp: sequence,
          target: hitTarget,
          registrations: host.pointerRegistrations.map((entry: { id: string; targetTag: number }) => ({
            ...entry,
            ownerId: host.ownerId,
            epoch: 1,
            revision: host.pointerRevision,
            depth: entry.targetTag === hitTarget ? 0 : -1,
          })),
        },
      }
    }
    const down = packet("start", scenario === "input-origin" ? native.findNodeHandle(editor.current)! : triggerTarget)
    if (scenario === "pen") Object.assign(down.nativeEvent, { pointerType: "pen" })
    await act(() => initial.onNativeWindowPointer(down))
    const trigger = screen.getByTestId("combo-box-trigger", hidden)
    const original = {
      target: triggerTarget,
      currentTarget: triggerTarget,
      persist: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        target: triggerTarget,
        timestamp: 1,
        identifier: 7,
        pageX: 20,
        pageY: 50,
        locationX: 0,
        locationY: 0,
        pointerType: "mouse",
      },
    }
    if (scenario !== "input-origin") {
      await act(() => trigger.props.onPointerDown(original))
      await act(() => trigger.props.onResponderGrant(original))
    }
    await f.ready(false)
    await acknowledge()
    expect(changes).not.toHaveBeenCalled()
    const optionTarget = native.findNodeHandle(option.current)!
    if (scenario.startsWith("query")) await fireEvent.changeText(screen.getByTestId("combo-box-input"), "Beta")
    if (scenario === "query-restore") await fireEvent.changeText(screen.getByTestId("combo-box-input"), "")
    if (["disabled", "disabled-restore", "read-only", "unmount", "pending"].includes(scenario)) await act(retire)
    if (scenario === "pending") await acknowledge()
    if (scenario === "disabled-restore") await act(restore)
    if (scenario === "window") {
      const host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            policyRevision: host.policyRevision,
            ready: true,
            windowActive: false,
          },
        }),
      )
    }
    const up = packet(scenario === "cancel" ? "cancel" : "end", scenario === "outside" ? 0 : optionTarget)
    if (scenario === "prevented") up.isDefaultPrevented = () => true
    if (scenario.startsWith("late-")) {
      await actWithoutNativeCollections(() => screen.getByTestId("host").props.onNativeWindowPointer(up))
      expect(changes).not.toHaveBeenCalled()
      expect(
        screen.container
          .queryAll((host) => !!host.props.actionRequests)
          .some((host) => JSON.parse(host.props.actionRequests).length > 0),
      ).toBe(true)
      if (scenario === "late-query") await fireEvent.changeText(screen.getByTestId("combo-box-input"), "Beta")
      else await act(retire)
    } else await act(() => screen.getByTestId("host").props.onNativeWindowPointer(up))
    expect(changes.mock.calls).toEqual(scenario === "select" || scenario === "input-origin" ? [[0]] : [])
    expect(down.persist).toHaveBeenCalledTimes(scenario === "pen" ? 0 : 1)
  },
)

it("binds all five sectioned options to the original list target in linked reading order", async () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let nextTarget = 800000
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    const original = inherited(view)
    if (original) return original
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++nextTarget)
    return targets.get(view)!
  })
  const f = setup()
  await render(
    f.node(
      <NativeCollectionComboBox
        items={[]}
        getKey={() => "unused"}
        getTextValue={() => "unused"}
        name="wire"
        inputLabel="Query"
        closeLabel="Close"
        isOpen
      >
        <NativeComboBoxItem id="" textValue="Empty" testID="ordered-empty">
          Empty
        </NativeComboBoxItem>
        <NativeComboBoxSection id="first-section" accessibilityLabel="First section">
          <NativeComboBoxItem id={0} textValue="Number zero" testID="ordered-number">
            Number zero
          </NativeComboBoxItem>
          <NativeComboBoxItem id="0" textValue="String zero" testID="ordered-string">
            String zero
          </NativeComboBoxItem>
        </NativeComboBoxSection>
        <NativeComboBoxSection id="second-section">
          <NativeComboBoxHeader>Second section</NativeComboBoxHeader>
          <NativeComboBoxItem id="third" textValue="Third" testID="ordered-third">
            Third
          </NativeComboBoxItem>
          <NativeComboBoxItem id="fourth" textValue="Fourth" testID="ordered-fourth">
            Fourth
          </NativeComboBoxItem>
        </NativeComboBoxSection>
      </NativeCollectionComboBox>,
    ),
  )
  await f.ready()
  const root = screen.getByTestId("combo-box-list", hidden)
  expect(JSON.parse(root.props.nativeCollectionSemantics)).toEqual({ kind: "list-root", count: 5 })
  const binding = JSON.parse(root.props.nativeCollectionBinding)
  expect(binding.descriptorId).toBe("")
  const field = screen.container.queryAll(
    (node) => typeof node.props.semanticBinding === "string" && node.props.semanticBinding.length > 0,
  )[0]
  const listAlias = JSON.parse(field.props.semanticBinding).aliases.find(
    (alias: { id: string }) => alias.id === root.props.nativeID,
  )
  expect(listAlias.target).toBeGreaterThan(0)
  for (const [ordinal, name] of ["empty", "number", "string", "third", "fourth"].entries()) {
    const option = screen.getByTestId(`ordered-${name}`, hidden)
    expect(JSON.parse(option.props.nativeCollectionSemantics)).toEqual({
      kind: "list-item",
      parentTarget: listAlias.target,
      ordinal,
    })
    const itemBinding = JSON.parse(option.props.nativeCollectionBinding)
    expect(itemBinding.rootRevision).toBe(binding.rootRevision)
    expect(itemBinding.descriptorId).not.toBe("")
  }
})

it("connects the complete state and original values to committed options and repeated owner-vetoed selection", async () => {
  const f = setup(),
    change = jest.fn(),
    close = jest.fn(),
    editor = createRef<RN.TextInput>()
  let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  await render(
    f.node(
      <NativeCollectionComboBox
        items={ITEMS}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        value={null}
        inputValue="Empty"
        inputRef={editor}
        isOpen
        onChange={change}
        onOpenChange={close}
        accessibilityLabel="Choices"
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem id={item.id} testID={`option-${String(item.id)}`}>
            <Capture />
            {item.label}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  await f.ready()
  expect(editor.current).not.toBeNull()
  expect(state.collection.getItem("")!.value).toBe(ITEMS[1])
  expect(typeof state.commitValidation).toBe("function")
  await press("option-")
  await press("option-")
  expect(change.mock.calls).toEqual([[""], [""]])
  expect(close.mock.calls).toEqual([])
  expect(state.value).toBeNull()
  expect(state.inputValue).toBe("Empty")
})

it("receives actual declarative options and preserves composite add/clear ordering", async () => {
  const f = setup(),
    events: string[] = [],
    change = jest.fn()
  await render(
    f.node(
      <TagComboBox
        items={ITEMS}
        selectedItems={[]}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.label}
        onSelectedItemsChange={(...args) => {
          events.push("selected")
          change(...args)
        }}
        onInputChange={(value) => events.push(`input:${value}`)}
        inputValue="Empty"
        isOpen
        customComboBoxProps={{ onInputChange: (value) => events.push(`nested:${value}`) }}
      >
        <NativeComboBoxItem id="" textValue="Empty" testID="static-empty">
          Empty
        </NativeComboBoxItem>
      </TagComboBox>,
    ),
  )
  await f.ready()
  await press("static-empty")
  await press("static-empty")
  expect(events).toEqual(["selected", "input:", "nested:", "selected", "input:", "nested:"])
  expect(change.mock.calls[0][0][0]).toBe(ITEMS[1])
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("Empty")
})

it("routes admitted input navigation through the full state without moving the original editor ref", async () => {
  const f = setup(),
    editor = createRef<RN.TextInput>(),
    change = jest.fn(),
    close = jest.fn()
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const find = jest.mocked(native.findNodeHandle).getMockImplementation()!
  // Model the original native TextInput target; this fixture establishes no SDK/input verdict.
  jest
    .mocked(native.findNodeHandle)
    .mockImplementation((target) => (target != null && target === editor.current ? 888888 : find(target)))
  let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  await render(
    f.node(
      <NativeCollectionComboBox
        items={ITEMS}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        value={null}
        inputRef={editor}
        isOpen
        disabledKeys={[""]}
        onChange={change}
        onOpenChange={close}
        accessibilityLabel="Choices"
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem id={item.id} textValue={item.label}>
            <Capture />
            {item.label}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  await f.ready()
  const original = editor.current
  const key = async (value: string, extra: Record<string, unknown> = {}) => {
    let host = screen.getByTestId("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    host = screen.getByTestId("host").props
    const policy = host.policies.find(
      (candidate: { targetTag: number; tokens: string[] }) =>
        candidate.targetTag === native.findNodeHandle(editor.current) && candidate.tokens.includes(`0000:${value}`),
    )
    expect(policy).toBeDefined()
    const event = {
      persist: jest.fn(),
      preventDefault: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        target: native.findNodeHandle(editor.current),
        focusedTarget: native.findNodeHandle(editor.current),
        windowId: "source-model-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        key: value,
        phase: "down",
        repeat: false,
        cancelled: false,
        nativeCode: 1,
        characters: "",
        nativeDefaultHandled: true,
        timestamp: 100,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        ...extra,
      },
    }
    await act(() => host.onNativeScopedKey(event))
  }
  await key("ArrowDown")
  expect(state.selectionManager.focusedKey).toBe(0)
  await key("ArrowDown")
  expect(state.selectionManager.focusedKey).toBe("b")
  await key("ArrowUp", { cancelled: true })
  expect(state.selectionManager.focusedKey).toBe("b")
  await key("Home")
  expect(state.selectionManager.focusedKey).toBe(0)
  await key("End")
  expect(state.selectionManager.focusedKey).toBe("b")
  await key("Enter")
  expect(state.selectionManager.focusedKey).toBe("b")
  await key("End")
  await key("Enter")
  expect(change.mock.calls).toEqual([["b"], ["b"]])
  expect(close.mock.calls).toEqual([])
  expect(state.value).toBeNull()
  expect(editor.current === original).toBe(true)
})

it("receives full parent context at the inner picker and preserves null-slot opt out", async () => {
  const f = setup(),
    outer = createRef<RN.View>(),
    inner = createRef<RN.View>(),
    inherited = jest.fn(),
    authored = jest.fn()
  const content = (slot?: null) =>
    f.node(
      <NativeComboBoxContext.Provider
        value={{ ref: inner, isReadOnly: true, inputValue: "context query", onInputChange: inherited }}
      >
        <TagComboBox
          ref={outer}
          items={ITEMS}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          onSelectedItemsChange={() => {}}
          onInputChange={authored}
          slot={slot}
        />
      </NativeComboBoxContext.Provider>,
    )
  await render(content())
  expect(outer.current).not.toBeNull()
  expect(inner.current).not.toBeNull()
  expect(inner.current === outer.current).toBe(false)
  expect(screen.getByTestId("combo-box-input").props.readOnly).toBe(true)
  expect(screen.getByTestId("combo-box-input").props.value).toBe("")
  await act(() => screen.rerender(content(null)))
  expect(inner.current).toBeNull()
  expect(screen.getByTestId("combo-box-input").props.readOnly).toBe(false)
  await fireEvent.changeText(screen.getByTestId("combo-box-input"), "owner query")
  expect(authored).toHaveBeenCalledWith("owner query")
  expect(inherited).not.toHaveBeenCalled()
})

it("forwards original input focus records and the complete five render flags", async () => {
  const f = setup(),
    focus = jest.fn(),
    blur = jest.fn(),
    nestedFocus = jest.fn(),
    nestedBlur = jest.fn(),
    changed = jest.fn(),
    style = jest.fn((state: TNativeCollectionComboBoxStyleState) => ({ opacity: state.isRequired ? 1 : 0.5 }))
  await render(
    f.node(
      <NativeCollectionComboBox
        items={ITEMS}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        accessibilityLabel="Choices"
        inputLabel="Query"
        closeLabel="Close"
        isRequired
        isInvalid
        isReadOnly
        style={style}
        onFocus={focus}
        onBlur={blur}
        onFocusChange={changed}
        inputProps={{ onFocus: nestedFocus, onBlur: nestedBlur }}
      />,
    ),
  )
  expect(style.mock.calls.at(-1)?.[0]).toMatchObject({
    isOpen: false,
    isDisabled: false,
    isInvalid: true,
    isRequired: true,
    isReadOnly: true,
    defaultStyle: expect.any(Object),
  })
  const entered = { nativeEvent: { target: 17 } },
    left = { nativeEvent: { target: 17 } }
  await act(() => screen.getByTestId("combo-box-input").props.onFocus(entered))
  await act(() => screen.getByTestId("combo-box-input").props.onFocus(entered))
  expect(focus.mock.calls).toEqual([[entered]])
  expect(nestedFocus.mock.calls).toEqual([[entered], [entered]])
  await act(() => screen.getByTestId("combo-box-input").props.onBlur(left))
  expect(blur.mock.calls).toEqual([[left]])
  expect(nestedBlur.mock.calls).toEqual([[left]])
  expect(changed.mock.calls).toEqual([[true], [false]])
})

it("passes named server validation and client validation policy into the full state", async () => {
  const f = setup(),
    validate = jest.fn(() => "Client invalid")
  let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  const content = (errors: Record<string, string>, behavior: "native" | "aria") =>
    f.node(
      <FormValidationContext.Provider value={errors}>
        <NativeCollectionComboBox
          items={ITEMS}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          accessibilityLabel="Choices"
          inputLabel="Query"
          closeLabel="Close"
          inputValue="Zero"
          isOpen
          name="entry"
          validate={validate}
          validationBehavior={behavior}
        >
          {(item) => (
            <NativeComboBoxItem id={item.id}>
              <Capture />
              {item.label}
            </NativeComboBoxItem>
          )}
        </NativeCollectionComboBox>
      </FormValidationContext.Provider>,
    )
  await render(content({ entry: "Server invalid" }, "native"))
  expect(state.displayValidation.validationErrors).toEqual(["Server invalid"])
  expect(validate).toHaveBeenCalledWith({ inputValue: "Zero", value: null, selectedKey: null })
  await act(() => screen.rerender(content({}, "aria")))
  expect(state.displayValidation.validationErrors).toEqual(["Client invalid"])
  expect(state.realtimeValidation.isInvalid).toBe(true)
})

it("preserves parent-controlled filtering without replacing the wrapper's original authored items", async () => {
  const f = setup()
  const contextItems = [{ id: "context-only", label: "Context only" }]
  const Owner = () => {
    const [query, setQuery] = useState("")
    return (
      <NativeComboBoxContext.Provider value={{ items: contextItems }}>
        <TagComboBox
          items={ITEMS}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          onSelectedItemsChange={() => {}}
          inputValue={query}
          onInputChange={setQuery}
        />
      </NativeComboBoxContext.Provider>
    )
  }
  await render(f.node(<Owner />))
  await press("combo-box-trigger")
  await f.ready()
  expect(screen.getByRole("option", { name: "Zero" })).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByTestId("combo-box-input"), "missing")
  expect(screen.getByRole("option", { name: "Zero" })).toBeOnTheScreen()
  expect(screen.queryByRole("option", { name: "Context only" })).toBeNull()
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("missing")
})

it("follows linked collection order after opaque parent-controlled reordering", async () => {
  const f = setup(),
    editor = createRef<RN.TextInput>()
  const native = jest.requireActual("react-native") as typeof RN
  const find = jest.mocked(native.findNodeHandle).getMockImplementation()!
  // Model only the original editor's native target, as in the established keyboard fixture.
  jest
    .mocked(native.findNodeHandle)
    .mockImplementation((target) => (target != null && target === editor.current ? 888888 : find(target)))
  const values = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]
  let reverse!: () => void
  let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  const Opaque = () => {
    const [reversed, setReversed] = useState(false)
    reverse = () => setReversed(true)
    return (reversed ? [...values].reverse() : values).map((item) => (
      <NativeComboBoxItem key={item.id} id={item.id} textValue={item.label}>
        <Capture />
        {item.label}
      </NativeComboBoxItem>
    ))
  }
  await render(
    f.node(
      <NativeComboBoxContext.Provider value={{ items: values }}>
        <NativeCollectionComboBox
          items={values}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          value={null}
          inputValue=""
          inputRef={editor}
          isOpen
          accessibilityLabel="Choices"
          inputLabel="Query"
          closeLabel="Close"
        >
          <Opaque />
        </NativeCollectionComboBox>
      </NativeComboBoxContext.Provider>,
    ),
  )
  await f.ready()
  const original = editor.current
  const key = async (value: string, extra: Record<string, unknown> = {}) => {
    let host = screen.getByTestId("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    host = screen.getByTestId("host").props
    const policy = host.policies.find(
      (candidate: { targetTag: number; tokens: string[] }) =>
        candidate.targetTag === native.findNodeHandle(editor.current) && candidate.tokens.includes(`0000:${value}`),
    )
    expect(policy).toBeDefined()
    const event = {
      persist: jest.fn(),
      preventDefault: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        target: native.findNodeHandle(editor.current),
        focusedTarget: native.findNodeHandle(editor.current),
        windowId: "source-model-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        key: value,
        phase: "down",
        repeat: false,
        cancelled: false,
        nativeCode: 1,
        characters: "",
        nativeDefaultHandled: true,
        timestamp: 100,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        ...extra,
      },
    }
    await act(() => host.onNativeScopedKey(event))
  }
  await key("Home")
  expect(state.selectionManager.focusedKey).toBe("a")
  await act(reverse)
  expect([...state.collection].map((node) => node.key)).toEqual(["c", "b", "a"])
  expect([...state.collection.getKeys()]).toEqual(["a", "b", "c"])
  await key("Home")
  expect(state.selectionManager.focusedKey).toBe("c")
  await key("ArrowDown")
  expect(state.selectionManager.focusedKey).toBe("b")
  await key("End")
  expect(state.selectionManager.focusedKey).toBe("a")
  await key("ArrowDown")
  expect(state.selectionManager.focusedKey).toBe("c")
  expect(editor.current === original).toBe(true)
  expect(state.value).toBeNull()
})

it("retains the custom picker root, complete render state and original field/root refs", async () => {
  const f = setup(),
    outer = createRef<RN.View>(),
    picker = createRef<RN.View>(),
    editor = createRef<RN.TextInput>()
  let flags: Record<string, unknown> = {}
  const content = (replacement: boolean) =>
    f.node(
      <NativeComboBoxContext.Provider value={{ ref: picker, "aria-label": "Parent field" }}>
        <TagComboBox
          items={ITEMS}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          onSelectedItemsChange={() => {}}
          ref={outer}
          inputRef={editor}
          id="source-field"
          aria-label="Source field"
          inputValue="held"
          isRequired
          isInvalid
          render={
            replacement
              ? undefined
              : (props, state) => {
                  flags = state
                  return <NativeFocusHost {...props} testID="custom-picker" />
                }
          }
        />
      </NativeComboBoxContext.Provider>,
    )
  await render(content(false))
  const originalRoot = picker.current,
    originalOuter = outer.current,
    originalInput = editor.current
  expect(originalRoot).not.toBeNull()
  expect(originalInput).not.toBeNull()
  expect(originalRoot === originalOuter).toBe(false)
  expect(screen.getByTestId("tag-combobox").props.id).toBeUndefined()
  expect(screen.getByTestId("custom-picker").props.id).toBeUndefined()
  expect(screen.getByTestId("combo-box-input").props.nativeID).toBe("source-field")
  expect(screen.getByTestId("combo-box-input").props.accessibilityLabel).toBe("Source field")
  expect(screen.getByTestId("combo-box-trigger").props.accessibilityLabel).toBe("Show suggestions")
  expect(screen.getByTestId("combo-box-group").props.accessibilityLabel).toBe("ComboBox Input Button Group")
  expect(flags).toEqual({ isOpen: false, isDisabled: false, isInvalid: true, isRequired: true, isReadOnly: false })
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held")
  await act(() => screen.rerender(content(true)))
  expect(screen.queryByTestId("custom-picker")).toBeNull()
  expect(picker.current).not.toBeNull()
  expect(outer.current === originalOuter).toBe(true)
  expect(editor.current === originalInput).toBe(true)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held")
})
it.each(["wrapper", "nested", "parent"] as const)(
  "keeps %s field naming and IDs separate from trigger and group labels",
  async (owner) => {
    const f = setup()
    await render(
      f.node(
        <NativeComboBoxContext.Provider
          value={{ id: owner === "parent" ? "parent-field" : undefined, "aria-label": "Parent field" }}
        >
          <TagComboBox
            items={ITEMS}
            selectedItems={[]}
            getItemKey={(item) => item.id}
            getItemTextValue={(item) => item.label}
            onSelectedItemsChange={() => {}}
            {...(owner === "wrapper" ? { id: "source-field", "aria-label": "Source field" } : null)}
            customComboBoxProps={owner === "nested" ? { id: "nested-field", "aria-label": "Nested field" } : undefined}
          />
        </NativeComboBoxContext.Provider>,
      ),
    )
    const expected = owner === "wrapper" ? "Source" : owner === "nested" ? "Nested" : "Parent"
    expect(screen.getByTestId("combo-box-input").props.nativeID).toBe(expected.toLowerCase() + "-field")
    expect(screen.getByTestId("combo-box-input").props.accessibilityLabel).toBe(expected + " field")
    expect(screen.getByTestId("combo-box-trigger").props.accessibilityLabel).toBe("Show suggestions")
    expect(screen.getByTestId("combo-box-group").props.accessibilityLabel).toBe("ComboBox Input Button Group")
    expect(screen.queryByTestId("tag-combobox-input-group")).toBeNull()
  },
)

it.each(["isDisabled", "isReadOnly"] as const)(
  "keeps explicit state requests available with %s while the owner vetoes",
  async (guard) => {
    const f = setup(),
      events: string[] = []
    let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
    const Capture = () => {
      state = useContext(NativeComboBoxStateContext)!
      return null
    }
    await render(
      f.node(
        <TagComboBox
          items={ITEMS}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          {...{ [guard]: true }}
          inputValue="held"
          onInputChange={(value) => events.push("input:" + value)}
          onSelectedItemsChange={(next, details) => {
            expect(next[0] === ITEMS[0]).toBe(true)
            expect(details.action).toBe("add")
            events.push("selected")
          }}
          render={(props) => (
            <NativeFocusHost {...props}>
              {props.children}
              <Capture />
            </NativeFocusHost>
          )}
        />,
      ),
    )
    await act(() => state.setInputValue("explicit"))
    await act(() => state.setValue(0))
    expect(events).toEqual(["input:explicit", "selected", "input:"])
    expect(state.value).toBeNull()
    expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held")
  },
)

it("retires old editor callbacks after requested host replacement without resetting logical owner state", async () => {
  const f = setup(),
    input = createRef<RN.TextInput>(),
    change = jest.fn(),
    focus = jest.fn(),
    blur = jest.fn(),
    within = jest.fn()
  let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  const content = (revision: number) =>
    f.node(
      <NativeCollectionComboBox
        items={ITEMS}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        value={null}
        inputValue="held"
        inputRef={input}
        inputLabel="Query"
        closeLabel="Close"
        onInputChange={change}
        onFocus={focus}
        onBlur={blur}
        onFocusChange={within}
        render={(props) => (
          <NativeFocusHost {...props} key={revision}>
            {props.children}
            <Capture />
          </NativeFocusHost>
        )}
      />,
    )
  await render(content(0))
  const first = input.current,
    retired = screen.getByTestId("combo-box-input").props
  const entered = { nativeEvent: { target: 17 } },
    left = { nativeEvent: { target: 17 } }
  await act(() => retired.onFocus(entered))
  expect(state.isFocused).toBe(true)
  expect(focus).toHaveBeenCalledTimes(1)
  await act(() => screen.rerender(content(1)))
  expect(input.current === first).toBe(false)
  expect(state.isFocused).toBe(true)
  await act(() => {
    retired.onChangeText("retired query")
    retired.onFocus(entered)
    retired.onBlur(left)
  })
  expect(change).not.toHaveBeenCalled()
  expect(focus).toHaveBeenCalledTimes(1)
  expect(blur).not.toHaveBeenCalled()
  expect(state.isFocused).toBe(true)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held")
  await act(() => screen.getByTestId("combo-box-input").props.onFocus(entered))
  expect(focus).toHaveBeenCalledTimes(1)
  expect(within.mock.calls).toEqual([[true], [true]])
})

it.each(["mouse", "pen", "touch"] as const)(
  "uses original %s trigger timing without a release retoggle",
  async (type) => {
    const f = setup(),
      input = createRef<RN.TextInput>(),
      changed = jest.fn()
    let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
    const Capture = () => {
      state = useContext(NativeComboBoxStateContext)!
      return null
    }
    await render(
      f.node(
        <NativeCollectionComboBox
          items={ITEMS}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          inputRef={input}
          inputLabel="Query"
          closeLabel="Close"
          onOpenChange={changed}
          render={(props) => (
            <NativeFocusHost {...props}>
              {props.children}
              <Capture />
            </NativeFocusHost>
          )}
        />,
      ),
    )
    const original = input.current,
      row = screen.getByTestId("combo-box-trigger")
    const event = {
      target: 17,
      currentTarget: 17,
      persist: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: { target: 17, timestamp: 1, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
    }
    await act(() =>
      row.props.onPointerDown({
        persist: jest.fn(),
        nativeEvent: { pointerType: type },
        isDefaultPrevented: () => false,
      }),
    )
    await act(() => row.props.onResponderGrant(event))
    expect(state.isOpen).toBe(type !== "touch")
    expect(changed.mock.calls).toStrictEqual(type === "touch" ? [] : [[true, "manual"]])
    await act(() => row.props.onResponderRelease(event))
    expect(state.isOpen).toBe(true)
    expect(changed.mock.calls).toStrictEqual([[true, "manual"]])
    expect(state.isFocused).toBe(false)
    expect(input.current === original).toBe(true)
  },
)

it.each(["disabled", "readonly", "window", "unmount", "cancel", "prevented"] as const)(
  "retires an original held touch trigger on %s",
  async (reason) => {
    const f = setup(),
      changed = jest.fn()
    const content = (disabled = false, readOnly = false) =>
      f.node(
        <NativeCollectionComboBox
          items={ITEMS}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          inputLabel="Query"
          closeLabel="Close"
          isDisabled={disabled}
          isReadOnly={readOnly}
          onOpenChange={changed}
        />,
      )
    await render(content())
    const target = screen.getByTestId("combo-box-trigger").props
    const event = {
      target: 17,
      currentTarget: 17,
      persist: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: { target: 17, timestamp: 1, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
    }
    const pointer = {
      persist: jest.fn(),
      nativeEvent: { pointerType: "touch" },
      defaultPrevented: false,
      isDefaultPrevented: () => false,
    }
    await act(() => {
      target.onPointerDown(pointer)
      target.onResponderGrant(event)
    })
    if (reason === "disabled") await act(() => screen.rerender(content(true)))
    else if (reason === "readonly") await act(() => screen.rerender(content(false, true)))
    else if (reason === "unmount") await act(() => screen.rerender(f.node(null)))
    else if (reason === "cancel") await act(() => target.onResponderTerminate(event))
    else if (reason === "prevented") pointer.defaultPrevented = true
    else {
      const host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "retired",
            epoch: 2,
            policyRevision: host.policyRevision,
            ready: false,
            windowActive: false,
          },
        }),
      )
    }
    if (reason !== "cancel") await act(() => target.onResponderRelease(event))
    expect(changed).not.toHaveBeenCalled()
  },
)

it.each([false, true])(
  "commits the closed native submit with owner-held matching text, readonly=%s",
  async (readonly) => {
    const f = setup(),
      events: string[] = []
    const opened = jest.fn()
    const submitted = jest.fn((event) => events.push("submit:" + event.nativeEvent.text))
    await render(
      f.node(
        <TagComboBox
          items={ITEMS}
          selectedItems={[]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          inputValue="Zero"
          isReadOnly={readonly}
          onSelectedItemsChange={() => {}}
          onInputChange={(value) => events.push("input:" + value)}
          inputProps={{ onSubmitEditing: submitted }}
          onOpenChange={opened}
        />,
      ),
    )
    const event = { nativeEvent: { text: "Zero", target: 17, eventCount: 1 } }
    await act(() => screen.getByTestId("combo-box-input").props.onFocus({ nativeEvent: { target: 17 } }))
    await act(() => screen.getByTestId("combo-box-input").props.onSubmitEditing(event))
    expect(events).toEqual(["submit:Zero"])
    expect(opened.mock.calls).toStrictEqual(readonly ? [] : [[true, "input"]])
    expect(submitted.mock.calls[0][0] === event).toBe(true)
    expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("Zero")
  },
)

it.each(["current", "readonly", "query"] as const)(
  "holds virtual submit for its actual current row, %s",
  async (change) => {
    const f = setup(),
      selected = jest.fn(),
      requested = jest.fn()
    let show!: () => void, retire!: () => void
    let state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
    const Capture = () => {
      state = useContext(NativeComboBoxStateContext)!
      return null
    }
    const Owner = () => {
      const [visible, setVisible] = useState(false),
        [retired, setRetired] = useState(false)
      show = () => setVisible(true)
      retire = () => setRetired(true)
      return (
        <NativeCollectionRendererContext.Provider
          value={{
            ...DefaultNativeCollectionRenderer,
            isVirtualized: true,
            CollectionRoot: (props) => (visible ? <DefaultNativeCollectionRenderer.CollectionRoot {...props} /> : null),
            layoutDelegate: {
              getItemRect: () => null,
              getVisibleRect: () => ({ x: 0, y: 0, width: 260, height: 180 }),
              getContentSize: () => ({ width: 260, height: 180 }),
              getKeyRange: () => [],
              requestRendering: requested,
            },
          }}
        >
          <NativeCollectionComboBox
            items={ITEMS}
            getKey={(item) => item.id}
            getTextValue={(item) => item.label}
            value={null}
            inputValue={retired && change === "query" ? "changed" : ""}
            isReadOnly={retired && change === "readonly"}
            isOpen
            onChange={selected}
            inputLabel="Query"
            closeLabel="Close"
            render={(props) => (
              <NativeFocusHost {...props}>
                {props.children}
                <Capture />
              </NativeFocusHost>
            )}
          />
        </NativeCollectionRendererContext.Provider>
      )
    }
    await render(f.node(<Owner />))
    await f.ready()
    await act(() => state.selectionManager.setFocusedKey("b"))
    const submitted = { persist: jest.fn(), nativeEvent: { target: 17, text: "", eventCount: 1 } }
    await act(() => screen.getByTestId("combo-box-input").props.onSubmitEditing(submitted))
    await act(() =>
      screen
        .getByTestId("combo-box-input")
        .props.onSubmitEditing({ persist: jest.fn(), nativeEvent: { target: 17, text: "", eventCount: 2 } }),
    )
    expect(selected).not.toHaveBeenCalled()
    expect(requested).toHaveBeenCalledWith("b")
    if (change !== "current") await act(retire)
    await act(show)
    expect(selected.mock.calls).toEqual(change === "current" ? [["b"], ["b"]] : [])
  },
)

it.each(["selection", "action", "link", "action-link"])(
  "preserves source item mouse callback ordering and ownership: %s",
  async (kind) => {
    const f = setup(),
      trace: unknown[] = []
    await render(
      f.node(
        <NativeCollectionComboBox
          items={[ITEMS[0]]}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          value={null}
          inputValue=""
          isOpen
          inputLabel="Query"
          closeLabel="Close"
          onChange={(key) => trace.push(["select", key])}
          onOpenChange={(value) => trace.push(["open", value])}
        >
          {(item) => (
            <NativeComboBoxItem
              id={item.id}
              textValue={item.label}
              testID="action-option"
              href={kind.includes("link") ? "/zero" : undefined}
              onAction={kind.includes("action") ? () => trace.push(["action"]) : undefined}
              onNavigate={(href) => trace.push(["navigate", href])}
              onPressChange={(value) => trace.push(["change", value])}
              onPressStart={() => trace.push(["start"])}
              onPressUp={() => trace.push(["up"])}
              onPressEnd={() => trace.push(["end"])}
              onPress={() => trace.push(["press"])}
            >
              {item.label}
            </NativeComboBoxItem>
          )}
        </NativeCollectionComboBox>,
      ),
    )
    await f.ready()
    const option = screen.getByTestId("action-option", hidden)
    const original = {
      target: 17,
      currentTarget: 17,
      persist: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        target: 17,
        timestamp: 1,
        identifier: 0,
        pageX: 0,
        pageY: 0,
        locationX: 0,
        locationY: 0,
        pointerType: "mouse",
      },
    }
    await act(() => option.props.onPointerDown(original))
    await act(() => option.props.onResponderGrant(original))
    expect(trace).toEqual([["start"], ["change", true]])
    await act(() => option.props.onResponderRelease(original))
    const business =
      kind === "selection"
        ? [["select", 0]]
        : kind.includes("action")
          ? [["action"], ["open", false]]
          : [
              ["navigate", "/zero"],
              ["open", false],
            ]
    expect(trace).toEqual(
      kind.includes("action")
        ? [["start"], ["change", true], ["up"], ["end"], ["change", false], ...business, ["press"]]
        : [["start"], ["change", true], ...business, ["up"], ["end"], ["change", false], ["press"]],
    )
  },
)

it.each(
  ["selection", "action", "link", "action-link"].flatMap((kind) => ["enter", "tab"].map((mode) => ({ kind, mode }))),
)("uses original input Enter/Tab with source action and link precedence: $kind/$mode", async ({ kind, mode }) => {
  const f = setup(),
    editor = createRef<RN.TextInput>(),
    trace: unknown[] = []
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
  jest
    .mocked(native.findNodeHandle)
    .mockImplementation((view) => (view != null && view === editor.current ? 888888 : inherited(view)))
  await render(
    f.node(
      <NativeCollectionComboBox
        items={[ITEMS[0]]}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        inputRef={editor}
        value={null}
        inputValue=""
        isOpen
        inputLabel="Query"
        closeLabel="Close"
        onChange={(key) => trace.push(["select", key])}
        onOpenChange={(open) => trace.push(["open", open])}
      >
        {(item) => (
          <NativeComboBoxItem
            id={item.id}
            textValue={item.label}
            href={kind.includes("link") ? "/zero" : undefined}
            onAction={kind.includes("action") ? () => trace.push(["action"]) : undefined}
            onNavigate={(href) => trace.push(["navigate", href])}
          >
            {item.label}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  await f.ready()
  const original = editor.current
  const key = async (value: string) => {
    let host = screen.getByTestId("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    host = screen.getByTestId("host").props
    const policy = host.policies.find(
      (entry: { targetTag: number; tokens: string[] }) =>
        entry.targetTag === 888888 && entry.tokens.includes(`0000:${value}`),
    )
    expect(policy).toBeDefined()
    await act(() =>
      host.onNativeScopedKey({
        persist: jest.fn(),
        isDefaultPrevented: () => false,
        nativeEvent: {
          kind: "keyboard",
          ownerId: host.ownerId,
          policyId: policy.id,
          target: 888888,
          focusedTarget: 888888,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          key: value,
          phase: "down",
          repeat: false,
          cancelled: false,
          nativeCode: 1,
          characters: "",
          nativeDefaultHandled: true,
          timestamp: ++sequence,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          capsLock: false,
          nativeModifierData: "0",
        },
      }),
    )
  }
  await key("ArrowDown")
  trace.length = 0
  if (mode === "enter") await key("Enter")
  else {
    let host = screen.getByTestId("host").props
    for (let attempt = 0; attempt < 2; attempt++) {
      host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeObservationStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "source-model-window",
            epoch: 1,
            observationRevision: host.observationRevision,
            ready: true,
            windowActive: true,
          },
        }),
      )
    }
    host = screen.getByTestId("host").props
    const registration = host.observations.find((entry: { targetTag: number }) => entry.targetTag === 888888)
    expect(registration).toBeDefined()
    await act(() =>
      host.onNativeObservedKey({
        persist: jest.fn(),
        isDefaultPrevented: () => false,
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          observationRevision: host.observationRevision,
          observerIds: [registration.id],
          eventId: ++sequence,
          target: 888888,
          focusedTarget: 888888,
          key: "Tab",
          code: "Tab",
          nativeCode: 1,
          legacyKeyCode: 9,
          location: 0,
          repeat: false,
          cancelled: false,
          isComposing: false,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          capsLock: false,
          nativeModifierData: "0",
          defaultCaptured: false,
          timestamp: sequence,
        },
      }),
    )
  }
  const expected =
    kind === "selection"
      ? [["select", 0]]
      : kind === "action"
        ? [["action"], ["open", false]]
        : mode === "enter"
          ? [
              ["navigate", "/zero"],
              ["open", false],
            ]
          : [["open", false]]
  expect(trace).toEqual(expected)
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("")
})

it.each(["current", "synchronous", "query", "href", "unmount"])(
  "uses the original native link route and retires obsolete failures: %s",
  async (mode) => {
    const f = setup(),
      report = jest.fn(),
      failure = new Error("original navigation"),
      url = "codon://zero"
    let reject!: (error: unknown) => void, retire!: () => void
    const open = jest.spyOn(RN.Linking, "openURL").mockImplementation(() => {
      if (mode === "synchronous") throw failure
      return new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest
      })
    })
    open.mockClear()
    const Harness = () => {
      const [retired, setRetired] = useState(false)
      retire = () => setRetired(true)
      if (retired && mode === "unmount") return null
      return (
        <NativeCollectionComboBox
          items={[ITEMS[0]]}
          getKey={(item) => item.id}
          getTextValue={(item) => item.label}
          isOpen
          value={null}
          inputValue={retired && mode === "query" ? "replacement" : ""}
          dependencies={[retired]}
          inputLabel="Query"
          closeLabel="Close"
        >
          {(item) => (
            <NativeComboBoxItem
              id={item.id}
              textValue={item.label}
              testID="native-link"
              href={retired && mode === "href" ? "codon://replacement" : url}
              accessibilityHint={retired && mode === "href" ? "codon://replacement" : url}
              onNavigationError={report}
            >
              {item.label}
            </NativeComboBoxItem>
          )}
        </NativeCollectionComboBox>
      )
    }
    await render(f.node(<Harness />))
    await f.ready()
    await press("native-link")
    expect(open.mock.calls).toEqual([[url]])
    if (mode !== "synchronous") {
      if (mode !== "current") await act(retire)
      if (mode === "href") expect(screen.getByTestId("native-link").props.accessibilityHint).toBe("codon://replacement")
      await act(async () => reject(failure))
    }
    expect(report.mock.calls).toEqual(mode === "current" || mode === "synchronous" ? [[failure, url]] : [])
    if (mode === "current" || mode === "synchronous") expect(report.mock.calls[0][0]).toBe(failure)
  },
)
