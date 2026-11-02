import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, screen } from "@testing-library/react-native"
import { createRef, useContext, type ComponentPropsWithRef } from "react"
import { AccessibilityInfo, findNodeHandle, processColor, StyleSheet, type TextInput, type View } from "react-native"

import {
  CompactTypeaheadSearch,
  NativeComboBoxListContext,
  NativeFloatingLayerHost,
  NativeFocusView,
  NativeThemeProvider,
} from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import type { TNativeComboBoxListRenderState } from "../../ComboBox/CollectionComboBoxList"

import { installCompactNativeLayout, pressCompact } from "./fixtures/nativeLayout"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))

const FocusableListRoot = ({
  native,
  inspect,
  focused,
  blurred,
  contextOverride,
}: {
  native: ComponentPropsWithRef<typeof NativeFocusView>
  inspect: (state: TNativeComboBoxListRenderState) => void
  focused: (event: unknown) => void
  blurred: (event: unknown) => void
  contextOverride: boolean
}) => {
  const inherited = useContext(NativeComboBoxListContext)
  if (!inherited || "slots" in inherited) throw new Error("Expected the actual owned ComboBox list defaults")
  return (
    <NativeComboBoxListContext.Provider
      value={{
        ...inherited,
        autoFocus: false,
        shouldUseVirtualFocus: false,
        style: contextOverride
          ? (state) => [
              typeof inherited.style === "function" ? inherited.style(state) : inherited.style,
              { outlineWidth: 0, outlineColor: "#112233" },
            ]
          : inherited.style,
        onFocus: (event) => {
          inherited.onFocus?.(event)
          focused(event)
        },
        onBlur: (event) => {
          inherited.onBlur?.(event)
          blurred(event)
        },
        render: (props, state) => {
          inspect(state)
          return inherited.render ? inherited.render(props, state) : <NativeFocusView {...props} />
        },
      }}
    >
      <NativeFocusView {...native} />
    </NativeComboBoxListContext.Provider>
  )
}

const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
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

it("preserves an indication for actual Compact list focus separately from logical row focus and authored overrides", async () => {
  const root = createRef<View>(),
    input = createRef<TextInput>(),
    query = jest.fn(),
    selected = jest.fn(),
    opened = jest.fn(),
    focused = jest.fn(),
    blurred = jest.fn()
  const items = [
    { id: "alpha", name: "Alpha Wave" },
    { id: "beta", name: "Beta Drift" },
  ]
  let latest: TNativeComboBoxListRenderState | undefined
  const content = (dark = false, override = false, contextOverride = false) => (
    <NativeThemeProvider
      mode={dark ? "dark" : "light"}
      overrides={{ colors: { focusRing: dark ? "#eea33a" : "#3859bc" } }}
    >
      <NativeFloatingLayerHost ref={fixture.hostRef} testID="host">
        <CompactTypeaheadSearch
          ref={root}
          render={(native) => (
            <FocusableListRoot
              native={native}
              inspect={(state) => {
                latest = state
              }}
              focused={focused}
              blurred={blurred}
              contextOverride={contextOverride}
            />
          )}
          inputRef={input}
          accessibilityLabel="Focused list search"
          items={items}
          inputValue="held query"
          value={null}
          isOpen
          onInputChange={query}
          onChange={selected}
          onOpenChange={opened}
          customOptionsListStyles={override ? { outlineWidth: 0, outlineColor: "#aabbcc", padding: 7 } : undefined}
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
  const view = await render(content())
  await pressCompact(row("type-ahead-search-button"))
  await fixture.ready()
  const originalRoot = root.current,
    originalList = fixture.target("type-ahead-search-options"),
    originalInput = input.current,
    originalHost = row("type-ahead-search-options")
  expect(originalRoot).not.toBeNull()
  expect(originalList).not.toBeNull()
  expect(originalInput).not.toBeNull()
  expect(findNodeHandle(originalList)).toBeGreaterThan(0)
  expect(originalHost.props.keyboardFocusable).toBe(true)
  expect(latest?.isFocused).toBe(false)
  expect(latest?.state.selectionManager.focusedKey).toBeNull()
  expect(StyleSheet.flatten(originalHost.props.style).outlineWidth).toBeUndefined()
  await act(() => latest!.state.selectionManager.setFocused(true))
  expect(latest?.state.selectionManager.isFocused).toBe(true)
  expect(latest?.isFocused).toBe(false)
  expect(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineWidth).toBeUndefined()
  const requestsBefore = [...opened.mock.calls]
  const editorFocus = jest.spyOn(originalInput!, "focus")
  const editorFocusCallsBefore = editorFocus.mock.calls.map((args) => [...args])
  const focus = {
    nativeEvent: {
      ownerId: originalHost.props.ownerId,
      target: findNodeHandle(originalList),
      isFocused: true,
      isFocusVisible: true,
      origin: "keyboard",
      timestamp: 1,
    },
  }
  const receiveFocus = originalHost.props.onNativeFocusChange
  await act(() => receiveFocus(focus))
  expect(focused.mock.calls).toEqual([[focus]])
  expect(latest).toMatchObject({ isFocused: true, isFocusVisible: true })
  expect(latest?.state.selectionManager.focusedKey).toBeNull()
  for (const option of screen.getAllByTestId(/^type-ahead-search-option-/, hidden))
    expect(option).toHaveStyle({ backgroundColor: "transparent" })
  expect(StyleSheet.flatten(row("type-ahead-search-group").props.style).outlineWidth).toBeUndefined()
  expect(row("type-ahead-search-options")).toHaveStyle({ outlineWidth: 1.5 })
  expect(processColor(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineColor)).toBe(
    processColor("#3859bc"),
  )
  await view.rerender(content(true))
  expect(row("type-ahead-search-options")).toBe(originalHost)
  expect(row("type-ahead-search-options")).toHaveStyle({ outlineWidth: 1.5 })
  expect(processColor(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineColor)).toBe(
    processColor("#eea33a"),
  )
  await view.rerender(content(true, false, true))
  expect(row("type-ahead-search-options")).toHaveStyle({ outlineWidth: 0 })
  expect(processColor(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineColor)).toBe(
    processColor("#112233"),
  )
  await view.rerender(content(true, true))
  expect(row("type-ahead-search-options")).toHaveStyle({ outlineWidth: 0, padding: 7 })
  expect(processColor(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineColor)).toBe(
    processColor("#aabbcc"),
  )
  await view.rerender(content(true))
  expect(row("type-ahead-search-options")).toHaveStyle({ outlineWidth: 1.5 })
  const blur = { nativeEvent: { ...focus.nativeEvent, isFocused: false, isFocusVisible: false, timestamp: 2 } }
  await act(() => row("type-ahead-search-options").props.onNativeFocusChange(blur))
  expect(blurred.mock.calls).toEqual([[blur]])
  expect(latest?.isFocused).toBe(false)
  expect(StyleSheet.flatten(row("type-ahead-search-options").props.style).outlineWidth).toBeUndefined()
  expect(root.current).toBe(originalRoot)
  expect(fixture.target("type-ahead-search-options")).toBe(originalList)
  expect(input.current).toBe(originalInput)
  expect(row("type-ahead-search-input").props.value).toBe("held query")
  expect(query).not.toHaveBeenCalled()
  expect(selected).not.toHaveBeenCalled()
  expect(opened.mock.calls).toEqual(requestsBefore)
  expect(editorFocus.mock.calls).toEqual(editorFocusCallsBefore)
  await view.unmount()
  expect(root.current).toBeNull()
  expect(() => fixture.target("type-ahead-search-options")).toThrow("Missing actual RN preset ref")
  expect(input.current).toBeNull()
  await rawAct(() => receiveFocus(focus))
  expect(focused).toHaveBeenCalledTimes(1)
})
