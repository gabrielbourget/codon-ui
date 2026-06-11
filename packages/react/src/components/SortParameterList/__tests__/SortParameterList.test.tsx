import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TABLE_SORT_DIRECTION__ASCENDING, TABLE_SORT_DIRECTION__DESCENDING } from "../../Table/queryTypes"
import type { TSortParameterListProps } from "../helpers"
import SortParameterList from "../SortParameterList"
import type { TSortParameter, TSortParameterProps } from "../SortParameterListItem/helpers"
import SortParameterListItem from "../SortParameterListItem/SortParameterListItem"
import itemStyles from "../SortParameterListItem/SortParameterListItemStyles.module.css"
import styles from "../SortParameterListStyles.module.css"

const sortParameterList: TSortParameter[] = [
  { ID: "name", name: "Name", sortDirection: TABLE_SORT_DIRECTION__ASCENDING },
  { ID: "date", name: "Date", sortDirection: TABLE_SORT_DIRECTION__DESCENDING },
]

const renderSortParameterList = (props: Partial<TSortParameterListProps> = {}) => {
  const defaultProps: TSortParameterListProps = {
    sortParameterList,
  }

  return render(<SortParameterList {...defaultProps} {...props} />)
}

const renderSortParameterListItem = (props: Partial<TSortParameterProps> = {}) => {
  const defaultProps: TSortParameterProps = {
    item: sortParameterList[0],
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDrop: vi.fn(),
  }

  return render(<SortParameterListItem {...defaultProps} {...props} />)
}

describe("<SortParameterList />", () => {
  it("merges native root className and style with custom root styling aliases.", () => {
    renderSortParameterList({
      ariaLabel: "Sort parameters",
      className: "native-sort-list",
      customClassName: "custom-sort-list",
      customStyles: { backgroundColor: "turquoise", marginTop: 5 },
      style: { backgroundColor: "tomato", marginBottom: 10 },
      "data-testid": "custom-sort-parameter-list",
    })

    const list = screen.getByTestId("custom-sort-parameter-list")

    expect(list).toHaveAttribute("aria-label", "Sort parameters")
    expect(list).toHaveClass(styles.sortParameterList)
    expect(list).toHaveClass("custom-sort-list")
    expect(list).toHaveClass("native-sort-list")
    expect(list).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })

  it("applies item, icon, and text slot styling hooks.", () => {
    const { baseElement } = renderSortParameterList({
      customItemClassName: "custom-sort-item",
      customItemStyles: { backgroundColor: "turquoise" },
      customItemIconClassName: "custom-sort-icon",
      customItemIconStyles: { marginRight: 5 },
      customItemTextClassName: "custom-sort-text",
      customItemTextStyles: { marginLeft: 10 },
    })

    expect(baseElement.querySelector(".custom-sort-item")).toHaveClass(itemStyles.sortParameterListItem)
    expect(baseElement.querySelector(".custom-sort-item")).toHaveStyle({
      backgroundColor: "rgb(64, 224, 208)",
    })
    expect(baseElement.querySelector(".custom-sort-icon")).toHaveStyle({ marginRight: "5px" })
    expect(baseElement.querySelector(".custom-sort-text")).toHaveStyle({ marginLeft: "10px" })
    expect(screen.getAllByTestId("sort-parameter-list-item-default-drag-indicator-icon")).toHaveLength(2)
  })

  it("does not leak wrapper-only list props onto the root element.", () => {
    renderSortParameterList({
      customClassName: "custom-sort-list",
      customStyles: { marginTop: 5 },
      customItemClassName: "custom-sort-item",
      customItemStyles: { backgroundColor: "turquoise" },
      customItemIconClassName: "custom-sort-icon",
      customItemIconStyles: { marginRight: 5 },
      customItemTextClassName: "custom-sort-text",
      customItemTextStyles: { marginLeft: 10 },
      onSortParameterListChange: vi.fn(),
    })

    const list = screen.getByTestId("sort-parameter-list")

    expect(list).not.toHaveAttribute("sortparameterlist")
    expect(list).not.toHaveAttribute("customclassname")
    expect(list).not.toHaveAttribute("customstyles")
    expect(list).not.toHaveAttribute("customitemclassname")
    expect(list).not.toHaveAttribute("customitemstyles")
    expect(list).not.toHaveAttribute("customitemiconclassname")
    expect(list).not.toHaveAttribute("customitemiconstyles")
    expect(list).not.toHaveAttribute("customitemtextclassname")
    expect(list).not.toHaveAttribute("customitemtextstyles")
    expect(list).not.toHaveAttribute("onsortparameterlistchange")
  })
})

describe("<SortParameterListItem />", () => {
  it("keeps computed identity, label, and styling props authoritative.", () => {
    renderSortParameterListItem({
      "aria-label": "Caller label",
      className: "native-sort-item",
      customClassName: "custom-sort-item",
      customStyles: { backgroundColor: "turquoise", marginTop: 5 },
      id: "caller-id",
      style: { backgroundColor: "tomato", marginBottom: 10 },
      "data-testid": "custom-sort-item",
    } as Partial<TSortParameterProps>)

    const item = screen.getByTestId("custom-sort-item")

    expect(item).toHaveAttribute("id", "name")
    expect(item).toHaveAttribute("aria-label", "Caller label")
    expect(item).toHaveClass(itemStyles.sortParameterListItem)
    expect(item).toHaveClass("custom-sort-item")
    expect(item).toHaveClass("native-sort-item")
    expect(item).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })
})
