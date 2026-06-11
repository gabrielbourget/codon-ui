import { readFileSync } from "node:fs"

import { render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { TAvailableFilterCriteria, TAvailableSortCriteria } from "../../Table/filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_OPERATION_CODE__LIKE,
  TABLE_FILTER_OPERATION_CODE__SIMILAR_TO,
  TABLE_SORT_DIRECTION__ASCENDING,
} from "../../Table/queryTypes"
import type { TApplySortAndFilterParametersArgs } from "../helpers"
import SortAndFilterPanel from "../SortAndFilterPanel"

const sortAndFilterPanelStylesSource = readFileSync(
  "src/components/SortAndFilterPanel/SortAndFilterPanelStyles.module.css",
  "utf8",
)
const activeFiltersStylesSource = readFileSync(
  "src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFiltersStyles.module.css",
  "utf8",
)
const sortParameterListStylesSource = readFileSync(
  "src/components/SortAndFilterPanel/InternalComponents/SortParameterList/SortParameterListStyles.module.css",
  "utf8",
)

const SORT_CRITERIA_ID__CITY = "city"
const SORT_CRITERIA_ID__NAME = "name"
const QUERY_KEY__CITY = "event.city"
const QUERY_KEY__NAME = "event.name"

const possibleSortCriteria: TAvailableSortCriteria[] = [
  {
    id: SORT_CRITERIA_ID__CITY,
    name: "City",
    queryKey: QUERY_KEY__CITY,
  },
  {
    id: SORT_CRITERIA_ID__NAME,
    name: "Name",
    queryKey: QUERY_KEY__NAME,
  },
]

const possibleFilterCriteria: TAvailableFilterCriteria[] = [
  {
    id: SORT_CRITERIA_ID__NAME,
    name: "Name",
    queryKey: QUERY_KEY__NAME,
    dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
    allowedOperationCodes: [TABLE_FILTER_OPERATION_CODE__LIKE, TABLE_FILTER_OPERATION_CODE__SIMILAR_TO],
  },
  {
    id: SORT_CRITERIA_ID__CITY,
    name: "City",
    queryKey: QUERY_KEY__CITY,
    dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
    allowedOperationCodes: [TABLE_FILTER_OPERATION_CODE__LIKE],
  },
]

const renderSortAndFilterPanel = (
  args: {
    applyPendingSortAndFilterChanges?: (args: TApplySortAndFilterParametersArgs) => void
  } = {},
) => {
  const applyPendingSortAndFilterChanges = args.applyPendingSortAndFilterChanges ?? vi.fn()

  render(
    <SortAndFilterPanel
      title="Events"
      possibleSortCriteria={possibleSortCriteria}
      possibleFilterCriteria={possibleFilterCriteria}
      applyPendingSortAndFilterChanges={applyPendingSortAndFilterChanges}
      isOpen
      onOpenChange={vi.fn()}
    />,
  )

  return { applyPendingSortAndFilterChanges }
}

const chooseSelectOption = async (label: string, optionName: string) => {
  const user = userEvent.setup()

  await user.click(screen.getByRole("button", { name: label }))
  await user.click(await screen.findByRole("option", { name: optionName }))

  return user
}

describe("<SortAndFilterPanel /> integration", () => {
  it("uses Codon theme tokens in internal query styles.", () => {
    const panelStylesSource = [
      sortAndFilterPanelStylesSource,
      activeFiltersStylesSource,
      sortParameterListStylesSource,
    ].join("\n")

    expect(panelStylesSource).toContain("var(--cui-color-primary-500)")
    expect(panelStylesSource).not.toMatch(
      /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
    )
  })

  it("uses default labels when no label map is supplied.", () => {
    renderSortAndFilterPanel()

    expect(screen.getByRole("button", { name: "Add Sort Criteria" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Add Filter Criteria" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Close Sort and Filter Panel" })).toBeVisible()
  })

  it("emits registry-shaped sort instructions.", async () => {
    const applyPendingSortAndFilterChanges = vi.fn()
    renderSortAndFilterPanel({ applyPendingSortAndFilterChanges })

    await chooseSelectOption("Add Sort Criteria", "City")
    await userEvent.setup().click(screen.getByRole("button", { name: "Apply" }))

    expect(applyPendingSortAndFilterChanges).toHaveBeenCalledWith({
      sortInstructions: [
        {
          id: SORT_CRITERIA_ID__CITY,
          criteriaID: SORT_CRITERIA_ID__CITY,
          criteriaName: "City",
          queryKey: QUERY_KEY__CITY,
          sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
        },
      ],
      filterGroups: [],
    })
  })

  it("emits filter groups with operation codes and query keys from criteria metadata.", async () => {
    const applyPendingSortAndFilterChanges = vi.fn()
    renderSortAndFilterPanel({ applyPendingSortAndFilterChanges })

    const user = await chooseSelectOption("Add Filter Criteria", "Name")
    await user.type(screen.getByRole("textbox", { name: "Filter Name by contained text" }), "ambient")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    await waitFor(() => expect(applyPendingSortAndFilterChanges).toHaveBeenCalledTimes(1))
    expect(applyPendingSortAndFilterChanges).toHaveBeenCalledWith({
      sortInstructions: [],
      filterGroups: [
        {
          id: SORT_CRITERIA_ID__NAME,
          criteriaID: SORT_CRITERIA_ID__NAME,
          criteriaName: "Name",
          queryKey: QUERY_KEY__NAME,
          dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
          joinOperator: TABLE_FILTER_JOIN_OPERATOR__AND,
          clauses: [
            {
              id: expect.any(String),
              operationCode: TABLE_FILTER_OPERATION_CODE__LIKE,
              argument: "ambient",
            },
          ],
        },
      ],
    })
  })

  it("uses the next allowed operation before duplicating filter clauses for the same criterion.", async () => {
    const applyPendingSortAndFilterChanges = vi.fn()
    renderSortAndFilterPanel({ applyPendingSortAndFilterChanges })

    const user = await chooseSelectOption("Add Filter Criteria", "Name")
    await user.type(screen.getByRole("textbox", { name: "Filter Name by contained text" }), "ambient")
    await user.click(screen.getByRole("button", { name: "Add filter for Name" }))

    const nameFilterGroup = screen.getByRole("region", { name: "Name filter group" })
    await user.type(within(nameFilterGroup).getByRole("textbox", { name: "Filter Name by similar text" }), "warehousse")
    await user.click(screen.getByRole("button", { name: "Add filter for Name" }))

    const containedFilterInputs = within(nameFilterGroup).getAllByRole("textbox", {
      name: "Filter Name by contained text",
    })
    await user.type(containedFilterInputs[1], "warehouse")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    await waitFor(() => expect(applyPendingSortAndFilterChanges).toHaveBeenCalledTimes(1))
    expect(applyPendingSortAndFilterChanges).toHaveBeenCalledWith({
      sortInstructions: [],
      filterGroups: [
        {
          id: SORT_CRITERIA_ID__NAME,
          criteriaID: SORT_CRITERIA_ID__NAME,
          criteriaName: "Name",
          queryKey: QUERY_KEY__NAME,
          dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
          joinOperator: TABLE_FILTER_JOIN_OPERATOR__AND,
          clauses: [
            {
              id: expect.any(String),
              operationCode: TABLE_FILTER_OPERATION_CODE__LIKE,
              argument: "ambient",
            },
            {
              id: expect.any(String),
              operationCode: TABLE_FILTER_OPERATION_CODE__SIMILAR_TO,
              argument: "warehousse",
            },
            {
              id: expect.any(String),
              operationCode: TABLE_FILTER_OPERATION_CODE__LIKE,
              argument: "warehouse",
            },
          ],
        },
      ],
    })
  }, 10_000)
})
