import { readFileSync } from "node:fs"

import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import Text from "../../Text/Text"
import type { TToggleButtonProps } from "../helpers"
import ToggleButton from "../ToggleButton"
import styles from "../ToggleButtonStyles.module.css"

const toggleButtonStylesSource = readFileSync("src/components/ToggleButton/ToggleButtonStyles.module.css", "utf8")

const toggleButtonThemeOrders: NonNullable<TToggleButtonProps["order"]>[] = [
  "secondary",
  "tertiary",
  "quaternary",
  "quintenary",
]

const ToggleButtonExample = (props: Partial<TToggleButtonProps> = {}) => {
  return (
    <ToggleButton order="primary" aria-label="Toggle Text" {...props}>
      <Text fontWeight="bold" elementType="h1">
        Toggle Text
      </Text>
    </ToggleButton>
  )
}

describe("<ToggleButton />", () => {
  it("renders.", () => {
    render(<ToggleButtonExample />)

    expect(screen.getByTestId("toggle-button")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<ToggleButtonExample height={50} width={150} />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      render(<ToggleButtonExample color="red" />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<ToggleButtonExample geometry="rounded" />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles["toggleButton--rounded"])

      rerender(<ToggleButtonExample geometry="round" />)
      expect(toggleButton).toHaveClass(styles["toggleButton--round"])

      rerender(<ToggleButtonExample geometry="orthogonal" />)
      expect(toggleButton).not.toHaveClass(styles["toggleButton--rounded"])
      expect(toggleButton).not.toHaveClass(styles["toggleButton--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<ToggleButtonExample order="primary" />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles["toggleButton--primary"])

      toggleButtonThemeOrders.forEach((orderCode) => {
        rerender(<ToggleButtonExample order={orderCode} />)
        expect(toggleButton).toHaveClass(styles[`toggleButton--${orderCode}`])
      })
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(toggleButtonStylesSource).toContain("var(--cui-color-primary-100)")
      expect(toggleButtonStylesSource).toContain("var(--cui-color-primary-200)")
      expect(toggleButtonStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("keeps selected order styles on semantic action foreground/background pairs.", () => {
      expect(toggleButtonStylesSource).toContain(
        ".toggleButton--primary[data-selected] {\n  background-color: var(--cui-action-primary-background);\n  border: 1px solid var(--cui-action-primary-border)",
      )
      expect(toggleButtonStylesSource).toContain(
        ".toggleButton--quintenary[data-selected] > * {\n  color: var(--cui-action-quintenary-foreground)",
      )
      expect(toggleButtonStylesSource).toContain(
        ".toggleButton--quintenary[data-selected][data-pressed] {\n  background-color: var(--cui-action-quintenary-background-pressed)",
      )
      expect(toggleButtonStylesSource).not.toContain(
        ".toggleButton--quintenary[data-selected] > * {\n  color: var(--white)",
      )
    })

    it("uses the semantic fallback style when no order is provided.", () => {
      render(
        <ToggleButton aria-label="Toggle Text">
          <Text fontWeight="bold" elementType="h1">
            Toggle Text
          </Text>
        </ToggleButton>,
      )
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles["toggleButton--no-bg-color-provided-fallback"])
      expect(toggleButton).not.toHaveClass(styles["toggleButton--primary"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<ToggleButtonExample />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles["toggleButton--applyFocusStyle"])
      expect(toggleButton).toHaveClass(styles["toggleButton--offsetFocusRing"])

      rerender(<ToggleButtonExample enableFocusStyle={false} offsetFocusRing={false} />)
      expect(toggleButton).toHaveClass(styles["toggleButton--noFocusStyle"])
      expect(toggleButton).not.toHaveClass(styles["toggleButton--applyFocusStyle"])
      expect(toggleButton).not.toHaveClass(styles["toggleButton--offsetFocusRing"])
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<ToggleButtonExample raised />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles["toggleButton--raised"])

      rerender(<ToggleButtonExample raised={false} />)
      expect(toggleButton).not.toHaveClass(styles["toggleButton--raised"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<ToggleButtonExample isDisabled />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveAttribute("data-disabled", "true")
    })

    it("responds to custom styles prop.", () => {
      render(<ToggleButtonExample customStyles={{ color: "turquoise", borderRadius: 0 }} />)
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <ToggleButtonExample
          height={50}
          width={150}
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-toggle-button-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).toHaveClass(styles.toggleButton)
      expect(toggleButton).toHaveClass(styles["toggleButton--primary"])
      expect(toggleButton).toHaveClass("native-toggle-button-class")
      expect(toggleButton).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <ToggleButtonExample
          height={50}
          width={150}
          color="turquoise"
          geometry="round"
          order="primary"
          enableFocusStyle={false}
          offsetFocusRing={false}
          raised
          customStyles={{ marginTop: 5 }}
        />,
      )
      const toggleButton = screen.getByTestId("toggle-button")

      expect(toggleButton).not.toHaveAttribute("color")
      expect(toggleButton).not.toHaveAttribute("geometry")
      expect(toggleButton).not.toHaveAttribute("order")
      expect(toggleButton).not.toHaveAttribute("enablefocusstyle")
      expect(toggleButton).not.toHaveAttribute("offsetfocusring")
      expect(toggleButton).not.toHaveAttribute("raised")
      expect(toggleButton).not.toHaveAttribute("customstyles")
    })
  })

  describe("interactions", () => {
    it("responds when hovering over it.", async () => {
      const user = userEvent.setup()

      render(<ToggleButtonExample />)
      const toggleButton = screen.getByTestId("toggle-button")

      await user.hover(toggleButton)

      expect(toggleButton).toHaveAttribute("data-hovered", "true")
    })

    it("responds when pressing it.", () => {
      render(<ToggleButtonExample />)
      const toggleButton = screen.getByTestId("toggle-button")

      fireEvent.mouseDown(toggleButton)

      expect(toggleButton).toHaveAttribute("data-pressed", "true")
    })
  })
})
