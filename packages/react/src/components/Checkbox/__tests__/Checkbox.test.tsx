import { readFileSync } from "node:fs"

import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import Checkbox from "../Checkbox"
import styles from "../CheckboxStyles.module.css"

const checkboxStylesSource = readFileSync("src/components/Checkbox/CheckboxStyles.module.css", "utf8")

describe("<Checkbox />", () => {
  it("renders.", () => {
    render(<Checkbox />)

    const checkbox = screen.getByTestId("checkbox")
    expect(checkbox).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Checkbox height={30} width={30} />)

      const checkbox = screen.getByTestId("checkbox")
      expect(checkbox).toHaveStyle({ height: "30px", width: "30px" })
    })

    it("responds to color props.", () => {
      render(<Checkbox color="red" />)

      const checkbox = screen.getByTestId("checkbox")
      expect(checkbox).toHaveStyle({ color: "rgb(255, 0, 0)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Checkbox geometry="rounded" />)
      const checkboxShape = screen.getByTestId("checkbox-shape")
      expect(checkboxShape).toHaveClass(styles["shape--rounded"])

      rerender(<Checkbox geometry="round" />)
      expect(checkboxShape).toHaveClass(styles["shape--round"])

      rerender(<Checkbox geometry="orthogonal" />)
      expect(checkboxShape).not.toHaveClass(styles["shape--rounded"])
      expect(checkboxShape).not.toHaveClass(styles["shape--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Checkbox order="primary" />)
      const checkboxShape = screen.getByTestId("checkbox-shape")
      expect(checkboxShape).toHaveClass(styles["shape--primary"])

      rerender(<Checkbox order="secondary" />)
      expect(checkboxShape).toHaveClass(styles["shape--secondary"])

      rerender(<Checkbox order="tertiary" />)
      expect(checkboxShape).toHaveClass(styles["shape--tertiary"])

      rerender(<Checkbox order="quaternary" />)
      expect(checkboxShape).toHaveClass(styles["shape--quaternary"])

      rerender(<Checkbox order="quintenary" />)
      expect(checkboxShape).toHaveClass(styles["shape--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(checkboxStylesSource).toContain("var(--cui-color-primary-500)")
      expect(checkboxStylesSource).toContain("var(--cui-color-primary-600)")
      expect(checkboxStylesSource).toContain("var(--cui-color-primary-700)")
      expect(checkboxStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("keeps selected order interactions on semantic action colors.", () => {
      expect(checkboxStylesSource).toContain(
        ".checkbox[data-selected] .shape--primary {\n  --checkbox-selected-foreground: var(--cui-action-primary-foreground);\n  background-color: var(--cui-action-primary-background)",
      )
      expect(checkboxStylesSource).toContain(
        ".checkbox[data-selected][data-hovered] .shape--primary {\n  background-color: var(--cui-action-primary-background-hover)",
      )
      expect(checkboxStylesSource).toContain(
        ".checkbox[data-selected][data-pressed] .shape--primary {\n  background-color: var(--cui-action-primary-background-pressed)",
      )
      expect(checkboxStylesSource).not.toContain(
        ".checkbox[data-selected][data-hovered] .shape--primary {\n  background-color: var(--cui-color-primary-400)",
      )
      expect(checkboxStylesSource).not.toContain(
        ".checkbox[data-selected][data-pressed] .shape--primary {\n  background-color: var(--cui-color-primary-300)",
      )
    })

    it("keeps selected order icons on semantic action foreground pairs.", () => {
      expect(checkboxStylesSource).toContain(
        ".checkbox[data-selected] .shape--quintenary {\n  --checkbox-selected-foreground: var(--cui-action-quintenary-foreground)",
      )
      expect(checkboxStylesSource).toContain(
        "stroke: var(--checkbox-selected-foreground, var(--cui-control-selected-foreground))",
      )
      expect(checkboxStylesSource).toContain(
        "fill: var(--checkbox-selected-foreground, var(--cui-control-selected-foreground))",
      )
      expect(checkboxStylesSource).not.toContain("stroke: var(--cui-control-selected-foreground)")
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Checkbox />)
      const checkbox = screen.getByTestId("checkbox")
      const checkboxShape = screen.getByTestId("checkbox-shape")

      fireEvent.focus(checkbox)

      expect(checkboxShape).toHaveClass(styles["shape--applyFocusStyle"])
      expect(checkboxShape).toHaveClass(styles["shape--offsetFocusRing"])

      rerender(<Checkbox enableFocusStyle={false} offsetFocusRing={false} />)
      fireEvent.blur(checkbox)

      expect(checkboxShape).not.toHaveClass(styles["shape--applyFocusStyle"])
      expect(checkboxShape).not.toHaveClass(styles["shape--offsetFocusRing"])
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Checkbox raised />)
      const checkboxShape = screen.getByTestId("checkbox-shape")
      expect(checkboxShape).toHaveClass(styles["shape--raised"])

      rerender(<Checkbox raised={false} />)
      expect(checkboxShape).not.toHaveClass(styles["shape--raised"])
    })

    it("responds to canonical disabled and readonly props.", () => {
      const { rerender } = render(<Checkbox isDisabled />)
      const checkbox = screen.getByTestId("checkbox")
      expect(checkbox).toHaveAttribute("data-disabled", "true")

      rerender(<Checkbox isReadOnly />)
      expect(checkbox).toHaveAttribute("data-readonly", "true")
    })

    it("responds to canonical indeterminate prop.", () => {
      render(<Checkbox isIndeterminate />)
      const checkbox = screen.getByTestId("checkbox")

      expect(checkbox).toHaveAttribute("data-indeterminate", "true")
      expect(document.querySelector("[data-icon='line']")).toBeInTheDocument()
    })

    it("responds to conditional selection icon visibility prop.", () => {
      const { rerender } = render(<Checkbox defaultSelected showIcon />)
      let checkboxIcon = document.querySelector("[data-icon='check']")
      expect(checkboxIcon).toBeInTheDocument()

      rerender(<Checkbox defaultSelected showIcon={false} />)
      checkboxIcon = document.querySelector("[data-icon='check']")
      expect(checkboxIcon).toBeNull()
    })

    it("renders the selection icon within the centered icon view box.", () => {
      render(<Checkbox defaultSelected />)

      expect(document.querySelector("[data-icon='check']")).toHaveAttribute("d", "M3 9.45833L6.69231 13.125L15 4.875")
    })

    it("responds to custom styles prop.", () => {
      render(<Checkbox customStyles={{ color: "turquoise", borderRadius: 0 }} />)

      const checkbox = screen.getByTestId("checkbox")
      expect(checkbox).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <Checkbox
          height={30}
          width={30}
          color="turquoise"
          customStyles={{ marginTop: 5 }}
          className="native-checkbox-class"
          style={{ color: "tomato", marginBottom: 10 }}
        />,
      )

      const checkbox = screen.getByTestId("checkbox")
      const checkboxShape = screen.getByTestId("checkbox-shape")

      expect(checkbox).toHaveClass(styles.checkbox)
      expect(checkbox).toHaveClass("native-checkbox-class")
      expect(checkbox).toHaveStyle({
        height: "30px",
        width: "30px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
      expect(checkboxShape).toHaveStyle({
        height: "30px",
        width: "30px",
        color: "rgb(64, 224, 208)",
        marginTop: "5px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Checkbox
          height={30}
          width={30}
          geometry="round"
          color="turquoise"
          raised
          order="primary"
          enableFocusStyle={false}
          offsetFocusRing={false}
          showIcon={false}
          customStyles={{ marginTop: 5 }}
        />,
      )

      const checkbox = screen.getByTestId("checkbox")

      expect(checkbox).not.toHaveAttribute("geometry")
      expect(checkbox).not.toHaveAttribute("color")
      expect(checkbox).not.toHaveAttribute("raised")
      expect(checkbox).not.toHaveAttribute("order")
      expect(checkbox).not.toHaveAttribute("enablefocusstyle")
      expect(checkbox).not.toHaveAttribute("offsetfocusring")
      expect(checkbox).not.toHaveAttribute("showicon")
      expect(checkbox).not.toHaveAttribute("customstyles")
    })
  })

  describe("interactions", () => {
    it("responds when hovering over it.", async () => {
      const user = userEvent.setup()

      render(<Checkbox />)
      const checkbox = screen.getByTestId("checkbox")

      await user.hover(checkbox)

      expect(checkbox).toHaveAttribute("data-hovered", "true")
    })

    it("responds when pressing it.", () => {
      render(<Checkbox />)
      const checkbox = screen.getByTestId("checkbox")

      fireEvent.mouseDown(checkbox)

      expect(checkbox).toHaveAttribute("data-pressed", "true")
    })
  })
})
