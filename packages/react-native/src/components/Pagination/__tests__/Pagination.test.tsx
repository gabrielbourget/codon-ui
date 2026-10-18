import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, View } from "react-native"

import {
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type TNativePressEvent,
} from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"
import { Pagination } from "../Pagination"
import type { TNativePaginationProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const hidden = { includeHiddenElements: true }
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  frames.clear()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const event = () => {
  let prevented = false
  return {
    nativeEvent: { target: 17, timestamp: 0 },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
}
const press = async (name: string) => fireEvent(screen.getByRole("button", { name, ...hidden }), "press", event())
const fixture = (initial: Partial<TNativePaginationProps> = {}) => {
  const page = jest.fn(),
    size = jest.fn(),
    ref = createRef<View>(),
    host = createRef<View>()
  const anchor = createRef<View>()
  const node = (props = initial, mode: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={mode}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={host} testID="host">
          <View ref={anchor} />
          <Pagination
            ref={ref}
            currentPage={3}
            itemsPerPage={10}
            numberOfItems={200}
            setCurrentPage={page}
            setItemsPerPage={size}
            {...props}
          />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const ready = async (popup: View) => {
    const measure = (view: View, rect: [number, number, number, number]) =>
      Object.defineProperty(view, "measureInWindow", {
        configurable: true,
        value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => callback(...rect)),
      })
    measure(host.current!, [0, 0, 360, 600])
    measure(anchor.current!, [100, 100, 50, 40])
    measure(popup, [0, 0, 200, 200])
    await fireEvent(screen.getByTestId("host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 600 } },
    })
    await fireEvent(screen.getByTestId("click-popover", hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 200 } },
    })
    for (const ready of [false, true]) {
      const host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "pagination-window",
            epoch: 1,
            policyRevision: host.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
    }
    await act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
  }
  return { node, page, size, ref, host, anchor, ready }
}

it("CAP.pagination.001/.005 renders the default primary group with an actual root ref and consumes wrapper props", async () => {
  const f = fixture()
  await render(f.node())
  expect(f.ref.current).not.toBeNull()
  expect(screen.getByTestId("primary-controls")).toBeOnTheScreen()
  for (const id of ["page-counter", "page-input", "items-per-page"]) expect(screen.queryByTestId(id)).toBeNull()
  for (const name of [
    "currentPage",
    "itemsPerPage",
    "numberOfItems",
    "setCurrentPage",
    "setItemsPerPage",
    "customGeneralButtonProps",
  ])
    expect(screen.getByTestId("pagination").props[name]).toBeUndefined()
})
it("CAP.pagination.002 preserves root custom/final/registered style order and authored zero axes", async () => {
  const f = fixture({
    customComponentStyles: [{ backgroundColor: "red", marginTop: 2 }, { width: 80 }],
    style: { backgroundColor: "blue", width: 0, height: 0 },
  })
  await render(f.node())
  expect(screen.getByTestId("pagination")).toHaveStyle({
    backgroundColor: "blue",
    marginTop: 2,
    width: 0,
    height: 0,
    flexDirection: "row",
  })
})
it("CAP.pagination.003 routes labels/IDs and empty native captions through the owned root", async () => {
  const f = fixture({
    ariaLabel: "",
    ariaLabelledBy: "first second",
    ariaDescribedBy: "description",
    ariaDetails: "details",
    labels: { root: { descriptionLabel: "", detailsLabel: "Détails" } },
  })
  await render(f.node())
  expect(screen.getByTestId("pagination").props).toMatchObject({
    accessibilityLabel: "",
    nativeLabelledBy: ["first", "second"],
    nativeDescribedBy: ["description"],
    nativeDetailsBy: ["details"],
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "Détails",
  })
})
it("CAP.pagination.004/.029 guards all actions and range boundaries despite a nested attempt to re-enable buttons", async () => {
  const f = fixture({ isDisabled: true, customGeneralButtonProps: { isDisabled: false } })
  await render(f.node())
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled()
  await press("Next Page")
  expect(f.page).not.toHaveBeenCalled()
  await screen.rerender(f.node({ currentPage: 1 }))
  expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled()
  await screen.rerender(f.node({ currentPage: 20 }))
  expect(screen.getByRole("button", { name: "Next Page" })).toBeDisabled()
})
it("CAP.pagination.006 forwards nested input/field/button props while preserving owned values", async () => {
  const f = fixture({
    chosenPaginationSubcomponents: ["page-input"],
    customGeneralButtonProps: { testID: "submit" },
    customPageNumberInputFormFieldProps: { testID: "field" },
    customPageNumberInputProps: { testID: "number", placeholder: "Authored placeholder" },
  })
  await render(f.node())
  expect(screen.getByTestId("submit")).toBeOnTheScreen()
  expect(screen.getByTestId("field")).toBeOnTheScreen()
  expect(screen.getByTestId("number")).toBeOnTheScreen()
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("1")
})
it("CAP.pagination.010/.025/.026 leaves current page unchanged after requests until owner echo", async () => {
  const f = fixture()
  await render(f.node())
  await press("Go To Page 3")
  expect(f.page).not.toHaveBeenCalled()
  await press("Go To Page 5")
  await press("Go To Page 5")
  expect(f.page.mock.calls).toEqual([[5], [5]])
  expect(screen.getByTestId("pagination-page-3").props.accessibilityState.selected).toBe(true)
  await screen.rerender(f.node({ currentPage: 5 }))
  expect(screen.getByTestId("pagination-page-5").props.accessibilityState.selected).toBe(true)
})
it("CAP.pagination.027 requests first/previous/next/last from the authoritative caller page", async () => {
  const f = fixture({ showFirstPageButton: true, showLastPageButton: true })
  await render(f.node())
  for (const name of ["First Page", "Previous Page", "Next Page", "Last Page"]) await press(name)
  expect(f.page.mock.calls).toEqual([[1], [2], [4], [20]])
})
it("CAP.pagination.011/.024/.028 coordinates size then page without drifting on repeated declined size changes", async () => {
  const trace: unknown[][] = []
  const f = fixture({
    chosenPaginationSubcomponents: ["items-per-page", "primary-controls"],
    setItemsPerPage: (value) => {
      f.size(value)
      trace.push(["size", value])
    },
    setCurrentPage: (value) => {
      f.page(value)
      trace.push(["page", value])
    },
  })
  await render(f.node())
  const choose = async (value: number) => {
    await press("Items Per Page")
    const window = screen.getByTestId("select-window", hidden)
    const dismissed = window.props.onDismiss
    await fireEvent(window, "show")
    await fireEvent.press(screen.getByRole("radio", { name: String(value) }))
    await act(() => dismissed())
  }
  await choose(50)
  await choose(20)
  expect(trace).toEqual([
    ["size", 50],
    ["page", 1],
    ["size", 20],
    ["page", 2],
  ])
  expect(screen.getByRole("button", { name: "Items Per Page" }).props.accessibilityValue.text).toBe("10")
  await screen.rerender(f.node({ chosenPaginationSubcomponents: ["items-per-page"], itemsPerPage: 50 }))
  expect(screen.getByRole("button", { name: "Items Per Page" }).props.accessibilityValue.text).toBe("50")
  await choose(20)
  expect(f.page).toHaveBeenLastCalledWith(6)
})
it("CAP.pagination.012 preserves option order and an authored empty option collection", async () => {
  const f = fixture({ chosenPaginationSubcomponents: ["items-per-page"], itemsPerPageOptions: [15, 30, 45] })
  await render(f.node())
  await press("Items Per Page")
  const firstDismissed = screen.getByTestId("select-window", hidden).props.onDismiss
  await fireEvent(screen.getByTestId("select-window", hidden), "show")
  expect(screen.getAllByRole("radio").map((node) => node.props.accessibilityLabel)).toEqual(["15", "30", "45"])
  await press("Close page size choices")
  await act(() => firstDismissed())
  await screen.rerender(f.node({ chosenPaginationSubcomponents: ["items-per-page"], itemsPerPageOptions: [] }))
  await press("Items Per Page")
  await fireEvent(screen.getByTestId("select-window", hidden), "show")
  expect(screen.queryAllByRole("radio")).toHaveLength(0)
  expect(screen.getByText("No page sizes available")).toBeOnTheScreen()
})
it("CAP.pagination.013/.014 uses the expected side-priority numeric window and singleton overflow affordance", async () => {
  const f = fixture({ currentPage: 10, maxVisiblePages: 4, consolidationPlacement: "right" })
  await render(f.node())
  expect(screen.getByTestId("pagination-page-9")).toBeOnTheScreen()
  expect(screen.queryByTestId("pagination-page-11")).toBeNull()
  expect(screen.getAllByTestId("pagination-overflow-trigger")).toHaveLength(2)
  await screen.rerender(f.node({ currentPage: 2, numberOfItems: 40, maxVisiblePages: 3 }))
  await press("Go To Page 3")
  expect(f.page).toHaveBeenCalledWith(3)
  expect(screen.queryByTestId("click-popover")).toBeNull()
})
it.each(["rounded", "round", "orthogonal"] as const)(
  "CAP.pagination.015 propagates %s geometry to all native controls",
  async (geometry) => {
    const f = fixture({
      geometry,
      chosenPaginationSubcomponents: ["page-counter", "page-input", "items-per-page", "primary-controls"],
    })
    await render(f.node())
    const expected =
      geometry === "orthogonal"
        ? 0
        : geometry === "round"
          ? resolveNativeTheme("light").radius.round
          : resolveNativeTheme("light").radius.rounded
    expect(screen.getByRole("button", { name: "Next Page" })).toHaveStyle({ borderRadius: expected })
    expect(screen.getByRole("button", { name: "Navigate to Selected Page" })).toHaveStyle({ borderRadius: expected })
  },
)
it.each(["light", "dark"] as const)(
  "CAP.pagination.016/.017 retains semantic defaults and all order styles in %s",
  async (mode) => {
    const f = fixture({
      buttonColorMode: "outline",
      chosenPaginationSubcomponents: ["page-counter", "primary-controls"],
    })
    await render(f.node(undefined, mode))
    expect(screen.getByTestId("pagination-separator-0")).toHaveStyle({
      backgroundColor: resolveNativeTheme(mode).colors.controlBorder,
    })
    for (const order of ["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const) {
      await screen.rerender(f.node({ buttonColorMode: "outline", order }, mode))
      expect(screen.getByRole("button", { name: "Previous Page" })).toHaveStyle({
        borderColor: resolveNativeTheme(mode).actions[order].border,
      })
    }
  },
)
it("CAP.pagination.018/.019 preserves grouped function labels and explicit empty legacy visible text", async () => {
  const f = fixture({
    firstPageLabel: "",
    prevPageLabel: "",
    counterText: "",
    pageInputLabel: "",
    pageInputSelectionButtonText: "",
    showFirstPageButton: true,
    chosenPaginationSubcomponents: ["page-counter", "page-input", "primary-controls"],
    labels: {
      root: { navigationAriaLabel: "Navigation locale" },
      primaryControls: { pageButtonAriaLabel: (value) => `Ouvrir ${value}`, nextPageButtonAriaLabel: "Suivant" },
    },
  })
  await render(f.node())
  expect(screen.getByTestId("pagination").props.accessibilityLabel).toBe("Navigation locale")
  expect(screen.getByRole("button", { name: "Ouvrir 3" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Suivant" })).toBeOnTheScreen()
  expect(screen.queryByText("Prev")).toBeNull()
  expect(screen.queryByText("Pages")).toBeNull()
  expect(screen.getByLabelText("Page number")).toBeOnTheScreen()
})
it("CAP.pagination.020 preserves custom icon nodes and explicit null suppression", async () => {
  const f = fixture({
    showFirstPageButton: true,
    showLastPageButton: true,
    incrementAllDownIcon: <Text testID="first-icon">A</Text>,
    incrementDownIcon: null,
    incrementUpIcon: <Text testID="next-icon">B</Text>,
    incrementAllUpIcon: <Text testID="last-icon">C</Text>,
    overflowItemsButtonIcon: <Text testID="overflow-icon">D</Text>,
  })
  await render(f.node())
  for (const id of ["first-icon", "next-icon", "last-icon", "overflow-icon"])
    expect(screen.getAllByTestId(id).length).toBeGreaterThan(0)
  expect(screen.queryByTestId("pagination-default-left-icon")).toBeNull()
})
it("CAP.pagination.021/.022 preserves one-page/zero-item visibility, selected groups, deduplication and separators", async () => {
  const f = fixture({ numberOfItems: 0, currentPage: 1 })
  await render(f.node())
  expect(screen.queryByTestId("pagination")).toBeNull()
  await screen.rerender(
    f.node({
      numberOfItems: 0,
      currentPage: 1,
      showWithOnePage: true,
      chosenPaginationSubcomponents: ["page-counter", "page-counter", "primary-controls"],
    }),
  )
  expect(screen.getAllByTestId("page-counter")).toHaveLength(1)
  expect(screen.getByTestId("pagination-separator-0")).toBeOnTheScreen()
  expect(screen.queryByTestId("pagination-separator-1")).toBeNull()
  expect(f.page).not.toHaveBeenCalled()
  await screen.rerender(f.node({ chosenPaginationSubcomponents: [] }))
  expect(screen.getByTestId("primary-controls")).toBeOnTheScreen()
})
it("CAP.pagination.023 keeps the page draft across owner/theme changes and submits only on the Go action", async () => {
  const f = fixture({ chosenPaginationSubcomponents: ["page-input", "primary-controls"] })
  await render(f.node())
  await fireEvent.changeText(screen.getByLabelText("Page number"), "7")
  await screen.rerender(
    f.node({ currentPage: 5, chosenPaginationSubcomponents: ["page-input", "primary-controls"] }, "dark"),
  )
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("7")
  expect(f.page).not.toHaveBeenCalled()
  await press("Navigate to Selected Page")
  expect(f.page.mock.calls).toEqual([[7]])
})
it("preserves the original general-button event and allows an owner veto without changing the page", async () => {
  const onPress = jest.fn((value: TNativePressEvent) => value.preventDefault())
  const f = fixture({ customGeneralButtonProps: { onPress } })
  await render(f.node())
  const original = event()
  await fireEvent(screen.getByRole("button", { name: "Next Page" }), "press", original)
  expect(onPress.mock.calls[0][0]).toBe(original)
  expect(f.page).not.toHaveBeenCalled()
})

it("CAP.pagination.007/.008/.009/.030 keeps independent popup/list styles and native selection while the owner declines a page", async () => {
  const popup = createRef<View>()
  const f = fixture()
  const props: Partial<TNativePaginationProps> = {
    currentPage: 1,
    maxVisiblePages: 4,
    customOptionsListStyles: { backgroundColor: "navy", fontSize: 22 },
    customClickPopoverProps: {
      ref: popup,
      triggerRef: f.anchor,
      customStyles: { backgroundColor: "purple" },
      customDialogStyles: { backgroundColor: "red" },
    },
  }
  await render(f.node(props))
  await fireEvent(screen.getAllByTestId("pagination-overflow-trigger")[0], "press", event())
  await f.ready(popup.current!)
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ backgroundColor: "purple" })
  expect(StyleSheet.flatten(screen.getByTestId("click-popover", hidden).props.style).boxShadow).toBeUndefined()
  expect(screen.getByTestId("click-popover-dialog", hidden)).toHaveStyle({ backgroundColor: "red" })
  expect(screen.getByTestId("pagination-overflow-scroll", hidden).props.contentContainerStyle).toMatchObject({
    backgroundColor: "navy",
  })
  const option = screen.getByTestId("pagination-option-page-2", hidden)
  const touch = {
    ...event(),
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, timestamp: 0, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => option.props.onResponderGrant(touch))
  await act(() => option.props.onResponderRelease(touch))
  expect(f.page.mock.calls).toEqual([[2]])
  expect(screen.getByTestId("pagination-page-1", hidden).props.accessibilityState.selected).toBe(true)
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
  await screen.rerender(
    f.node({ ...props, customClickPopoverProps: { ...props.customClickPopoverProps, raised: true } }),
  )
  expect(StyleSheet.flatten(screen.getByTestId("click-popover", hidden).props.style).boxShadow).toBeDefined()
})

it("selects a pagination option on Enter/Space down without duplicating requests on native key-up", async () => {
  const popup = createRef<View>(),
    f = fixture()
  await render(
    f.node({ currentPage: 1, maxVisiblePages: 4, customClickPopoverProps: { ref: popup, triggerRef: f.anchor } }),
  )
  await fireEvent(screen.getAllByTestId("pagination-overflow-trigger")[0], "press", event())
  await f.ready(popup.current!)
  const send = async (key: string, phase: "down" | "up") => {
    const node = screen.getByTestId("pagination-option-page-2", hidden)
    const packet = {
      ...event(),
      nativeEvent: {
        kind: "keyboard",
        ownerId: node.props.ownerId,
        target: 17,
        key,
        nativeCode: 40,
        characters: "",
        phase,
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        nativeDefaultHandled: true,
        timestamp: 0,
      },
    }
    await act(() => node.props.onNativeKey(packet))
  }
  await send("Enter", "down")
  expect(f.page.mock.calls).toEqual([[2]])
  await send("Enter", "up")
  expect(f.page).toHaveBeenCalledTimes(1)
  await send(" ", "down")
  await send(" ", "up")
  expect(f.page).toHaveBeenCalledTimes(1)
  await send(" ", "down")
  await send(" ", "up")
  expect(f.page.mock.calls).toEqual([[2], [2]])
})

it("preserves controlled closed popup state and reports repeated native trigger requests", async () => {
  const opened = jest.fn(),
    f = fixture({
      currentPage: 10,
      maxVisiblePages: 4,
      customClickPopoverProps: { isOpen: false, onOpenChange: opened },
    })
  await render(f.node())
  for (let index = 0; index < 2; index++)
    await fireEvent(screen.getAllByTestId("pagination-overflow-trigger")[0], "press", event())
  expect(opened.mock.calls).toEqual([[true], [true]])
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  expect(f.page).not.toHaveBeenCalled()
})

it("uses the existing locale-aware number model for Go without depending on a native blur event", async () => {
  const changed = jest.fn(),
    f = fixture({
      numberOfItems: 20_000,
      chosenPaginationSubcomponents: ["page-input"],
      customPageNumberInputProps: { locale: "de-DE", onChangeText: changed },
    })
  await render(f.node())
  await fireEvent.changeText(screen.getByLabelText("Page number"), "1.234")
  await press("Navigate to Selected Page")
  expect(changed.mock.calls).toEqual([["1.234"]])
  expect(f.page.mock.calls).toEqual([[1234]])
})

it("merges registered root/slot styles before each button's final style callback", async () => {
  const registered = StyleSheet.create({ root: { padding: 3 }, slot: { minWidth: 73 } })
  const defaults: unknown[] = []
  const f = fixture({
    customComponentStyles: registered.root,
    customGeneralButtonProps: {
      customStyles: { marginTop: 2 },
      style: ({ defaultStyle }) => {
        defaults.push(defaultStyle)
        return { ...defaultStyle, height: 0 }
      },
    },
    customPageNumberButtonStyles: registered.slot,
  })
  await render(f.node())
  expect(screen.getByTestId("pagination")).toHaveStyle({ padding: 3 })
  expect(screen.getByTestId("pagination-page-3")).toHaveStyle({ minWidth: 73, marginTop: 2, height: 0 })
  expect(
    defaults.some(
      (value) => typeof value === "object" && value !== null && "minWidth" in value && value.minWidth === 73,
    ),
  ).toBe(true)
})

it("renders explicit RTL ordering/icons and preserves all visibility guards", async () => {
  const f = fixture({
    rtl: true,
    showFirstPageButton: true,
    showLastPageButton: true,
    showPrevPageButtonLabel: false,
    showNextPageButtonIcon: false,
  })
  await render(f.node())
  expect(screen.getByTestId("pagination")).toHaveStyle({ flexDirection: "row-reverse", direction: "ltr" })
  expect(screen.getByTestId("pagination-default-double-right-icon", hidden)).toBeOnTheScreen()
  expect(screen.queryByText("Prev")).toBeNull()
  await screen.rerender(f.node({ showIncrementButtons: false }))
  expect(screen.queryByRole("button", { name: "Next Page" })).toBeNull()
  await screen.rerender(f.node({ currentPage: 1, showPrevPageButtonOnFirstPage: false }))
  expect(screen.queryByRole("button", { name: "Previous Page" })).toBeNull()
})

it.each([
  ["customFirstPageButtonStyles", "First Page"],
  ["customPrevButtonStyles", "Previous Page"],
  ["customNextButtonStyles", "Next Page"],
  ["customLastPageButtonStyles", "Last Page"],
  ["customPageNumberButtonStyles", "Go To Page 10"],
  ["customPageNumberInputNavigationButtonStyles", "Navigate to Selected Page"],
] as const)("keeps %s scoped above general native button styles", async (slot, name) => {
  const f = fixture({
    currentPage: 10,
    maxVisiblePages: 4,
    showFirstPageButton: true,
    showLastPageButton: true,
    chosenPaginationSubcomponents: ["page-input", "primary-controls"],
    customGeneralButtonProps: { customStyles: { marginTop: 2 } },
    [slot]: { marginTop: 7 },
  })
  await render(f.node())
  expect(screen.getByRole("button", { name })).toHaveStyle({ marginTop: 7 })
  if (name !== "Next Page") expect(screen.getByRole("button", { name: "Next Page" })).toHaveStyle({ marginTop: 2 })
})

it.each([
  [{ showFirstPageButton: false }, "First Page"],
  [{ showPrevPageButton: false }, "Previous Page"],
  [{ showNextPageButton: false }, "Next Page"],
  [{ showLastPageButton: false }, "Last Page"],
  [{ currentPage: 1, showFirstPageButtonOnFirstPage: false }, "First Page"],
  [{ currentPage: 20, showLastPageButtonOnLastPage: false }, "Last Page"],
] as const)("preserves explicit visibility flags %j", async (flags, name) => {
  const f = fixture({ showFirstPageButton: true, showLastPageButton: true, ...flags })
  await render(f.node())
  expect(screen.queryByRole("button", { name })).toBeNull()
  expect(f.page).not.toHaveBeenCalled()
})

it("keeps counter, numeric editor, select and both field style owners independent", async () => {
  const f = fixture({
    chosenPaginationSubcomponents: ["page-counter", "page-input", "items-per-page"],
    customPageCounterProps: { showMaxValue: false, customTextStyles: { fontSize: 27 } },
    customPageCounterStyles: { backgroundColor: "red" },
    customPageNumberInputFormFieldStyles: { backgroundColor: "blue" },
    customPageNumberInputFormFieldProps: { testID: "page-field" },
    customPageNumberInputStyles: { backgroundColor: "purple" },
    customItemsPerPageFormFieldProps: { testID: "size-field" },
    customItemsPerPageFormFieldStyles: { backgroundColor: "orange" },
    customItemsPerPageSelectStyles: { backgroundColor: "green" },
  })
  await render(f.node())
  expect(screen.getByTestId("counter")).toHaveStyle({ backgroundColor: "red" })
  expect(screen.queryByTestId("counter-max")).toBeNull()
  expect(screen.getByTestId("counter-value")).toHaveStyle({ fontSize: 27 })
  expect(screen.getByTestId("page-field")).toHaveStyle({ backgroundColor: "blue" })
  expect(screen.getByTestId("number-input")).toHaveStyle({ backgroundColor: "purple" })
  expect(screen.getByTestId("size-field")).toHaveStyle({ backgroundColor: "orange" })
  expect(screen.getByTestId("select")).toHaveStyle({ backgroundColor: "green" })
})

it("does not submit a discarded editor draft after the native numeric configuration changes", async () => {
  const f = fixture({ chosenPaginationSubcomponents: ["page-input"] })
  await render(f.node())
  await fireEvent.changeText(screen.getByLabelText("Page number"), "7")
  await screen.rerender(f.node({ chosenPaginationSubcomponents: ["page-input"], itemsPerPage: 100 }))
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("1")
  await press("Navigate to Selected Page")
  expect(f.page.mock.calls).toEqual([[1]])
})

it("NAV.001/.003 binds navigation and current-page wording without moving current state after declined requests", async () => {
  const f = fixture({
    labels: {
      root: { navigationRoleDescription: "Navigation locale" },
      primaryControls: { currentPageValue: "Page actuelle" },
    },
  })
  await render(f.node())
  expect(screen.getByTestId("pagination").props).toMatchObject({
    nativeNavigation: true,
    nativeNavigationLabel: "Navigation locale",
    accessible: false,
  })
  expect(screen.getByTestId("pagination-page-3").props.accessibilityValue).toEqual({ text: "Page actuelle" })
  expect(screen.getByTestId("pagination-page-5").props.accessibilityValue).toEqual({ text: "" })
  await press("Go To Page 5")
  await press("Go To Page 5")
  expect(f.page.mock.calls).toEqual([[5], [5]])
  expect(screen.getByTestId("pagination-page-3").props.accessibilityValue).toEqual({ text: "Page actuelle" })
  expect(screen.getByTestId("pagination-page-5").props.accessibilityValue).toEqual({ text: "" })
  await screen.rerender(f.node({ currentPage: 5 }))
  expect(screen.getByTestId("pagination-page-5").props.accessibilityValue).toEqual({ text: "Current page" })
  expect(
    screen
      .getAllByTestId(/^pagination-page-/)
      .filter((node) => node.props.accessibilityState.selected)
      .map((node) => node.props.testID),
  ).toEqual(["pagination-page-5"])
})

it.each([false, true])("NAV.003 preserves authored value text and zero range fields with alias=%s", async (alias) => {
  const f = fixture({
    customGeneralButtonProps: {
      accessibilityValue: { min: 0, max: 0, now: 0, text: alias ? "ignored" : "Author value" },
      ...(alias ? { "aria-valuetext": "Author alias" } : {}),
    },
  })
  await render(f.node())
  const text = alias ? "Author alias" : "Author value"
  expect(screen.getByTestId("pagination-page-3").props.accessibilityValue).toEqual({
    min: 0,
    max: 0,
    now: 0,
    text: `${text}, Current page`,
  })
  for (const id of ["pagination-page-5", "pagination-previous", "pagination-next"])
    expect(screen.getByTestId(id).props.accessibilityValue).toEqual({ min: 0, max: 0, now: 0, text })
})

it("NAV.003 preserves explicit empty wording and updates localization without page callbacks", async () => {
  const f = fixture({
    labels: { root: { navigationRoleDescription: "" }, primaryControls: { currentPageValue: "" } },
    customGeneralButtonProps: { accessibilityValue: { now: 0, text: "" } },
  })
  await render(f.node())
  expect(screen.getByTestId("pagination").props.nativeNavigationLabel).toBe("")
  expect(screen.getByTestId("pagination-page-3").props.accessibilityValue).toMatchObject({ now: 0, text: "" })
  expect(screen.getByTestId("pagination-page-3").props.accessibilityState.selected).toBe(true)
  await screen.rerender(f.node({ labels: { primaryControls: { currentPageValue: "Aktuelle Seite" } } }))
  expect(screen.getByTestId("pagination-page-3").props.accessibilityValue).toEqual({ text: "Aktuelle Seite" })
  expect(f.page).not.toHaveBeenCalled()
  expect(f.size).not.toHaveBeenCalled()
})

it.each([false, true])("NAV.003 protects caller current-page state from a nested selected alias=%s", async (alias) => {
  const f = fixture({ customGeneralButtonProps: { "aria-selected": alias, accessibilityState: { selected: alias } } })
  await render(f.node())
  expect(screen.getByTestId("pagination-page-3").props.accessibilityState.selected).toBe(true)
  expect(screen.getByTestId("pagination-page-5").props.accessibilityState.selected).toBe(false)
})

it("NAV.003 keeps a controlled overflow's expanded state authoritative over nested aliases", async () => {
  const f = fixture({
    currentPage: 1,
    customClickPopoverProps: { isOpen: true },
    customGeneralButtonProps: { "aria-expanded": false, accessibilityState: { expanded: false } },
  })
  await render(f.node())
  for (const trigger of screen.getAllByTestId("pagination-overflow-trigger", hidden))
    expect(trigger.props.accessibilityState.expanded).toBe(true)
  await screen.rerender(
    f.node({
      currentPage: 1,
      customClickPopoverProps: { isOpen: false },
      customGeneralButtonProps: { "aria-expanded": true },
    }),
  )
  for (const trigger of screen.getAllByTestId("pagination-overflow-trigger", hidden))
    expect(trigger.props.accessibilityState.expanded).toBe(false)
})

it("NAV.003 retains the numeric accessibility value map when current status moves, preserving fixed labels", async () => {
  const f = fixture({ currentPage: 1 })
  await render(f.node())
  expect(screen.getByTestId("pagination-page-1").props).toMatchObject({
    accessibilityLabel: "Go To Page 1",
    accessibilityValue: { text: "Current page" },
  })
  await screen.rerender(f.node({ currentPage: 2 }))
  expect(screen.getByTestId("pagination-page-1").props).toMatchObject({
    accessibilityLabel: "Go To Page 1",
    accessibilityValue: { text: "" },
    accessibilityState: { selected: false },
  })
  expect(screen.getByTestId("pagination-page-2").props.accessibilityValue).toEqual({ text: "Current page" })
  expect(f.page).not.toHaveBeenCalled()
})
