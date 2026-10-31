import { writeFileSync } from "node:fs"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import React from "react"
import { afterAll, expect, it, vi } from "vitest"

import InputArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument"
import BooleanArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument"
import RangeArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument"
import ListArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgument"
import {
  normalizeDraftToQueryFilterGroups,
  type TQueryFilterGroupDraft,
} from "../../../../packages/react/src/components/Table/filterDraft"

const report: Record<string, unknown> = {
  kind: "Actual corrected canonical editor ownership assertions; no native editing or delivery claim",
}
const normalize = (
  argument: TQueryFilterGroupDraft["clauses"][number]["argument"],
  operationCode: "equal" | "in" | "between" = "equal",
) =>
  normalizeDraftToQueryFilterGroups({
    id: "g",
    criteriaID: "c",
    criteriaName: "Current",
    dataType: "number",
    joinOperator: "and",
    clauses: [{ id: "c", operationCode, argument }],
  })
it("records held undefined/null/false Boolean ownership without inventing an owner echo", async () => {
  const records = []
  for (const mode of ["Checkbox", "Toggle"] as const)
    for (const argument of [undefined, null, false]) {
      const change = vi.fn()
      render(
        <BooleanArgument
          dataType="boolean"
          argument={argument}
          booleanArgumentComponent={mode}
          onArgumentChange={change}
        />,
      )
      const input = screen.getByRole(mode === "Checkbox" ? "checkbox" : "switch") as HTMLInputElement
      const before = input.checked
      const user = userEvent.setup()
      await user.click(input)
      const afterFirst = input.checked
      await user.click(input)
      records.push({
        mode,
        argument,
        before,
        afterFirst,
        afterSecond: input.checked,
        requests: change.mock.calls.map(([payload]) => payload),
      })
      expect(input.checked).toBe(false)
      expect(afterFirst).toBe(false)
      expect(change.mock.calls.map(([payload]) => payload)).toEqual([{ argument: true }, { argument: true }])
      cleanup()
    }
  report.boolean = records
  expect(records).toHaveLength(6)
})
it("records number requests while the owner holds undefined/null/zero", async () => {
  const records = []
  for (const argument of [undefined, null, 0]) {
    const change = vi.fn()
    render(<InputArgument dataType="number" argument={argument} onArgumentChange={change} />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    const before = input.value
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^Increase/ }))
    const afterFirst = input.value
    await user.click(screen.getByRole("button", { name: /^Increase/ }))
    records.push({
      argument,
      before,
      afterFirst,
      afterSecond: input.value,
      requests: change.mock.calls.map(([payload]) => payload),
    })
    expect(input.value).toBe(argument === 0 ? "0" : "")
    expect(afterFirst).toBe(argument === 0 ? "0" : "")
    expect(change.mock.calls.map(([payload]) => payload)).toEqual([
      { argument: argument === 0 ? 1 : 0 },
      { argument: argument === 0 ? 1 : 0 },
    ])
    cleanup()
  }
  report.number = records
})
it("records cleared numeric output and its actual normalization/JSON representation", async () => {
  const change = vi.fn()
  render(<InputArgument dataType="number" argument={0} onArgumentChange={change} />)
  const input = screen.getByRole("textbox") as HTMLInputElement
  const user = userEvent.setup()
  await user.clear(input)
  await user.tab()
  const payload = change.mock.calls.at(-1)?.[0]
  expect(payload).toBeDefined()
  expect(payload).toEqual({ argument: null })
  const normalized = normalize(payload.argument)
  expect(normalized).toEqual([])
  report.numberClear = {
    payload,
    normalized,
    json: JSON.parse(JSON.stringify(normalized)),
    ownerStill: 0,
    displayed: input.value,
  }
})
it("records an incomplete range and mixed numeric-list requests against the current declared query model", async () => {
  const range = vi.fn()
  render(<RangeArgument dataType="text" argument={[]} onArgumentChange={range} />)
  const minimum = screen.getByRole("textbox", { name: "Min Value" }) as HTMLInputElement
  fireEvent.change(minimum, { target: { value: "edited" } })
  expect(minimum.value).toBe("")
  expect(range).toHaveBeenCalledWith({ argument: ["edited", undefined] })
  report.incompleteRange = { owner: [], displayed: minimum.value, payload: range.mock.calls.at(-1)?.[0] }
  cleanup()
  const list = vi.fn()
  const owner = [0, 1]
  render(<ListArgument dataType="number" argument={owner} onArgumentChange={list} />)
  const first = screen.getByRole("textbox", { name: "Filter Argument 0" }) as HTMLInputElement
  const before = first.value
  fireEvent.change(first, { target: { value: "edited" } })
  const payload = list.mock.calls.at(-1)?.[0]
  report.numericList = { owner, before, after: first.value, payload, normalized: normalize(payload.argument, "in") }
  expect(owner).toEqual([0, 1])
  expect(payload).toEqual({ argument: ["edited", 1] })
  expect(normalize(payload.argument, "in")[0].clauses[0].argument).toEqual(["edited", 1])
})
it("records the actual empty-list UI instead of assuming the unreachable fallback creates an editor", async () => {
  const change = vi.fn()
  render(<ListArgument dataType="text" argument={[]} onArgumentChange={change} />)
  const before = screen.queryAllByRole("textbox").length
  await userEvent.setup().click(screen.getByRole("button", { name: "Add Filter Argument Entry" }))
  expect(before).toBe(0)
  expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  expect(change).toHaveBeenCalledWith({ argument: [""] })
  report.emptyList = {
    owner: [],
    before,
    after: screen.queryAllByRole("textbox").length,
    requests: change.mock.calls.map(([payload]) => payload),
  }
})
afterAll(() => {
  const target = process.env.CODON_FILTER_EDITOR_ORACLE_OUTPUT
  if (!target?.startsWith("/private/tmp/codon-native-filter-text-"))
    throw new Error("Use a mutable task-owned oracle output")
  writeFileSync(
    target,
    JSON.stringify(
      report,
      (_key, value) =>
        value === undefined
          ? { undefined: true }
          : typeof value === "number" && !Number.isFinite(value)
            ? { nonFinite: String(value) }
            : value,
      2,
    ) + "\n",
  )
})
