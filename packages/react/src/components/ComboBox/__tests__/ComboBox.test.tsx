import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import textStyles from "../../Text/TextStyles.module.css"
import ComboBox from "../ComboBox"
import styles from "../ComboBoxStyles.module.css"
import { COMBOBOX_SIZE__LG, COMBOBOX_SIZE__MD, COMBOBOX_SIZE__SM, type TComboBoxProps } from "../helpers"

type TComboBoxTestItem = {
  id: string
  name: string
}

const baseTestItems = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
const testItems = baseTestItems.map((name, index) => ({ id: `${index + 1}`, name }))

const ComboBoxExample = (props: Partial<TComboBoxProps<TComboBoxTestItem>> = {}) => {
  return (
    <ComboBox aria-label="combobox" items={testItems} {...props}>
      {(item) => {
        const comboBoxItem = item as TComboBoxTestItem

        return <ListBoxItem id={comboBoxItem.id}>{comboBoxItem.name}</ListBoxItem>
      }}
    </ComboBox>
  )
}

describe("<ComboBox />", () => {
  it("renders.", () => {
    render(<ComboBoxExample />)

    expect(screen.getByTestId("combo-box")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<ComboBoxExample height={50} width={150} />)
      const comboBox = screen.getByTestId("combo-box")

      expect(comboBox).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      render(<ComboBoxExample color="turquoise" />)
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(comboBoxGroup).toHaveStyle({ color: "rgb(64, 224, 208)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<ComboBoxExample geometry="rounded" />)
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--rounded"])

      rerender(<ComboBoxExample geometry="round" />)
      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--round"])

      rerender(<ComboBoxExample geometry="orthogonal" />)
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--rounded"])
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--round"])
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<ComboBoxExample textSize={COMBOBOX_SIZE__SM} />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(textStyles.b11)

      rerender(<ComboBoxExample textSize={COMBOBOX_SIZE__MD} />)
      expect(input).toHaveClass(textStyles.b10)

      rerender(<ComboBoxExample textSize={COMBOBOX_SIZE__LG} />)
      expect(input).toHaveClass(textStyles.b9)
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<ComboBoxExample />)
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--offsetFocusRing"])

      rerender(<ComboBoxExample enableFocusStyle={false} offsetFocusRing={false} />)
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<ComboBoxExample isDisabled />)
      const comboBox = screen.getByTestId("combo-box")

      expect(comboBox).toHaveAttribute("data-disabled", "true")
    })

    it("responds to isOpen prop.", () => {
      render(<ComboBoxExample isOpen={false} />)

      expect(screen.queryByRole("option", { name: "Option 1" })).toBeNull()
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<ComboBoxExample errorState />)
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--errorState"])

      rerender(<ComboBoxExample warningState />)
      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--warningState"])

      rerender(<ComboBoxExample successState />)
      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<ComboBoxExample errorState warningState successState />)
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(comboBoxGroup).toHaveClass(styles["inputButtonGroup--errorState"])
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--warningState"])
      expect(comboBoxGroup).not.toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("responds to custom styles prop.", () => {
      render(
        <ComboBoxExample
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          customInputButtonGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
        />,
      )

      const comboBox = screen.getByTestId("combo-box")
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })
      const input = screen.getByTestId("input")
      const button = screen.getByTestId("button")

      expect(comboBox).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(comboBoxGroup).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(input).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(button).toHaveStyle({ borderRadius: "6px" })
    })

    it("renders its default icon and custom ComponentIcon override.", () => {
      const { rerender } = render(<ComboBoxExample />)

      expect(screen.getByTestId("button").querySelector("svg")).toBeInTheDocument()

      rerender(<ComboBoxExample ComponentIcon={<span data-testid="custom-combobox-icon">C</span>} />)

      expect(screen.getByTestId("custom-combobox-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <ComboBoxExample
          height={50}
          width={150}
          color="turquoise"
          customStyles={{ marginTop: 5 }}
          className="native-combobox-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )

      const comboBox = screen.getByTestId("combo-box")

      expect(comboBox).toHaveClass(styles.comboBox)
      expect(comboBox).toHaveClass("native-combobox-class")
      expect(comboBox).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <ComboBoxExample
          height={50}
          width={150}
          color="turquoise"
          textSize={COMBOBOX_SIZE__SM}
          geometry="round"
          placement="top"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          isOpen={false}
          isDisabled={false}
          emptyListMessage="Nothing here"
          shouldFocusWrap={false}
          labels={{ triggerButtonAriaLabel: "Open" }}
          ComponentIcon={<span data-testid="custom-combobox-icon">C</span>}
          customStyles={{ marginTop: 5 }}
          customInputStyles={{ marginTop: 5 }}
          customButtonStyles={{ marginTop: 5 }}
          customInputButtonGroupStyles={{ marginTop: 5 }}
          customOptionsListStyles={{ marginTop: 5 }}
        />,
      )

      const comboBox = screen.getByTestId("combo-box")

      expect(comboBox).not.toHaveAttribute("height")
      expect(comboBox).not.toHaveAttribute("width")
      expect(comboBox).not.toHaveAttribute("color")
      expect(comboBox).not.toHaveAttribute("textsize")
      expect(comboBox).not.toHaveAttribute("geometry")
      expect(comboBox).not.toHaveAttribute("placement")
      expect(comboBox).not.toHaveAttribute("enablefocusstyle")
      expect(comboBox).not.toHaveAttribute("offsetfocusring")
      expect(comboBox).not.toHaveAttribute("errorstate")
      expect(comboBox).not.toHaveAttribute("warningstate")
      expect(comboBox).not.toHaveAttribute("successstate")
      expect(comboBox).not.toHaveAttribute("isopen")
      expect(comboBox).not.toHaveAttribute("isdisabled")
      expect(comboBox).not.toHaveAttribute("emptylistmessage")
      expect(comboBox).not.toHaveAttribute("shouldfocuswrap")
      expect(comboBox).not.toHaveAttribute("labels")
      expect(comboBox).not.toHaveAttribute("componenticon")
      expect(comboBox).not.toHaveAttribute("customstyles")
      expect(comboBox).not.toHaveAttribute("custominputstyles")
      expect(comboBox).not.toHaveAttribute("custombuttonstyles")
      expect(comboBox).not.toHaveAttribute("custominputbuttongroupstyles")
      expect(comboBox).not.toHaveAttribute("customoptionsliststyles")
    })

    it("accepts custom labels for internal copy.", () => {
      render(
        <ComboBoxExample
          items={[]}
          isOpen
          labels={{
            inputButtonGroupAriaLabel: "Localized combobox controls",
            triggerButtonAriaLabel: "Open localized choices",
            emptyListMessage: "No localized choices remain",
          }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized combobox controls" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Open localized choices" })).toBeVisible()
      expect(screen.getByText("No localized choices remain")).toBeVisible()
    })
  })
})
