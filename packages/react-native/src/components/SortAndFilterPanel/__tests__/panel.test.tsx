import "../../Table/__tests__/collectionModel"

import { act as rawAct, cleanup, within } from "@testing-library/react-native"
import { useEffect, useState, type ComponentProps } from "react"
import { AccessibilityInfo, AppState, View } from "react-native"

import { nativeVirtualDrag } from "../../../collection/dragAndDrop/virtualDrag"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import NativeDragModule from "../../../input/specs/NativeCUIDragAndDrop"
import { NativeBackdropHost } from "../../../overlays/backdrop/NativeBackdropHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { filterEditor } from "../../Filtering/__tests__/fixtures/editorQuery"
import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../Table/__tests__/collectionModel"
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
jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "sort-panel-module"),
    readGeometry: jest.fn(),
  },
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
const tree = (
  props: Partial<TNativeSortAndFilterPanelProps> = {},
  theme: ComponentProps<typeof NativeThemeProvider> = {},
) => (
  <NativeThemeProvider {...theme}>
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
  for (const ready of host(identity).props.acceptedWindowId ? [true] : [false, true]) {
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
  const receive = (packet: object) =>
    host(identity).props.onNativeDragStatus({ nativeEvent: { packet: JSON.stringify(packet) } })
  const scope = host(identity).props
  const window = { ownerId: scope.ownerId, windowId: "source-model-window", epoch: 1 }
  await act(() =>
    receive({
      ...window,
      kind: "window",
      surfaceId: 11,
      scopeTarget: 10,
      available: true,
      canLift: true,
      canDrop: true,
    }),
  )
  for (const binding of JSON.parse(host(identity).props.dragBindings))
    await act(() =>
      receive({ ...window, ...binding, kind: "binding", moduleId: "sort-panel-module", ready: true, error: "" }),
    )
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
  // Synthetic source identities for original mounted refs; no native readiness claim.
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const tags = new WeakMap<object, number>()
  let nextTag = 1000000
  jest.mocked(native.findNodeHandle).mockImplementation((host) => {
    if (!host || typeof host !== "object") return typeof host === "number" ? host : null
    if (!tags.has(host)) tags.set(host, ++nextTag)
    return tags.get(host)!
  })

  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.mocked(NativeDragModule!.readGeometry).mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    const scope = screen.container.queryAll(
      (node) => node.props.ownerId === request.ownerId && typeof node.props.dragBindings === "string",
    )[0]
    const binding = JSON.parse(scope?.props.dragBindings ?? "[]").find(
      (value: { bindingId: string; revision: string; rootTarget: number }) =>
        value.bindingId === request.bindingId &&
        value.revision === request.revision &&
        value.rootTarget === request.rootTarget,
    )
    if (!binding) throw new Error("Original composed Sort binding is unavailable for the current native request")
    return JSON.stringify({
      ...request,
      geometry: {
        root: { x: 0, y: 0, width: 200, height: 400 },
        items: binding.members.map((member: object, index: number) => ({
          ...member,
          rect: { x: 0, y: index * 100, width: 200, height: 80 },
        })),
      },
    })
  })
})
afterEach(async () => {
  await rawAct(() => nativeVirtualDrag.cancel())
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("retains a programmatic Dialog target without adding shell or backdrop Tab stops", async () => {
  await render(tree())
  await present()
  expect(host("query-panel-dialog").props.nativeTabStop).toBe(false)
  expect(host("query-panel-dialog").props.keyboardFocusable).toBe(true)
  expect(host("sort-filter-panel").props.nativeTabStop).toBe(false)
  expect(host("sort-filter-panel-backdrop").props.focusable).toBe(false)
  expect(screen.getByRole("button", { name: "Add Sort Criteria" }).props.keyboardFocusable).toBe(true)
})

it("retains both filter scroll owners and the same editor through dialog style and metadata changes", async () => {
  const view = await render(
    tree({ activeFilters: applied, customDialogStyles: { letterSpacing: 2, fontStyle: "italic" } }),
  )
  await present()
  const editor = screen.getByLabelText("Filter Name by contained text")
  const dialog = host("query-panel-dialog")
  expect(host("sort-filter-panel").props.nativeTypographyStyle).toBeUndefined()
  expect(dialog.props.nativeTypographyStyle).toBeUndefined()
  const scrollers = () =>
    screen.container.queryAll(
      (node) =>
        node.type.includes("ScrollView") &&
        ["query-active-filters", "query-filter-parameter-list"].includes(node.props.testID),
    )
  expect(scrollers()).toHaveLength(2)
  for (const scroller of scrollers()) {
    expect(scroller.props.keyboardShouldPersistTaps).toBe("always")
    expect(scroller.props.keyboardDismissMode).toBe("none")
  }
  expect(scrollers()[0].queryAll((node) => node.props.testID === "query-filter-parameter-list")).toEqual([
    scrollers()[1],
  ])
  expect(screen.getByText("Filtering By:")).toHaveStyle({ letterSpacing: 2, fontStyle: "italic" })
  expect(screen.getByText("Sort and Filter Panel")).toHaveStyle({ letterSpacing: 2, fontStyle: "italic" })
  expect(screen.getByText("Apply")).toHaveStyle({ letterSpacing: 0, fontStyle: "normal", fontWeight: "700" })
  await fireEvent.changeText(editor, " pending ")
  await view.rerender(
    tree({
      activeFilters: applied,
      customDialogStyles: { letterSpacing: 0, fontStyle: "normal" },
      possibleFilterCriteria: criteria.map((criterion) => ({ ...criterion })),
    }),
  )
  await acknowledge()
  expect(screen.getByText("Filtering By:")).toHaveStyle({ letterSpacing: 0, fontStyle: "normal" })
  expect(host("query-panel-dialog")).toBe(dialog)
  expect(screen.getByLabelText("Filter Name by contained text")).toBe(editor)
  expect(editor.props.value).toBe(" pending ")
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

it("reorders the visible draft, applies its exact order, and restores the owner's order on held Cancel", async () => {
  const activeSorts: TTableSortInstruction[] = [
    { id: "city", criteriaID: "city", criteriaName: "City", queryKey: "event.city", sortDirection: "Ascending" },
    { id: "name", criteriaID: "name", criteriaName: "Name", queryKey: "event.name", sortDirection: "Descending" },
  ]
  const events: unknown[] = []
  await render(
    tree({
      activeSorts,
      applyPendingSortAndFilterChanges: (request) => events.push(request),
      onOpenChange: (open) => events.push(open),
    }),
  )
  await present()
  await act(() =>
    host("query-sort-option-city").props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }),
  )
  const chooser = host("native-drop-chooser-window")
  const dismissed = chooser.props.onDismiss as () => void
  expect(screen.getAllByTestId("native-drop-chooser-window", { includeHiddenElements: true })).toHaveLength(1)
  await fireEvent(chooser, "show")
  await acknowledge("native-drop-chooser-floating-host")
  // Deliver the original pointer callbacks directly across the renderer's covered parent tree, as in choose().
  expect(chooser.props.visible).toBe(true)
  const pressChoice = async (name: string) => {
    const receiver = within(chooser).getByRole("button", { name, includeHiddenElements: true }).props
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
  }
  await pressChoice("Insert after Sort Parameter - Name - Descending")
  expect(nativeVirtualDrag.pendingRequest()?.selected?.target).toMatchObject({ key: "name", dropPosition: "after" })
  expect(events).toEqual([])
  await pressChoice("Drop")
  expect(nativeVirtualDrag.pendingRequest()?.phase).toBe("closing")
  expect(JSON.parse(host("query-sort-option-city").props.nativeCollectionSemantics).ordinal).toBe(0)
  expect(events).toEqual([])
  await act(dismissed)
  await acknowledge()
  expect(JSON.parse(host("query-sort-option-name").props.nativeCollectionSemantics).ordinal).toBe(0)
  expect(events).toEqual([])
  expect(activeSorts.map((sort) => sort.id)).toEqual(["city", "name"])
  await press("Apply")
  expect(events).toEqual([{ sortInstructions: [activeSorts[1], activeSorts[0]], filterGroups: [] }, false])
  await press("Apply")
  expect(events).toHaveLength(4)
  await press("Cancel")
  expect(events.at(-1)).toBe(false)
  expect(JSON.parse(host("query-sort-option-city").props.nativeCollectionSemantics).ordinal).toBe(0)
  expect(activeSorts.map((sort) => sort.id)).toEqual(["city", "name"])
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

it("retains the public panel's original editor and dirty draft when owner metadata arrives asynchronously", async () => {
  let complete!: (metadata: TAvailableFilterCriteria[]) => void
  const pending = new Promise<TAvailableFilterCriteria[]>((resolve) => {
    complete = resolve
  })
  const apply = jest.fn()
  const Owner = () => {
    const [metadata, setMetadata] = useState(criteria)
    useEffect(() => {
      let live = true
      void pending.then((next) => {
        if (live) setMetadata(next)
      })
      return () => {
        live = false
      }
    }, [])
    return tree({ possibleFilterCriteria: metadata, activeFilters: applied, applyPendingSortAndFilterChanges: apply })
  }
  await render(<Owner />)
  await present()
  const editor = screen.getByLabelText("Filter Name by contained text")
  const dialog = host("query-panel-dialog")
  await fireEvent.changeText(editor, " pending async ")
  expect(apply).not.toHaveBeenCalled()
  await act(async () => {
    complete(
      criteria.map((criterion) =>
        criterion.id === "name" ? { ...criterion, name: "Arrived", queryKey: "events.arrived" } : criterion,
      ),
    )
    await pending
  })
  await acknowledge()
  expect(screen.getByLabelText("Filter Arrived by contained text")).toBe(editor)
  expect(host("query-panel-dialog")).toBe(dialog)
  expect(editor.props.value).toBe(" pending async ")
  expect(apply).not.toHaveBeenCalled()
  await press("Apply")
  expect(apply).toHaveBeenCalledTimes(1)
  expect(apply.mock.calls[0][0].filterGroups[0]).toMatchObject({
    criteriaID: "name",
    criteriaName: "Arrived",
    queryKey: "events.arrived",
    clauses: [{ id: "name-clause", operationCode: "like", argument: "pending async" }],
  })
  expect(editor.props.value).toBe(" pending async ")
})

it("keeps muted separators and filter borders independent while retaining the original draft", async () => {
  const apply = jest.fn(),
    close = jest.fn()
  const props = { activeFilters: applied, applyPendingSortAndFilterChanges: apply, onOpenChange: close }
  const view = await render(tree(props, { overrides: { colors: { borderMuted: "purple", controlBorder: "orange" } } }))
  const group = screen.getByLabelText("Name filter group", { includeHiddenElements: true })
  const editor = screen.getByLabelText("Filter Name by contained text", { includeHiddenElements: true })
  expect(editor.props.value).toBe("held")
  expect(group).toHaveStyle({ borderColor: "purple" })
  const separators = screen.getAllByTestId("line-segment", { includeHiddenElements: true })
  expect(separators).toHaveLength(4)
  for (const separator of separators) expect(separator).toHaveStyle({ backgroundColor: "purple" })
  await view.rerender(
    tree(props, { mode: "dark", overrides: { colors: { borderMuted: "lime", controlBorder: "orange" } } }),
  )
  expect(screen.getByLabelText("Name filter group", { includeHiddenElements: true })).toBe(group)
  expect(group).toHaveStyle({ borderColor: "lime" })
  for (const separator of screen.getAllByTestId("line-segment", { includeHiddenElements: true }))
    expect(separator).toHaveStyle({ backgroundColor: "lime" })
  expect(screen.getByLabelText("Filter Name by contained text", { includeHiddenElements: true })).toBe(editor)
  expect(editor.props.value).toBe("held")
  expect(apply).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
})

it("routes explicit criteria label presses to their original admitted refs without changing the query", async () => {
  const focus = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  const apply = jest.fn()
  const view = await render(tree({ applyPendingSortAndFilterChanges: apply }))
  await present()
  await act(() => jest.advanceTimersByTime(20))
  const labels = screen.getAllByTestId("form-field-label")
  const sort = screen.getByRole("button", { name: "Add Sort Criteria" })
  const filter = screen.getByRole("button", { name: "Add Filter Criteria" })
  focus.mockClear()
  for (const [index, control] of [sort, filter].entries()) {
    expect(labels[index].props.onPress).toEqual(expect.any(Function))
    await fireEvent.press(labels[index])
    expect(focus.mock.calls.at(-1)![1]).toBe(control.props.ownerId)
  }
  expect(focus).toHaveBeenCalledTimes(2)
  const retiredSortLabel = labels[0].props.onPress
  await view.rerender(
    tree({
      applyPendingSortAndFilterChanges: apply,
      labels: { form: { addSortCriteriaLabel: "Sort field", addFilterCriteriaLabel: "Filter field" } },
    }),
  )
  await acknowledge()
  focus.mockClear()
  await act(() => retiredSortLabel())
  expect(focus).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Sort field" })).toBe(sort)
  expect(screen.getByRole("button", { name: "Filter field" })).toBe(filter)
  await fireEvent.press(screen.getAllByTestId("form-field-label")[1])
  expect(focus.mock.calls.at(-1)![1]).toBe(filter.props.ownerId)
  expect(apply).not.toHaveBeenCalled()
  expect(screen.queryByTestId("select-window")).toBeNull()
})

it("loads and clears explicit confirmed scene models without generating an Apply request", async () => {
  await render(<SortAndFilterPanelFixture />)
  const owner = () => JSON.parse(screen.getByTestId("query-panel-owner").props.children)
  await press("Load confirmed query")
  expect(owner().confirmed.sortInstructions.map((item: TTableSortInstruction) => item.id)).toEqual(["count", "name"])
  expect(owner().confirmed.filterGroups.map((group: TTableFilterGroup) => group.clauses[0].argument)).toEqual([
    0,
    false,
  ])
  await press("Open query panel")
  await present()
  expect(screen.getAllByRole("option").map((row) => row.props.accessibilityLabel)).toEqual([
    "Sort Parameter - Count - Descending",
    "Sort Parameter - Name - Ascending",
  ])
  expect(filterEditor("Filter Argument", within(screen.getByLabelText("Count filter group"))).props.value).toBe("0")
  expect(
    within(screen.getByLabelText("Active filter group")).getByRole("checkbox", { name: "Filter Argument" }).props
      .accessibilityState.checked,
  ).toBe(false)
  const dismissed = host("sort-filter-panel-window").props.onDismiss
  await press("Clear All")
  await press("Cancel")
  await act(() => jest.advanceTimersByTime(1000))
  await act(() => dismissed())
  await press("Open query panel")
  await present()
  expect(screen.getAllByRole("option")).toHaveLength(2)
  expect(owner().requests).toEqual([])
  const nextDismissed = host("sort-filter-panel-window").props.onDismiss
  await press("Cancel")
  await act(() => jest.advanceTimersByTime(1000))
  await act(() => nextDismissed())
  await press("Clear confirmed query")
  await press("Open query panel")
  await present()
  expect(screen.queryAllByRole("option")).toEqual([])
  expect(screen.getByText("No filters currently applied")).toBeOnTheScreen()
  expect(owner().requests).toEqual([])
})

it("source closeout: routes a real simple ComboBox argument to the query draft without confirming the owner", async () => {
  await render(<SortAndFilterPanelFixture />)
  const owner = () => JSON.parse(screen.getByTestId("query-panel-owner").props.children)
  await press("Load ComboBox argument")
  await press("Open query panel")
  await present()
  await press("Show filter argument suggestions")
  const window = host("combo-box-window")
  const dismissed = window.props.onDismiss
  await fireEvent(window, "show")
  const editor = screen.getByLabelText("Edit filter argument", { includeHiddenElements: true })
  await fireEvent.changeText(editor, "pending query")
  expect(editor.props.value).toBe("pending query")
  expect(owner().confirmed.filterGroups[0].clauses[0].argument).toBe("Alpha")
  await acknowledge("combo-box-floating-host")
  // The original responder pair proves source composition beneath the covered logical parent.
  const option = screen.getByRole("radio", { name: "Beta", includeHiddenElements: true })
  expect(option.props.onResponderGrant).toEqual(expect.any(Function))
  expect(option.props.onResponderRelease).toEqual(expect.any(Function))
  const event = {
    persist: jest.fn(),
    stopPropagation: jest.fn(),
    target: 17,
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
    option.props.onResponderGrant(event)
    option.props.onResponderRelease(event)
  })
  expect(
    screen.getByRole("button", { name: "Show filter argument suggestions", includeHiddenElements: true }).props
      .accessibilityValue.text,
  ).toBe("Beta")
  expect(screen.queryByTestId("combo-box-window", { includeHiddenElements: true })).toBeNull()
  await act(() => dismissed())
  await acknowledge()
  await press("Apply")
  expect(owner().requests[0].filterGroups[0]).toMatchObject({
    criteriaID: "suggestion",
    queryKey: "events.suggestion",
    clauses: [{ id: "suggestion-clause", operationCode: "equal", argument: "Beta" }],
  })
  expect(owner().confirmed.filterGroups[0].clauses[0].argument).toBe("Alpha")
})

it("source closeout: retains both canonical Typeahead placeholders and their owned arguments", async () => {
  await render(<SortAndFilterPanelFixture />)
  const owner = () => JSON.parse(screen.getByTestId("query-panel-owner").props.children)
  await press("Load typeahead placeholders")
  await press("Open query panel")
  await present()
  expect(screen.getByTestId("filter-typeahead-placeholder")).toHaveTextContent(
    "placeholder: typeahead search not implemented yet",
  )
  expect(screen.getByTestId("filter-multi-typeahead-placeholder")).toHaveTextContent(
    "placeholder: multi-typeahead search not implemented yet",
  )
  expect(screen.queryByTestId("typeahead-input")).toBeNull()
  await press("Apply")
  expect(owner().requests[0].filterGroups[0].clauses.map((clause: { argument: unknown }) => clause.argument)).toEqual([
    "kept scalar",
    ["kept", "list"],
  ])
  expect(owner().confirmed.filterGroups[0].clauses.map((clause: { argument: unknown }) => clause.argument)).toEqual([
    "kept scalar",
    ["kept", "list"],
  ])
})
