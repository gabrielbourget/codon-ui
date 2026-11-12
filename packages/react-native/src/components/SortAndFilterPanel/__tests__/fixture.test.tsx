import "../../../collection/__tests__/nativeReceipts"

import { act, cleanup, screen, within } from "@testing-library/react-native"
import { useContext } from "react"
import { AccessibilityInfo, DeviceEventEmitter, Platform } from "react-native"

import {
  actWithNativeCollections as fixtureAct,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeOverlayProvider, OverlayRegistryContext } from "../../../overlays/NativeOverlayProvider"

import { SortAndFilterPanelFixture } from "./fixtures/PanelFixture"
import QueryProbe from "./fixtures/QueryProbe"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: { getLease: jest.fn(() => "g02-source-drag-module"), readGeometry: jest.fn() },
}))

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
let appRestored: (() => boolean) | undefined
const RegistryProbe = () => {
  const registry = useContext(OverlayRegistryContext)
  appRestored = () => registry?.canRestore(null) ?? false
  return null
}
const snapshot = () => JSON.parse(screen.getByTestId("native-query-draft-proof").props.children as string)

it("keeps the probe's owner veto distinct from editable data through metadata and theme changes", async () => {
  await render(<QueryProbe />)
  expect(
    snapshot().confirmed.filterGroups.map((group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument),
  ).toEqual([false, 0])
  await press("Add Count sort")
  await press("Add Active sort")
  await press("Move Count after Active")
  await press("Apply request")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  expect(snapshot().lastRequest.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["active", "count"])
  await press("Refresh metadata")
  await press("Toggle theme")
  expect(snapshot().draft.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["active", "count"])
  expect(snapshot().draft.filterGroups[0].criteriaName).toBe("Active refreshed")
  await press("Cancel to owner")
  expect(snapshot().draft.sortInstructions).toEqual([])
  expect(
    snapshot().draft.filterGroups.map((group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument),
  ).toEqual([false, 0])
})

it("echoes an Apply only when enabled and restores that confirmed snapshot after Clear", async () => {
  await render(<QueryProbe />)
  await press("Toggle owner echo")
  await press("Add Count sort")
  await press("Apply request")
  expect(snapshot().confirmed.sortInstructions[0].id).toBe("count")
  await press("Clear draft")
  expect(snapshot().draft.filterGroups).toEqual([])
  await press("Cancel to owner")
  expect(snapshot().draft.sortInstructions[0].id).toBe("count")
  expect(snapshot().draft.filterGroups).toHaveLength(2)
  await press("Reset probe")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  expect(snapshot().lastRequest).toBeNull()
  expect(snapshot().draft.sortInstructions).toEqual([])
})

it("guards closed command requests and rehydrates on a later open", async () => {
  await render(<QueryProbe />)
  await press("Add Count sort")
  await press("Toggle open")
  const before = snapshot()
  await press("Add Active sort")
  await press("Clear draft")
  await press("Apply request")
  expect(snapshot()).toEqual(before)
  await press("Toggle open")
  expect(snapshot().draft.sortInstructions).toEqual([])
})

it("composes the actual Add Sort, row, header and footer controls with owner veto/echo", async () => {
  jest.replaceProperty(Platform, "OS", "ios")
  await render(
    <NativeOverlayProvider>
      <RegistryProbe />
      <QueryProbe />
    </NativeOverlayProvider>,
  )
  await press("Add Sort Criteria")
  const window = screen.getByTestId("select-window")
  const dismissed = window.props.onDismiss
  await fireEvent(window, "show")
  expect(appRestored?.()).toBe(false)
  await fireEvent.press(screen.getByRole("radio", { name: "Count" }))
  await act(() => dismissed())
  expect(appRestored?.()).toBe(true)
  expect(snapshot().draft.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["count"])
  await fireEvent.press(within(screen.getByTestId("query-sort-entry")).getByRole("button", { name: "Sort Descending" }))
  await press("Apply")
  expect(snapshot().lastRequest.sortInstructions[0].sortDirection).toBe("Descending")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  await press("Close Sort and Filter Panel")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  await press("Toggle owner echo")
  await press("Apply")
  await press("Clear All")
  expect(snapshot().draft.sortInstructions).toEqual([])
  await press("Cancel")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  await press("Remove Count")
  expect(snapshot().draft.sortInstructions).toEqual([])
  expect(snapshot().confirmed.sortInstructions).toHaveLength(1)
})

it("keeps current control drafts and owner snapshots through theme/metadata refresh and resets the control scene", async () => {
  await render(<QueryProbe />)
  await press("Add Count sort")
  await press("Sort Descending")
  await press("Refresh metadata")
  await press("Toggle theme")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  await press("Toggle open")
  await press("Delete Sort Entry")
  await press("Apply")
  expect(snapshot().draft.sortInstructions).toHaveLength(1)
  expect(snapshot().lastRequest).toBeNull()
  await press("Reset probe")
  expect(screen.queryByTestId("query-sort-entry")).toBeNull()
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  expect(snapshot().draft.filterGroups).toHaveLength(2)
})

afterEach(() => jest.restoreAllMocks())

describe("G02 fixture", () => {
  const host = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
  const owner = () => JSON.parse(host("query-panel-owner").props.children as string)
  const pressControl = async (name: string) => {
    const previous = screen.queryByTestId("sort-filter-panel-window", { includeHiddenElements: true })
    const dismissed = previous?.props.onDismiss
    await fireEvent.press(screen.getByRole("button", { name }))
    if (previous && typeof dismissed === "function" && !owner().open) await fixtureAct(() => dismissed())
  }
  const present = async () => {
    await fireEvent(host("sort-filter-panel-window"), "show")
    await fireEvent(host("sort-filter-panel"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 600 } },
    })
    for (const ready of [false, true]) {
      const scope = host("sort-filter-panel-floating-host").props
      await fixtureAct(() =>
        scope.onNativeScopeStatus({
          nativeEvent: {
            ownerId: scope.ownerId,
            windowId: "g02-source-window",
            epoch: 1,
            ready,
            windowActive: true,
            policyRevision: scope.policyRevision,
          },
        }),
      )
    }
  }
  const open = async () => {
    await pressControl("Open query panel")
    await present()
  }
  const confirmedArguments = () =>
    owner().confirmed.filterGroups.map((group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument)
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  })
  afterEach(async () => {
    await cleanup()
    await act(() => jest.runOnlyPendingTimers())
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it("records ordered Close, Cancel and Apply requests while a finite owner veto keeps the real panel visible", async () => {
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load confirmed query")
    await pressControl("Veto next two closes")
    await open()
    await pressControl("Clear All")
    await pressControl("Close Sort and Filter Panel")
    expect(owner().open).toBe(true)
    expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
    expect(owner().callbacks).toEqual([{ type: "open", next: false }])
    await pressControl("Cancel")
    expect(owner().open).toBe(true)
    expect(owner().closeVetoesRemaining).toBe(0)
    expect(screen.getAllByTestId("query-sort-entry")).toHaveLength(2)
    expect(confirmedArguments()).toEqual([0, false])
    expect(owner().requests).toEqual([])
    await pressControl("Clear All")
    await pressControl("Apply")
    expect(owner().callbacks).toEqual([
      { type: "open", next: false },
      { type: "open", next: false },
      { type: "apply", request: { sortInstructions: [], filterGroups: [] } },
      { type: "open", next: false },
    ])
    expect(owner().open).toBe(false)
    expect(owner().closeRequests).toBe(3)
    expect(owner().requests).toEqual([{ sortInstructions: [], filterGroups: [] }])
    expect(confirmedArguments()).toEqual([0, false])
  })

  it("retains exact repeated Apply requests through vetoes and confirms only after owner echo is enabled", async () => {
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load confirmed query")
    await pressControl("Veto next two closes")
    await open()
    await pressControl("Clear All")
    for (let index = 0; index < 3; index++) {
      await pressControl("Apply")
      expect(owner().requests).toHaveLength(index + 1)
      expect(confirmedArguments()).toEqual([0, false])
      expect(owner().open).toBe(index < 2)
    }
    expect(owner().callbacks.map((event: { type: string }) => event.type)).toEqual([
      "apply",
      "open",
      "apply",
      "open",
      "apply",
      "open",
    ])
    await pressControl("Toggle owner echo")
    await open()
    await pressControl("Clear All")
    await pressControl("Apply")
    expect(owner().confirmed).toEqual({ sortInstructions: [], filterGroups: [] })
    expect(owner().requests).toHaveLength(4)
    expect(owner().callbacks.slice(-2)).toEqual([
      { type: "apply", request: { sortInstructions: [], filterGroups: [] } },
      { type: "open", next: false },
    ])
  })

  it("reserves the keyboard viewport without replacing the edited field and applies its current query on the first press", async () => {
    jest.replaceProperty(Platform, "OS", "ios")
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load text argument")
    await open()
    const editor = screen.getByLabelText("Filter Name by contained text")
    await fireEvent.changeText(editor, " first query ")
    const viewport = host("query-panel-keyboard-viewport")
    await fireEvent(viewport, "layout", {
      persist: () => {},
      nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 844 } },
    })
    await fixtureAct(() =>
      DeviceEventEmitter.emit("keyboardWillShow", {
        duration: 0,
        endCoordinates: { screenX: 0, screenY: 509, width: 390, height: 335 },
      }),
    )
    expect(viewport).toHaveStyle({ paddingBottom: 335 })
    expect(screen.getByLabelText("Filter Name by contained text")).toBe(editor)
    expect(editor.props.value).toBe(" first query ")
    expect(host("query-active-filters").props.keyboardShouldPersistTaps).toBe("always")
    await pressControl("Apply")
    expect(owner().open).toBe(false)
    expect(owner().closeRequests).toBe(1)
    expect(owner().requests).toHaveLength(1)
    expect(owner().requests[0].filterGroups[0].clauses[0].argument).toBe("first query")
    expect(owner().callbacks.map((event: { type: string }) => event.type)).toEqual(["apply", "open"])
  })

  it.each(["Checkbox", "Toggle"] as const)(
    "exposes the supported %s Boolean editor with raw false and a held owner",
    async (mode) => {
      await render(<SortAndFilterPanelFixture />)
      await pressControl("Load confirmed query")
      if (mode === "Toggle") await pressControl("Toggle Boolean editor")
      await open()
      const control = screen.getByRole(mode === "Checkbox" ? "checkbox" : "switch")
      expect(control).not.toBeChecked()
      expect(confirmedArguments()).toEqual([0, false])
      await fireEvent.press(control)
      expect(control).toBeChecked()
      expect(confirmedArguments()).toEqual([0, false])
      await pressControl("Apply")
      expect(
        owner().requests[0].filterGroups.map(
          (group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument,
        ),
      ).toEqual([0, true])
      expect(confirmedArguments()).toEqual([0, false])
      expect(owner().callbacks.map((event: { type: string }) => event.type)).toEqual(["apply", "open"])
    },
  )

  it("refreshes metadata asynchronously while keeping the original dirty editor and emits current metadata on Apply", async () => {
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load text argument")
    await pressControl("Refresh metadata after next open")
    await open()
    const editor = screen.getByLabelText("Filter Name by contained text")
    await fireEvent.changeText(editor, " pending async ")
    await fixtureAct(() => jest.advanceTimersByTime(3000))
    expect(screen.getByLabelText("Filter Name refreshed by contained text")).toBe(editor)
    expect(editor.props.value).toBe(" pending async ")
    expect(owner().hostEvents).toEqual([{ action: "refresh-metadata", at: expect.any(Number) }])
    expect(owner().callbacks).toEqual([])
    await pressControl("Apply")
    expect(owner().requests[0].filterGroups[0]).toMatchObject({
      criteriaName: "Name refreshed",
      queryKey: "events.name",
      clauses: [{ argument: "pending async" }],
    })
    expect(confirmedArguments()).toEqual(["held"])
  })

  it("replaces owner arrays immutably after opening and rehydrates without inventing a public callback", async () => {
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load confirmed query")
    await pressControl("Replace owner after next open")
    await open()
    const editor = screen.getByTestId("number-input-input")
    await fireEvent.changeText(editor, "42")
    expect(editor.props.value).toBe("42")
    await fixtureAct(() => jest.advanceTimersByTime(3000))
    expect(screen.getByTestId("number-input-input")).toBe(editor)
    expect(editor.props.value).toBe("7")
    expect(confirmedArguments()).toEqual([7, false])
    expect(owner().hostEvents).toEqual([{ action: "replace-owner", at: expect.any(Number) }])
    expect(owner().callbacks).toEqual([])
    expect(owner().requests).toEqual([])
    expect(owner().open).toBe(true)
  })

  it("removes the actual panel without a business callback and restores only on explicit host action", async () => {
    await render(<SortAndFilterPanelFixture />)
    await pressControl("Load confirmed query")
    await pressControl("Unmount panel after next open")
    await open()
    await fireEvent.changeText(screen.getByTestId("number-input-input"), "42")
    await fixtureAct(() => jest.advanceTimersByTime(3000))
    expect(screen.queryByTestId("query-panel-dialog")).toBeNull()
    expect(owner().panelMounted).toBe(false)
    expect(owner().open).toBe(true)
    expect(owner().callbacks).toEqual([])
    expect(owner().requests).toEqual([])
    expect(confirmedArguments()).toEqual([0, false])
    await fixtureAct(() => jest.advanceTimersByTime(6000))
    expect(owner().hostEvents).toEqual([{ action: "unmount-panel", at: expect.any(Number) }])
    expect(owner().callbacks).toEqual([])
    await pressControl("Restore query panel")
    expect(owner().panelMounted).toBe(true)
    expect(owner().open).toBe(false)
    expect(screen.queryByTestId("query-panel-dialog")).toBeNull()
    await pressControl("Reset query scene")
    expect(owner()).toMatchObject({
      confirmed: { sortInstructions: [], filterGroups: [] },
      requests: [],
      callbacks: [],
      closeRequests: 0,
      echo: false,
      open: false,
      panelMounted: true,
      booleanToggle: false,
      closeVetoesRemaining: 0,
      pendingAction: null,
      hostEvents: [],
    })
  })

  it.each(["Replace owner", "Refresh metadata", "Unmount panel"])(
    "retires queued %s work on an accepted close and does not replay it on reopen",
    async (action) => {
      await render(<SortAndFilterPanelFixture />)
      await pressControl(`${action} after next open`)
      await open()
      await pressControl("Close Sort and Filter Panel")
      expect(owner().pendingAction).toBeNull()
      await fixtureAct(() => jest.advanceTimersByTime(6000))
      expect(owner().hostEvents).toEqual([])
      expect(owner().callbacks).toEqual([{ type: "open", next: false }])
      await open()
      await fixtureAct(() => jest.advanceTimersByTime(6000))
      expect(owner().hostEvents).toEqual([])
      expect(owner().panelMounted).toBe(true)
      expect(owner().requests).toEqual([])
    },
  )
})
