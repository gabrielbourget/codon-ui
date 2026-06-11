import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import Switch from "../Switch"
import styles from "../SwitchStyles.module.css"

const switchStylesSource = readFileSync("src/components/Switch/SwitchStyles.module.css", "utf8")

describe("<Switch />", () => {
  it("renders the default switch root.", () => {
    render(<Switch />)

    expect(screen.getByTestId("switch")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Switch height={30} width={30} />)

      expect(screen.getByTestId("switch-track")).toHaveStyle({ height: "30px", width: "30px" })
    })

    it("responds to color props.", () => {
      render(<Switch indicatorColor="blue" trackColor="red" />)

      const switchComponent = screen.getByTestId("switch")

      expect(switchComponent.style.getPropertyValue("--switch-track-color")).toBe("red")
      expect(switchComponent.style.getPropertyValue("--switch-track-selected-color-fallback")).toBe("red")
      expect(switchComponent.style.getPropertyValue("--switch-indicator-color")).toBe("blue")
      expect(switchComponent.style.getPropertyValue("--switch-indicator-selected-color")).toBe("blue")
    })

    it("responds to invertColorsOnToggle.", async () => {
      const user = userEvent.setup()

      render(<Switch invertColorsOnToggle showBorder />)

      const switchComponent = screen.getByTestId("switch")
      const track = screen.getByTestId("switch-track")
      const indicator = screen.getByTestId("switch-indicator")

      expect(switchComponent).not.toHaveAttribute("data-selected")
      expect(track).toHaveClass(styles["_switch__track--showBorder--invertColorsOnToggle--fallback"])
      expect(indicator).toHaveClass(styles["_switch__indicator--invertColorsOnToggle"])

      await user.click(screen.getByRole("switch"))

      expect(switchComponent).toHaveAttribute("data-selected")
    })

    it("responds to showBorder.", () => {
      const { rerender } = render(<Switch showBorder />)

      let track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track"])
      expect(track).toHaveClass(styles["_switch__track--showBorder"])

      rerender(<Switch />)

      track = screen.getByTestId("switch-track")
      expect(track).not.toHaveClass(styles["_switch__track--showBorder"])
    })

    it("keeps pressed selectors pointed at rendered track classes.", () => {
      expect(switchStylesSource).toContain("._switch[data-pressed] ._switch__track")
      expect(switchStylesSource).toContain("._switch[data-pressed] ._switch__track--showBorder")
      expect(switchStylesSource).not.toContain("._switch[data-pressed] .switch__track")
    })

    it("keeps selected order fallbacks on canonical CUI palette variables.", () => {
      expect(switchStylesSource).toContain("var(--switch-track-selected-color-primary, var(--cui-color-primary-500))")
      expect(switchStylesSource).toContain(
        "var(--switch-track-selected-color-secondary, var(--cui-color-secondary-500))",
      )
      expect(switchStylesSource).toContain("var(--switch-track-selected-color-tertiary, var(--cui-color-tertiary-500))")
      expect(switchStylesSource).toContain(
        "var(--switch-track-selected-color-quaternary, var(--cui-color-quaternary-500))",
      )
      expect(switchStylesSource).toContain(
        "var(--switch-track-selected-color-quintenary, var(--cui-color-quintenary-500))",
      )
      expect(switchStylesSource).not.toMatch(/var\(--(?:primary|secondary|tertiary|quaternary|quintenary)\)/u)
    })

    it("responds to canonical disabled and readonly props.", () => {
      const { rerender } = render(<Switch isDisabled />)
      const switchComponent = screen.getByTestId("switch")

      expect(switchComponent).toHaveAttribute("data-disabled", "true")

      rerender(<Switch isReadOnly />)

      expect(switchComponent).toHaveAttribute("data-readonly", "true")
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Switch geometry="rounded" />)

      let track = screen.getByTestId("switch-track")
      let indicator = screen.getByTestId("switch-indicator")
      expect(track).toHaveClass(styles["_switch__track--rounded"])
      expect(indicator).toHaveClass(styles["_switch__indicator--rounded"])

      rerender(<Switch geometry="round" />)

      track = screen.getByTestId("switch-track")
      indicator = screen.getByTestId("switch-indicator")
      expect(track).toHaveClass(styles["_switch__track--round"])
      expect(indicator).toHaveClass(styles["_switch__indicator--round"])

      rerender(<Switch geometry="orthogonal" />)

      track = screen.getByTestId("switch-track")
      indicator = screen.getByTestId("switch-indicator")
      expect(track).not.toHaveClass(styles["_switch__track--rounded"])
      expect(indicator).not.toHaveClass(styles["_switch__indicator--rounded"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Switch order="primary" />)

      let track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track--primary"])

      rerender(<Switch order="secondary" />)

      track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track--secondary"])

      rerender(<Switch order="tertiary" />)

      track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track--tertiary"])

      rerender(<Switch order="quaternary" />)

      track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track--quaternary"])

      rerender(<Switch order="quintenary" />)

      track = screen.getByTestId("switch-track")
      expect(track).toHaveClass(styles["_switch__track--quintenary"])
    })

    it("responds to raised indicator props.", () => {
      const { rerender } = render(<Switch />)

      let indicator = screen.getByTestId("switch-indicator")
      expect(indicator).toHaveClass(styles["_switch__indicator--raised"])

      rerender(<Switch raised={false} />)

      indicator = screen.getByTestId("switch-indicator")
      expect(indicator).not.toHaveClass(styles["_switch__indicator--raised"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Switch />)

      let indicator = screen.getByTestId("switch-indicator")
      expect(indicator).toHaveClass(styles["_switch__indicator--applyFocusStyle"])
      expect(indicator).toHaveClass(styles["_switch__indicator--offsetFocusRing"])

      rerender(<Switch enableFocusStyle={false} offsetFocusRing={false} />)

      indicator = screen.getByTestId("switch-indicator")
      expect(indicator).not.toHaveClass(styles["_switch__indicator--applyFocusStyle"])
      expect(indicator).not.toHaveClass(styles["_switch__indicator--offsetFocusRing"])
    })

    it("responds to on and off icon props.", () => {
      const { rerender } = render(<Switch />)

      let onIcon = screen.queryByTestId("switch-icon-on")
      let offIcon = screen.queryByTestId("switch-icon-off")
      expect(onIcon).toBeNull()
      expect(offIcon).toBeNull()

      rerender(<Switch showOnOffIcons />)

      onIcon = screen.queryByTestId("switch-icon-on")
      offIcon = screen.queryByTestId("switch-icon-off")
      expect(onIcon).not.toBeNull()
      expect(offIcon).not.toBeNull()
      expect(onIcon?.querySelector("svg")).toBeInTheDocument()
      expect(offIcon?.querySelector("svg")).toBeInTheDocument()

      rerender(
        <Switch
          showOnOffIcons
          iconOn={<span data-testid="custom-switch-icon-on">On</span>}
          iconOff={<span data-testid="custom-switch-icon-off">Off</span>}
        />,
      )
      expect(screen.getByTestId("custom-switch-icon-on")).toBeInTheDocument()
      expect(screen.getByTestId("custom-switch-icon-off")).toBeInTheDocument()

      rerender(<Switch showOnOffIcons iconOn={<span data-testid="custom-switch-icon-on">On</span>} />)

      onIcon = screen.getByTestId("switch-icon-on")
      offIcon = screen.getByTestId("switch-icon-off")
      expect(onIcon).toContainElement(screen.getByTestId("custom-switch-icon-on"))
      expect(offIcon.querySelector("svg")).toBeInTheDocument()

      rerender(<Switch showOnOffIcons iconOff={null} />)

      offIcon = screen.getByTestId("switch-icon-off")
      expect(offIcon).toBeEmptyDOMElement()
    })

    it("responds to left and right content props.", () => {
      render(
        <Switch
          leftContent={<span data-testid="switch-left-content">Left Content</span>}
          rightContent={<span data-testid="switch-right-content">Right Content</span>}
        />,
      )

      const leftContent = screen.getByTestId("switch-left-content")
      const track = screen.getByTestId("switch-track")
      const rightContent = screen.getByTestId("switch-right-content")

      expect(leftContent).toHaveTextContent(/left content/i)
      expect(rightContent).toHaveTextContent(/right content/i)
      expect(leftContent.compareDocumentPosition(track)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(track.compareDocumentPosition(rightContent)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })

    it("responds to custom style props.", () => {
      render(
        <Switch
          customStyles={{ height: 40, width: 80 }}
          customIndicatorStyles={{ backgroundColor: "blue" }}
          customTrackStyles={{ backgroundColor: "red" }}
        />,
      )

      const switchComponent = screen.getByTestId("switch")
      const track = screen.getByTestId("switch-track")
      const indicator = screen.getByTestId("switch-indicator")

      expect(switchComponent).toHaveStyle({ height: "40px", width: "80px" })
      expect(track).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(indicator).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <Switch
          height={30}
          width={60}
          trackColor="red"
          customStyles={{ marginTop: 5 }}
          className="native-switch-class"
          style={{ width: 80, marginBottom: 10 }}
        />,
      )

      const switchComponent = screen.getByTestId("switch")

      expect(switchComponent).toHaveClass(styles._switch)
      expect(switchComponent).toHaveClass("native-switch-class")
      expect(switchComponent.style.getPropertyValue("--switch-track-color")).toBe("red")
      expect(switchComponent).toHaveStyle({
        height: "30px",
        width: "80px",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Switch
          height={30}
          width={60}
          trackColor="red"
          indicatorColor="blue"
          invertColorsOnToggle
          showBorder
          geometry="round"
          order="primary"
          raised={false}
          enableFocusStyle={false}
          offsetFocusRing={false}
          showOnOffIcons
          customStyles={{ marginTop: 5 }}
          customTrackStyles={{ backgroundColor: "red" }}
          customIndicatorStyles={{ backgroundColor: "blue" }}
        />,
      )

      const switchComponent = screen.getByTestId("switch")

      expect(switchComponent).not.toHaveAttribute("trackcolor")
      expect(switchComponent).not.toHaveAttribute("indicatorcolor")
      expect(switchComponent).not.toHaveAttribute("invertcolorsontoggle")
      expect(switchComponent).not.toHaveAttribute("showborder")
      expect(switchComponent).not.toHaveAttribute("customstyles")
      expect(switchComponent).not.toHaveAttribute("customtrackstyles")
      expect(switchComponent).not.toHaveAttribute("customindicatorstyles")
    })
  })
})
