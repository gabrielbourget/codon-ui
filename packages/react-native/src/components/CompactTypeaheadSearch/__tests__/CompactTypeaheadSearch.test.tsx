import "../../../collection/__tests__/nativeReceipts"

import { cleanup, screen } from "@testing-library/react-native"
import { createRef, type ReactNode, type RefAttributes, useState } from "react"
import { AccessibilityInfo, findNodeHandle, type View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../.."
import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { CompactTypeaheadSearch } from "../CompactTypeaheadSearch"
import type { TNativeCompactTypeaheadSearchProps } from "../types"

import { advance, pressCompact, installCompactNativeLayout } from "./fixtures/nativeLayout"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
let fixture: ReturnType<typeof installCompactNativeLayout>
const items = [
  { id: "alpha", name: "Alpha Wave" },
  { id: "beta", name: "Beta Drift" },
]
type TProps = TNativeCompactTypeaheadSearchProps<(typeof items)[number]> & RefAttributes<View>
const wrapper = (props: TProps = {}, extra?: ReactNode) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost ref={fixture.hostRef} testID="host">
      <CompactTypeaheadSearch accessibilityLabel="Search" items={items} {...props} />
      {extra}
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const ready = async (admitTrigger = true) => {
  if (admitTrigger) await pressCompact(row("type-ahead-search-button"))
  await fixture.ready()
}
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

it("CAP.compact-typeahead.001 renders actual compound hosts and caller root ref", async () => {
  const ref = createRef<View>()
  await render(wrapper({ ref }))
  expect(row("type-ahead-search")).toBeOnTheScreen()
  expect(row("type-ahead-search-input").props.value).toBe("")
  expect(row("type-ahead-search-button")).toBeOnTheScreen()
  expect(ref.current).not.toBeNull()
})
it("CAP.compact-typeahead.002/.003 preserves independent default and zero dimensions", async () => {
  const { rerender } = await render(wrapper())
  expect(row("type-ahead-search")).toHaveStyle({ width: "100%" })
  expect(row("type-ahead-search-group")).toHaveStyle({ width: "100%" })
  await rerender(wrapper({ height: 0, width: 0 }))
  expect(row("type-ahead-search")).toHaveStyle({ height: 0, width: 0 })
  expect(row("type-ahead-search-group")).toHaveStyle({ height: 0, width: 0 })
})
it("CAP.compact-typeahead.004/.012/.013 keeps group/input/button colors independent from final root styles", async () => {
  await render(
    wrapper({
      color: "turquoise",
      width: 150,
      customStyles: [{ marginTop: 5 }],
      style: { width: 175, color: "tomato" },
      customInputButtonGroupStyles: { color: "orange" },
      customInputStyles: { backgroundColor: "green" },
      customButtonStyles: { borderRadius: 6 },
    }),
  )
  expect(row("type-ahead-search")).toHaveStyle({ width: 175, marginTop: 5 })
  expect(row("type-ahead-search").props.style.color).toBeUndefined()
  expect(row("type-ahead-search-group")).toHaveStyle({ width: 150 })
  expect(row("type-ahead-search-input")).toHaveStyle({ color: "turquoise", backgroundColor: "green" })
  expect(row("type-ahead-search-button")).toHaveStyle({ borderRadius: 6 })
})
it("CAP.compact-typeahead.014 receives post-custom defaults and canonical root render state", async () => {
  const style = jest.fn(({ defaultStyle }) => ({ ...defaultStyle, width: 175 }))
  await render(wrapper({ width: 150, customStyles: { marginTop: 5 }, style, isReadOnly: true }))
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({
      isOpen: false,
      isReadOnly: true,
      defaultStyle: expect.objectContaining({ width: 150, marginTop: 5 }),
    }),
  )
  expect(row("type-ahead-search")).toHaveStyle({ width: 175, marginTop: 5 })
})
it("CAP.compact-typeahead.029 activates a measured real popup row with the original key", async () => {
  const onChange = jest.fn()
  await render(wrapper({ isOpen: true, value: null, onChange }))
  await ready()
  expect(findNodeHandle(fixture.target("type-ahead-search-option-string:alpha"))).toBeGreaterThan(0)
  await pressCompact(row("type-ahead-search-option-string:alpha"))
  expect(onChange).toHaveBeenCalledWith("alpha")
})

it.each([
  ["rounded", 5],
  ["round", 10000],
  ["orthogonal", 0],
] as const)("CAP.compact-typeahead.005 maps %s geometry", async (geometry, radius) => {
  await render(wrapper({ geometry }))
  expect(row("type-ahead-search-group")).toHaveStyle({ borderRadius: radius })
})
it.each([
  ["small", 12],
  ["medium", 14],
  ["large", 16],
] as const)("CAP.compact-typeahead.006 maps %s input typography", async (textSize, fontSize) => {
  await render(wrapper({ textSize }))
  expect(row("type-ahead-search-input")).toHaveStyle({ fontSize })
})
it("CAP.compact-typeahead.007 honors false focus outline and offset controls", async () => {
  const { rerender } = await render(wrapper())
  await fireEvent(row("type-ahead-search-input"), "focus", { nativeEvent: { target: 17 } })
  expect(row("type-ahead-search-group")).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await rerender(wrapper({ enableFocusStyle: false, offsetFocusRing: false }))
  expect(row("type-ahead-search-group").props.style.outlineWidth).toBeUndefined()
})
it.each(["isDisabled", "isReadOnly"] as const)(
  "CAP.compact-typeahead.008 blocks user query/open requests after %s takeover",
  async (guard) => {
    const onInputChange = jest.fn(),
      onOpenChange = jest.fn()
    const { rerender } = await render(wrapper({ onInputChange, onOpenChange }))
    const lateChange = row("type-ahead-search-input").props.onChangeText
    await rerender(wrapper({ onInputChange, onOpenChange, [guard]: true }))
    await act(() => lateChange("stale"))
    await pressCompact(row("type-ahead-search-button"))
    expect(onInputChange).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(row("type-ahead-search-input").props.value).toBe("")
  },
)
it("CAP.compact-typeahead.009 and oracle retain trigger toggles under controlled false", async () => {
  const onOpenChange = jest.fn()
  await render(wrapper({ isOpen: false, onOpenChange }))
  await pressCompact(row("type-ahead-search-button"))
  await pressCompact(row("type-ahead-search-button"))
  expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false])
  expect(screen.queryByTestId("type-ahead-search-popover", { includeHiddenElements: true })).toBeNull()
})
it.each([
  [{ errorState: true }, "#b73434"],
  [{ warningState: true }, "#a66b00"],
  [{ successState: true }, "#2f7d18"],
] as const)("CAP.compact-typeahead.010 maps semantic status %j", async (status, borderColor) => {
  await render(wrapper(status))
  expect(row("type-ahead-search-group")).toHaveStyle({ borderColor })
})
it("CAP.compact-typeahead.011 gives error precedence over warning and success", async () => {
  await render(wrapper({ errorState: true, warningState: true, successState: true }))
  expect(row("type-ahead-search-group")).toHaveStyle({ borderColor: "#b73434" })
})
it("CAP.compact-typeahead.015 consumes all wrapper data and customization props", async () => {
  await render(
    wrapper({
      inputValue: "held",
      value: 0,
      isOpen: false,
      isLoading: true,
      minimumInputLength: 0,
      rtl: true,
      customOptionsListStyles: { maxHeight: 0 },
    }),
  )
  for (const key of [
    "inputValue",
    "value",
    "isOpen",
    "isLoading",
    "minimumInputLength",
    "rtl",
    "items",
    "customOptionsListStyles",
    "color",
    "geometry",
  ])
    expect(row("type-ahead-search").props[key]).toBeUndefined()
})
it("CAP.compact-typeahead.016/.017 preserves RTL, custom content and owned SVG default", async () => {
  const { rerender } = await render(wrapper({ rtl: true }))
  expect(row("type-ahead-search-group")).toHaveStyle({ flexDirection: "row-reverse" })
  expect(row("type-ahead-search")).toHaveStyle({ direction: "rtl" })
  expect(row("type-ahead-search-input")).toHaveStyle({ writingDirection: "rtl" })
  expect(row("type-ahead-search-default-search-icon").props).toEqual(
    expect.objectContaining({ minX: 0, minY: 0, vbWidth: 24, vbHeight: 24 }),
  )
  await rerender(wrapper({ SearchIcon: <Text testID="custom-search">S</Text> }))
  expect(row("custom-search")).toBeOnTheScreen()
  expect(screen.queryByTestId("type-ahead-search-default-search-icon")).toBeNull()
})
it("CAP.compact-typeahead.018/.019 uses grouped labels and the current trimmed-query threshold", async () => {
  const message = jest.fn(({ minimumInputLength }) => `Need ${minimumInputLength}`)
  await render(
    wrapper({
      isOpen: true,
      inputValue: " A ",
      minimumInputLength: 2,
      labels: {
        inputButtonGroupAriaLabel: "Group",
        searchButtonAriaLabel: "Run",
        suggestionsListAriaLabel: "Results",
        status: { minimumInputLengthMessage: message },
      },
    }),
  )
  expect(row("type-ahead-search-group").props.accessibilityLabel).toBe("Group")
  expect(row("type-ahead-search-button").props.accessibilityLabel).toBe("Run")
  expect(row("type-ahead-search-options").props.accessibilityLabel).toBe("Results")
  expect(message).toHaveBeenLastCalledWith({ minimumInputLength: 2 })
  expect(screen.getByText("Need 2", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.queryByTestId("type-ahead-search-option-string:alpha", { includeHiddenElements: true })).toBeNull()
})
it("CAP.compact-typeahead.020 preserves empty messages and grouped precedence", async () => {
  const { rerender } = await render(
    wrapper({
      isOpen: true,
      items: [],
      minimumInputLength: 2,
      minimumInputLengthMessage: "Legacy",
      labels: { status: { minimumInputLengthMessage: () => "" } },
    }),
  )
  expect(row("type-ahead-search-minimum-query-state")).toBeOnTheScreen()
  expect(screen.queryByText("Legacy", { includeHiddenElements: true })).toBeNull()
  await rerender(
    wrapper({ isOpen: true, items: [], emptyListMessage: "Empty", labels: { status: { emptyListMessage: "" } } }),
  )
  expect(row("type-ahead-search-empty-state")).toBeOnTheScreen()
  expect(screen.queryByText("Empty", { includeHiddenElements: true })).toBeNull()
})
it.each(["minimum-query", "empty", "loading"] as const)(
  "CAP.compact-typeahead.021/.022/.024 closes %s through actual group departure",
  async (kind) => {
    const Harness = () => {
      const [query, setQuery] = useState("")
      return wrapper({
        items: [],
        inputValue: query,
        onInputChange: setQuery,
        minimumInputLength: kind === "minimum-query" ? 3 : 0,
        isLoading: kind === "loading",
      })
    }
    await render(<Harness />)
    await pressCompact(row("type-ahead-search-button"))
    await fireEvent(row("type-ahead-search-input"), "focus", { nativeEvent: { target: 17 } })
    await fireEvent.changeText(row("type-ahead-search-input"), "Al")
    await ready(false)
    expect(row(`type-ahead-search-${kind}-state`)).toBeOnTheScreen()
    await fireEvent(row("type-ahead-search-input"), "blur", { nativeEvent: { target: 17 } })
    await advance()
    await advance()
    expect(row("type-ahead-search-input").props.value).toBe("")
    expect(screen.queryByTestId("type-ahead-search-popover", { includeHiddenElements: true })).toBeNull()
  },
)
it("CAP.compact-typeahead.023/.025/.026 composes loading and minimum guidance with a static trigger", async () => {
  const { rerender } = await render(
    wrapper({ isOpen: true, isLoading: true, minimumInputLength: 3, loadingMessage: "Searching" }),
  )
  expect(row("type-ahead-search-loading-state")).toBeOnTheScreen()
  expect(row("type-ahead-search-minimum-query-state")).toBeOnTheScreen()
  expect(row("type-ahead-search-default-loading-indicator")).toBeOnTheScreen()
  expect(row("type-ahead-search-default-search-icon")).toBeOnTheScreen()
  await rerender(
    wrapper({ isOpen: true, isLoading: true, LoadingIndicator: <Text testID="custom-loading">Busy</Text> }),
  )
  expect(row("custom-loading")).toBeOnTheScreen()
  expect(
    screen.queryByTestId("type-ahead-search-default-loading-indicator", { includeHiddenElements: true }),
  ).toBeNull()
})
it("CAP.compact-typeahead.027/.028 passes original caller-curated items and held query metadata without filtering", async () => {
  const renderer = jest.fn((item, args) => (
    <Text testID={`render-${args.itemKey}`}>{`${item.name}|${args.query}|${args.textValue}`}</Text>
  ))
  await render(wrapper({ isOpen: true, inputValue: "does not match", renderItem: renderer }))
  expect(renderer).toHaveBeenCalledWith(items[0], {
    query: "does not match",
    textValue: "Alpha Wave",
    itemKey: "alpha",
  })
  await ready()
  expect(row("render-beta")).toBeOnTheScreen()
})
it("CAP.compact-typeahead.030 closes a controlled clear after selection without local query echoes", async () => {
  const Harness = () => {
    const [query, setQuery] = useState("Al")
    const [selected, setSelected] = useState<string | number | null>(null)
    return wrapper({
      inputValue: query,
      onInputChange: setQuery,
      value: selected,
      minimumInputLength: 2,
      onChange: (key) => {
        setSelected(key)
        setQuery("")
      },
    })
  }
  await render(<Harness />)
  await ready()
  await pressCompact(row("type-ahead-search-option-string:alpha"))
  await advance()
  expect(row("type-ahead-search-input").props.value).toBe("")
  expect(screen.queryByTestId("type-ahead-search-minimum-query-state", { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByTestId("type-ahead-search-popover", { includeHiddenElements: true })).toBeNull()
})
it("NATIVE.compact.001 preserves typed zero/empty keys and authoritative held value/query", async () => {
  const onChange = jest.fn(),
    onInputChange = jest.fn()
  await render(
    wrapper({
      isOpen: true,
      inputValue: "",
      value: null,
      onChange,
      onInputChange,
      items: [
        { id: "", name: "Empty key" },
        { id: "0", name: "Zero key" },
      ],
      getItemKey: (item) => (item.id === "0" ? 0 : ""),
    }),
  )
  await ready()
  await pressCompact(row("type-ahead-search-option-number:0"))
  await pressCompact(row("type-ahead-search-option-string:"))
  expect(onChange.mock.calls.map(([key]) => key)).toEqual([0, ""])
  expect(onInputChange).not.toHaveBeenCalled()
  expect(row("type-ahead-search-input").props.value).toBe("")
})
it("NATIVE.compact.002 matches the uncontrolled selected-value label-request oracle", async () => {
  const onInputChange = jest.fn()
  await render(wrapper({ isOpen: true, inputValue: "held", onInputChange }))
  await ready()
  await pressCompact(row("type-ahead-search-option-string:alpha"))
  expect(onInputChange).toHaveBeenCalledWith("Alpha Wave")
  expect(row("type-ahead-search-input").props.value).toBe("held")
})
it("NATIVE.compact.003 preserves false/zero/empty custom affordances without defaults", async () => {
  await render(wrapper({ isOpen: true, isLoading: true, SearchIcon: false, LoadingIndicator: 0 }))
  expect(screen.queryByTestId("type-ahead-search-default-search-icon")).toBeNull()
  expect(
    screen.queryByTestId("type-ahead-search-default-loading-indicator", { includeHiddenElements: true }),
  ).toBeNull()
  expect(screen.getByText("0", { includeHiddenElements: true })).toBeOnTheScreen()
})
it.each([false, true])(
  "NATIVE.compact.004 retains a consumed iterator and source query-keyed caching, query change=%s",
  async (changeQuery) => {
    const iterable = (function* () {
      yield* items
    })()
    const disabledKeys = (function* () {
      yield "alpha"
    })()
    const { rerender } = await render(wrapper({ isOpen: true, inputValue: "Al", items: iterable, disabledKeys }))
    await ready()
    expect(row("type-ahead-search-option-string:alpha")).toBeOnTheScreen()
    await rerender(
      wrapper({
        isOpen: true,
        inputValue: changeQuery ? "Be" : "Al",
        items: iterable,
        disabledKeys,
        getItemTextValue: (item) => `${item.name}!`,
      }),
    )
    expect(row("type-ahead-search-option-string:alpha").props.accessibilityLabel).toBe(
      changeQuery ? "Alpha Wave!" : "Alpha Wave",
    )
    expect(row("type-ahead-search-option-string:beta")).toBeOnTheScreen()
    expect(row("type-ahead-search-option-string:alpha").props.accessibilityState.disabled).toBe(true)
  },
)
it("NATIVE.compact.005 excludes disabled rows and stale callbacks after guard takeover", async () => {
  const onChange = jest.fn()
  const { rerender } = await render(wrapper({ isOpen: true, onChange, disabledKeys: ["alpha"] }))
  await ready()
  await pressCompact(row("type-ahead-search-option-string:alpha"))
  expect(onChange).not.toHaveBeenCalled()
  const beta = row("type-ahead-search-option-string:beta")
  const packet = {
    nativeEvent: {
      kind: "activation",
      ownerId: beta.props.ownerId,
      target: findNodeHandle(fixture.target("type-ahead-search-option-string:beta")),
      activationId: 1,
      source: "android-click",
      observedAt: 100,
    },
  }
  const latePress = beta.props.onNativeActivation
  expect(latePress).toEqual(expect.any(Function))
  await rerender(wrapper({ isOpen: true, onChange, isReadOnly: true }))
  await act(() => latePress(packet))
  expect(onChange).not.toHaveBeenCalled()
})
it("NATIVE.compact.009 matches canonical selected-row style and pointer recommit without replacing a held query", async () => {
  const onChange = jest.fn(),
    onInputChange = jest.fn()
  await render(wrapper({ isOpen: true, value: "alpha", inputValue: "held", onChange, onInputChange }))
  await ready()
  expect(row("type-ahead-search-option-string:alpha")).toHaveStyle({
    backgroundColor: "#efefef",
    padding: 5,
    minHeight: 20,
  })
  await pressCompact(row("type-ahead-search-option-string:alpha"))
  expect(onChange).not.toHaveBeenCalled()
  expect(onInputChange).toHaveBeenCalledWith("Alpha Wave")
  expect(row("type-ahead-search-input").props.value).toBe("held")
})
it("NATIVE.compact.010 keeps an explicit empty default query ahead of the default selected label", async () => {
  const onInputChange = jest.fn()
  const { rerender } = await render(wrapper({ defaultValue: "alpha", defaultInputValue: "", onInputChange }))
  expect(row("type-ahead-search-input").props.value).toBe("")
  await rerender(wrapper({ defaultValue: "beta", defaultInputValue: "later", onInputChange }))
  expect(row("type-ahead-search-input").props.value).toBe("")
  expect(onInputChange).not.toHaveBeenCalled()
})
