import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type * as RN from "react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { confirmNativeCollections } from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { NativeShowcase } from "../NativeShowcase"

const mockViews = new Map<string, RN.View>()
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (view) mockViews.set(props.ownerId, view)
          else mockViews.delete(props.ownerId)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: { getLease: jest.fn(() => "query-scene-source-model") },
}))
jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIMotionSnapshot", () => ({
  __esModule: true,
  default: {
    backdropFrame: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded) as Record<string, unknown>
      return JSON.stringify({ ...request, staged: true, published: true })
    }),
  },
}))
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual<typeof import("react-native-safe-area-context")>("react-native-safe-area-context")
  const Native = jest.requireActual<typeof RN>("react-native")
  return { ...actual, SafeAreaProvider: Native.View, SafeAreaView: Native.View }
})

const hidden = { includeHiddenElements: true }
let activation = 0
beforeEach(() => {
  jest.useFakeTimers()
  mockViews.clear()
  const native = jest.requireActual<typeof RN>("react-native")
  const original = jest.isMockFunction(native.findNodeHandle)
    ? jest.mocked(native.findNodeHandle).getMockImplementation()!
    : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 70000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const existing = original(view)
    if (existing || !view || typeof view !== "object") return existing
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const press = async (name: string) => {
  const node = screen.getByRole("button", { name, ...hidden })
  if (typeof node.props.onNativeActivation !== "function") return userEvent.setup().press(node)
  let scope = node.parent
  while (scope && !scope.props.onNativeScopeStatus) scope = scope.parent
  if (!scope) throw new Error("Expected the action's same-window native scope")
  const host = scope.props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: host.ownerId,
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  const view = mockViews.get(node.props.ownerId)
  if (!view) throw new Error("Expected the action's original native ref")
  await act(() =>
    node.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "ios-accessibility-activate",
        ownerId: node.props.ownerId,
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(view),
        observedAt: 0,
        activationId: ++activation,
        scopeOwnerId: host.ownerId,
        windowId: host.ownerId,
        epoch: 1,
      },
    }),
  )
}
const renderShowcase = async () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
const enter = async () => {
  await renderShowcase()
  await press("Panel scene")
  await press("Open panel")
  const window = screen.getByTestId("panel-window", hidden)
  await fireEvent(window, "show")
  return window.props.onDismiss as () => void
}

it("retains Panel's owner veto and original editor through live theme, side, fixture and window changes", async () => {
  await enter()
  const editor = screen.getByLabelText("Held query", hidden)
  await fireEvent.changeText(editor, "declined draft")
  await press("Request close")
  await press("Request close")
  expect(screen.getByTestId("panel-window", hidden).props.visible).toBe(true)
  expect(screen.getByText("Close requests: 2", hidden)).toBeOnTheScreen()
  await press("Toggle physical side")
  await press("Toggle scene theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    expect(screen.getByLabelText("Held query", hidden)).toBe(editor)
    expect(editor).toHaveDisplayValue("")
    expect(screen.getByTestId("panel", hidden)).toHaveStyle({ right: 0, backgroundColor: "#171717" })
    expect(screen.getByText("Close requests: 2", hidden)).toBeOnTheScreen()
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("echoes Panel closure and restores the complete scene owner through normal showcase reset", async () => {
  const dismissed = await enter()
  await press("Toggle physical side")
  await press("Toggle panel appearance")
  await press("Toggle scene theme")
  await press("Toggle veto")
  await press("Request close")
  await act(() => dismissed())
  await act(() => jest.runAllTimers())
  expect(screen.queryByTestId("panel")).toBeNull()
  await press("Reset scene")
  await press("Panel scene")
  expect(screen.getByText("Owner open: false")).toBeOnTheScreen()
  expect(screen.getByText("Close requests: 0")).toBeOnTheScreen()
  await press("Open panel")
  await fireEvent(screen.getByTestId("panel-window", hidden), "show")
  expect(screen.getByText("Owner veto: true", hidden)).toBeOnTheScreen()
  expect(screen.getByLabelText("Held query", hidden)).toHaveDisplayValue("")
  expect(screen.getByTestId("panel", hidden)).toHaveStyle({ left: 0, backgroundColor: "#ffffff", padding: 0 })
})

it("opens the standalone query scene through the same chooser without nesting overlay providers", async () => {
  await renderShowcase()
  await press("Sort and Filter scene")
  expect(screen.getByRole("button", { name: "Open query panel" })).toBeOnTheScreen()
  expect(JSON.parse(screen.getByTestId("query-panel-owner").props.children as string)).toMatchObject({
    confirmed: { sortInstructions: [], filterGroups: [] },
    requests: [],
    closeRequests: 0,
    echo: false,
  })
})

const settleQueryCollections = async () => {
  for (let turn = 0; turn < 4; turn++) {
    if (!(await confirmNativeCollections({ container: screen.container }))) return
  }
  throw new Error("Query scene collection receipts did not settle")
}
const queryOwner = () => JSON.parse(screen.getByTestId("query-panel-owner", hidden).props.children as string)
const enterQuery = async (configuration: "default" | "metadata-theme" | "echo" = "default") => {
  await renderShowcase()
  await press("Sort and Filter scene")
  if (configuration === "echo") await press("Toggle owner echo")
  if (configuration === "metadata-theme") {
    await press("Refresh filter metadata")
    await press("Toggle theme")
    await press("Compact width")
  }
  await press("Open query panel")
  await fireEvent(screen.getByTestId("sort-filter-panel-window", hidden), "show")
}
const chooseQueryCriterion = async (kind: "Sort" | "Filter", name: string) => {
  await press(`Add ${kind} Criteria`)
  const window = screen.getByTestId("select-window", hidden)
  const dismissed = window.props.onDismiss as () => void
  await fireEvent(window, "show")
  const receiver = screen.getByRole("radio", { name, ...hidden }).props
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
  // The test renderer keeps the covered parent in the Modal's logical ancestry.
  await act(() => {
    receiver.onResponderGrant(event)
    receiver.onResponderRelease(event)
  })
  expect(screen.queryByTestId("select-window", hidden)).toBeNull()
  await act(() => dismissed())
  await settleQueryCollections()
}

const finishQueryClose = async (action: string) => {
  const dismissed = screen.getByTestId("sort-filter-panel-window", hidden).props.onDismiss as () => void
  await press(action)
  await act(() => dismissed())
  await act(() => jest.runAllTimers())
  expect(screen.queryByTestId("sort-filter-panel")).toBeNull()
}
const reopenQuery = async () => {
  await press("Open query panel")
  await fireEvent(screen.getByTestId("sort-filter-panel-window", hidden), "show")
  await settleQueryCollections()
}

it("applies the query scene's current metadata and theme while retaining controls through window changes and owner veto", async () => {
  await enterQuery("metadata-theme")
  await chooseQueryCriterion("Sort", "Count")
  await press("Sort Descending")
  await chooseQueryCriterion("Filter", "Name refreshed")
  const editor = screen.getByLabelText("Filter Name refreshed by contained text", hidden)
  await fireEvent.changeText(editor, " pending scene ")
  const row = screen.getByTestId("query-sort-entry", hidden)
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    expect(screen.getByTestId("query-sort-entry", hidden)).toBe(row)
    expect(screen.getByLabelText("Name refreshed filter group", hidden)).toBeOnTheScreen()
    expect(screen.getByLabelText("Filter Name refreshed by contained text", hidden)).toBe(editor)
    expect(editor).toHaveDisplayValue(" pending scene ")
    expect(screen.getByTestId("sort-filter-panel", hidden)).toHaveStyle({ backgroundColor: "#171717" })
    await finishQueryClose("Apply")
    expect(queryOwner().confirmed).toEqual({ sortInstructions: [], filterGroups: [] })
    expect(queryOwner().requests).toHaveLength(1)
    expect(queryOwner().requests[0].sortInstructions).toEqual([
      expect.objectContaining({ criteriaID: "count", sortDirection: "Descending" }),
    ])
    expect(queryOwner().requests[0].filterGroups).toEqual([
      expect.objectContaining({
        criteriaID: "name",
        criteriaName: "Name refreshed",
        clauses: [expect.objectContaining({ argument: "pending scene" })],
      }),
    ])
    await reopenQuery()
    expect(screen.queryByTestId("query-sort-entry", hidden)).toBeNull()
    expect(screen.getByText("No filters currently applied", hidden)).toBeOnTheScreen()
    expect(queryOwner().closeRequests).toBe(1)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("echoes the query scene's Apply, cancels Clear to the owner snapshot and restores the complete scene on reset", async () => {
  await enterQuery("echo")
  await chooseQueryCriterion("Sort", "Count")
  await press("Sort Descending")
  await finishQueryClose("Apply")
  const confirmed = queryOwner().confirmed
  expect(confirmed.sortInstructions).toEqual([
    expect.objectContaining({ criteriaID: "count", sortDirection: "Descending" }),
  ])
  await reopenQuery()
  await press("Clear All")
  expect(screen.queryByTestId("query-sort-entry", hidden)).toBeNull()
  await finishQueryClose("Cancel")
  expect(queryOwner().confirmed).toEqual(confirmed)
  await reopenQuery()
  expect(screen.getByTestId("query-sort-entry", hidden)).toBeOnTheScreen()
  await finishQueryClose("Close Sort and Filter Panel")
  await press("Toggle theme")
  await press("Refresh filter metadata")
  expect(queryOwner().closeRequests).toBe(3)
  await press("Reset scene")
  await press("Sort and Filter scene")
  expect(queryOwner()).toEqual({
    confirmed: { sortInstructions: [], filterGroups: [] },
    requests: [],
    closeRequests: 0,
    echo: false,
  })
  await reopenQuery()
  expect(screen.queryByTestId("query-sort-entry", hidden)).toBeNull()
  expect(screen.getByTestId("sort-filter-panel", hidden)).toHaveStyle({ backgroundColor: "#ffffff" })
})
