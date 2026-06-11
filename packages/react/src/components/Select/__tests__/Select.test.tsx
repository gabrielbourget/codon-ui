import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import textStyles from "../../Text/TextStyles.module.css"
import { SELECT_SIZE__LG, SELECT_SIZE__MD, SELECT_SIZE__SM, type TSelectProps } from "../helpers"
import Select from "../Select"
import selectStyles from "../SelectStyles.module.css"

type TSelectTestItem = {
  id: string
  name: string
}

const testItemsBase = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
const testItems = testItemsBase.map((name, index) => ({ id: `${index + 1}`, name }))

const SelectExample = (props: Partial<TSelectProps<TSelectTestItem>> = {}) => {
  return (
    <Select aria-label="Select" items={testItems} placeholder="Make a choice" {...props}>
      {(item) => <ListBoxItem id={item.id}>{item.name}</ListBoxItem>}
    </Select>
  )
}

describe("<Select />", () => {
  it("renders.", () => {
    render(<SelectExample />)

    expect(screen.getByTestId("select")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<SelectExample height={50} width={150} />)
      const select = screen.getByTestId("select")

      expect(select).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      {
        const { unmount } = render(<SelectExample textSize={SELECT_SIZE__SM} />)
        const selectedValue = screen.getByTestId("select-value")

        expect(selectedValue).toHaveClass(textStyles.b11)

        unmount()
      }

      {
        const { unmount } = render(<SelectExample textSize={SELECT_SIZE__MD} />)
        const selectedValue = screen.getByTestId("select-value")

        expect(selectedValue).toHaveClass(textStyles.b10)

        unmount()
      }

      {
        render(<SelectExample textSize={SELECT_SIZE__LG} />)
        const selectedValue = screen.getByTestId("select-value")

        expect(selectedValue).toHaveClass(textStyles.b9)
      }
    })

    it("responds to corner geometry props.", () => {
      {
        const { unmount } = render(<SelectExample geometry="rounded" />)
        const select = screen.getByTestId("select")

        expect(select).toHaveClass(selectStyles["select--rounded"])

        unmount()
      }

      {
        const { unmount } = render(<SelectExample geometry="round" />)
        const select = screen.getByTestId("select")

        expect(select).toHaveClass(selectStyles["select--round"])

        unmount()
      }

      {
        render(<SelectExample geometry="orthogonal" />)
        const select = screen.getByTestId("select")

        expect(select).not.toHaveClass(selectStyles["select--rounded"])
        expect(select).not.toHaveClass(selectStyles["select--round"])
      }
    })

    it("responds to canonical disabled prop.", () => {
      render(<SelectExample isDisabled />)

      expect(document.querySelector("[data-disabled]")).toBeInTheDocument()
    })

    it("responds to isOpen prop.", () => {
      render(<SelectExample isOpen={false} />)

      expect(screen.queryByRole("option", { name: "Option 1" })).toBeNull()
    })

    it("responds to form element status props.", () => {
      {
        const { unmount } = render(<SelectExample errorState />)
        const triggerButton = screen.getByTestId("button")

        expect(triggerButton).toHaveStyle({ border: "1px solid var(--cui-validation-error-border)" })

        unmount()
      }

      {
        const { unmount } = render(<SelectExample warningState />)
        const triggerButton = screen.getByTestId("button")

        expect(triggerButton).toHaveStyle({ border: "1px solid var(--cui-validation-warning-border)" })

        unmount()
      }

      {
        render(<SelectExample successState />)
        const triggerButton = screen.getByTestId("button")

        expect(triggerButton).toHaveStyle({ border: "1px solid var(--cui-validation-success-border)" })
      }
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<SelectExample errorState warningState successState />)
      const triggerButton = screen.getByTestId("button")

      expect(triggerButton).toHaveStyle({ border: "1px solid var(--cui-validation-error-border)" })
    })

    it("responds to custom style props.", async () => {
      const user = userEvent.setup()
      render(
        <SelectExample
          customStyles={{ backgroundColor: "turquoise" }}
          customSelectedItemStyles={{ backgroundColor: "blue" }}
          customSelectedItemTextStyles={{ color: "red" }}
          customOptionsListStyles={{ backgroundColor: "orange" }}
        />,
      )

      const triggerButton = screen.getByTestId("button")

      await user.click(triggerButton)
      const listOptions = await screen.findAllByRole("option")
      await user.click(listOptions[0])
      await user.click(triggerButton)

      const select = screen.getByTestId("select")
      const selectedItem = screen.getByTestId("select-value")
      const optionsList = screen.getByRole("dialog")

      expect(select).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      expect(triggerButton).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(selectedItem).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(optionsList).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
    })

    it("renders its default icon and custom ComponentIcon override.", () => {
      const { rerender } = render(<SelectExample />)

      expect(screen.getByTestId("button").querySelector("svg")).toBeInTheDocument()

      rerender(<SelectExample ComponentIcon={<span data-testid="custom-select-icon">S</span>} />)

      expect(screen.getByTestId("custom-select-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <SelectExample
          height={50}
          width={150}
          customClassName="legacy-select-class"
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-select-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )

      const select = screen.getByTestId("select")

      expect(select).toHaveClass(selectStyles.select)
      expect(select).toHaveClass("legacy-select-class")
      expect(select).toHaveClass("native-select-class")
      expect(select).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <SelectExample
          height={50}
          width={150}
          textSize={SELECT_SIZE__SM}
          geometry="round"
          placement="top"
          errorState
          warningState
          successState
          isOpen={false}
          isDisabled={false}
          emptyListMessage="Nothing here"
          shouldFocusWrap={false}
          ComponentIcon={<span data-testid="custom-select-icon">S</span>}
          customClassName="legacy-select-class"
          customStyles={{ marginTop: 5 }}
          customSelectedItemStyles={{ marginTop: 5 }}
          customSelectedItemTextStyles={{ marginTop: 5 }}
          customOptionsListStyles={{ marginTop: 5 }}
        />,
      )

      const select = screen.getByTestId("select")

      expect(select).not.toHaveAttribute("height")
      expect(select).not.toHaveAttribute("width")
      expect(select).not.toHaveAttribute("textsize")
      expect(select).not.toHaveAttribute("geometry")
      expect(select).not.toHaveAttribute("placement")
      expect(select).not.toHaveAttribute("errorstate")
      expect(select).not.toHaveAttribute("warningstate")
      expect(select).not.toHaveAttribute("successstate")
      expect(select).not.toHaveAttribute("isopen")
      expect(select).not.toHaveAttribute("isdisabled")
      expect(select).not.toHaveAttribute("emptylistmessage")
      expect(select).not.toHaveAttribute("shouldfocuswrap")
      expect(select).not.toHaveAttribute("componenticon")
      expect(select).not.toHaveAttribute("customclassname")
      expect(select).not.toHaveAttribute("customstyles")
      expect(select).not.toHaveAttribute("customselecteditemstyles")
      expect(select).not.toHaveAttribute("customselecteditemtextstyles")
      expect(select).not.toHaveAttribute("customoptionsliststyles")
    })
  })
})
