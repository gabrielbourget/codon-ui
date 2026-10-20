import { act, screen, within } from "@testing-library/react-native"
import { createRef, useContext, type ReactNode } from "react"
import { AccessibilityInfo, StyleSheet, type View } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  rerenderWithNativeCollections,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { resolveNativeTheme } from "../../../theme/defaults"
import type { TTableSortInstruction } from "../../Table/queryTypes"
import { Text } from "../../Text/Text"
import { DEFAULT_QUERY_CONTROL_LABELS, resolveQueryControlLabels } from "../controlLabels"
import {
  QueryActiveSorts,
  QueryPanelFooter,
  QueryPanelHeader,
  QuerySortCriteriaField,
  QuerySortEntry,
  type TQuerySortEntryProps,
} from "../QueryControls"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const labels = DEFAULT_QUERY_CONTROL_LABELS
const instruction = (
  id = "a",
  sortDirection: TTableSortInstruction["sortDirection"] = "Ascending",
): TTableSortInstruction => ({ id, criteriaID: id, criteriaName: "City", sortDirection })
const wrap = (children: ReactNode, mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeFloatingLayerHost>{children}</NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const entryProps = (): TQuerySortEntryProps => ({
  parameter: instruction(),
  availableSortCriteria: [],
  labels: labels.sortEntry,
  onModifySortParameter: jest.fn(),
  onSortAscending: jest.fn(),
  onSortDescending: jest.fn(),
  onDeleteSortParameter: jest.fn(),
})
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("CAP.query-controls.001 retains caller direction through vetoes and suppresses requests for the current direction", async () => {
  const props = entryProps()
  await render(wrap(<QuerySortEntry {...props} />))
  expect(screen.getByText("City")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Sort Ascending" }).props.accessibilityState.checked).toBe(true)
  await press("Sort Ascending")
  await press("Sort Descending")
  await press("Sort Descending")
  expect(props.onSortAscending).not.toHaveBeenCalled()
  expect(props.onSortDescending).toHaveBeenNthCalledWith(1, "a")
  expect(props.onSortDescending).toHaveBeenNthCalledWith(2, "a")
  expect(screen.getByRole("button", { name: "Sort Ascending" }).props.accessibilityState.checked).toBe(true)
  expect(props.parameter.sortDirection).toBe("Ascending")
})

it("uses current row IDs, labels and callbacks after a replacement rather than acknowledging a request locally", async () => {
  const props = entryProps()
  await render(wrap(<QuerySortEntry {...props} />))
  const next = {
    ...entryProps(),
    parameter: { ...instruction("", "Descending"), criteriaName: "Renamed" },
    labels: { ...labels.sortEntry, sortAscendingButtonAriaLabel: "Monter", deleteButtonAriaLabel: "Supprimer" },
  }
  await rerenderWithNativeCollections(wrap(<QuerySortEntry {...next} />))
  expect(screen.getByText("Renamed")).toBeOnTheScreen()
  await press("Sort Descending")
  await press("Monter")
  await press("Supprimer")
  expect(next.onSortAscending).toHaveBeenCalledWith("")
  expect(next.onSortDescending).not.toHaveBeenCalled()
  expect(next.onDeleteSortParameter).toHaveBeenCalledWith("")
  expect(props.onDeleteSortParameter).not.toHaveBeenCalled()
})

it("keeps the canonical unused modifier callback separate from actual row actions", async () => {
  const props = entryProps()
  props.availableSortCriteria = [{ id: "b", name: "Other" }]
  await render(wrap(<QuerySortEntry {...props} />))
  await press("Sort Descending")
  await press("Delete Sort Entry")
  expect(screen.queryByTestId("select")).toBeNull()
  expect(props.onModifySortParameter).not.toHaveBeenCalled()
})

it.each(["component", "window"] as const)("blocks sort actions when the %s is inactive", async (kind) => {
  const props = entryProps()
  let active = true
  if (kind === "component") props.canAct = () => active
  await render(
    wrap(
      <NativeFloatingWindowContext.Provider value={() => (kind === "window" ? active : true)}>
        <QuerySortEntry {...props} />
      </NativeFloatingWindowContext.Provider>,
    ),
  )
  active = false
  await press("Sort Descending")
  await press("Delete Sort Entry")
  expect(props.onSortDescending).not.toHaveBeenCalled()
  expect(props.onDeleteSortParameter).not.toHaveBeenCalled()
})

it("CAP.query-controls.002 merges labels without losing empty strings, defaults or formatter identity", () => {
  const formatter = jest.fn(() => "formatted")
  const merged = resolveQueryControlLabels({
    form: { addSortCriteriaPlaceholder: "" },
    header: { closeButtonAriaLabel: "" },
    footer: { applyButton: "" },
    sortParameterList: { itemAriaLabel: formatter },
  })
  expect(merged.form).toEqual({ addSortCriteriaLabel: "Add Sort Criteria", addSortCriteriaPlaceholder: "" })
  expect(merged.header.closeButtonAriaLabel).toBe("")
  expect(merged.footer).toEqual({ clearAllButton: "Clear All", cancelButton: "Cancel", applyButton: "" })
  expect(merged.sortParameterList.itemAriaLabel).toBe(formatter)
  expect(labels.header.closeButtonAriaLabel).toBe("Close Sort and Filter Panel")
  expect(formatter).not.toHaveBeenCalled()
})

it("CAP.query-controls.003 forwards the actual Select ref and keeps null selection through repeated same-item requests", async () => {
  const ref = createRef<View>()
  const onAdd = jest.fn()
  const metadata = [
    { id: "", name: "Empty ID" },
    { id: "b", name: "Second" },
  ]
  await render(
    wrap(
      <QuerySortCriteriaField
        ref={ref}
        availableSortCriteria={metadata}
        labels={labels.form}
        closeLabel="Close criteria"
        onAddSortParameter={onAdd}
      />,
    ),
  )
  expect(ref.current).not.toBeNull()
  const target = ref.current
  await press("Add Sort Criteria")
  expect(screen.getAllByRole("radio").map((node) => node.props.accessibilityLabel)).toEqual(["Empty ID", "Second"])
  await fireEvent.press(screen.getByRole("radio", { name: "Empty ID" }))
  expect(screen.getByRole("button", { name: "Add Sort Criteria" }).props.accessibilityValue.text).toBe(
    "Select Sort Criteria",
  )
  await press("Add Sort Criteria")
  await fireEvent.press(screen.getByRole("radio", { name: "Empty ID" }))
  expect(onAdd.mock.calls).toEqual([[""], [""]])
  expect(ref.current).toBe(target)
  expect(metadata).toEqual([
    { id: "", name: "Empty ID" },
    { id: "b", name: "Second" },
  ])
})

it("renders current criteria and names without retaining deleted metadata", async () => {
  const previous = jest.fn(),
    current = jest.fn()
  await render(
    wrap(
      <QuerySortCriteriaField
        availableSortCriteria={[{ id: "old", name: "Old" }]}
        labels={labels.form}
        closeLabel="Close"
        onAddSortParameter={previous}
      />,
    ),
  )
  await rerenderWithNativeCollections(
    wrap(
      <QuerySortCriteriaField
        availableSortCriteria={[{ id: "new", name: "Nouveau" }]}
        labels={{ addSortCriteriaLabel: "Ajouter", addSortCriteriaPlaceholder: "Choisir" }}
        closeLabel="Fermer"
        onAddSortParameter={current}
      />,
    ),
  )
  await press("Ajouter")
  expect(screen.queryByRole("radio", { name: "Old" })).toBeNull()
  await fireEvent.press(screen.getByRole("radio", { name: "Nouveau" }))
  expect(current).toHaveBeenCalledWith("new")
  expect(previous).not.toHaveBeenCalled()
})

it("guards Add Sort callback delivery while closed without inventing selection state", async () => {
  let active = true
  const onAdd = jest.fn()
  await render(
    wrap(
      <QuerySortCriteriaField
        canAct={() => active}
        availableSortCriteria={[{ id: "a", name: "City" }]}
        labels={labels.form}
        closeLabel="Close"
        onAddSortParameter={onAdd}
      />,
    ),
  )
  await press("Add Sort Criteria")
  active = false
  await fireEvent.press(screen.getByRole("radio", { name: "City" }))
  expect(onAdd).not.toHaveBeenCalled()
})

it("CAP.query-controls.004 retains active tags until the owner removes them, including empty IDs", async () => {
  const onDelete = jest.fn()
  const sorts = [instruction(""), { ...instruction("b"), criteriaName: "Name" }]
  await render(
    wrap(<QueryActiveSorts sortParameterList={sorts} labels={labels.activeSorts} onDeleteSortParameter={onDelete} />),
  )
  expect(screen.getByText("Sorting By:")).toBeOnTheScreen()
  expect(screen.queryByText("No sorting currently applied")).toBeNull()
  await press("Remove City")
  await press("Remove City")
  expect(onDelete.mock.calls).toEqual([[""], [""]])
  expect(sorts).toHaveLength(2)
  expect(screen.getByText("City")).toBeOnTheScreen()
  await rerenderWithNativeCollections(
    wrap(<QueryActiveSorts sortParameterList={[]} labels={labels.activeSorts} onDeleteSortParameter={onDelete} />),
  )
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Remove City" })).toBeNull()
})

it("uses current active-sort tag metadata and removal callback after replacement", async () => {
  const previous = jest.fn(),
    current = jest.fn()
  await render(
    wrap(
      <QueryActiveSorts
        sortParameterList={[instruction()]}
        labels={labels.activeSorts}
        onDeleteSortParameter={previous}
      />,
    ),
  )
  await rerenderWithNativeCollections(
    wrap(
      <QueryActiveSorts
        sortParameterList={[{ ...instruction("current"), criteriaName: "Nouveau" }]}
        labels={labels.activeSorts}
        onDeleteSortParameter={current}
      />,
    ),
  )
  await press("Remove Nouveau")
  expect(current).toHaveBeenCalledWith("current")
  expect(previous).not.toHaveBeenCalled()
})

it("CAP.query-controls.005 keeps Clear, Cancel and Apply as distinct current requests", async () => {
  const order: string[] = []
  const clear = jest.fn(() => {
      order.push("clear")
    }),
    cancel = jest.fn(() => {
      order.push("cancel")
    }),
    apply = jest.fn(() => {
      order.push("apply")
    })
  await render(
    wrap(
      <QueryPanelFooter
        labels={labels.footer}
        onClearAllSortAndFilterParameters={clear}
        onCancelPendingChanges={cancel}
        onApplyPendingChanges={apply}
      />,
    ),
  )
  await press("Clear All")
  await press("Cancel")
  await press("Apply")
  await press("Apply")
  expect(order).toEqual(["clear", "cancel", "apply", "apply"])
  expect(clear).toHaveBeenCalledTimes(1)
  expect(cancel).toHaveBeenCalledTimes(1)
})

it("updates footer labels/callbacks and keeps a vetoed Apply separate from Cancel", async () => {
  const original = jest.fn(),
    current = jest.fn()
  const noop = jest.fn()
  await render(
    wrap(
      <QueryPanelFooter
        labels={labels.footer}
        onClearAllSortAndFilterParameters={noop}
        onCancelPendingChanges={noop}
        onApplyPendingChanges={original}
      />,
    ),
  )
  await rerenderWithNativeCollections(
    wrap(
      <QueryPanelFooter
        labels={{ clearAllButton: "Effacer", cancelButton: "Annuler", applyButton: "Valider" }}
        onClearAllSortAndFilterParameters={noop}
        onCancelPendingChanges={noop}
        onApplyPendingChanges={current}
      />,
    ),
  )
  await press("Valider")
  expect(current).toHaveBeenCalledTimes(1)
  expect(original).not.toHaveBeenCalled()
  expect(noop).not.toHaveBeenCalled()
})

it("preserves thrown Apply callbacks and does not invoke another footer action", async () => {
  const error = new Error("owner rejected")
  const other = jest.fn()
  await render(
    wrap(
      <QueryPanelFooter
        labels={labels.footer}
        onClearAllSortAndFilterParameters={other}
        onCancelPendingChanges={other}
        onApplyPendingChanges={() => {
          throw error
        }}
      />,
    ),
  )
  await expect(press("Apply")).rejects.toThrow(error)
  expect(other).not.toHaveBeenCalled()
})

it("retains the title and current close label/callback without mutating open ownership", async () => {
  const previous = jest.fn(),
    current = jest.fn()
  await render(wrap(<QueryPanelHeader title="Events" labels={labels.header} onCloseSortAndFilterPanel={previous} />))
  await press("Close Sort and Filter Panel")
  await press("Close Sort and Filter Panel")
  expect(previous).toHaveBeenCalledTimes(2)
  expect(screen.getByText("Events")).toBeOnTheScreen()
  await rerenderWithNativeCollections(
    wrap(
      <QueryPanelHeader
        title="Événements"
        labels={{ closeButtonAriaLabel: "Fermer" }}
        onCloseSortAndFilterPanel={current}
      />,
    ),
  )
  await press("Fermer")
  expect(current).toHaveBeenCalledTimes(1)
  expect(screen.getByText("Événements")).toBeOnTheScreen()
})

it("wires the canonical1000ms close tooltip delay to the existing native trigger", async () => {
  jest.useFakeTimers()
  const timer = jest.spyOn(globalThis, "setTimeout")
  await render(wrap(<QueryPanelHeader title="Events" labels={labels.header} onCloseSortAndFilterPanel={jest.fn()} />))
  await fireEvent(screen.getByRole("button", { name: "Close Sort and Filter Panel" }), "pointerEnter", {
    nativeEvent: { pointerType: "mouse" },
    persist: jest.fn(),
  })
  expect(timer.mock.calls.some((call) => call[1] === 1000)).toBe(true)
  expect(screen.queryByTestId("tooltip", { includeHiddenElements: true })).toBeNull()
  await act(() => jest.advanceTimersByTime(999))
  expect(screen.queryByTestId("tooltip", { includeHiddenElements: true })).toBeNull()
  await act(() => jest.advanceTimersByTime(1))
  expect(screen.getByTestId("tooltip", { includeHiddenElements: true })).toBeOnTheScreen()
})

it("CAP.query-controls.006 updates existing theme spacing, surface and radius without changing authored data", async () => {
  const props = entryProps()
  await render(wrap(<QuerySortEntry {...props} />))
  const initial = StyleSheet.flatten(screen.getByTestId("query-sort-entry").props.style)
  expect(initial).toMatchObject({
    padding: resolveNativeTheme("light").spacing.unit * 2,
    backgroundColor: resolveNativeTheme("light").colors.controlHoverBackground,
    borderRadius: resolveNativeTheme("light").radius.rounded,
  })
  await rerenderWithNativeCollections(wrap(<QuerySortEntry {...props} />, "dark"))
  expect(StyleSheet.flatten(screen.getByTestId("query-sort-entry").props.style).backgroundColor).toBe(
    resolveNativeTheme("dark").colors.controlHoverBackground,
  )
  for (const glyph of ["ascending", "descending", "delete", "grip"]) {
    const node = screen.getByTestId(`query-${glyph}-glyph`, { includeHiddenElements: true })
    expect(node.props.accessible).toBe(false)
  }
  expect(within(screen.getByTestId("query-sort-entry")).getByText("City")).toBeOnTheScreen()
  expect(props.parameter).toEqual(instruction())
})

const WindowStatus = () => {
  const active = useContext(NativeFloatingWindowContext)
  return <Text testID="query-parent-window-status">{String(active?.())}</Text>
}
it("admits a Select child-window request while its actual parent window is temporarily inactive", async () => {
  const onAdd = jest.fn()
  await render(
    <NativeOverlayProvider>
      <WindowStatus />
      {wrap(
        <QuerySortCriteriaField
          availableSortCriteria={[{ id: "a", name: "City" }]}
          labels={labels.form}
          closeLabel="Close"
          onAddSortParameter={onAdd}
        />,
      )}
    </NativeOverlayProvider>,
  )
  expect(screen.getByTestId("query-parent-window-status").props.children).toBe("true")
  await press("Add Sort Criteria")
  await fireEvent(screen.getByTestId("select-window"), "show")
  expect(screen.getByTestId("query-parent-window-status").props.children).toBe("false")
  await fireEvent.press(screen.getByRole("radio", { name: "City" }))
  expect(onAdd).toHaveBeenCalledWith("a")
})
