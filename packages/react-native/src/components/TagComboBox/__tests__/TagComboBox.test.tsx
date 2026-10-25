import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, useState } from "react"
import * as RN from "react-native"

import { NativeThemeProvider, TagComboBox, TagComboBoxItem, Text } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  fireEventWithNativeCollections as fireEvent,
  screen,
  userEvent,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormRegistry } from "../../../form/registry"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { resolveNativeTheme } from "../../../theme/defaults"
import { NativeComboBoxGroupContext, NativeComboBoxPopoverContext } from "../../ComboBox/collectionContext"
import { getNativeTagComboBoxStyles } from "../styles"
import type { TNativeTagComboBoxProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
type TItem = { key: string | number; label: string; group: string }
const items: TItem[] = [
  { key: 0, label: "Zero", group: "First" },
  { key: "", label: "Empty", group: "Second" },
  { key: "tail", label: "Tail", group: "Third" },
]
const base: TNativeTagComboBoxProps<TItem> = {
  items,
  selectedItems: [],
  getItemKey: (item) => item.key,
  getItemTextValue: (item) => item.label,
  onSelectedItemsChange: () => {},
}
const modelOriginalFormTargets = () => {
  const native = jest.requireActual<typeof RN>("react-native")
  const find = native.findNodeHandle as jest.Mock
  const previous = find.getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let sequence = 2000000
  find.mockImplementation((host) => {
    const known = previous(host)
    if (known != null || !host || typeof host !== "object") return known
    if (!targets.has(host)) targets.set(host, ++sequence)
    return targets.get(host)!
  })
}
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
const host = createRef<RN.View>(),
  anchor = createRef<RN.View>(),
  popup = createRef<RN.View>()
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameSequence = 0
const wrap = (children: React.ReactNode) => (
  <NativeThemeProvider>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="fixture-host" ref={host}>
        <NativeComboBoxGroupContext.Provider value={{ ref: anchor }}>
          <NativeComboBoxPopoverContext.Provider value={{ ref: popup }}>
            {children}
          </NativeComboBoxPopoverContext.Provider>
        </NativeComboBoxGroupContext.Provider>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const node = (props: Partial<TNativeTagComboBoxProps<TItem>> = {}) => wrap(<TagComboBox {...base} {...props} />)
const ready = async () => {
  const measure = (target: RN.View, box: number[]) =>
    Object.defineProperty(target, "measureInWindow", {
      configurable: true,
      value: (callback: (...values: number[]) => void) => callback(...box),
    })
  measure(host.current!, [0, 0, 360, 640])
  measure(anchor.current!, [10, 40, 260, 48])
  measure(popup.current!, [0, 0, 260, 180])
  await fireEvent(row("fixture-host"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } } })
  await fireEvent(row("combo-box-popover"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
  })
  for (const ready of [false, true]) {
    const scope = row("fixture-host").props
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
const choose = async (label = "Empty") => {
  await ready()
  await act(() => userEvent.setup().press(screen.getByRole("option", { name: label })))
}
const remove = async () => {
  const target = row("tag-remove-button")
  const event = {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: { target: 17, timestamp: 100, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => target.props.onResponderGrant(event))
  await act(() => target.props.onResponderRelease(event))
}
beforeEach(() => {
  jest.useFakeTimers()
  frames.clear()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameSequence
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("CAP.tag-combobox.001 forwards actual root/editor refs and composes the two native controls", async () => {
  const root = createRef<RN.View>(),
    input = createRef<RN.TextInput>()
  await render(wrap(<TagComboBox {...base} ref={root} inputRef={input} isOpen selectedItems={[items[0]]} />))
  expect(root.current).not.toBeNull()
  expect(input.current).not.toBeNull()
  expect(typeof root.current?.measure).toBe("function")
  expect(typeof input.current?.setNativeProps).toBe("function")
  expect(row("tag-combobox").props.role).toBe("group")
  expect(row("tag-group")).toBeOnTheScreen()
  expect(row("combo-box")).toBeOnTheScreen()
})
it("CAP.tag-combobox.002/.010/.011/.013 keeps root and every nested style owner independent", async () => {
  await render(
    node({
      selectedItems: [items[0]],
      width: 0,
      height: 50,
      minWidth: 0,
      maxWidth: 300,
      customStyles: { width: 150, marginTop: 5 },
      style: { width: 175, marginBottom: 10 },
      customTagGroupStyles: { backgroundColor: "gold" },
      customTagGroupProps: { testID: "selected-group", customStyles: { marginTop: 2 } },
      customTagStyles: { color: "orange" },
      customTagProps: { testID: "selected-tag", customStyles: { backgroundColor: "purple" } },
      customComboBoxStyles: { backgroundColor: "blue" },
      customComboBoxProps: {
        testID: "choices",
        customStyles: { color: "green" },
        customInputButtonGroupStyles: { borderBottomWidth: 7 },
      },
    }),
  )
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style)).toMatchObject({
    width: 175,
    height: 50,
    minWidth: 0,
    maxWidth: 300,
    marginTop: 5,
    marginBottom: 10,
  })
  expect(RN.StyleSheet.flatten(row("selected-group").props.style)).toMatchObject({
    backgroundColor: "gold",
    marginTop: 2,
  })
  expect(RN.StyleSheet.flatten(row("selected-tag").props.style)).toMatchObject({ backgroundColor: "purple" })
  expect(RN.StyleSheet.flatten(screen.getByText("Zero", hidden).props.style).color).toBe("orange")
  expect(RN.StyleSheet.flatten(row("choices").props.style).backgroundColor).toBe("blue")
  expect(RN.StyleSheet.flatten(row("choices-group").props.style)).toMatchObject({
    borderWidth: 0,
    borderBottomWidth: 0,
  })
})
it("CAP.tag-combobox.003/.012 preserves color and original icon content", async () => {
  await render(
    node({ selectedItems: [items[0]], color: "turquoise", ComponentIcon: <Text testID="custom-icon">Open</Text> }),
  )
  expect(RN.StyleSheet.flatten(row("tag").props.style).backgroundColor).toBe("turquoise")
  expect(row("custom-icon")).toBeOnTheScreen()
})
it.each([
  ["small", "b11"],
  ["medium", "b10"],
  ["large", "b9"],
] as const)("CAP.tag-combobox.004 maps %s default tag typography", async (textSize, variant) => {
  expect(getNativeTagComboBoxStyles(resolveNativeTheme("light"), { ...base, textSize }, false).textVariant).toBe(
    variant,
  )
  const view = await render(node({ selectedItems: [items[0]], textSize }))
  const before = RN.StyleSheet.flatten(screen.getByText("Zero", hidden).props.style)
  expect(typeof before.fontSize).toBe("number")
  await view.rerender(node({ selectedItems: [items[0]], textSize: textSize === "large" ? "small" : "large" }))
  expect(RN.StyleSheet.flatten(screen.getByText("Zero", hidden).props.style).fontSize).not.toBe(before.fontSize)
})
it("CAP.tag-combobox.005 binds observed root focus and preserves explicit disabled ring flags", async () => {
  const view = await render(node())
  await fireEvent(row("tag-combobox"), "focus", { nativeEvent: { target: 17 } })
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBe(1.5)
  await view.rerender(node({ enableFocusStyle: false, offsetFocusRing: false }))
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBeUndefined()
})
it("CAP.tag-combobox.005 follows original descendant focus observations and retires stale focus", async () => {
  modelOriginalFormTargets()
  const root = createRef<RN.View>()
  await render(wrap(<TagComboBox {...base} ref={root} isOpen />))
  await ready()
  const props = row("tag-combobox").props
  expect(props.nativeFocusWithinBinding).toEqual(expect.any(String))
  expect(props.nativeFocusWithinBinding).not.toBe("")
  const data = {
    ownerId: props.ownerId,
    bindingId: props.nativeFocusWithinBinding,
    target: RN.findNodeHandle(root.current),
    surfaceId: 1,
    windowId: "source-model-window",
    scopeOwnerId: row("fixture-host").props.ownerId,
    scopeEpoch: 1,
    sequence: 2,
    attached: true,
    active: true,
    within: true,
    focusedTarget: 313,
    textInputFocused: true,
    origin: "keyboard",
    observedAt: 100,
  }
  await act(() => props.onNativeFocusWithin({ nativeEvent: data }))
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBe(1.5)
  await act(() => props.onNativeFocusWithin({ nativeEvent: { ...data, sequence: 1, within: false } }))
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBe(1.5)
  await act(() =>
    props.onNativeFocusWithin({
      nativeEvent: { ...data, sequence: 3, within: false, focusedTarget: 0, textInputFocused: false },
    }),
  )
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBeUndefined()
  await fireEvent(row("tag-combobox"), "focus", { nativeEvent: { target: 313 } })
  expect(RN.StyleSheet.flatten(row("tag-combobox").props.style).outlineWidth).toBeUndefined()
})
it("CAP.tag-combobox.006/.007 keeps disabled and controlled false open state authoritative", async () => {
  const change = jest.fn()
  await render(
    node({
      selectedItems: [items[0]],
      isDisabled: true,
      isOpen: false,
      onSelectedItemsChange: change,
      customTagProps: { isDisabled: false },
      customComboBoxProps: { isDisabled: false, isOpen: true },
    }),
  )
  expect(row("tag-combobox").props.accessibilityState.disabled).toBe(true)
  expect(row("tag-remove-button").props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByRole("option")).toBeNull()
  expect(change).not.toHaveBeenCalled()
})
it("CAP.tag-combobox.014 consumes wrapper props and sends root layout events once", async () => {
  const layout = jest.fn()
  await render(
    node({
      selectedItems: [items[0]],
      onLayout: layout,
      nativeID: "root-owner",
      labels: {},
      order: "primary",
      minWidth: 0,
    }),
  )
  for (const key of ["selectedItems", "items", "labels", "order", "minWidth", "getItemKey", "customTagGroupProps"])
    expect(row("tag-combobox").props[key]).toBeUndefined()
  expect(row("combo-box").props.nativeID).toBeUndefined()
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 90 } } }
  await fireEvent(row("tag-combobox"), "layout", event)
  expect(layout.mock.calls[0][0] === event).toBe(true)
  expect(layout).toHaveBeenCalledTimes(1)
})
it("CAP.tag-combobox.015 merges independent labels with nested ComboBox label precedence", async () => {
  await render(
    node({
      accessibilityLabel: "Picker field",
      labels: {
        groupAriaLabel: "Controls",
        tagGroupAriaLabel: "Selected",
        comboBox: { triggerButtonAriaLabel: "Outer choices" },
      },
      customComboBoxProps: {
        labels: { triggerButtonAriaLabel: "Nested choices", inputButtonGroupAriaLabel: "Input controls" },
      },
    }),
  )
  expect(row("tag-combobox").props.accessibilityLabel).toBe("Controls")
  expect(row("tag-list").props.accessibilityLabel).toBe("Selected")
  expect(row("combo-box-group").props.accessibilityLabel).toBe("Input controls")
  expect(screen.queryByTestId("tag-combobox-picker", hidden)).toBeNull()
  expect(row("combo-box-input").props.accessibilityLabel).toBe("Picker field")
  expect(screen.getByRole("button", { name: "Nested choices" })).toBeOnTheScreen()
})
it("CAP.tag-combobox.016/.023/.024 preserves repeated owner vetoes, original objects and clear callback order", async () => {
  const selectedItems: TItem[] = [],
    events: string[] = [],
    change = jest.fn()
  await render(
    node({
      selectedItems,
      inputValue: "Empty",
      isOpen: true,
      onSelectedItemsChange: (...args) => {
        events.push("selected")
        change(...args)
      },
      onInputChange: (text) => events.push(`input:${text}`),
      customComboBoxProps: { onInputChange: (text) => events.push(`nested:${text}`) },
    }),
  )
  await choose()
  await choose()
  expect(events).toEqual(["selected", "input:", "nested:", "selected", "input:", "nested:"])
  expect(change.mock.calls[0][0][0] === items[1]).toBe(true)
  expect(change.mock.calls[0][1]).toEqual({ action: "add", changedItems: [items[1]], changedKeys: [""] })
  expect(selectedItems).toEqual([])
  expect(row("combo-box-input").props.value).toBe("Empty")
  expect(screen.queryByTestId("tag", hidden)).toBeNull()
})
it("CAP.tag-combobox.017/.019/.022 filters owner echoes and clears only the uncontrolled query", async () => {
  const Owner = () => {
    const [selected, setSelected] = useState<TItem[]>([])
    return node({
      isOpen: true,
      defaultInputValue: "Empty",
      selectedItems: selected,
      onSelectedItemsChange: setSelected,
    })
  }
  await render(<Owner />)
  await choose()
  expect(row("combo-box-input").props.value).toBe("")
  expect(screen.queryByRole("option", { name: "Empty" })).toBeNull()
  expect(screen.getByText("Empty", hidden)).toBeOnTheScreen()
})
it("CAP.tag-combobox.018/.025 emits exact removal details and retains caller-owned data on veto", async () => {
  const owner = [items[0]],
    change = jest.fn()
  await render(node({ selectedItems: owner, onSelectedItemsChange: change }))
  await remove()
  await remove()
  expect(change.mock.calls).toEqual([
    [[], { action: "remove", changedItems: owner, changedKeys: [0] }],
    [[], { action: "remove", changedItems: owner, changedKeys: [0] }],
  ])
  expect(owner[0] === items[0]).toBe(true)
  expect(screen.getByText("Zero", hidden)).toBeOnTheScreen()
})
it("CAP.tag-combobox.020/.021 keeps text accessors, custom content and nullish/falsy fallback", async () => {
  const view = await render(
    node({ selectedItems: [items[0]], getItemTextValue: (item) => `${item.group}: ${item.label}` }),
  )
  expect(screen.getByText("First: Zero", hidden)).toBeOnTheScreen()
  await view.rerender(node({ selectedItems: [items[0]], renderTagContent: (item) => <Text>Group: {item.group}</Text> }))
  expect(screen.getByText("Group: First", hidden)).toBeOnTheScreen()
  await view.rerender(node({ selectedItems: [items[0]], renderTagContent: () => false }))
  expect(screen.queryByText("Zero", hidden)).toBeNull()
})
it("retains caller-curated options and public item authoring independently of the held query", async () => {
  const change = jest.fn()
  await render(
    node({
      inputValue: "unrelated query",
      isOpen: true,
      onSelectedItemsChange: change,
      children: (item) => (
        <TagComboBoxItem id={item.key} textValue={item.label}>
          {item.label}
        </TagComboBoxItem>
      ),
    }),
  )
  await choose()
  expect(change.mock.calls[0][0][0]).toBe(items[1])
  expect(row("combo-box-input").props.value).toBe("unrelated query")
})
it("retains cached one-shot items through registration renders and controlled callbacks", async () => {
  const change = jest.fn(),
    iterator = items[Symbol.iterator]()
  await render(node({ items: iterator, isOpen: true, onSelectedItemsChange: change }))
  await choose()
  expect(change.mock.calls[0][0][0] === items[1]).toBe(true)
})

it("registers only the original inner ComboBox key/text values rather than selected tag objects", async () => {
  modelOriginalFormTargets()
  const registry = new NativeFormRegistry()
  const key = createRef<RN.TextInput>(),
    text = createRef<RN.TextInput>(),
    custom = createRef<RN.TextInput>()
  await render(
    wrap(
      <NativeFormRegistryContext.Provider value={registry}>
        <TagComboBox {...base} name="key" inputRef={key} selectedItems={[items[0]]} inputValue="held" />
        <TagComboBox {...base} name="text" inputRef={text} formValue="text" inputValue="held" />
        <TagComboBox {...base} name="custom" inputRef={custom} formValue="key" allowsCustomValue inputValue="draft" />
      </NativeFormRegistryContext.Provider>,
    ),
  )
  const fields = [...registry.fields.values()]
  expect(fields).toHaveLength(3)
  for (const [name, expected, ref] of [
    ["key", "", key],
    ["text", "held", text],
    ["custom", "draft", custom],
  ] as const) {
    const field = fields.find((field) => field.data.entries[0]?.[0] === name)!
    expect(field.data.entries).toEqual([[name, expected]])
    expect(field.editor()).toBe(ref.current)
    expect(ref.current).not.toBeNull()
  }
})

it("preserves selected tags and the same original editor across a vetoed form query reset", async () => {
  modelOriginalFormTargets()
  const registry = new NativeFormRegistry(),
    input = createRef<RN.TextInput>()
  const query = jest.fn(),
    selected = jest.fn()
  const content = (value: string) =>
    wrap(
      <NativeFormRegistryContext.Provider value={registry}>
        <TagComboBox
          {...base}
          name="text"
          formValue="text"
          inputRef={input}
          selectedItems={[items[0]]}
          inputValue={value}
          onInputChange={query}
          onSelectedItemsChange={selected}
        />
      </NativeFormRegistryContext.Provider>,
    )
  const view = await render(content("initial"))
  const original = input.current
  await view.rerender(content("held"))
  query.mockClear()
  await act(() => [...registry.fields.values()][0].reset("programmatic"))
  expect(query).toHaveBeenCalledWith("initial")
  expect(selected).not.toHaveBeenCalled()
  expect(input.current).toBe(original)
  expect(input.current).not.toBeNull()
  expect([...registry.fields.values()][0].data.entries).toEqual([["text", "held"]])
  expect(screen.getByText("Zero", hidden)).toBeOnTheScreen()
})
