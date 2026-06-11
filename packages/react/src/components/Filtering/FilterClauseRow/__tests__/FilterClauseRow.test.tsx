import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { TQueryFilterClauseDraft, TQueryFilterGroupDraft } from "../../../Table/filterDraft"
import type { TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT as QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_JOIN_OPERATOR__AND as QUERY_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_OPERATION_CODE__IN as FILTERING_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LIKE as FILTERING_OPERATION_CODE__LIKE,
} from "../../../Table/queryTypes"
import FilterClauseRow from "../FilterClauseRow"
import styles from "../FilterClauseRowStyles.module.css"
import type { TFilterClauseRowProps } from "../helpers"

const availableFilterCriteria: TAvailableFilterCriteria[] = [
  {
    id: "name",
    name: "Name",
    dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
    allowedOperationCodes: [FILTERING_OPERATION_CODE__LIKE, FILTERING_OPERATION_CODE__IN],
  },
]

const clause: TQueryFilterClauseDraft = {
  id: "clause-1",
  operationCode: FILTERING_OPERATION_CODE__LIKE,
  argument: "ambient",
}

const group: TQueryFilterGroupDraft = {
  id: "group-1",
  criteriaID: "name",
  criteriaName: "Name",
  dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
  clauses: [clause],
}

const renderFilterClauseRow = (props: Partial<TFilterClauseRowProps> = {}) => {
  const defaultProps: TFilterClauseRowProps = {
    listIndex: 0,
    group,
    clause,
    availableFilterCriteria,
    onModifyFilterClause: vi.fn(),
    onDeleteFilterClause: vi.fn(),
  }

  return render(<FilterClauseRow {...defaultProps} {...props} />)
}

describe("<FilterClauseRow />", () => {
  it("renders the intended accessible row label on the visual root.", () => {
    renderFilterClauseRow()

    const filterClauseRow = screen.getByRole("group", { name: "Filter Parameter #1 - Name" })

    expect(filterClauseRow).toHaveClass(styles.filterClauseRow)
  })

  it("merges native root className and style with custom root styling aliases.", () => {
    renderFilterClauseRow({
      className: "native-filter-row",
      customClassName: "custom-filter-row",
      customStyles: { backgroundColor: "turquoise", marginTop: 5 },
      style: { backgroundColor: "tomato", marginBottom: 10 },
      "data-testid": "custom-filter-clause-row",
    })

    const filterClauseRow = screen.getByTestId("custom-filter-clause-row")

    expect(filterClauseRow).toHaveClass(styles.filterClauseRow)
    expect(filterClauseRow).toHaveClass("custom-filter-row")
    expect(filterClauseRow).toHaveClass("native-filter-row")
    expect(filterClauseRow).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })

  it("maps aria labeling aliases onto the root element.", () => {
    renderFilterClauseRow({
      ariaLabel: "Alias filter row",
      ariaLabelledBy: "alias-label-id",
      ariaDescribedBy: "alias-description-id",
      ariaDetails: "alias-details-id",
    })

    const filterClauseRow = screen.getByTestId("filter-clause-row")

    expect(filterClauseRow).toHaveAttribute("aria-label", "Alias filter row")
    expect(filterClauseRow).toHaveAttribute("aria-labelledby", "alias-label-id")
    expect(filterClauseRow).toHaveAttribute("aria-describedby", "alias-description-id")
    expect(filterClauseRow).toHaveAttribute("aria-details", "alias-details-id")
  })

  it("applies field, argument, and delete action slot styling hooks.", () => {
    const { baseElement } = renderFilterClauseRow({
      customParameterInfoClassName: "custom-parameter-info",
      customParameterInfoStyles: { backgroundColor: "turquoise" },
      customCriteriaFieldClassName: "custom-criteria-field",
      customCriteriaFieldStyles: { marginTop: 5 },
      customOperationFieldClassName: "custom-operation-field",
      customOperationFieldStyles: { marginBottom: 10 },
      customArgumentClassName: "custom-argument-slot",
      customArgumentStyles: { paddingTop: 15 },
      customDeleteButtonClassName: "custom-delete-action",
      customDeleteButtonStyles: { paddingLeft: 20 },
    })

    expect(screen.getByTestId("filter-clause-row-parameter-info")).toHaveClass("custom-parameter-info")
    expect(screen.getByTestId("filter-clause-row-parameter-info")).toHaveStyle({
      backgroundColor: "rgb(64, 224, 208)",
    })
    expect(baseElement.querySelector(".custom-criteria-field")).toHaveStyle({ marginTop: "5px" })
    expect(baseElement.querySelector(".custom-operation-field")).toHaveStyle({ marginBottom: "10px" })
    expect(screen.getByTestId("filter-clause-row-argument")).toHaveClass("custom-argument-slot")
    expect(screen.getByTestId("filter-clause-row-argument")).toHaveStyle({ paddingTop: "15px" })
    expect(screen.getByRole("button", { name: "Delete Filter Entry" })).toHaveClass("custom-delete-action")
    expect(screen.getByRole("button", { name: "Delete Filter Entry" })).toHaveStyle({ paddingLeft: "20px" })
    expect(screen.getByRole("button", { name: "Delete Filter Entry" })).toContainElement(
      screen.getByTestId("filter-clause-row-default-delete-icon"),
    )
  })

  it("does not leak wrapper-only props onto the root element.", () => {
    renderFilterClauseRow({
      customClassName: "custom-filter-row",
      customStyles: { marginTop: 5 },
      customParameterInfoClassName: "custom-parameter-info",
      customParameterInfoStyles: { backgroundColor: "turquoise" },
      customCriteriaFieldClassName: "custom-criteria-field",
      customCriteriaFieldStyles: { marginTop: 5 },
      customOperationFieldClassName: "custom-operation-field",
      customOperationFieldStyles: { marginBottom: 10 },
      customConditionTypeFieldClassName: "custom-condition-type-field",
      customConditionTypeFieldStyles: { marginLeft: 15 },
      customArgumentClassName: "custom-argument-slot",
      customArgumentStyles: { paddingTop: 15 },
      customDeleteButtonClassName: "custom-delete-action",
      customDeleteButtonStyles: { paddingLeft: 20 },
    })

    const filterClauseRow = screen.getByTestId("filter-clause-row")

    expect(filterClauseRow).not.toHaveAttribute("listindex")
    expect(filterClauseRow).not.toHaveAttribute("availablefiltercriteria")
    expect(filterClauseRow).not.toHaveAttribute("showcriteriaselector")
    expect(filterClauseRow).not.toHaveAttribute("hidedeletebutton")
    expect(filterClauseRow).not.toHaveAttribute("customclassname")
    expect(filterClauseRow).not.toHaveAttribute("customstyles")
    expect(filterClauseRow).not.toHaveAttribute("customparameterinfoclassname")
    expect(filterClauseRow).not.toHaveAttribute("customparameterinfostyles")
    expect(filterClauseRow).not.toHaveAttribute("customcriteriafieldclassname")
    expect(filterClauseRow).not.toHaveAttribute("customcriteriafieldstyles")
    expect(filterClauseRow).not.toHaveAttribute("customoperationfieldclassname")
    expect(filterClauseRow).not.toHaveAttribute("customoperationfieldstyles")
    expect(filterClauseRow).not.toHaveAttribute("customconditiontypefieldclassname")
    expect(filterClauseRow).not.toHaveAttribute("customconditiontypefieldstyles")
    expect(filterClauseRow).not.toHaveAttribute("customargumentclassname")
    expect(filterClauseRow).not.toHaveAttribute("customargumentstyles")
    expect(filterClauseRow).not.toHaveAttribute("customdeletebuttonclassname")
    expect(filterClauseRow).not.toHaveAttribute("customdeletebuttonstyles")
  })
})
