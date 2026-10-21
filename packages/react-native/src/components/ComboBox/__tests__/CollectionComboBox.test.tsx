import "../../../collection/__tests__/nativeReceipts"

import { createRef, useContext, useState } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
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
  const ready = async () => {
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
    for (const ready of [false, true]) {
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
  expect(close.mock.calls).toEqual([[false], [false]])
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
  expect(state.selectionManager.focusedKey).toBeNull()
  await key("End")
  await key("Enter")
  expect(change.mock.calls).toEqual([["b"], ["b"]])
  expect(close.mock.calls).toEqual([[false], [false]])
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
