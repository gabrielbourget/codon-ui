import { readFileSync } from "node:fs"

import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import DateTimeRangePicker from "../DateTimeRangePicker"
import styles from "../DateTimeRangePickerStyles.module.css"
import {
  DATETIME_RANGE_PICKER_SIZE__LG,
  DATETIME_RANGE_PICKER_SIZE__MD,
  DATETIME_RANGE_PICKER_SIZE__SM,
} from "../helpers"

const calendarStylesSource = readFileSync("src/components/DateTimeRangePicker/CalendarStyles.module.css", "utf8")

const openDateTimeRangePicker = async () => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: /DateTimeRangePicker Trigger Button/iu })

  await user.click(triggerButton)

  const popover = await screen.findByTestId("datetime-range-picker-popover")
  const dialog = await screen.findByRole("dialog")

  return { popover, dialog }
}

describe("<DateTimeRangePicker />", () => {
  it("renders.", () => {
    render(<DateTimeRangePicker aria-label="datetime-range-picker" />)
    const dateTimeRangePicker = screen.getByTestId("datetime-range-picker")

    expect(dateTimeRangePicker).toBeInTheDocument()
    expect(dateTimeRangePicker).toHaveClass(styles.dateTimePicker)
  })

  describe("props API surface", () => {
    it("responds to text size props.", () => {
      const textSizeToExpectedClassMap = {
        [DATETIME_RANGE_PICKER_SIZE__SM]: "b11",
        [DATETIME_RANGE_PICKER_SIZE__MD]: "b10",
        [DATETIME_RANGE_PICKER_SIZE__LG]: "b9",
      } as const

      const runCase = (textSize: keyof typeof textSizeToExpectedClassMap) => {
        const { baseElement, unmount } = render(
          <DateTimeRangePicker textSize={textSize} aria-label="datetime-range-picker" />,
        )

        const expectedClassName = textStyles[textSizeToExpectedClassMap[textSize]]
        const textSizeStyleTargets = baseElement.querySelectorAll("[data-textsize-target]")

        expect(textSizeStyleTargets.length).toBeGreaterThan(0)
        textSizeStyleTargets.forEach((element) => expect(element).toHaveClass(expectedClassName))

        unmount()
      }

      runCase(DATETIME_RANGE_PICKER_SIZE__SM)
      runCase(DATETIME_RANGE_PICKER_SIZE__MD)
      runCase(DATETIME_RANGE_PICKER_SIZE__LG)
    })

    it("responds to corner geometry props.", async () => {
      const { unmount } = render(<DateTimeRangePicker geometry="rounded" aria-label="datetime-range-picker" />)
      const { popover, dialog } = await openDateTimeRangePicker()

      let inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--rounded"])
      expect(popover).toHaveClass(styles["popover--rounded"])
      expect(dialog).toHaveClass(styles["dialog--rounded"])

      unmount()

      const { unmount: unmountRound } = render(
        <DateTimeRangePicker geometry="round" aria-label="datetime-range-picker" />,
      )
      const { popover: popoverRound, dialog: dialogRound } = await openDateTimeRangePicker()
      inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--round"])
      expect(popoverRound).toHaveClass(styles["popover--rounded"])
      expect(dialogRound).toHaveClass(styles["dialog--rounded"])

      unmountRound()

      render(<DateTimeRangePicker geometry="orthogonal" aria-label="datetime-range-picker" />)
      const { popover: popoverOrthogonal, dialog: dialogOrthogonal } = await openDateTimeRangePicker()
      inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--rounded"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--round"])
      expect(popoverOrthogonal).not.toHaveClass(styles["popover--rounded"])
      expect(dialogOrthogonal).not.toHaveClass(styles["dialog--rounded"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<DateTimeRangePicker isDisabled aria-label="datetime-range-picker" />)

      expect(screen.getByTestId("datetime-range-picker")).toHaveAttribute("data-disabled", "true")
    })

    it("responds to canonical readonly prop.", () => {
      render(<DateTimeRangePicker isReadOnly aria-label="datetime-range-picker" />)

      expect(screen.getByTestId("datetime-range-picker")).toHaveAttribute("data-readonly", "true")
    })

    it("responds to isOpen prop.", () => {
      render(<DateTimeRangePicker isOpen={false} aria-label="datetime-range-picker" />)
      const dateTimeRangePicker = screen.getByTestId("datetime-range-picker")

      expect(dateTimeRangePicker).not.toHaveAttribute("data-open")
      expect(screen.queryByTestId("datetime-range-picker-popover")).toBeNull()
    })

    it("responds to focus props.", () => {
      const { unmount } = render(<DateTimeRangePicker aria-label="datetime-picker" />)
      let inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--offsetFocusRing"])

      unmount()

      render(<DateTimeRangePicker enableFocusStyle={false} offsetFocusRing={false} aria-label="datetime-picker" />)

      inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--offsetFocusRing"])
    })

    it("responds to form element status props.", () => {
      const { unmount } = render(<DateTimeRangePicker errorState aria-label="datetime-range-picker" />)
      let inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--errorState"])

      unmount()

      const { unmount: unmountWarning } = render(
        <DateTimeRangePicker warningState aria-label="datetime-range-picker" />,
      )
      inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--warningState"])

      unmountWarning()

      render(<DateTimeRangePicker successState aria-label="datetime-range-picker" />)
      inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<DateTimeRangePicker errorState warningState successState aria-label="datetime-range-picker" />)
      const inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--errorState"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--warningState"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("calendar state styles use numbered palette tokens.", () => {
      expect(calendarStylesSource).toContain("var(--cui-color-primary-100)")
      expect(calendarStylesSource).toContain("var(--cui-color-primary-200)")
      expect(calendarStylesSource).toContain("var(--cui-color-primary-400)")
      expect(calendarStylesSource).toContain("var(--cui-color-primary-500)")
      expect(calendarStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to custom style props.", async () => {
      render(
        <DateTimeRangePicker
          customStyles={{ backgroundColor: "turquoise" }}
          customInputStyles={{ backgroundColor: "red" }}
          customButtonStyles={{ backgroundColor: "orange" }}
          customInputButtonGroupStyles={{ backgroundColor: "yellow" }}
          customPopoverStyles={{ backgroundColor: "green" }}
          customCalendarStyles={{ backgroundColor: "blue" }}
          customCalendarHeaderStyles={{ backgroundColor: "indigo" }}
          customCalendarPrevBtnStyles={{ backgroundColor: "purple" }}
          customCalendarNextBtnStyles={{ backgroundColor: "pink" }}
          customCalendarGridStyles={{ backgroundColor: "magenta" }}
          customCalendarGridHeaderStyles={{ backgroundColor: "white" }}
          customCalendarGridHeaderCellStyles={{ backgroundColor: "black" }}
          customCalendarGridBodyStyles={{ backgroundColor: "gold" }}
          customCalendarGridBodyCellStyles={{ backgroundColor: "cyan" }}
          aria-label="datetime-range-picker"
          multiMonth
        />,
      )

      const dateTimePicker = screen.getByTestId("datetime-range-picker")
      const dateTimeInputs = screen.getAllByTestId("datetime-range-picker-input")
      const triggerButton = screen.getByRole("button", { name: /DateTimeRangePicker Trigger Button/iu })
      const inputButtonGroup = screen.getByRole("group", { name: "DateTimeRangePicker Input Icon Group" })

      await openDateTimeRangePicker()

      const popover = await screen.findByTestId("datetime-range-picker-popover")
      const withinPopover = within(popover)

      const calendar = withinPopover.getByTestId("datetime-range-picker-calendar")
      const calendarHeader = withinPopover.getByTestId("datetime-range-picker-calendar-heading")
      const calendarPrevBtn = withinPopover.getByTestId("datetime-range-picker-prev-btn")
      const calendarNextBtn = withinPopover.getByTestId("datetime-range-picker-next-btn")
      const calendarGrids = withinPopover.getAllByTestId("datetime-range-picker-calendar-grid")
      const calendarGridHeaders = withinPopover.getAllByTestId("datetime-range-picker-calendar-header")
      const calendarGridHeaderCells = withinPopover.getAllByTestId("datetime-range-picker-calendar-header-cell")
      const calendarGridBodies = withinPopover.getAllByTestId("datetime-range-picker-calendar-body")
      const calendarGridBodyCells = withinPopover.getAllByTestId("datetime-range-picker-calendar-body-cell")

      expect(dateTimePicker).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      dateTimeInputs.forEach((input) => expect(input).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" }))
      expect(triggerButton).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(inputButtonGroup).toHaveStyle({ backgroundColor: "rgb(255, 255, 0)" })
      expect(popover).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(calendar).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(calendarHeader).toHaveStyle({ backgroundColor: "rgb(75, 0, 130)" })
      expect(calendarPrevBtn).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
      expect(calendarNextBtn).toHaveStyle({ backgroundColor: "rgb(255, 192, 203)" })
      calendarGrids.forEach((grid) => expect(grid).toHaveStyle({ backgroundColor: "rgb(255, 0, 255)" }))
      calendarGridHeaders.forEach((header) => expect(header).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" }))
      calendarGridHeaderCells.forEach((cell) => expect(cell).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" }))
      calendarGridBodies.forEach((body) => expect(body).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" }))
      calendarGridBodyCells.forEach((cell) => expect(cell).toHaveStyle({ backgroundColor: "rgb(0, 255, 255)" }))
    })

    it("accepts custom labels for its internal controls.", async () => {
      const user = userEvent.setup()

      render(
        <DateTimeRangePicker
          aria-label="datetime-range-picker"
          labels={{
            inputButtonGroupAriaLabel: "Localized date range input controls",
            triggerButtonAriaLabel: "Open localized date range picker",
            calendarAriaLabel: "Localized date range picker calendar",
          }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized date range input controls" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: /open localized date range picker/iu }))

      expect(await screen.findByTestId("datetime-range-picker-calendar")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Localized date range picker calendar"),
      )
    })

    it("renders a custom trigger icon when ComponentIcon is provided.", () => {
      render(
        <DateTimeRangePicker
          aria-label="datetime-range-picker"
          ComponentIcon={<span data-testid="custom-datetime-range-picker-icon">Calendar</span>}
        />,
      )

      expect(screen.getByTestId("custom-datetime-range-picker-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <DateTimeRangePicker
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-datetime-range-picker-class"
          style={{ color: "tomato", marginBottom: 10 }}
          aria-label="datetime-range-picker"
        />,
      )

      const dateTimeRangePicker = screen.getByTestId("datetime-range-picker")

      expect(dateTimeRangePicker).toHaveClass(styles.dateTimePicker)
      expect(dateTimeRangePicker).toHaveClass("native-datetime-range-picker-class")
      expect(dateTimeRangePicker).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <DateTimeRangePicker
          isOpen={false}
          textSize={DATETIME_RANGE_PICKER_SIZE__SM}
          geometry="round"
          isDisabled={false}
          isReadOnly={false}
          multiMonth={false}
          enableFocusStyle={false}
          offsetFocusRing={false}
          placement="top"
          dayLength="short"
          hourCycle={12}
          granularity="minute"
          shouldForceLeadingZeros={false}
          errorState
          warningState
          successState
          ComponentIcon={<span>Calendar</span>}
          customStyles={{ marginTop: 5 }}
          customInputStyles={{ backgroundColor: "red" }}
          customButtonStyles={{ backgroundColor: "orange" }}
          customInputButtonGroupStyles={{ backgroundColor: "yellow" }}
          customPopoverStyles={{ backgroundColor: "green" }}
          customDialogStyles={{ backgroundColor: "purple" }}
          customCalendarStyles={{ backgroundColor: "blue" }}
          customCalendarHeaderStyles={{ backgroundColor: "indigo" }}
          customCalendarPrevBtnStyles={{ backgroundColor: "purple" }}
          customCalendarNextBtnStyles={{ backgroundColor: "pink" }}
          customCalendarGridStyles={{ backgroundColor: "magenta" }}
          customCalendarGridHeaderStyles={{ backgroundColor: "white" }}
          customCalendarGridHeaderCellStyles={{ backgroundColor: "black" }}
          customCalendarGridBodyStyles={{ backgroundColor: "gold" }}
          customCalendarGridBodyCellStyles={{ backgroundColor: "cyan" }}
          labels={{ inputButtonGroupAriaLabel: "Date range controls" }}
          aria-label="datetime-range-picker"
        />,
      )

      const dateTimeRangePicker = screen.getByTestId("datetime-range-picker")

      expect(dateTimeRangePicker).not.toHaveAttribute("isopen")
      expect(dateTimeRangePicker).not.toHaveAttribute("textsize")
      expect(dateTimeRangePicker).not.toHaveAttribute("geometry")
      expect(dateTimeRangePicker).not.toHaveAttribute("isdisabled")
      expect(dateTimeRangePicker).not.toHaveAttribute("isreadonly")
      expect(dateTimeRangePicker).not.toHaveAttribute("multimonth")
      expect(dateTimeRangePicker).not.toHaveAttribute("enablefocusstyle")
      expect(dateTimeRangePicker).not.toHaveAttribute("offsetfocusring")
      expect(dateTimeRangePicker).not.toHaveAttribute("placement")
      expect(dateTimeRangePicker).not.toHaveAttribute("daylength")
      expect(dateTimeRangePicker).not.toHaveAttribute("hourcycle")
      expect(dateTimeRangePicker).not.toHaveAttribute("granularity")
      expect(dateTimeRangePicker).not.toHaveAttribute("shouldforceleadingzeros")
      expect(dateTimeRangePicker).not.toHaveAttribute("errorstate")
      expect(dateTimeRangePicker).not.toHaveAttribute("warningstate")
      expect(dateTimeRangePicker).not.toHaveAttribute("successstate")
      expect(dateTimeRangePicker).not.toHaveAttribute("componenticon")
      expect(dateTimeRangePicker).not.toHaveAttribute("customstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("custominputstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("custombuttonstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("custominputbuttongroupstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("custompopoverstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customdialogstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendarstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendarheaderstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendarprevbtnstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendarnextbtnstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendargridstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendargridheaderstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendargridheadercellstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendargridbodystyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("customcalendargridbodycellstyles")
      expect(dateTimeRangePicker).not.toHaveAttribute("labels")
    })
  })
})
