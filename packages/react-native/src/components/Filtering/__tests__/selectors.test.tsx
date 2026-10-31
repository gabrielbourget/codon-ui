import { fireEvent, render, screen } from "@testing-library/react-native"

import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeThemeProvider } from "../../../theme"
import type { TAvailableFilterCriteria } from "../../Table/filterMetadata"
import { FilterClauseSelectors, type TFilterClauseSelectorsProps } from "../FilterClauseSelectors"
import { DEFAULT_FILTER_CLAUSE_LABELS, resolveFilterClauseLabels } from "../labels"
import {
  computeAvailableFilterConditionTypes,
  computeAvailableOperationCodeItems,
  computeFilterArgumentType,
} from "../metadata"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const criteria: TAvailableFilterCriteria[] = [
  { id: "name", name: "Name", dataType: "text", allowedOperationCodes: ["like", "in", "between"] },
  { id: "", name: "Empty ID", dataType: "number", allowedOperationCodes: ["between", "equal"] },
]
const base = (): TFilterClauseSelectorsProps => {
  const clause = {
    id: "clause",
    operationCode: "like" as const,
    conditionType: "List" as const,
    argument: "raw",
    filterArgumentSelectedKey: "old",
  }
  return {
    group: {
      id: "group",
      criteriaID: "name",
      criteriaName: "Name",
      dataType: "text",
      joinOperator: "or",
      clauses: [clause],
    },
    clause,
    availableFilterCriteria: criteria,
    closeLabels: { criteria: "Close criteria", operation: "Close condition", conditionType: "Close type" },
    onModifyFilterClause: jest.fn(),
    onDeleteFilterClause: jest.fn(),
  }
}
const node = (props: TFilterClauseSelectorsProps) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>
      <FilterClauseSelectors {...props} />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const choose = async (field: string, option: string) => {
  await fireEvent.press(screen.getByRole("button", { name: field }))
  await fireEvent.press(screen.getByRole("radio", { name: option }))
}

it("CAP.filter-selectors.001 selects the first current operation and preserves an empty criterion ID without optimistic owner mutation", async () => {
  const props = base()
  await render(node(props))
  await choose("Filter Criteria", "Empty ID")
  expect(props.onModifyFilterClause).toHaveBeenCalledWith({
    newCriteriaID: "",
    updatedClause: {
      id: "clause",
      operationCode: "between",
      conditionType: undefined,
      argument: ["", ""],
      filterArgumentSelectedKey: null,
    },
  })
  expect(props.group.criteriaID).toBe("name")
  expect(props.clause.argument).toBe("raw")
  expect(screen.getByRole("button", { name: "Filter Criteria" }).props.accessibilityValue.text).toBe("Name")
})
it("CAP.filter-selectors.002 resets condition/selection metadata when requesting another operation", async () => {
  const props = base()
  await render(node(props))
  await choose("Filter Condition", "Included in")
  expect(props.onModifyFilterClause).toHaveBeenCalledWith({
    newCriteriaID: "name",
    updatedClause: {
      id: "clause",
      operationCode: "in",
      conditionType: undefined,
      argument: [],
      filterArgumentSelectedKey: null,
    },
  })
  expect(screen.queryByRole("button", { name: "Filter Condition Type" })).toBeNull()
  expect(props.clause.filterArgumentSelectedKey).toBe("old")
})
it.each(["in", "not-in"] as const)(
  "CAP.filter-selectors.003 shows current null condition selection for %s and resets the argument on change",
  async (operationCode) => {
    const props = base()
    props.clause = { id: "clause", operationCode, argument: ["kept"] }
    props.group = { ...props.group, clauses: [props.clause] }
    await render(node(props))
    expect(screen.getByRole("button", { name: "Filter Condition Type" }).props.accessibilityValue.text).toBe(
      "Filter Condition Type",
    )
    await choose("Filter Condition Type", "Range")
    expect(props.onModifyFilterClause).toHaveBeenCalledWith({
      newCriteriaID: "name",
      updatedClause: {
        id: "clause",
        operationCode,
        conditionType: "Range",
        argument: [],
        filterArgumentSelectedKey: null,
      },
    })
  },
)
it.each(["date", "date-time", "time"] as const)(
  "excludes Multi-Select for %s without removing List/Range",
  (dataType) => {
    expect(computeAvailableFilterConditionTypes(dataType).map((item) => item.name)).toEqual(["Range", "List"])
  },
)
it("keeps all three non-temporal condition modes and current dispatch hints", () => {
  for (const dataType of ["text", "number", "boolean"] as const)
    expect(computeAvailableFilterConditionTypes(dataType).map((item) => item.name)).toEqual([
      "Range",
      "List",
      "Multi-Select",
    ])
  const props = base()
  expect(computeFilterArgumentType(props.group, props.clause)).toBe("Input")
  expect(computeFilterArgumentType({ ...props.group, usesSelectInput: true }, props.clause)).toBe("Select")
})
it("preserves operation order, empty labels and missing metadata without mutating owner arrays", () => {
  const allowed = Object.freeze(["like", "equal"] as const)
  expect(
    computeAvailableOperationCodeItems([{ ...criteria[0], allowedOperationCodes: allowed }], "name", { like: "" }),
  ).toEqual([
    { id: "like", name: "" },
    { id: "equal", name: "equal" },
  ])
  expect(computeAvailableOperationCodeItems(criteria, "missing")).toEqual([])
  expect(allowed).toEqual(["like", "equal"])
  const formatter = jest.fn(() => "")
  const labels = resolveFilterClauseLabels({
    criteriaLabel: "",
    operations: { like: "" },
    argumentAccessibleLabel: formatter,
  })
  expect(labels.criteriaLabel).toBe("")
  expect(labels.operations.like).toBe("")
  expect(labels.operations.equal).toBe("Equal to")
  expect(labels.argumentAccessibleLabel).toBe(formatter)
  expect(DEFAULT_FILTER_CLAUSE_LABELS.criteriaLabel).toBe("Filter Criteria")
})
it("uses current criterion metadata/callbacks after replacement", async () => {
  const previous = base(),
    current = base()
  await render(node(previous))
  current.availableFilterCriteria = [{ id: "name", name: "Name", dataType: "text", allowedOperationCodes: ["equal"] }]
  current.labels = { conditionLabel: "Condition", operations: { equal: "Égal" } }
  await screen.rerender(node(current))
  await choose("Condition", "Égal")
  expect(previous.onModifyFilterClause).not.toHaveBeenCalled()
  expect(current.onModifyFilterClause).toHaveBeenCalledWith({
    newCriteriaID: "name",
    updatedClause: {
      id: "clause",
      operationCode: "equal",
      conditionType: undefined,
      argument: undefined,
      filterArgumentSelectedKey: null,
    },
  })
})
it.each(["closed", "deleted"] as const)("rejects %s clause requests without recreating data", async (kind) => {
  const props = base()
  let active = true
  props.canAct = () => active
  await render(node(props))
  if (kind === "closed") active = false
  else {
    props.group = { ...props.group, clauses: [] }
    await screen.rerender(node(props))
  }
  await choose("Filter Condition", "Included in")
  await fireEvent.press(screen.getByRole("button", { name: "Delete Filter Entry" }))
  expect(props.onModifyFilterClause).not.toHaveBeenCalled()
  expect(props.onDeleteFilterClause).not.toHaveBeenCalled()
})
it("preserves selector/delete visibility controls and current delete identity", async () => {
  const props = base()
  await render(node({ ...props, showCriteriaSelector: false, hideDeleteButton: true }))
  expect(screen.queryByRole("button", { name: "Filter Criteria" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Delete Filter Entry" })).toBeNull()
  const updated = {
    ...props,
    clause: { ...props.clause, id: "" },
    group: { ...props.group, clauses: [{ ...props.clause, id: "" }] },
  }
  await screen.rerender(node(updated))
  await fireEvent.press(screen.getByRole("button", { name: "Delete Filter Entry" }))
  expect(props.onDeleteFilterClause).toHaveBeenCalledWith("")
})
