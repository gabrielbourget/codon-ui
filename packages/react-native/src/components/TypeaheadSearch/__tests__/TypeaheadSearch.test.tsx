import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  PlatformColor,
  Platform,
  ScrollView,
  StyleSheet,
  type View,
  type TextInput,
} from "react-native"

import {
  AVAILABLE_TYPEAHEAD_SEARCH_STATUSES,
  Button,
  DEFAULT_TYPEAHEAD_SEARCH_LABELS,
  NativeThemeProvider,
  Text,
  TypeaheadSearch,
  resolveTypeaheadSearchLabels,
  type TypeaheadSearchProps,
} from "../../.."

type TItem = { id: string | number; name: string; disabled?: boolean }
const ITEMS: readonly TItem[] = [
  { id: 0, name: "Alpha" },
  { id: "0", name: "Beta" },
  { id: "", name: "Empty" },
]
const key = (item: TItem) => item.id
const name = { accessibilityLabel: "Search items" }
const root = () => screen.getByTestId("typeahead-search")
const input = () => screen.getByTestId("typeahead-search-input")
const button = () => screen.getByTestId("typeahead-search-button")
const row = (name: string) => screen.getByRole("radio", { name })
const query = { inputValue: "", onInputChange: jest.fn() }
const nativeMethods: { measureLayout: jest.Mock; focus: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
const animation = () => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })
beforeEach(() => {
  jest.useFakeTimers()
  query.onInputChange.mockClear()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(Animated, "timing").mockImplementation(animation)
  jest.spyOn(Animated, "loop").mockImplementation(animation)
  nativeMethods.measureLayout.mockReset()
  nativeMethods.focus.mockClear()
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("CAP.typeahead-search.001 renders the controlled input and caller-configured inline results viewport", async () => {
  await render(
    <TypeaheadSearch
      {...query}
      {...name}
      status="minimum-query"
      minimumInputLength={2}
      customResultsContainerStyles={{ height: 320, maxHeight: 320 }}
    />,
  )
  expect(input()).toHaveDisplayValue("")
  expect(input()).toHaveStyle({ borderWidth: 0, outlineWidth: 0, backgroundColor: "transparent" })
  expect(screen.getByTestId("typeahead-search-minimum-query-state")).toHaveTextContent(
    "Enter at least 2 characters to search",
  )
  expect(screen.getByTestId("typeahead-search-results-container").props.nestedScrollEnabled).toBe(true)
  expect(screen.getByTestId("typeahead-search-results-container")).toHaveStyle({
    minHeight: 160,
    height: 320,
    maxHeight: 320,
  })
})

it("CAP.typeahead-search.002 preserves computed/custom/final root styles and native identity precedence", async () => {
  await render(
    <TypeaheadSearch
      {...query}
      testID=""
      data-testid="alias"
      customStyles={{ color: "turquoise", marginTop: 5, width: 0 }}
      style={[false, { color: "tomato", marginBottom: 10, opacity: 0 }]}
    />,
  )
  expect(screen.getByTestId("")).toHaveStyle({
    flexDirection: "column",
    gap: 10,
    color: "tomato",
    width: 0,
    marginTop: 5,
    marginBottom: 10,
    opacity: 0,
  })
  expect(screen.queryByTestId("alias")).toBeNull()
})

it("CAP.typeahead-search.003 preserves all six native style owners", async () => {
  await render(
    <TypeaheadSearch
      {...query}
      items={ITEMS}
      getItemKey={key}
      customStyles={{ padding: 2 }}
      customInputRowStyles={{ backgroundColor: "pink" }}
      customInputStyles={{ paddingLeft: 15 }}
      customSearchButtonStyles={{ height: 35 }}
      customResultsContainerStyles={{ marginTop: 5 }}
      customResultsListStyles={{ gap: 15 }}
    />,
  )
  expect(root()).toHaveStyle({ padding: 2 })
  expect(screen.getByTestId("typeahead-search-input-row")).toHaveStyle({ backgroundColor: "pink", borderWidth: 1 })
  expect(input()).toHaveStyle({ paddingLeft: 15, borderWidth: 0 })
  expect(button()).toHaveStyle({ height: 35 })
  expect(screen.getByTestId("typeahead-search-results-container")).toHaveStyle({ marginTop: 5 })
  expect(screen.getByTestId("typeahead-search-results-list")).toHaveStyle({ gap: 15 })
})

it("CAP.typeahead-search.004 disables query/search while retaining canonical selectable results", async () => {
  const changes = jest.fn()
  const submits = jest.fn()
  const selections = jest.fn()
  await render(
    <TypeaheadSearch
      {...name}
      inputValue="owner"
      onInputChange={changes}
      onSubmitQuery={submits}
      onSelectionChange={selections}
      items={[{ id: 0, name: "Alpha", disabled: true }]}
      getItemKey={key}
      isDisabled
    />,
  )
  expect(root()).toHaveStyle({ opacity: 0.4 })
  expect(input().props.editable).toBe(false)
  expect(button()).toBeDisabled()
  await fireEvent.changeText(input(), "blocked")
  await fireEvent.press(button())
  await fireEvent(input(), "submitEditing", { nativeEvent: { text: "blocked" } })
  expect(changes).not.toHaveBeenCalled()
  expect(submits).not.toHaveBeenCalled()
  await fireEvent.press(row("Alpha"))
  expect(selections.mock.calls).toEqual([[0]])
  expect(row("Alpha")).toBeChecked()
})

it("CAP.typeahead-search.005 forwards actual root/input refs and native layout while consuming wrapper props", async () => {
  const ref = createRef<View>()
  const editor = createRef<TextInput>()
  const layout = jest.fn()
  const props: TypeaheadSearchProps<TItem> = {
    ...query,
    items: ITEMS,
    getItemKey: key,
    getItemTextValue: (item) => item.name,
    renderItem: (item) => item.name,
    status: "minimum-query",
    minimumInputLength: 0,
    idleMessage: "",
    minimumInputLengthMessage: "",
    loadingMessage: "",
    emptyListMessage: "",
    errorMessage: "",
    searchButtonAriaLabel: "Go",
    labels: {},
    shouldAutoFocusInput: false,
    shouldFocusWrap: false,
    geometry: "round",
    SearchIcon: <Text>S</Text>,
    LoadingIndicator: <Text>L</Text>,
    onSelectionChange: jest.fn(),
    onSubmitQuery: jest.fn(),
    customStyles: {},
    customInputRowStyles: {},
    customInputStyles: {},
    customSearchButtonStyles: {},
    customResultsContainerStyles: {},
    customResultsListStyles: {},
    inputRef: editor,
    inputProps: {},
    "data-testid": "alias",
    ...name,
  }
  await render(
    <TypeaheadSearch
      {...props}
      ref={ref}
      testID="typeahead-search"
      nativeID="search-root"
      onLayout={layout}
      collapsable={false}
    />,
  )
  for (const prop of Object.keys(props)) expect(root().props[prop]).toBeUndefined()
  expect(root().props).toMatchObject({ nativeID: "search-root", collapsable: false })
  expect(typeof ref.current?.measure).toBe("function")
  expect(typeof editor.current?.focus).toBe("function")
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 100, height: 200 } } }
  await fireEvent(root(), "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
})

it("CAP.typeahead-search.006 keeps real controlled requests distinct from owner echo and repeated veto", async () => {
  const requests = jest.fn()
  const { rerender } = await render(
    <TypeaheadSearch inputValue="" onInputChange={requests} items={ITEMS} getItemKey={key} />,
  )
  await fireEvent.changeText(input(), "  requested  ")
  await fireEvent.changeText(input(), "second")
  expect(input()).toHaveDisplayValue("")
  expect(requests.mock.calls).toEqual([["  requested  "], ["second"]])
  await rerender(<TypeaheadSearch inputValue="  requested  " onInputChange={requests} items={ITEMS} getItemKey={key} />)
  expect(input()).toHaveDisplayValue("  requested  ")
  expect(requests).toHaveBeenCalledTimes(2)
})

it("CAP.typeahead-search.007 submits only the trimmed controlled query and preserves the genuine native observer event", async () => {
  const trace: unknown[] = []
  const submit = jest.fn((value) => trace.push(value))
  const observer = jest.fn((event) => trace.push(event))
  await render(
    <TypeaheadSearch
      inputValue="  authoritative  "
      onInputChange={jest.fn()}
      onSubmitQuery={submit}
      inputProps={{ onSubmitEditing: observer }}
    />,
  )
  const event = { nativeEvent: { text: "uncommitted-native", target: 7 } }
  await fireEvent(input(), "submitEditing", event)
  expect(trace).toEqual([event, "authoritative"])
  expect(observer.mock.calls[0][0]).toBe(event)
  await fireEvent(input(), "keyPress", { nativeEvent: { key: "Enter" } })
  expect(submit).toHaveBeenCalledTimes(1)
  await fireEvent.press(button())
  expect(submit.mock.calls).toEqual([["authoritative"], ["authoritative"]])
  expect(input()).toHaveDisplayValue("  authoritative  ")
})

it("CAP.typeahead-search.008 renders all caller-driven states without replacing query or auto-inferring results", async () => {
  const { rerender } = await render(<TypeaheadSearch {...query} status="idle" idleMessage="Start" />)
  expect(screen.getByTestId("typeahead-search-idle-state")).toHaveTextContent("Start")
  expect(screen.getByText("Start")).toHaveStyle({ fontSize: 12, fontStyle: "italic", textAlign: "center" })
  for (const [status, message] of [
    ["minimum-query", "At least"],
    ["loading", "Loading..."],
    ["empty", "Nothing"],
    ["error", "Failed"],
  ] as const) {
    await rerender(
      <TypeaheadSearch
        {...query}
        inputValue="retained"
        status={status}
        minimumInputLengthMessage="At least"
        loadingMessage="Loading..."
        emptyListMessage="Nothing"
        errorMessage="Failed"
      />,
    )
    expect(screen.getByTestId(`typeahead-search-${status}-state`)).toHaveTextContent(
      new RegExp(message.replaceAll(".", "\\.")),
    )
    expect(screen.getByTestId(`typeahead-search-${status}-state`).props.accessibilityLiveRegion).toBe("polite")
    expect(input()).toHaveDisplayValue("retained")
  }
  await rerender(<TypeaheadSearch {...query} status="results" items={[]} />)
  expect(screen.getByTestId("typeahead-search-results-list")).toBeOnTheScreen()
  expect(screen.queryByTestId("typeahead-search-empty-state")).toBeNull()
})

it("CAP.typeahead-search.009 owns default native affordances and the exact loader settings", async () => {
  await render(<TypeaheadSearch {...query} status="loading" />)
  expect(screen.getByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true })).toHaveStyle({
    width: 18,
    height: 18,
  })
  expect(
    screen.getByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true }).props.accessible,
  ).toBe(false)
  expect(screen.getByTestId("typeahead-search-default-loading-indicator")).toHaveStyle({ minWidth: 24, minHeight: 24 })
  expect(screen.getByTestId("circle-loader-spinner", { includeHiddenElements: true })).toHaveStyle({
    width: 18,
    height: 18,
    borderWidth: 2.5,
    borderColor: "transparent",
  })
  expect(Animated.timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 850, useNativeDriver: true, isInteraction: false }),
  )
})

it("CAP.typeahead-search.010 preserves custom affordances and replaces the owned loading work", async () => {
  const { rerender } = await render(<TypeaheadSearch {...query} status="loading" />)
  const loops = jest.mocked(Animated.loop).mock.results.map((result) => result.value)
  await rerender(
    <TypeaheadSearch
      {...query}
      status="loading"
      SearchIcon={<Text>Custom S</Text>}
      LoadingIndicator={<Text>Custom L</Text>}
    />,
  )
  expect(screen.getByText("Custom S")).toBeOnTheScreen()
  expect(screen.getByText("Custom L")).toBeOnTheScreen()
  expect(screen.queryByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByTestId("typeahead-search-default-loading-indicator")).toBeNull()
  expect(loops.length).toBeGreaterThan(0)
  expect(loops.every((loop) => loop.stop.mock.calls.length > 0)).toBe(true)
})

it("CAP.typeahead-search.011 preserves grouped label precedence, exports and explicit empty native names", async () => {
  const { rerender } = await render(
    <TypeaheadSearch
      {...query}
      items={ITEMS}
      getItemKey={key}
      searchButtonAriaLabel="Alias"
      labels={{ searchButtonAriaLabel: "Localized search", resultsListAriaLabel: "Localized results" }}
    />,
  )
  expect(screen.getByRole("button", { name: "Localized search" })).toBeOnTheScreen()
  expect(screen.getByTestId("typeahead-search-results-list").props.accessibilityLabel).toBe("Localized results")
  expect(AVAILABLE_TYPEAHEAD_SEARCH_STATUSES).toEqual(["idle", "minimum-query", "loading", "error", "empty", "results"])
  expect(DEFAULT_TYPEAHEAD_SEARCH_LABELS.status.emptyListMessage).toBe("No matching results found")
  await rerender(
    <TypeaheadSearch
      {...query}
      accessibilityLabel=""
      aria-label="Alias"
      status="empty"
      emptyListMessage="Alias empty"
      labels={{ status: { emptyListMessage: "" } }}
    />,
  )
  expect(input().props.accessibilityLabel).toBe("")
  expect(screen.getByTestId("typeahead-search-empty-state")).toHaveTextContent("")
})

it("CAP.typeahead-search.012 renders original items with exact arguments and emits internal single-selection toggles", async () => {
  const selected = jest.fn()
  const renderItem = jest.fn((item: TItem, args) => (
    <Text>
      {item.name} | {args.query}
    </Text>
  ))
  await render(
    <TypeaheadSearch
      {...query}
      inputValue="alpha"
      items={ITEMS}
      getItemKey={key}
      renderItem={renderItem}
      onSelectionChange={selected}
    />,
  )
  expect(renderItem).toHaveBeenCalledWith(ITEMS[0], { query: "alpha", textValue: "Alpha", itemKey: 0 })
  await fireEvent.press(row("Alpha | alpha"))
  await fireEvent.press(row("Alpha | alpha"))
  await fireEvent.press(row("Beta | alpha"))
  await fireEvent.press(row("Empty | alpha"))
  await fireEvent.press(row("Empty | alpha"))
  expect(selected.mock.calls).toEqual([[0], [null], ["0"], [""], [null]])
})

it.each([undefined, null, false, 0, ""])("uses canonical falsy-to-default affordances for %p", async (content) => {
  await render(<TypeaheadSearch {...query} status="loading" SearchIcon={content} LoadingIndicator={content} />)
  expect(screen.getByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.getByTestId("typeahead-search-default-loading-indicator")).toBeOnTheScreen()
})

it("keeps a truthy boolean override empty instead of restoring an owned default", async () => {
  await render(<TypeaheadSearch {...query} status="loading" SearchIcon={true} LoadingIndicator={true} />)
  expect(screen.queryByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByTestId("typeahead-search-default-loading-indicator")).toBeNull()
  expect(screen.getByTestId("typeahead-search-loading-state")).toHaveTextContent("Loading results")
})

it("wraps authored bigint affordance content in native Text", async () => {
  await render(<TypeaheadSearch {...query} status="loading" SearchIcon={12n} LoadingIndicator={13n} />)
  expect(screen.getByText("12")).toBeOnTheScreen()
  expect(screen.getByText("13")).toBeOnTheScreen()
})

it.each(AVAILABLE_TYPEAHEAD_SEARCH_STATUSES)(
  "does not gate empty/repeated search submissions in status %s",
  async (status) => {
    const submit = jest.fn()
    await render(
      <TypeaheadSearch
        inputValue="   "
        onInputChange={jest.fn()}
        onSubmitQuery={submit}
        minimumInputLength={100}
        status={status}
      />,
    )
    await fireEvent.press(button())
    await fireEvent.press(button())
    expect(submit.mock.calls).toEqual([[""], [""]])
  },
)

it("preserves label map inputs, nested precedence and exact minimum-length formatter arguments", async () => {
  const minimum = jest.fn(({ minimumInputLength }) => `Threshold ${minimumInputLength}`)
  const labels = Object.freeze({
    searchButtonAriaLabel: "",
    status: Object.freeze({ loadingMessage: "", minimumInputLengthMessage: minimum }),
  })
  const resolved = resolveTypeaheadSearchLabels({ labels, loadingMessage: "Alias", emptyListMessage: "Empty alias" })
  expect(resolved.searchButtonAriaLabel).toBe("")
  expect(resolved.status.loadingMessage).toBe("")
  expect(resolved.status.emptyListMessage).toBe("Empty alias")
  await render(<TypeaheadSearch {...query} labels={labels} status="minimum-query" minimumInputLength={NaN} />)
  expect(minimum).toHaveBeenCalledWith({ minimumInputLength: NaN })
  expect(screen.getByTestId("typeahead-search-minimum-query-state")).toHaveTextContent("Threshold NaN")
})

it("consumes an iterable once per identity and preserves default key/text adapters", async () => {
  let iterations = 0
  const items = {
    *[Symbol.iterator]() {
      iterations++
      yield { ID: 9, label: "From label" }
      yield { name: "By index" }
    },
  }
  const selected = jest.fn()
  const { rerender } = await render(<TypeaheadSearch {...query} items={items} onSelectionChange={selected} />)
  await fireEvent.press(row("From label"))
  await fireEvent.press(row("By index"))
  await rerender(<TypeaheadSearch {...query} inputValue="new query" items={items} onSelectionChange={selected} />)
  expect(iterations).toBe(1)
  expect(selected.mock.calls).toEqual([["9"], ["1"]])
  expect(row("By index")).toBeChecked()
})

it("keeps explicit nonfinite numeric keys distinct and toggles them without geometry normalization", async () => {
  const items = [
    { id: NaN, name: "NaN key" },
    { id: Infinity, name: "Infinity key" },
  ]
  const select = jest.fn()
  await render(<TypeaheadSearch {...query} items={items} getItemKey={key} onSelectionChange={select} />)
  await fireEvent.press(row("NaN key"))
  expect(row("NaN key")).toBeChecked()
  await fireEvent.press(row("NaN key"))
  await fireEvent.press(row("Infinity key"))
  expect(select.mock.calls).toEqual([[NaN], [null], [Infinity]])
})

it("preserves empty collection text while deriving names from authored row content", async () => {
  const original = Object.freeze({ id: "", label: "" })
  const renderItem = jest.fn(() => <Text>Authored result</Text>)
  const select = jest.fn()
  await render(
    <TypeaheadSearch
      {...query}
      items={[original]}
      getItemKey={(item) => item.id}
      renderItem={renderItem}
      onSelectionChange={select}
    />,
  )
  expect(renderItem).toHaveBeenCalledWith(original, { query: "", textValue: "", itemKey: "" })
  await fireEvent.press(row("Authored result"))
  expect(select.mock.calls).toEqual([[""]])
})

it("retains internal selection through query/relabel/reorder/removal/reinsertion and resets only the results lifetime", async () => {
  const select = jest.fn()
  const fixture = (
    items: readonly TItem[],
    inputValue = "",
    status: TypeaheadSearchProps<TItem>["status"] = "results",
  ) => (
    <TypeaheadSearch
      inputValue={inputValue}
      onInputChange={jest.fn()}
      items={items}
      getItemKey={key}
      status={status}
      onSelectionChange={select}
    />
  )
  const { rerender } = await render(fixture(ITEMS))
  await fireEvent.press(row("Alpha"))
  const stale = row("Alpha").props.onAccessibilityAction
  await rerender(fixture(ITEMS.slice(1), "query"))
  await rerender(fixture([ITEMS[1], { id: 0, name: "Relabeled" }, ITEMS[2]], "query"))
  expect(row("Relabeled")).toBeChecked()
  expect(select.mock.calls).toEqual([[0]])
  await act(() => stale({ nativeEvent: { actionName: "increment" } }))
  expect(select).toHaveBeenCalledTimes(1)
  await rerender(fixture(ITEMS, "query", "loading"))
  await rerender(fixture(ITEMS, "query"))
  expect(row("Alpha")).not.toBeChecked()
  expect(select).toHaveBeenCalledTimes(1)
})

it("preserves keyed interactive row content without selecting its enclosing result", async () => {
  const select = jest.fn()
  const Child = () => {
    const [count, setCount] = useState(0)
    return <Button onPress={() => setCount((value) => value + 1)}>Inner {count}</Button>
  }
  const renderer = () => <Child key="stable" />
  const { rerender } = await render(
    <TypeaheadSearch
      {...query}
      items={ITEMS.slice(0, 1)}
      getItemKey={key}
      renderItem={renderer}
      onSelectionChange={select}
    />,
  )
  await userEvent.setup().press(screen.getByRole("button", { name: "Inner 0" }))
  await rerender(
    <TypeaheadSearch
      {...query}
      inputValue="new"
      items={ITEMS.slice(0, 1)}
      getItemKey={key}
      renderItem={renderer}
      onSelectionChange={select}
    />,
  )
  expect(screen.getByRole("button", { name: "Inner 1" })).toBeOnTheScreen()
  expect(select).not.toHaveBeenCalled()
})

it("protects all owned editor props while forwarding original allowed native events", async () => {
  const change = jest.fn()
  const raw = jest.fn()
  const injected = jest.fn()
  const observer = {
    onChange: raw,
    value: "injected",
    onChangeText: injected,
    isDisabled: true,
    testID: "injected",
    style: { color: "red" },
    autoFocus: true,
    returnKeyType: "search" as const,
  }
  await render(<TypeaheadSearch inputValue="owner" onInputChange={change} inputProps={observer} />)
  expect(input()).toHaveDisplayValue("owner")
  expect(input().props).toMatchObject({ editable: true, returnKeyType: "search" })
  expect(input().props.autoFocus).not.toBe(true)
  expect(screen.queryByTestId("injected")).toBeNull()
  const event = { nativeEvent: { text: "raw", eventCount: 1, target: 7 } }
  await fireEvent(input(), "change", event)
  await fireEvent.changeText(input(), "requested")
  expect(raw.mock.calls[0][0]).toBe(event)
  expect(change.mock.calls).toEqual([["requested"]])
  expect(injected).not.toHaveBeenCalled()
})

it("uses current callbacks and blocks retired input/submit work after guard takeover and unmount", async () => {
  const first = jest.fn()
  const second = jest.fn()
  const submit = jest.fn()
  const { rerender, unmount } = await render(
    <TypeaheadSearch inputValue="first" onInputChange={first} onSubmitQuery={submit} />,
  )
  const text = input().props.onChangeText
  const send = input().props.onSubmitEditing
  await rerender(<TypeaheadSearch inputValue="second" onInputChange={second} onSubmitQuery={submit} />)
  await act(() => text("current callback"))
  await act(() => send({ nativeEvent: { text: "native" } }))
  expect(first).not.toHaveBeenCalled()
  expect(second.mock.calls).toEqual([["current callback"]])
  expect(submit.mock.calls).toEqual([["second"]])
  await rerender(<TypeaheadSearch inputValue="second" onInputChange={second} onSubmitQuery={submit} isDisabled />)
  await act(() => text("blocked"))
  await act(() => send({ nativeEvent: { text: "blocked" } }))
  await unmount()
  await act(() => text("retired"))
  expect(second).toHaveBeenCalledTimes(1)
  expect(submit).toHaveBeenCalledTimes(1)
})

it.each([
  ["orthogonal", 0],
  ["rounded", 5],
  ["round", 10000],
] as const)("retains %s row geometry and single group focus styling", async (geometry, radius) => {
  await render(<TypeaheadSearch {...query} geometry={geometry} />)
  const group = screen.getByTestId("typeahead-search-input-row")
  expect(group).toHaveStyle({ borderRadius: radius })
  await fireEvent(input(), "focus", { nativeEvent: { target: 7 } })
  expect(group).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 0 })
  expect(input()).toHaveStyle({ outlineWidth: 0 })
  await fireEvent(input(), "blur", { nativeEvent: { target: 7 } })
  expect(group.props.style.outlineWidth).toBeUndefined()
})

it("updates native theme/window/registered styles without changing the owner or selection", async () => {
  const color = PlatformColor("labelColor")
  const custom = StyleSheet.create({ list: { gap: 0, padding: 0 } })
  const fixture = (dark: boolean) => (
    <NativeThemeProvider
      mode={dark ? "dark" : "light"}
      overrides={
        dark
          ? { colors: { controlForeground: "purple", controlHoverBackground: "orange" }, spacing: { unit: 8 } }
          : undefined
      }
    >
      <TypeaheadSearch
        {...query}
        items={ITEMS}
        getItemKey={key}
        customResultsListStyles={[false, custom.list]}
        inputProps={{ selectionColor: color }}
      />
    </NativeThemeProvider>
  )
  const { rerender } = await render(fixture(false))
  await fireEvent.press(row("Alpha"))
  await rerender(fixture(true))
  expect(input()).toHaveDisplayValue("")
  expect(root()).toHaveStyle({ color: "purple", gap: 16 })
  expect(row("Alpha")).toBeChecked()
  expect(row("Alpha")).toHaveStyle({ backgroundColor: "orange" })
  expect(screen.getByText("Alpha")).toHaveStyle({ color: "purple" })
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(screen.getByTestId("typeahead-search-results-container")).toHaveStyle({ maxHeight: 195 })
  expect(screen.getByTestId("typeahead-search-results-list")).toHaveStyle({ gap: 0 })
  expect(row("Alpha")).toBeChecked()
})

it("maps shouldFocusWrap to measured native row focus without selecting or fabricating a value", async () => {
  const scroll = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => undefined)
  nativeMethods.measureLayout.mockImplementation((_relative, done) => done(0, 400, 200, 48))
  const select = jest.fn()
  const fixture = (wrap: boolean) => (
    <TypeaheadSearch
      {...query}
      items={ITEMS.slice(0, 2)}
      getItemKey={key}
      shouldFocusWrap={wrap}
      onSelectionChange={select}
    />
  )
  const { rerender } = await render(fixture(false))
  await fireEvent.press(row("Alpha"))
  await fireEvent(screen.getByTestId("typeahead-search-results-container"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 160 } },
  })
  await fireEvent(row("Alpha"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } })
  expect(nativeMethods.focus).not.toHaveBeenCalled()
  await rerender(fixture(true))
  await fireEvent(row("Beta"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  expect(nativeMethods.focus).toHaveBeenCalledTimes(1)
  expect(nativeMethods.focus.mock.contexts[0].props.accessibilityState.checked).toBe(true)
  expect(scroll).toHaveBeenCalledWith({ y: 288, animated: false })
  expect(select.mock.calls).toEqual([[0]])
})

it("retires delayed measured focus after item/status/window replacement and unmount", async () => {
  const pending: (() => void)[] = []
  nativeMethods.measureLayout.mockImplementation((_relative, done) => pending.push(() => done(0, 400, 200, 48)))
  const fixture = (items: readonly TItem[] = ITEMS) => <TypeaheadSearch {...query} items={items} getItemKey={key} />
  const { rerender, unmount } = await render(fixture())
  await fireEvent(row("Alpha"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  await rerender(fixture(ITEMS.slice(1)))
  await act(() => pending.shift()?.())
  expect(nativeMethods.focus).not.toHaveBeenCalled()
  await fireEvent(row("Beta"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  await fireEvent(screen.getByTestId("typeahead-search-results-container"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 100 } },
  })
  await act(() => pending.shift()?.())
  expect(nativeMethods.focus).not.toHaveBeenCalled()
  await fireEvent(row("Beta"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  await unmount()
  await act(() => pending.shift()?.())
  expect(nativeMethods.focus).not.toHaveBeenCalled()
})

it.each([
  "customStyles",
  "style",
  "customInputRowStyles",
  "customInputStyles",
  "customSearchButtonStyles",
  "customResultsContainerStyles",
  "customResultsListStyles",
] as const)("rejects unsupported CSS colors in %s", async (field) => {
  await expect(
    render(<TypeaheadSearch {...query} {...{ [field]: { backgroundColor: "var(--unsupported)" } }} />),
  ).rejects.toThrow(/unsupported native color/)
})

it("rejects duplicate result keys instead of mixing logical native row identities", async () => {
  await expect(render(<TypeaheadSearch {...query} items={[ITEMS[0], ITEMS[0]]} getItemKey={key} />)).rejects.toThrow(
    /duplicate key/,
  )
})

it("does not invoke result adapters while a non-results status owns the body", async () => {
  const getKey = jest.fn((item: TItem) => item.id)
  const getText = jest.fn((item: TItem) => item.name)
  const { rerender } = await render(
    <TypeaheadSearch {...query} status="loading" items={ITEMS} getItemKey={getKey} getItemTextValue={getText} />,
  )
  expect(getKey).not.toHaveBeenCalled()
  expect(getText).not.toHaveBeenCalled()
  await rerender(
    <TypeaheadSearch {...query} status="results" items={ITEMS} getItemKey={getKey} getItemTextValue={getText} />,
  )
  expect(getKey).toHaveBeenCalledTimes(3)
  expect(getText).toHaveBeenCalledTimes(3)
})

it("retains a pending native focus request through equivalent data/styles and callback-only rerenders", async () => {
  const pending: (() => void)[] = []
  nativeMethods.measureLayout.mockImplementation((_relative, done) => pending.push(() => done(0, 0, 200, 48)))
  const first = jest.fn()
  const second = jest.fn()
  const fixture = (items: readonly TItem[], onSelectionChange: typeof first) => (
    <TypeaheadSearch {...query} items={items} getItemKey={key} onSelectionChange={onSelectionChange} />
  )
  const { rerender } = await render(fixture(ITEMS, first))
  await fireEvent(row("Alpha"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  expect(pending).toHaveLength(1)
  await rerender(fixture([...ITEMS], second))
  await act(() => pending.shift()?.())
  expect(nativeMethods.focus).toHaveBeenCalledTimes(1)
  expect(first).not.toHaveBeenCalled()
  expect(second).not.toHaveBeenCalled()
})

it("keeps obsolete measured focus retired after list layout changes and restoration", async () => {
  const pending: (() => void)[] = []
  nativeMethods.measureLayout.mockImplementation((_relative, done) => pending.push(() => done(0, 0, 200, 48)))
  const fixture = (gap: number) => (
    <TypeaheadSearch {...query} items={ITEMS} getItemKey={key} customResultsListStyles={{ gap }} />
  )
  const { rerender } = await render(fixture(5))
  await fireEvent(row("Alpha"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  await rerender(fixture(9))
  await rerender(fixture(5))
  await act(() => pending.shift()?.())
  expect(nativeMethods.focus).not.toHaveBeenCalled()
})

it.each([
  ["ios", 44],
  ["android", 48],
] as const)("retains the %s native result target and uncapped text scaling", async (platform, target) => {
  jest.replaceProperty(Platform, "OS", platform)
  await render(<TypeaheadSearch {...query} items={ITEMS} getItemKey={key} />)
  expect(row("Alpha")).toHaveStyle({ width: "100%", minHeight: target, padding: 5 })
  expect(screen.getByText("Alpha").props.allowFontScaling).not.toBe(false)
})

it.each(["window", "viewport", "input", "button"] as const)(
  "retires pending row focus on %s takeover before another native layout arrives",
  async (takeover) => {
    const pending: (() => void)[] = []
    nativeMethods.measureLayout.mockImplementation((_relative, done) => pending.push(() => done(0, 0, 200, 48)))
    const { rerender } = await render(<TypeaheadSearch {...query} items={ITEMS} getItemKey={key} />)
    await fireEvent(row("Alpha"), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
    expect(pending).toHaveLength(1)
    if (takeover === "window") {
      const current = Dimensions.get("window")
      const next = { ...current, height: current.height + 100 }
      await act(() => Dimensions.set({ window: next, screen: next }))
    } else if (takeover === "viewport") {
      await rerender(
        <TypeaheadSearch
          {...query}
          items={ITEMS}
          getItemKey={key}
          customResultsContainerStyles={{ height: 240, minHeight: 0, maxHeight: 240 }}
        />,
      )
    } else {
      await fireEvent(takeover === "input" ? input() : button(), "focus", { nativeEvent: { target: 7 } })
    }
    await act(() => pending.shift()?.())
    expect(nativeMethods.focus).not.toHaveBeenCalled()
    expect(query.onInputChange).not.toHaveBeenCalled()
  },
)

it("preserves renderer negative zero while selection callbacks follow canonical Set key semantics", async () => {
  const selected = jest.fn()
  const item = { id: -0, name: "Negative zero" }
  const renderer = jest.fn((value: typeof item, _args: { itemKey: string | number }) => value.name)
  await render(
    <TypeaheadSearch
      {...query}
      items={[item]}
      getItemKey={(value) => value.id}
      renderItem={renderer}
      onSelectionChange={selected}
    />,
  )
  expect(Object.is(renderer.mock.calls[0][1].itemKey, -0)).toBe(true)
  await fireEvent.press(row("Negative zero"))
  expect(Object.is(selected.mock.calls[0][0], 0)).toBe(true)
  expect(Object.is(item.id, -0)).toBe(true)
})
