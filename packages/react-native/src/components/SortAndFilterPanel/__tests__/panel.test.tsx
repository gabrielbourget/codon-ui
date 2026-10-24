import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { AccessibilityInfo, AppState, View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeBackdropHost } from "../../../overlays/backdrop/NativeBackdropHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import type { TAvailableFilterCriteria } from "../../Table/filterMetadata"
import type { TTableFilterGroup, TTableSortInstruction } from "../../Table/queryTypes"
import { resolveNativeSortAndFilterPanelLabels } from "../labels"
import { SortAndFilterPanel, type TNativeSortAndFilterPanelProps } from "../SortAndFilterPanel"

import { SortAndFilterPanelFixture } from "./fixtures/PanelFixture"

jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const sorts = [
  { id: "city", name: "City", queryKey: "event.city" },
  { id: "name", name: "Name", queryKey: "event.name" },
]
const criteria: TAvailableFilterCriteria[] = [
  { id: "name", name: "Name", queryKey: "event.name", dataType: "text", allowedOperationCodes: ["like", "similar-to"] },
  { id: "city", name: "City", queryKey: "event.city", dataType: "text", allowedOperationCodes: ["like"] },
]
const applied: TTableFilterGroup[] = [
  {
    id: "name-group",
    criteriaID: "name",
    criteriaName: "Old name",
    dataType: "text",
    joinOperator: "and",
    clauses: [{ id: "name-clause", operationCode: "like", argument: "held" }],
  },
]
const tree = (props: Partial<TNativeSortAndFilterPanelProps> = {}) => (
  <NativeThemeProvider>
    <NativeOverlayProvider backdropAdapter={{ Target: View, Effect: () => <View testID="modeled-backdrop" /> }}>
      <NativeBackdropHost>
        <SortAndFilterPanel
          possibleSortCriteria={sorts}
          possibleFilterCriteria={criteria}
          isOpen
          applyPendingSortAndFilterChanges={jest.fn()}
          onOpenChange={jest.fn()}
          {...props}
        />
      </NativeBackdropHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const host = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const acknowledge = async (identity = "sort-filter-panel-floating-host") => {
  for (const ready of [false, true]) {
    const props = host(identity).props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: props.policyRevision,
        },
      }),
    )
  }
}
const present = async () => {
  await fireEvent(host("sort-filter-panel-window"), "show")
  await fireEvent(host("sort-filter-panel"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 600 } },
  })
  await acknowledge()
}
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const choose = async (field: string, option: string) => {
  await press(field)
  await fireEvent(host("select-window"), "show")
  await acknowledge("select-floating-host")
  const dismissed = host("select-window").props.onDismiss
  // Native Modals remain beneath their covered parent in the test renderer's logical tree.
  const receiver = screen.getByRole("radio", { name: option, includeHiddenElements: true }).props
  const event = {
    persist: jest.fn(),
    currentTarget: 17,
    nativeEvent: {
      target: 17,
      timestamp: 100,
      identifier: 1,
      pageX: 1,
      pageY: 1,
      locationX: 1,
      locationY: 1,
      touches: [],
      changedTouches: [],
    },
  }
  await act(() => {
    receiver.onResponderGrant(event)
    receiver.onResponderRelease(event)
  })
  await act(() => dismissed())
  await acknowledge()
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps closed state owned and exposes the canonical default chrome, fields and separate style owners", async () => {
  const closed = await render(tree({ isOpen: false }))
  expect(screen.queryByTestId("query-panel-dialog")).toBeNull()
  await closed.rerender(
    tree({
      customModalStyles: { width: 380 },
      customDialogStyles: { padding: 17 },
      customOverlayStyles: { backgroundColor: "plum" },
      children: <View testID="unused-child" />,
    }),
  )
  await present()
  expect(host("sort-filter-panel")).toHaveStyle({ width: 380 })
  expect(host("query-panel-dialog")).toHaveStyle({ padding: 17, gap: 10 })
  expect(host("sort-filter-panel-backdrop")).toHaveStyle({ backgroundColor: "plum" })
  for (const name of [
    "Add Sort Criteria",
    "Add Filter Criteria",
    "Close Sort and Filter Panel",
    "Clear All",
    "Cancel",
    "Apply",
  ])
    expect(screen.getByRole("button", { name })).toBeOnTheScreen()
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  expect(screen.getByText("No filters currently applied")).toBeOnTheScreen()
  expect(screen.queryByTestId("unused-child")).toBeNull()
})
it("retains exact partial labels, formatter identity and explicit empty defaults in the resolver", () => {
  const formatter = jest.fn(() => "Group")
  const labels = resolveNativeSortAndFilterPanelLabels({
    form: { addFilterCriteriaPlaceholder: "" },
    activeFilters: { filterGroupAriaLabel: formatter, joinOperators: { or: "Any" } },
    footer: { applyButton: "" },
  })
  expect(labels.form.addSortCriteriaLabel).toBe("Add Sort Criteria")
  expect(labels.form.addFilterCriteriaPlaceholder).toBe("")
  expect(labels.activeFilters.filterGroupAriaLabel).toBe(formatter)
  expect(labels.activeFilters.joinOperators).toEqual({ and: "Match all", or: "Any" })
  expect(labels.footer.applyButton).toBe("")
  expect(formatter).not.toHaveBeenCalled()
})
it("requests the original criteria ref after presentation and routes a changed focus target", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AppState, "currentState")!
  Object.defineProperty(AppState, "currentState", { configurable: true, get: () => "active" })
  const focus = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  try {
    const view = await render(tree({ initialFocusTarget: "sort" }))
    await present()
    await act(() => jest.advanceTimersByTime(20))
    expect(focus).toHaveBeenCalled()
    const sort = focus.mock.calls.at(-1)!
    expect(sort[0]).not.toBeNull()
    expect(sort[1]).toBe(screen.getByRole("button", { name: "Add Sort Criteria" }).props.ownerId)
    await view.rerender(tree({ initialFocusTarget: "filter" }))
    await act(() => jest.advanceTimersByTime(20))
    expect(focus.mock.calls.at(-1)![1]).toBe(screen.getByRole("button", { name: "Add Filter Criteria" }).props.ownerId)
    expect(focus.mock.calls.at(-1)![0]).not.toBe(sort[0])
    await view.rerender(tree({ initialFocusTarget: "sort" }))
    await act(() => jest.advanceTimersByTime(20))
    expect(focus.mock.calls.at(-1)![0]).toBe(sort[0])
  } finally {
    Object.defineProperty(AppState, "currentState", descriptor)
  }
})
it("composes registry-shaped sort editing, removal, clear, apply order and held owner reopen", async () => {
  const events: unknown[] = []
  const props = {
    applyPendingSortAndFilterChanges: (request: unknown) => events.push(request),
    onOpenChange: (open: boolean) => events.push(open),
  }
  const view = await render(tree(props))
  await present()
  await choose("Add Sort Criteria", "City")
  await press("Sort Descending")
  await press("Apply")
  expect(events).toEqual([
    {
      sortInstructions: [
        { id: "city", criteriaID: "city", criteriaName: "City", queryKey: "event.city", sortDirection: "Descending" },
      ],
      filterGroups: [],
    },
    false,
  ])
  expect(screen.getByRole("button", { name: "Remove City" })).toBeOnTheScreen()
  await press("Clear All")
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  expect(events).toHaveLength(2)
  const dismissed = host("sort-filter-panel-window").props.onDismiss
  await view.rerender(tree({ ...props, isOpen: false }))
  await act(() => jest.advanceTimersByTime(1000))
  await act(() => dismissed())
  await view.rerender(tree(props))
  await present()
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
})
it("restores the applied snapshot on Cancel while Close only requests dismissal", async () => {
  const activeSorts: TTableSortInstruction[] = [
    { id: "city", criteriaID: "city", criteriaName: "City", sortDirection: "Ascending" },
  ]
  const apply = jest.fn(),
    close = jest.fn()
  await render(tree({ activeSorts, applyPendingSortAndFilterChanges: apply, onOpenChange: close }))
  await present()
  await press("Remove City")
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  await press("Cancel")
  expect(screen.getByRole("button", { name: "Remove City" })).toBeOnTheScreen()
  expect(apply).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledWith(false)
  await press("Sort Descending")
  await press("Close Sort and Filter Panel")
  expect(screen.getByRole("button", { name: "Sort Descending" }).props.accessibilityState.checked).toBe(true)
  expect(close).toHaveBeenCalledTimes(2)
})
it("hydrates editors, keeps raw drafts through join changes, and normalizes filter payloads only on Apply", async () => {
  const apply = jest.fn()
  await render(tree({ activeFilters: applied, applyPendingSortAndFilterChanges: apply }))
  await present()
  await fireEvent.changeText(screen.getByLabelText("Filter Name by contained text"), " draft ")
  expect(apply).not.toHaveBeenCalled()
  expect(screen.getByLabelText("Filter Name by contained text").props.value).toBe(" draft ")
  await press("Add filter for Name")
  expect(screen.getAllByRole("button", { name: "Delete Filter Entry" })).toHaveLength(2)
  await fireEvent.press(screen.getByRole("button", { name: /match any/i }))
  await press("Apply")
  expect(apply.mock.calls[0][0].filterGroups[0]).toMatchObject({
    criteriaID: "name",
    queryKey: "event.name",
    joinOperator: "or",
    clauses: [{ id: "name-clause", operationCode: "like", argument: "draft" }],
  })
  expect(applied[0].clauses[0].argument).toBe("held")
})
it("adds the next allowed operation before duplicates and removes grouped clauses through their tags", async () => {
  const apply = jest.fn()
  await render(tree({ applyPendingSortAndFilterChanges: apply }))
  await present()
  await choose("Add Filter Criteria", "Name")
  await press("Add filter for Name")
  const operations = screen
    .getAllByRole("button", { name: "Filter Condition" })
    .map((node) => node.props.accessibilityValue.text)
  expect(operations).toEqual(["Contains", "Similar to"])
  await fireEvent.press(screen.getAllByRole("button", { name: "Remove Name" })[0])
  expect(screen.getAllByRole("button", { name: "Delete Filter Entry" })).toHaveLength(1)
  expect(apply).not.toHaveBeenCalled()
})
it("hydrates select-backed zero, false and empty values without coercion", async () => {
  const possibleFilterCriteria: TAvailableFilterCriteria[] = [
    {
      id: "zero",
      name: "Quantity",
      dataType: "text",
      queryKey: "events.quantity",
      allowedOperationCodes: ["equal"],
      usesSelectInput: true,
      availableCriteriaArguments: [{ id: "zero-choice", name: "Zero", argumentValue: 0 }],
    },
    {
      id: "false",
      name: "Flag",
      dataType: "text",
      allowedOperationCodes: ["equal"],
      usesSelectInput: true,
      availableCriteriaArguments: [{ id: "", name: "False", argumentValue: false }],
    },
    {
      id: "empty",
      name: "Empty",
      dataType: "text",
      allowedOperationCodes: ["equal"],
      usesSelectInput: true,
      availableCriteriaArguments: [{ id: "empty-choice", name: "Empty value", argumentValue: "" }],
    },
  ]
  const activeFilters: TTableFilterGroup[] = possibleFilterCriteria.map((criterion, index) => ({
    id: criterion.id,
    criteriaID: criterion.id,
    criteriaName: criterion.name,
    dataType: "text",
    joinOperator: "and",
    clauses: [{ id: `clause-${index}`, operationCode: "equal", argument: [0, false, ""][index] }],
  }))
  const apply = jest.fn()
  await render(tree({ possibleFilterCriteria, activeFilters, applyPendingSortAndFilterChanges: apply }))
  await present()
  expect(
    screen.getAllByRole("button", { name: "Filter Argument" }).map((node) => node.props.accessibilityValue.text),
  ).toEqual(["Zero", "False", "Empty value"])
  await press("Apply")
  expect(apply.mock.calls[0][0].filterGroups.map((group: TTableFilterGroup) => group.clauses[0].argument)).toEqual([
    0,
    false,
  ])
})
it("keeps a pending raw argument through metadata refresh and uses current metadata on Apply", async () => {
  const apply = jest.fn()
  const view = await render(tree({ activeFilters: applied, applyPendingSortAndFilterChanges: apply }))
  await present()
  await fireEvent.changeText(screen.getByLabelText("Filter Name by contained text"), " pending ")
  await view.rerender(
    tree({
      activeFilters: applied,
      applyPendingSortAndFilterChanges: apply,
      possibleFilterCriteria: criteria.map((criterion) =>
        criterion.id === "name" ? { ...criterion, name: "Renamed", queryKey: "events.renamed" } : criterion,
      ),
    }),
  )
  await acknowledge()
  expect(screen.getByLabelText("Filter Renamed by contained text").props.value).toBe(" pending ")
  await press("Apply")
  expect(apply.mock.calls[0][0].filterGroups[0]).toMatchObject({
    criteriaName: "Renamed",
    queryKey: "events.renamed",
    clauses: [{ id: "name-clause", operationCode: "like", argument: "pending" }],
  })
})
it("runs the maintained panel scene through held Apply, reopen and owner echo", async () => {
  await render(<SortAndFilterPanelFixture />)
  const owner = () => JSON.parse(screen.getByTestId("query-panel-owner").props.children)
  const closeWith = async (button: string) => {
    const dismissed = host("sort-filter-panel-window").props.onDismiss
    await press(button)
    await act(() => jest.advanceTimersByTime(1000))
    await act(() => dismissed())
  }
  await press("Open query panel")
  await present()
  await choose("Add Sort Criteria", "Name")
  await closeWith("Apply")
  expect(owner().confirmed.sortInstructions).toEqual([])
  expect(owner().requests[0].sortInstructions[0].criteriaID).toBe("name")
  await press("Open query panel")
  await present()
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  await closeWith("Cancel")
  await press("Toggle owner echo")
  await press("Open query panel")
  await present()
  await choose("Add Sort Criteria", "Count")
  await closeWith("Apply")
  expect(owner().confirmed.sortInstructions[0].criteriaID).toBe("count")
  expect(owner().requests).toHaveLength(2)
  expect(owner().closeRequests).toBe(3)
})
