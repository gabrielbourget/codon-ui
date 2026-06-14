import { readFileSync } from "node:fs"

import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../../tokens/theme-order"
import Button from "../Button"
import styles from "../ButtonStyles.module.css"
import { COLOR_MODE__FILL, COLOR_MODE__OUTLINE, type TAvailableColorModes } from "../helpers"

type TButtonTestInfo = {
  colorMode: TAvailableColorModes
  themingOrder?: TThemingOrderCode
}

const buttonStylesSource = readFileSync("src/components/Button/ButtonStyles.module.css", "utf8")

const buttonThemingOrderTestData: TButtonTestInfo[] = [
  { colorMode: COLOR_MODE__FILL, themingOrder: THEME_ORDER_CODE__SECONDARY },
  { colorMode: COLOR_MODE__FILL, themingOrder: THEME_ORDER_CODE__TERTIARY },
  { colorMode: COLOR_MODE__FILL, themingOrder: THEME_ORDER_CODE__QUATERNARY },
  { colorMode: COLOR_MODE__FILL, themingOrder: THEME_ORDER_CODE__QUINTENARY },
  { colorMode: COLOR_MODE__OUTLINE, themingOrder: THEME_ORDER_CODE__PRIMARY },
  { colorMode: COLOR_MODE__OUTLINE, themingOrder: THEME_ORDER_CODE__SECONDARY },
  { colorMode: COLOR_MODE__OUTLINE, themingOrder: THEME_ORDER_CODE__TERTIARY },
  { colorMode: COLOR_MODE__OUTLINE, themingOrder: THEME_ORDER_CODE__QUATERNARY },
  { colorMode: COLOR_MODE__OUTLINE, themingOrder: THEME_ORDER_CODE__QUINTENARY },
]

describe("<Button />", () => {
  it("renders.", () => {
    render(<Button />)

    expect(screen.getByTestId("button")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Button height={50} width={150} />)

      const buttonStyles = getComputedStyle(screen.getByTestId("button"))
      expect(buttonStyles.height).toBe("50px")
      expect(buttonStyles.width).toBe("150px")
    })

    it("responds to color mode props.", () => {
      const { rerender } = render(<Button colorMode="fill" />)
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles["button--fill"])

      rerender(<Button colorMode="outline" />)
      expect(button).toHaveClass(styles["button--outline"])

      rerender(<Button colorMode="fill" order="primary" />)
      expect(button).toHaveClass(styles["button--primary--fill"])

      rerender(<Button colorMode="outline" order="primary" />)
      expect(button).toHaveClass(styles["button--primary--outline"])
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Button geometry="rounded" />)
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles["button--rounded"])

      rerender(<Button geometry="round" />)
      expect(button).toHaveClass(styles["button--round"])

      rerender(<Button geometry="orthogonal" />)
      expect(button).not.toHaveClass(styles["button--rounded"])
      expect(button).not.toHaveClass(styles["button--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Button order="primary" colorMode="fill" />)
      const button = screen.getByTestId("button")
      expect(button).toHaveClass(styles["button--primary--fill"])

      buttonThemingOrderTestData.forEach((testData: TButtonTestInfo) => {
        const { colorMode, themingOrder } = testData
        const computedTargetClassname = `button--${themingOrder}--${colorMode}`

        rerender(<Button order={themingOrder} colorMode={colorMode} />)
        expect(button).toHaveClass(styles[computedTargetClassname])
      })
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(buttonStylesSource).toContain("var(--cui-color-primary-500)")
      expect(buttonStylesSource).toContain("var(--cui-color-primary-600)")
      expect(buttonStylesSource).toContain("var(--cui-color-primary-700)")
      expect(buttonStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("keeps interactive cursor and color transition defaults on the root button.", () => {
      expect(buttonStylesSource).toContain(".button:not([data-disabled]) {\n  cursor: pointer;")
      expect(buttonStylesSource).toContain("var(--cui-transition-color)")
    })

    it("keeps fill order styles on semantic action foreground/background pairs.", () => {
      expect(buttonStylesSource).toContain(
        ".button--primary--fill {\n  background-color: var(--cui-action-primary-background);\n  color: var(--cui-action-primary-foreground)",
      )
      expect(buttonStylesSource).toContain(
        ".button--quintenary--fill {\n  background-color: var(--cui-action-quintenary-background);\n  color: var(--cui-action-quintenary-foreground)",
      )
      expect(buttonStylesSource).toContain(
        ".button--quintenary--fill[data-pressed]:not([data-disabled]) {\n  background-color: var(--cui-action-quintenary-background-pressed)",
      )
      expect(buttonStylesSource).not.toContain(
        ".button--quintenary--fill {\n  background-color: var(--cui-color-quintenary-500);\n  color: var(--white)",
      )
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Button />)
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles["button--applyFocusStyle"])
      expect(button).toHaveClass(styles["button--offsetFocusRing"])

      rerender(<Button enableFocusStyle={false} offsetFocusRing={false} />)
      expect(button).not.toHaveClass(styles["button--applyFocusStyle"])
      expect(button).not.toHaveClass(styles["button--offsetFocusRing"])
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Button />)
      const button = screen.getByTestId("button")
      expect(button).toHaveClass(styles["button--raised"])

      rerender(<Button raised={false} />)
      expect(button).not.toHaveClass(styles["button--raised"])

      rerender(<Button raised={false} raisedOnHover />)
      expect(button).toHaveClass(styles["button--raisedOnHover"])
    })

    it("responds to isDisabled prop.", () => {
      render(<Button isDisabled />)

      const button = screen.getByTestId("button")
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute("data-disabled", "true")
    })

    it("responds to custom styles prop.", () => {
      render(<Button customStyles={{ color: "turquoise", borderRadius: 0 }} />)

      const button = screen.getByTestId("button")
      expect(button).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native and custom class names without losing computed root styles.", () => {
      render(
        <Button className={() => "native-button-class"} customClassName="custom-button-class">
          Button
        </Button>,
      )
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles.button)
      expect(button).toHaveClass("custom-button-class")
      expect(button).toHaveClass("native-button-class")
    })

    it("merges native style after custom styles without losing computed dimensions.", () => {
      render(
        <Button
          height={40}
          width={100}
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          style={{ color: "tomato", width: 120 }}
        />,
      )
      const button = screen.getByTestId("button")

      expect(button).toHaveStyle({
        height: "40px",
        width: "120px",
        color: "rgb(255, 99, 71)",
        borderRadius: 0,
      })
    })

    it("keeps native style as the final root style escape hatch for custom color variables.", () => {
      render(
        <Button
          color="rebeccapurple"
          hoverColor="plum"
          customStyles={{ backgroundColor: "turquoise", color: "white" }}
          style={{ backgroundColor: "tomato", color: "black" }}
        />,
      )
      const button = screen.getByTestId("button")

      expect(button).toHaveStyle({
        backgroundColor: "rgb(255, 99, 71)",
        color: "rgb(0, 0, 0)",
      })
      expect(button.style.getPropertyValue("--btn-bg")).toBe("tomato")
      expect(button.style.getPropertyValue("--btn-hover-bg")).toBe("plum")
    })

    it("maps color and hover color to CSS variables.", () => {
      render(<Button color="rebeccapurple" hoverColor="plum" />)
      const button = screen.getByTestId("button")

      expect(button.style.getPropertyValue("--btn-bg")).toBe("rebeccapurple")
      expect(button.style.getPropertyValue("--btn-hover-bg")).toBe("plum")
      expect(button).not.toHaveAttribute("data-hover-color")
    })

    it("maps custom outline color through border and text style.", () => {
      render(<Button color="rebeccapurple" colorMode={COLOR_MODE__OUTLINE} />)
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles["button--customOutline"])
      expect(button).toHaveStyle({
        border: "2px solid rebeccapurple",
        color: "rgb(102, 51, 153)",
      })
    })

    it("gives transparent mode precedence over themed and custom color classes.", () => {
      render(
        <Button transparent color="rebeccapurple" colorMode={COLOR_MODE__OUTLINE} order={THEME_ORDER_CODE__PRIMARY} />,
      )
      const button = screen.getByTestId("button")

      expect(button).toHaveClass(styles["button--transparent"])
      expect(button).not.toHaveClass(styles["button--customOutline"])
      expect(button).not.toHaveClass(styles["button--primary--outline"])
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Button
          color="rebeccapurple"
          colorMode={COLOR_MODE__OUTLINE}
          customClassName="custom-button-class"
          customStyles={{ marginTop: 5 }}
          enableFocusStyle={false}
          geometry="round"
          height={40}
          hoverColor="plum"
          offsetFocusRing={false}
          order={THEME_ORDER_CODE__PRIMARY}
          raised={false}
          raisedOnHover
          transparent
          width={100}
        />,
      )
      const button = screen.getByTestId("button")

      expect(button).not.toHaveAttribute("color")
      expect(button).not.toHaveAttribute("colormode")
      expect(button).not.toHaveAttribute("customclassname")
      expect(button).not.toHaveAttribute("customstyles")
      expect(button).not.toHaveAttribute("enablefocusstyle")
      expect(button).not.toHaveAttribute("geometry")
      expect(button).not.toHaveAttribute("height")
      expect(button).not.toHaveAttribute("hovercolor")
      expect(button).not.toHaveAttribute("offsetfocusring")
      expect(button).not.toHaveAttribute("order")
      expect(button).not.toHaveAttribute("raised")
      expect(button).not.toHaveAttribute("raisedonhover")
      expect(button).not.toHaveAttribute("transparent")
      expect(button).not.toHaveAttribute("width")
    })
  })

  describe("interactions", () => {
    it("responds when hovering over it.", async () => {
      const user = userEvent.setup()

      render(<Button />)
      const button = screen.getByTestId("button")

      await user.hover(button)

      expect(button).toHaveAttribute("data-hovered", "true")
    })

    it("responds when pressing it.", () => {
      render(<Button />)
      const button = screen.getByTestId("button")

      fireEvent.mouseDown(button)

      expect(button).toHaveAttribute("data-pressed", "true")
    })

    it("does not enter hover or pressed interaction state when disabled.", async () => {
      const user = userEvent.setup()

      render(<Button isDisabled hoverColor="plum" raisedOnHover />)
      const button = screen.getByTestId("button")

      await user.hover(button)
      fireEvent.mouseDown(button)

      expect(button).toHaveAttribute("data-disabled", "true")
      expect(button).not.toHaveAttribute("data-hovered")
      expect(button).not.toHaveAttribute("data-pressed")
    })
  })
})
