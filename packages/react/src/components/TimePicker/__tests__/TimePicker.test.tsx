import { render, screen } from "@testing-library/react"
import type { TimeValue } from "react-aria-components"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import { TIME_PICKER_SIZE__LG, TIME_PICKER_SIZE__MD, TIME_PICKER_SIZE__SM, type TTimePickerProps } from "../helpers"
import TimePicker from "../TimePicker"
import styles from "../TimePickerStyles.module.css"

const renderTimePicker = (props: Partial<TTimePickerProps<TimeValue>> = {}) =>
  render(<TimePicker aria-label="time-picker" {...props} />)

const getTimePicker = () => screen.getByTestId("time-picker")
const getTimePickerInputIconGroup = () => screen.getByRole("group", { name: "TimePicker Input Icon Group" })
const getTimePickerInput = () => screen.getByRole("group", { name: "time-picker" })

describe("<TimePicker />", () => {
  it("renders.", () => {
    renderTimePicker()

    const timePicker = getTimePicker()
    const inputIconGroup = getTimePickerInputIconGroup()
    const timePickerInput = getTimePickerInput()

    expect(timePicker).toBeInTheDocument()
    expect(timePicker).toHaveClass(styles.timePicker)
    expect(inputIconGroup).toHaveClass(styles.inputIconGroup)
    expect(inputIconGroup).toHaveClass(styles["inputIconGroup--rounded"])
    expect(timePickerInput).toHaveClass(styles.timeInput)
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      renderTimePicker({ height: 50, width: 150 })

      expect(getTimePicker()).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      const textSizeToExpectedClassMap = {
        [TIME_PICKER_SIZE__SM]: "b11",
        [TIME_PICKER_SIZE__MD]: "b10",
        [TIME_PICKER_SIZE__LG]: "b9",
      } as const

      const runCase = (textSize: keyof typeof textSizeToExpectedClassMap) => {
        const { unmount } = renderTimePicker({ textSize })

        const expectedClassName = textStyles[textSizeToExpectedClassMap[textSize]]
        const spinbuttons = screen.getAllByRole("spinbutton")

        expect(spinbuttons.length).toBeGreaterThan(0)
        spinbuttons.forEach((spinbutton) => expect(spinbutton).toHaveClass(expectedClassName))

        unmount()
      }

      runCase(TIME_PICKER_SIZE__SM)
      runCase(TIME_PICKER_SIZE__MD)
      runCase(TIME_PICKER_SIZE__LG)
    })

    it("responds to corner geometry props.", () => {
      const { unmount } = renderTimePicker({ geometry: "rounded" })

      let inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--rounded"])

      unmount()

      const { unmount: unmountRound } = renderTimePicker({ geometry: "round" })
      inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--round"])

      unmountRound()

      renderTimePicker({ geometry: "orthogonal" })
      inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--rounded"])
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--round"])
    })

    it("responds to focus props.", () => {
      const { unmount } = renderTimePicker()

      let inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--applyFocusStyle"])
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--offsetFocusRing"])

      unmount()

      renderTimePicker({ enableFocusStyle: false, offsetFocusRing: false })
      inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--noFocusStyle"])
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--applyFocusStyle"])
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      renderTimePicker({ isDisabled: true })

      expect(getTimePicker()).toHaveAttribute("data-disabled", "true")
    })

    it("responds to canonical readonly prop.", () => {
      renderTimePicker({ isReadOnly: true })

      expect(getTimePicker()).toHaveAttribute("data-readonly", "true")
    })

    it("forwards granularity to the underlying time field.", () => {
      renderTimePicker({ granularity: "second" })

      expect(screen.getAllByRole("spinbutton")).toHaveLength(3)
    })

    it("responds to form element status props.", () => {
      const { unmount } = renderTimePicker({ errorState: true })

      let inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--errorState"])

      unmount()

      const { unmount: unmountWarning } = renderTimePicker({ warningState: true })
      inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--warningState"])

      unmountWarning()

      renderTimePicker({ successState: true })
      inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      renderTimePicker({ errorState: true, warningState: true, successState: true })

      const inputIconGroup = getTimePickerInputIconGroup()
      expect(inputIconGroup).toHaveClass(styles["inputIconGroup--errorState"])
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--warningState"])
      expect(inputIconGroup).not.toHaveClass(styles["inputIconGroup--successState"])
    })

    it("responds to custom style props.", () => {
      renderTimePicker({
        customStyles: { backgroundColor: "turquoise", borderRadius: 0 },
        customInputStyles: { backgroundColor: "orange" },
        customInputIconGroupStyles: { backgroundColor: "blue" },
      })

      const timePicker = getTimePicker()
      const timePickerInput = getTimePickerInput()
      const inputIconGroup = getTimePickerInputIconGroup()

      expect(timePicker).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(timePickerInput).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(inputIconGroup).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("accepts custom labels for its internal control group.", () => {
      renderTimePicker({ labels: { inputIconGroupAriaLabel: "Localized time input controls" } })

      expect(screen.getByRole("group", { name: "Localized time input controls" })).toBeInTheDocument()
    })

    it("renders a custom icon when ComponentIcon is provided.", () => {
      renderTimePicker({ ComponentIcon: <span data-testid="custom-time-picker-icon">Clock</span> })

      expect(screen.getByTestId("custom-time-picker-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      renderTimePicker({
        customStyles: { color: "turquoise", marginTop: 5 },
        className: "native-time-picker-class",
        style: { color: "tomato", marginBottom: 10 },
      })

      const timePicker = getTimePicker()
      expect(timePicker).toHaveClass(styles.timePicker)
      expect(timePicker).toHaveClass("native-time-picker-class")
      expect(timePicker).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      renderTimePicker({
        height: 50,
        width: 150,
        textSize: TIME_PICKER_SIZE__SM,
        geometry: "round",
        hourCycle: 12,
        granularity: "minute",
        shouldForceLeadingZeros: false,
        enableFocusStyle: false,
        offsetFocusRing: false,
        isDisabled: false,
        isReadOnly: false,
        errorState: true,
        warningState: true,
        successState: true,
        ComponentIcon: <span>Clock</span>,
        customStyles: { marginTop: 5 },
        customInputStyles: { backgroundColor: "orange" },
        customInputIconGroupStyles: { backgroundColor: "blue" },
        labels: { inputIconGroupAriaLabel: "Time controls" },
      })

      const timePicker = getTimePicker()

      expect(timePicker).not.toHaveAttribute("height")
      expect(timePicker).not.toHaveAttribute("width")
      expect(timePicker).not.toHaveAttribute("textsize")
      expect(timePicker).not.toHaveAttribute("geometry")
      expect(timePicker).not.toHaveAttribute("hourcycle")
      expect(timePicker).not.toHaveAttribute("granularity")
      expect(timePicker).not.toHaveAttribute("shouldforceleadingzeros")
      expect(timePicker).not.toHaveAttribute("enablefocusstyle")
      expect(timePicker).not.toHaveAttribute("offsetfocusring")
      expect(timePicker).not.toHaveAttribute("isdisabled")
      expect(timePicker).not.toHaveAttribute("isreadonly")
      expect(timePicker).not.toHaveAttribute("errorstate")
      expect(timePicker).not.toHaveAttribute("warningstate")
      expect(timePicker).not.toHaveAttribute("successstate")
      expect(timePicker).not.toHaveAttribute("componenticon")
      expect(timePicker).not.toHaveAttribute("customstyles")
      expect(timePicker).not.toHaveAttribute("custominputstyles")
      expect(timePicker).not.toHaveAttribute("custominputicongroupstyles")
      expect(timePicker).not.toHaveAttribute("labels")
    })
  })
})
