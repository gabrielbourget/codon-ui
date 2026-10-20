import { readFileSync, writeFileSync } from "node:fs"

import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import React from "react"
import { afterAll, expect, it, vi } from "vitest"

import SelectArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/SelectTypeFilterArgument/SelectTypeFilterArgument"
import MultiSelectArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiSelectTypeFilterArgument/MultiSelectTypeFilterArgument"
import {
  computeAvailableFilterConditionTypes as canonicalConditions,
  computeAvailableOperationCodeItems as canonicalOperations,
  computeFilterArgumentType as canonicalType,
} from "../../../../packages/react/src/components/Filtering/FilterClauseRow/helpers"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../../packages/react/src/components/Filtering/labels"
import {
  DEFAULT_FILTER_CLAUSE_LABELS,
  DEFAULT_FILTER_OPTION_LABELS,
} from "../../../../packages/react-native/src/components/Filtering/labels"
import {
  computeAvailableFilterConditionTypes,
  computeAvailableOperationCodeItems,
  computeFilterArgumentType,
} from "../../../../packages/react-native/src/components/Filtering/metadata"
import type { TQueryFilterGroupDraft } from "../../../../packages/react-native/src/components/Table/filterDraft"
import {
  AVAILABLE_TABLE_FILTER_ARGUMENT_DATA_TYPES,
  AVAILABLE_TABLE_FILTER_OPERATION_CODES,
} from "../../../../packages/react-native/src/components/Table/queryTypes"

const report: Record<string, unknown> = {
  kind: "Canonical helper/label and actual browser option-control observations; no native delivery or pixels",
}
it("compares all current helper inputs and bounded defaults against actual canonical functions", () => {
  let cells = 0
  for (const dataType of AVAILABLE_TABLE_FILTER_ARGUMENT_DATA_TYPES) {
    expect(computeAvailableFilterConditionTypes(dataType)).toEqual(canonicalConditions(dataType))
    for (const operationCode of AVAILABLE_TABLE_FILTER_OPERATION_CODES)
      for (const conditionType of [undefined, "Range", "List", "Multi-Select"] as const)
        for (let flags = 0; flags < 8; flags++) {
          const group: TQueryFilterGroupDraft = {
            id: "g",
            criteriaID: "c",
            criteriaName: "Current",
            dataType,
            joinOperator: "and",
            clauses: [],
            usesTypeAheadInput: !!(flags & 1),
            usesSelectInput: !!(flags & 2),
            usesComboBoxInput: !!(flags & 4),
          }
          const clause = { id: "c", operationCode, conditionType }
          expect(computeFilterArgumentType(group, clause)).toEqual(canonicalType(group, clause))
          cells++
        }
  }
  const criteria = [
    { id: "", name: "", dataType: "text" as const, allowedOperationCodes: AVAILABLE_TABLE_FILTER_OPERATION_CODES },
  ]
  expect(computeAvailableOperationCodeItems(criteria, "", { like: "" })).toEqual(
    canonicalOperations(criteria, "", { like: "" }),
  )
  let fields = 0
  for (const [key, value] of Object.entries(DEFAULT_FILTER_CLAUSE_LABELS)) {
    const canonical = DEFAULT_TABLE_FILTERING_LABELS.filterClause[key as keyof typeof DEFAULT_FILTER_CLAUSE_LABELS]
    if (typeof value === "function")
      for (const criteriaName of ["", "Événements"])
        expect(value({ criteriaName, index: 0 })).toEqual((canonical as typeof value)({ criteriaName, index: 0 }))
    else expect(value).toEqual(canonical)
    fields++
  }
  for (const [key, value] of Object.entries(DEFAULT_FILTER_OPTION_LABELS))
    expect(value).toEqual(
      DEFAULT_TABLE_FILTERING_LABELS.argumentInput[key as keyof typeof DEFAULT_FILTER_OPTION_LABELS],
    )
  const originalGlyph = readFileSync("src/components/Filtering/FilterClauseRow/DefaultDeleteIcon.tsx", "utf8").match(
    /d="([^"]+)"/,
  )![1]
  const nativeGlyph = readFileSync("../react-native/src/components/Filtering/FilterDeleteGlyph.tsx", "utf8").match(
    /d="([^"]+)"/,
  )![1]
  expect(nativeGlyph).toBe(originalGlyph)
  report.deleteGlyphPathExact = true
  report.helpers = { dispatchCells: cells, conditionDataTypes: 6, clauseLabelFields: fields, optionLabelFields: 4 }
})
it("records actual canonical Select payloads and held null selection for falsy and array option values", async () => {
  const observations = []
  for (const argumentValue of [false, 0, "", null, undefined, [0, 1]]) {
    const onArgumentChange = vi.fn()
    render(
      <SelectArgument
        dataType="text"
        filterArgumentSelectedKey={null}
        availableFilterArguments={[{ id: "", name: "Selected", argumentValue }]}
        onArgumentChange={onArgumentChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Filter Argument" }))
    await user.click(screen.getByRole("option", { name: "Selected" }))
    const payload = onArgumentChange.mock.calls[0][0]
    expect(payload).toEqual({ argument: argumentValue ?? "Selected", filterArgumentSelectedKey: "" })
    if (Array.isArray(argumentValue)) expect(payload.argument).toBe(argumentValue)
    observations.push({
      input: argumentValue === undefined ? { undefined: true } : argumentValue,
      payload,
      arrayIdentityPreserved: Array.isArray(argumentValue) ? payload.argument === argumentValue : null,
    })
    cleanup()
  }
  report.select = observations
})
it("records the actual canonical name-based Multi Select request", async () => {
  const onArgumentChange = vi.fn()
  render(
    <MultiSelectArgument
      dataType="text"
      argument={[]}
      availableFilterArguments={[
        { id: "", name: "Alpha", argumentValue: false },
        { id: "b", name: "Beta", argumentValue: 0 },
      ]}
      onArgumentChange={onArgumentChange}
    />,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show filter argument suggestions Filter Argument" }))
  await user.click(screen.getByRole("option", { name: "Alpha" }))
  expect(onArgumentChange).toHaveBeenCalledWith({ argument: ["Alpha"], filterArgumentSelectedKey: "" })
  report.multiSelect = {
    payload: onArgumentChange.mock.calls[0][0],
    usesArgumentValue: false,
    canonicalTriggerAccessibleName: "Show filter argument suggestions Filter Argument",
  }
})
afterAll(() => {
  const target = process.env.CODON_FILTER_SELECTOR_ORACLE_OUTPUT
  if (!target?.startsWith("/private/tmp/codon-native-filter-selectors-"))
    throw new Error("Use a mutable task-owned oracle output")
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n")
})
