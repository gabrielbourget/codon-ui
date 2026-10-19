import { writeFileSync } from "node:fs"

import { cleanup, render, screen } from "@testing-library/react"
import React, { isValidElement } from "react"
import { afterAll, expect, it, vi } from "vitest"

import {
  renderFilterArgumentInput,
  type TFilterArgumentInputContext,
} from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/helpers"
import FilterClauseRow from "../../../../packages/react/src/components/Filtering/FilterClauseRow/FilterClauseRow"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../../packages/react/src/components/Filtering/labels"
import { AVAILABLE_FILTER_ARGUMENT_TYPES } from "../../../../packages/react/src/components/Table/filterMetadata"
import type { TTableFilterOperationCode } from "../../../../packages/react/src/components/Table/queryTypes"
import { DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS } from "../../../../packages/react-native/src/components/Filtering/dispatchLabels"
import { computeFilterArgumentAccessibleLabel } from "../../../../packages/react-native/src/components/Filtering/metadata"

const report: Record<string, unknown> = {
  kind: "Actual canonical renderer/label oracle; private native composition only; no installed, Card/root or temporal acceptance",
}
it("binds every received label/default/formatter to actual canonical labels", () => {
  const canonical = DEFAULT_TABLE_FILTERING_LABELS.argumentInput
  const native = DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS
  const keys = [
    "label",
    "placeholder",
    "booleanLabel",
    "minValueLabel",
    "minValuePlaceholder",
    "maxValueLabel",
    "maxValuePlaceholder",
    "selectLabel",
    "selectPlaceholder",
    "addMultiInputItemButtonAriaLabel",
    "deleteMultiInputItemButtonAriaLabel",
    "typeAheadSearchUnavailable",
    "multiTypeAheadSearchUnavailable",
  ] as const
  for (const key of keys) expect(native[key]).toBe(canonical[key])
  for (const index of [0, 1, 20])
    expect(native.multiInputItemAriaLabel({ index })).toBe(canonical.multiInputItemAriaLabel({ index }))
  for (const position of [1, 2, 21])
    expect(native.multiInputItemPlaceholder({ position })).toBe(canonical.multiInputItemPlaceholder({ position }))
  expect(native.tagComboBox).toEqual(canonical.tagComboBox)
  expect(native.comboBox.triggerButtonAriaLabel).toBe(canonical.comboBox.triggerButtonAriaLabel)
  expect(native.comboBox.emptyListMessage).toBe(canonical.comboBox.emptyListMessage)
  report.labels = {
    scalarFields: keys.length,
    formatterVectors: 6,
    tagComboBox: native.tagComboBox,
    comboBox: native.comboBox,
  }
})
it("executes all33 kind/data cells and preserves the actual empty outcomes and Boolean overrides", () => {
  const cells = []
  for (const dataType of ["text", "number", "boolean"] as const)
    for (const filterArgumentType of AVAILABLE_FILTER_ARGUMENT_TYPES) {
      const isArray = ["Range", "Multi Input", "Multi Select"].includes(filterArgumentType)
      const isBoolean = ["Boolean", "Checkbox", "Toggle"].includes(filterArgumentType)
      const argument = isArray
        ? dataType === "number" && filterArgumentType === "Range"
          ? [0, 1]
          : ["Alpha", "Beta"]
        : isBoolean || (dataType === "boolean" && filterArgumentType === "Input")
          ? false
          : dataType === "number" && filterArgumentType === "Input"
            ? 0
            : "held"
      const props: TFilterArgumentInputContext = {
        dataType,
        argument,
        booleanArgumentComponent: "Checkbox",
        filterArgumentSelectedKey: null,
        availableFilterArguments: [
          { id: "a", name: "Alpha" },
          { id: "b", name: "Beta" },
        ],
        onArgumentChange: vi.fn(),
      }
      const element = renderFilterArgumentInput({ ...props, filterArgumentType })
      expect(isValidElement(element)).toBe(true)
      render(<div data-testid="oracle-source">{element}</div>)
      const body = screen.getByTestId("oracle-source")
      if (dataType === "boolean" && (filterArgumentType === "Input" || filterArgumentType === "Range"))
        expect(body).toBeEmptyDOMElement()
      if (filterArgumentType === "Checkbox") expect(screen.getByRole("checkbox")).not.toBeChecked()
      if (filterArgumentType === "Toggle") expect(screen.getByRole("switch")).not.toBeChecked()
      if (filterArgumentType === "Input" && dataType !== "boolean")
        expect(screen.getByRole("textbox")).toHaveValue(dataType === "number" ? "0" : "held")
      if (filterArgumentType === "Typeahead Search")
        expect(body).toHaveTextContent(DEFAULT_TABLE_FILTERING_LABELS.argumentInput.typeAheadSearchUnavailable)
      if (filterArgumentType === "Multi-Typeahead Search")
        expect(body).toHaveTextContent(DEFAULT_TABLE_FILTERING_LABELS.argumentInput.multiTypeAheadSearchUnavailable)
      cells.push({
        dataType,
        filterArgumentType,
        text: body.textContent,
        inputValues: Array.from(body.querySelectorAll("input")).map((input) => ({
          type: input.type,
          value: input.value,
          checked: input.checked,
        })),
      })
      cleanup()
    }
  expect(cells).toHaveLength(33)
  const context: TFilterArgumentInputContext = { dataType: "boolean", argument: false, onArgumentChange: vi.fn() }
  render(
    <div data-testid="oracle-source">{renderFilterArgumentInput({ ...context, filterArgumentType: "Boolean" })}</div>,
  )
  expect(screen.getByTestId("oracle-source")).toBeEmptyDOMElement()
  expect(renderFilterArgumentInput(context)).toBeNull()
  report.dispatch = { cells, unset: null, missingBooleanMode: "empty child, truthy renderer element" }
})
it("compares effective text-input labels against actual Card row composition", () => {
  const rows = []
  for (const operationCode of ["like", "similar-to", "equal", "not-like"] as TTableFilterOperationCode[]) {
    const clause = { id: "clause", operationCode, argument: "held" }
    const name = "Name"
    render(
      <FilterClauseRow
        listIndex={0}
        group={{
          id: "group",
          criteriaID: "criterion",
          criteriaName: name,
          dataType: "text",
          joinOperator: "and",
          clauses: [clause],
        }}
        clause={clause}
        availableFilterCriteria={[{ id: "criterion", name, dataType: "text", allowedOperationCodes: [operationCode] }]}
        onModifyFilterClause={() => {}}
        onDeleteFilterClause={() => {}}
      />,
    )
    const expected = computeFilterArgumentAccessibleLabel({ criteriaName: name, operationCode })
    expect(screen.getByRole("textbox", { name: expected })).toHaveValue("held")
    rows.push({ operationCode, label: expected })
    cleanup()
  }
  report.rowLabels = rows
})
it("records the existing non-string ComboBox rejection without coercing it", () => {
  expect(() =>
    render(
      <>
        {renderFilterArgumentInput({
          dataType: "boolean",
          filterArgumentType: "Combo Box",
          argument: false,
          availableFilterArguments: [{ id: "a", name: "Alpha" }],
          filterArgumentSelectedKey: null,
          onArgumentChange: () => {},
        })}
      </>,
    ),
  ).toThrow(TypeError)
  cleanup()
  report.mismatchedComboBox = {
    dataType: "boolean",
    argument: false,
    outcome: "TypeError in inherited string filter; explicit existing value-matrix rejection; no coercion",
  }
})
afterAll(() => {
  const target = process.env.CODON_FILTER_DISPATCH_ORACLE_OUTPUT
  if (!target?.startsWith("/private/tmp/codon-native-filter-dispatch-"))
    throw new Error("Use a mutable task-owned oracle output")
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n")
})
