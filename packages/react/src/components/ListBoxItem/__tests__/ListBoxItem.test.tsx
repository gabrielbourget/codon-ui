import { render, screen } from "@testing-library/react"
import { ListBox } from "react-aria-components"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import { LISTBOX_ITEM__SIZE_LG, LISTBOX_ITEM__SIZE_MD, LISTBOX_ITEM__SIZE_SM } from "../helpers"
import ListBoxItem from "../ListBoxItem"
import styles from "../ListBoxItemStyles.module.css"

describe("<ListBoxItem />", () => {
  it("renders.", () => {
    render(
      <ListBox aria-label="list">
        <ListBoxItem aria-label="list item" id="1">
          List Box Item Content
        </ListBoxItem>
      </ListBox>,
    )
    const listBoxItem = screen.getByTestId("listbox-item")

    expect(listBoxItem).toBeInTheDocument()
    expect(listBoxItem).toHaveTextContent(/list box item content/iu)
  })

  describe("props API surface", () => {
    it("responds to textSize prop.", () => {
      const { rerender } = render(
        <ListBox aria-label="list">
          <ListBoxItem textSize={LISTBOX_ITEM__SIZE_SM} aria-label="list item" id="1">
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )
      const listBoxItem = screen.getByTestId("listbox-item")

      expect(listBoxItem).toHaveClass(textStyles.b11)

      rerender(
        <ListBox aria-label="list">
          <ListBoxItem textSize={LISTBOX_ITEM__SIZE_MD} aria-label="list item" id="1">
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )
      expect(listBoxItem).toHaveClass(textStyles.b10)

      rerender(
        <ListBox aria-label="list">
          <ListBoxItem textSize={LISTBOX_ITEM__SIZE_LG} aria-label="list item" id="1">
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )
      expect(listBoxItem).toHaveClass(textStyles.b9)
    })

    it("responds to custom styles prop.", () => {
      render(
        <ListBox aria-label="list">
          <ListBoxItem aria-label="list item" id="1" customStyles={{ backgroundColor: "blue" }}>
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )

      expect(screen.getByTestId("listbox-item")).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <ListBox aria-label="list">
          <ListBoxItem
            aria-label="list item"
            id="1"
            textSize={LISTBOX_ITEM__SIZE_SM}
            customStyles={{ color: "turquoise", marginTop: 5 }}
            className="native-listbox-item-class"
            style={{ color: "tomato", marginBottom: 10 }}
          >
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )

      const listBoxItem = screen.getByTestId("listbox-item")

      expect(listBoxItem).toHaveClass(styles.listBoxItem)
      expect(listBoxItem).toHaveClass(textStyles.b11)
      expect(listBoxItem).toHaveClass("native-listbox-item-class")
      expect(listBoxItem).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("preserves inherited render-prop children, className, and style.", () => {
      render(
        <ListBox aria-label="list" disabledKeys={["1"]} selectedKeys={["1"]} selectionMode="single">
          <ListBoxItem
            aria-label="list item"
            id="1"
            className={({ isDisabled }) => (isDisabled ? "disabled-listbox-item-class" : "enabled-listbox-item-class")}
            style={({ isSelected }) => ({ color: isSelected ? "teal" : "tomato" })}
          >
            {({ isSelected }) => <span>{isSelected ? "Selected item" : "Available item"}</span>}
          </ListBoxItem>
        </ListBox>,
      )

      const listBoxItem = screen.getByTestId("listbox-item")

      expect(listBoxItem).toHaveTextContent("Selected item")
      expect(listBoxItem).toHaveClass(styles.listBoxItem)
      expect(listBoxItem).toHaveClass("disabled-listbox-item-class")
      expect(listBoxItem).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <ListBox aria-label="list">
          <ListBoxItem aria-label="list item" id="1" textSize={LISTBOX_ITEM__SIZE_SM} customStyles={{ marginTop: 5 }}>
            List Box Item Content
          </ListBoxItem>
        </ListBox>,
      )

      const listBoxItem = screen.getByTestId("listbox-item")

      expect(listBoxItem).not.toHaveAttribute("textsize")
      expect(listBoxItem).not.toHaveAttribute("customstyles")
    })
  })
})
