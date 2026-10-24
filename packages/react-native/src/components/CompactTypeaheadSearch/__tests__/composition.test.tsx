import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, useContext, type ContextType, type ReactNode } from "react"
import { AccessibilityInfo, findNodeHandle, type TextInput, type View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
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

import { advance, installCompactNativeLayout, pressCompact, row } from "./fixtures/nativeLayout"

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

it("routes accessibility aliases to the original editor's semantic binding", async () => {
  const editor = createRef<TextInput>()
  const node = (empty = false, native = false, label = "Search") =>
    wrap(
      <CompactTypeaheadSearch
        items={items}
        inputRef={editor}
        inputValue="held"
        accessibilityLabel={label}
        aria-labelledby={empty ? "" : "search-label other-label"}
        aria-describedby={empty ? "" : "search-description"}
        aria-details={empty ? "" : "search-details"}
        {...(native
          ? { nativeLabelledBy: ["native-label"], nativeDescribedBy: [], nativeDetailsBy: ["native-details"] }
          : {})}
      />,
    )
  const view = await render(node())
  const original = editor.current!
  const binding = () =>
    JSON.parse(
      view.container.queryAll((node) => typeof node.props.semanticBinding === "string")[0].props.semanticBinding,
    )
  const first = binding()
  const self = first.aliases.find(
    (entry: { id: string; target: number }) => entry.target === findNodeHandle(original),
  ).id
  expect(first.labelledBy).toEqual([self, "search-label", "other-label"])
  expect(first.describedBy).toEqual(["search-description"])
  expect(first.detailsBy).toEqual(["search-details"])
  await view.rerender(node(true))
  expect(binding()).toMatchObject({ labelledBy: [], describedBy: [], detailsBy: [] })
  await view.rerender(node(false, true))
  expect(binding()).toMatchObject({
    labelledBy: [self, "native-label"],
    describedBy: [],
    detailsBy: ["native-details"],
  })
  await view.rerender(node(false, false, ""))
  expect(binding().labelledBy).toEqual(["search-label", "other-label"])
  expect(row("type-ahead-search").props["aria-describedby"]).toBeUndefined()
  expect(row("type-ahead-search").props["aria-details"]).toBeUndefined()
  expect(editor.current).toBe(original)
  expect(row("type-ahead-search-input").props.value).toBe("held")
})

it.each(["programmatic", "soft-key", "physical-key", "native-edit"] as const)(
  "preserves selection suppression ownership for %s",
  async (action) => {
    let state: ContextType<typeof NativeComboBoxStateContext> = null
    const Capture = () => {
      state = useContext(NativeComboBoxStateContext)
      return null
    }
    const editor = createRef<TextInput>(),
      changed = jest.fn()
    const node = (query: string) =>
      wrap(
        <CompactTypeaheadSearch
          items={items}
          accessibilityLabel="Query"
          value={null}
          inputValue={query}
          isOpen
          minimumInputLength={3}
          inputRef={editor}
          onInputChange={changed}
          SearchIcon={<Capture />}
        />,
      )
    const view = await render(node("long"))
    const original = editor.current!
    await act(() => {
      state!.setValue(0)
    })
    await view.rerender(node(""))
    await fixture.ready()
    expect(screen.queryByTestId("type-ahead-search-minimum-query-state", { includeHiddenElements: true })).toBeNull()
    if (action === "programmatic") {
      await act(() => {
        state!.setInputValue("a")
      })
      expect(screen.queryByTestId("type-ahead-search-minimum-query-state", { includeHiddenElements: true })).toBeNull()
    } else {
      if (action === "soft-key") {
        await fireEvent(row("type-ahead-search-input"), "keyPress", {
          nativeEvent: { key: "ArrowLeft", target: findNodeHandle(original) },
        })
      } else if (action === "physical-key") {
        await fixture.observedKey(original, "ArrowLeft")
      } else {
        await fireEvent(row("type-ahead-search-input"), "change", {
          nativeEvent: { text: "a", eventCount: 1, target: findNodeHandle(original) },
        })
      }
      expect(row("type-ahead-search-minimum-query-state")).toBeOnTheScreen()
      expect(changed.mock.calls).toEqual(action === "native-edit" ? [["a"]] : [])
    }
    expect(editor.current).toBe(original)
    expect(row("type-ahead-search-input").props.value).toBe("")
  },
)

it.each(["group-blur", "state-close"] as const)("retains authored descendant focus during %s", async (action) => {
  let state: ContextType<typeof NativeComboBoxStateContext> = null
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)
    return <NativeFocusHost testID="search-descendant" focusable />
  }
  const onOpenChange = jest.fn()
  await render(
    wrap(
      <CompactTypeaheadSearch
        items={items}
        accessibilityLabel="Query"
        inputValue="q"
        minimumInputLength={3}
        isOpen
        onOpenChange={onOpenChange}
        SearchIcon={<Capture />}
      />,
    ),
  )
  await fixture.ready()
  const descendant = fixture.target("search-descendant")
  await act(() =>
    row("search-descendant").props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row("search-descendant").props.ownerId,
        target: findNodeHandle(descendant),
        isFocused: true,
      },
    }),
  )
  await fixture.within("type-ahead-search", "search-descendant")
  await fixture.within("type-ahead-search-group", "search-descendant")
  if (action === "group-blur") {
    await act(() => row("type-ahead-search-group").props.onBlur({ nativeEvent: { target: 17 } }))
    await advance()
  } else {
    await act(() => {
      state!.open(null, "manual")
    })
    onOpenChange.mockClear()
    await act(() => {
      state!.close()
    })
  }
  expect(onOpenChange).not.toHaveBeenCalledWith(false)
  expect(fixture.target("search-descendant")).toBe(descendant)
  await fixture.within("type-ahead-search", null, 2)
  await fixture.within("type-ahead-search-group", null, 2)
  await fixture.within("type-ahead-search", "search-descendant", 1)
  await fixture.within("type-ahead-search-group", "search-descendant", 1)
  if (action === "group-blur") {
    await act(() => row("type-ahead-search-group").props.onBlur({ nativeEvent: { target: 17 } }))
    await advance()
  } else {
    await act(() => {
      state!.open(null, "manual")
    })
    onOpenChange.mockClear()
    await act(() => {
      state!.close()
    })
  }
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

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

it.each([
  ["isDisabled", false],
  ["isReadOnly", false],
  ["isDisabled", true],
  ["isReadOnly", true],
] as const)("retires selection focus when inherited %s changes, restored=%s", async (guard, restored) => {
  let state: ContextType<typeof NativeComboBoxStateContext> = null
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)
    return null
  }
  const editor = createRef<TextInput>(),
    onOpenChange = jest.fn(),
    onChange = jest.fn()
  const node = (blocked: boolean) =>
    wrap(
      <NativeComboBoxContext.Provider value={{ [guard]: blocked }}>
        <CompactTypeaheadSearch
          items={items}
          value={null}
          inputValue="held"
          inputRef={editor}
          onChange={onChange}
          onOpenChange={onOpenChange}
          SearchIcon={<Capture />}
        />
      </NativeComboBoxContext.Provider>,
    )
  const view = await render(node(false))
  await fixture.ready()
  const original = editor.current!,
    focus = jest.spyOn(original, "focus"),
    write = jest.spyOn(original, "setNativeProps")
  await act(() => {
    state!.setValue(0)
  })
  expect(onChange).toHaveBeenCalledWith(0)
  await view.rerender(node(true))
  if (restored) await view.rerender(node(false))
  onOpenChange.mockClear()
  await advance()
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(focus).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(editor.current).toBe(original)
  expect(row("type-ahead-search-input").props.value).toBe("held")
})

it.each([
  ["isDisabled", "override"],
  ["isReadOnly", "override"],
  ["isDisabled", "named"],
  ["isReadOnly", "named"],
  ["isDisabled", "null"],
  ["isReadOnly", "null"],
] as const)("uses resolved %s context for selection focus with %s ownership", async (guard, ownership) => {
  let state: ContextType<typeof NativeComboBoxStateContext> = null
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)
    return null
  }
  const editor = createRef<TextInput>(),
    onOpenChange = jest.fn()
  await render(
    wrap(
      <NativeComboBoxContext.Provider
        value={{ slots: { [NATIVE_DEFAULT_SLOT]: { [guard]: true }, search: { [guard]: false } } }}
      >
        <CompactTypeaheadSearch
          {...(ownership === "override" ? { [guard]: false } : {})}
          slot={ownership === "named" ? "search" : ownership === "null" ? null : undefined}
          items={items}
          value={null}
          inputValue="held"
          inputRef={editor}
          onOpenChange={onOpenChange}
          SearchIcon={<Capture />}
        />
      </NativeComboBoxContext.Provider>,
    ),
  )
  await fixture.ready()
  const original = editor.current!,
    focus = jest.spyOn(original, "focus")
  await act(() => {
    state!.setValue(0)
  })
  onOpenChange.mockClear()
  await advance()
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(focus).toHaveBeenCalledTimes(1)
  expect(editor.current).toBe(original)
  expect(row("type-ahead-search-input").props.value).toBe("held")
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
