import { describe, expect, it } from "vitest"

import { TABLE_SORT_DIRECTION__ASCENDING, TABLE_SORT_DIRECTION__DESCENDING } from "../../Table/queryTypes"
import { reorderSortParameterList } from "../helpers"
import type { TSortParameter } from "../SortParameterListItem/helpers"

const sortParameterList: TSortParameter[] = [
  { ID: "name", name: "Name", sortDirection: TABLE_SORT_DIRECTION__ASCENDING },
  { ID: "date", name: "Date", sortDirection: TABLE_SORT_DIRECTION__DESCENDING },
  { ID: "status", name: "Status", sortDirection: TABLE_SORT_DIRECTION__ASCENDING },
]

describe("reorderSortParameterList", () => {
  it("moves the dragged item before the target item.", () => {
    const reorderedList = reorderSortParameterList(sortParameterList, "status", "name")

    expect(reorderedList.map((item) => item.ID)).toEqual(["status", "name", "date"])
  })

  it("returns the original list when there is no dragged item.", () => {
    const reorderedList = reorderSortParameterList(sortParameterList, null, "name")

    expect(reorderedList).toBe(sortParameterList)
  })

  it("returns the original list when either item is missing.", () => {
    const reorderedList = reorderSortParameterList(sortParameterList, "missing", "name")

    expect(reorderedList).toBe(sortParameterList)
  })
})
