import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, useContext, type ContextType, type ReactNode } from "react"
import { AccessibilityInfo, type TextInput, type View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormRegistry } from "../../../form/registry"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import {
  NativeComboBoxContext,
  NativeComboBoxFieldErrorContext,
  NativeComboBoxFieldIdsContext,
  NativeComboBoxStateContext,
} from "../../ComboBox/collectionContext"
import { CompactTypeaheadSearch } from "../CompactTypeaheadSearch"

import { installCompactNativeLayout, pressCompact, row } from "./fixtures/nativeLayout"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
let fixture: ReturnType<typeof installCompactNativeLayout>
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  fixture = installCompactNativeLayout()
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const items = [
  { id: 0, name: "Alpha" },
  { id: "beta", name: "Beta" },
]
const wrap = (child: ReactNode) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost ref={fixture.hostRef} testID="host">
      {child}
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)

it.each(["isDisabled", "isReadOnly"] as const)("preserves programmatic state requests under %s", async (guard) => {
  let state: ContextType<typeof NativeComboBoxStateContext> = null
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)
    return null
  }
  const onInputChange = jest.fn(),
    onChange = jest.fn(),
    onOpenChange = jest.fn(),
    editor = createRef<TextInput>()
  await render(
    wrap(
      <CompactTypeaheadSearch
        items={items}
        accessibilityLabel="Query"
        {...{ [guard]: true }}
        value={null}
        inputValue="held"
        inputRef={editor}
        onInputChange={onInputChange}
        onChange={onChange}
        onOpenChange={onOpenChange}
        SearchIcon={<Capture />}
      />,
    ),
  )
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await act(() => {
    state!.setInputValue("programmatic")
    state!.setValue(0)
    state!.open(null, "manual")
  })
  expect(onInputChange).toHaveBeenCalledWith("programmatic")
  expect(onChange).toHaveBeenCalledWith(0)
  expect(onOpenChange).toHaveBeenCalledWith(true)
  expect(row("type-ahead-search-input").props.value).toBe("held")
  expect(editor.current).toBe(original)
  expect(write).not.toHaveBeenCalled()
})

it("inherits named/default/null root contexts while retaining the caller's actual root ref and compact style defaults", async () => {
  const contextRef = createRef<View>(),
    callerRef = createRef<View>()
  const style = jest.fn(({ defaultStyle, isDisabled, isRequired }) => ({
    ...defaultStyle,
    width: isDisabled && isRequired ? 211 : 177,
  }))
  const inheritedRender = jest.fn((props) => <NativeFocusHost {...props} testID="inherited-compact" />)
  const node = (slot?: string | null) =>
    wrap(
      <NativeComboBoxContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: {
              ref: contextRef,
              isDisabled: true,
              isRequired: true,
              render: inheritedRender,
              style: { marginLeft: 9 },
            },
            search: { isReadOnly: true },
          },
        }}
      >
        <CompactTypeaheadSearch
          slot={slot}
          ref={callerRef}
          items={items}
          accessibilityLabel="Query"
          customStyles={{ marginTop: 5 }}
          style={style}
        />
      </NativeComboBoxContext.Provider>,
    )
  const view = await render(node())
  expect(contextRef.current).toBe(callerRef.current)
  expect(callerRef.current).not.toBeNull()
  expect(row("inherited-compact")).toHaveStyle({ width: 211, marginTop: 5, marginLeft: 9 })
  expect(
    style.mock.calls.every(
      ([value]) =>
        value.defaultStyle.width === "100%" &&
        value.defaultStyle.marginTop === 5 &&
        value.isDisabled &&
        value.isRequired,
    ),
  ).toBe(true)
  expect(row("type-ahead-search-input").props.editable).toBe(false)
  await view.rerender(node("search"))
  expect(row("type-ahead-search-input").props.editable).toBe(false)
  expect(row("type-ahead-search")).toHaveStyle({ width: 177 })
  await view.rerender(node(null))
  expect(row("type-ahead-search-input").props.editable).toBe(true)
})

it("shares the ComboBox state, validation and field identifiers with authored icon descendants", async () => {
  let state: ContextType<typeof NativeComboBoxStateContext> = null
  let validation: ContextType<typeof NativeComboBoxFieldErrorContext> = null
  let ids: ContextType<typeof NativeComboBoxFieldIdsContext> = null
  const Probe = () => {
    state = useContext(NativeComboBoxStateContext)
    validation = useContext(NativeComboBoxFieldErrorContext)
    ids = useContext(NativeComboBoxFieldIdsContext)
    return null
  }
  const validate = jest.fn(() => "Choose another value")
  await render(
    wrap(
      <CompactTypeaheadSearch
        items={items}
        accessibilityLabel="Query"
        value={null}
        inputValue="held"
        validationBehavior="aria"
        validate={validate}
        SearchIcon={<Probe />}
      />,
    ),
  )
  expect(state!.inputValue).toBe("held")
  expect(state!.value).toBeNull()
  expect(validation).toBe(state!.displayValidation)
  expect(validation!.validationErrors).toEqual(["Choose another value"])
  expect(ids!.input).toEqual(expect.any(String))
  expect(validate).toHaveBeenCalledWith({ inputValue: "held", value: null, selectedKey: null })
  await pressCompact(row("type-ahead-search-button"))
  await fixture.ready()
  expect(state!.collection.size).toBe(2)
})

it("registers form data against the original editor and retires it on unmount", async () => {
  const registry = new NativeFormRegistry(),
    editor = createRef<TextInput>()
  const view = await render(
    wrap(
      <NativeFormRegistryContext.Provider value={registry}>
        <CompactTypeaheadSearch
          items={items}
          accessibilityLabel="Query"
          inputRef={editor}
          inputValue="held"
          value={0}
          name="search"
          form="external"
          formValue="text"
        />
      </NativeFormRegistryContext.Provider>,
    ),
  )
  const field = [...registry.fields.values()][0]
  expect(field).toBeDefined()
  expect(field.editor()).toBe(editor.current)
  expect(field.descriptor.formId).toBe("external")
  expect(field.data.entries).toEqual([["search", "held"]])
  expect(field.data.validationBehavior).toBe("native")
  await view.unmount()
  expect(registry.fields.size).toBe(0)
  expect(editor.current).toBeNull()
})

it("reuses query-before-key form reset requests while the owner retains its value and query", async () => {
  const registry = new NativeFormRegistry(),
    editor = createRef<TextInput>(),
    calls: unknown[][] = []
  await render(
    wrap(
      <NativeFormRegistryContext.Provider value={registry}>
        <CompactTypeaheadSearch
          items={items}
          accessibilityLabel="Query"
          inputRef={editor}
          value="beta"
          defaultValue={0}
          inputValue="held"
          defaultInputValue="wrapper-only default"
          name="search"
          onInputChange={(value) => calls.push(["query", value])}
          onChange={(value) => calls.push(["key", value])}
        />
      </NativeFormRegistryContext.Provider>,
    ),
  )
  await pressCompact(row("type-ahead-search-button"))
  await fixture.ready()
  const original = editor.current
  calls.length = 0
  await act(() => [...registry.fields.values()][0].reset("programmatic"))
  expect(calls).toEqual([
    ["query", "Beta"],
    ["key", 0],
  ])
  expect(row("type-ahead-search-input").props.value).toBe("held")
  expect([...registry.fields.values()][0].data.entries).toEqual([["search", "beta"]])
  expect(editor.current).toBe(original)
})
