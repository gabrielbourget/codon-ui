import { readFileSync } from "node:fs"

import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import DateTimePicker from "../DateTimePicker"
import styles from "../DateTimePickerStyles.module.css"
import { DATETIME_PICKER_SIZE__LG, DATETIME_PICKER_SIZE__MD, DATETIME_PICKER_SIZE__SM } from "../helpers"

const calendarStylesSource = readFileSync("src/components/DateTimePicker/CalendarStyles.module.css", "utf8")

const openDateTimePicker = async () => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: /DateTimePicker Trigger Button/iu })

  await user.click(triggerButton)

  const popover = await screen.findByTestId("datetime-picker-popover")
  const dialog = await screen.findByRole("dialog")

  return { popover, dialog }
}

describe("<DateTimePicker />", () => {
  it("renders.", () => {
    render(<DateTimePicker aria-label="datetime-picker" />)

    expect(screen.getByTestId("datetime-picker")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to text size props.", () => {
      const textSizeToExpectedClassMap = {
        [DATETIME_PICKER_SIZE__SM]: "b11",
        [DATETIME_PICKER_SIZE__MD]: "b10",
        [DATETIME_PICKER_SIZE__LG]: "b9",
      } as const

      const runCase = (textSize: keyof typeof textSizeToExpectedClassMap) => {
        const { baseElement, unmount } = render(<DateTimePicker textSize={textSize} aria-label="datetime-picker" />)

        const expectedClassName = textStyles[textSizeToExpectedClassMap[textSize]]
        const textSizeStyleTargets = baseElement.querySelectorAll("[data-textsize-target]")

        expect(textSizeStyleTargets.length).toBeGreaterThan(0)
        textSizeStyleTargets.forEach((element) => expect(element).toHaveClass(expectedClassName))

        unmount()
      }

      runCase(DATETIME_PICKER_SIZE__SM)
      runCase(DATETIME_PICKER_SIZE__MD)
      runCase(DATETIME_PICKER_SIZE__LG)
    })

    it("responds to corner geometry props.", async () => {
      const { unmount } = render(<DateTimePicker geometry="rounded" aria-label="datetime-picker" />)
      const { popover, dialog } = await openDateTimePicker()

      let inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--rounded"])
      expect(popover).toHaveClass(styles["popover--rounded"])
      expect(dialog).toHaveClass(styles["dialog--rounded"])

      unmount()

      const { unmount: unmountRound } = render(<DateTimePicker geometry="round" aria-label="datetime-picker" />)
      const { popover: popoverRound, dialog: dialogRound } = await openDateTimePicker()
      inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--round"])
      expect(popoverRound).toHaveClass(styles["popover--rounded"])
      expect(dialogRound).toHaveClass(styles["dialog--rounded"])

      unmountRound()

      render(<DateTimePicker geometry="orthogonal" aria-label="datetime-picker" />)
      const { popover: popoverOrthogonal, dialog: dialogOrthogonal } = await openDateTimePicker()
      inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group", hidden: true })
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--rounded"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--round"])
      expect(popoverOrthogonal).not.toHaveClass(styles["popover--rounded"])
      expect(dialogOrthogonal).not.toHaveClass(styles["dialog--rounded"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<DateTimePicker isDisabled aria-label="datetime-picker" />)

      expect(screen.getByTestId("datetime-picker")).toHaveAttribute("data-disabled", "true")
    })

    it("responds to canonical readonly prop.", () => {
      render(<DateTimePicker isReadOnly aria-label="datetime-picker" />)

      expect(screen.getByTestId("datetime-picker")).toHaveAttribute("data-readonly", "true")
    })

    it("responds to isOpen prop.", () => {
      render(<DateTimePicker isOpen={false} aria-label="datetime-picker" />)
      const dateTimePicker = screen.getByTestId("datetime-picker")

      expect(dateTimePicker).not.toHaveAttribute("data-open")
      expect(screen.queryByTestId("datetime-picker-popover")).toBeNull()
    })

    it("responds to focus props.", () => {
      const { unmount } = render(<DateTimePicker aria-label="datetime-picker" />)
      let inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--offsetFocusRing"])

      unmount()

      render(<DateTimePicker enableFocusStyle={false} offsetFocusRing={false} aria-label="datetime-picker" />)

      inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--offsetFocusRing"])
    })

    it("responds to form element status props.", () => {
      const { unmount } = render(<DateTimePicker errorState aria-label="datetime-picker" />)
      let inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--errorState"])

      unmount()

      const { unmount: unmountWarning } = render(<DateTimePicker warningState aria-label="datetime-picker" />)
      inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--warningState"])

      unmountWarning()

      render(<DateTimePicker successState aria-label="datetime-picker" />)
      inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<DateTimePicker errorState warningState successState aria-label="datetime-picker" />)
      const inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })

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
        <DateTimePicker
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
          aria-label="datetime-picker"
        />,
      )

      const dateTimePicker = screen.getByTestId("datetime-picker")
      const dateTimeInput = screen.getByTestId("datetime-picker-input")
      const triggerButton = screen.getByRole("button", { name: /DateTimePicker Trigger Button/iu })
      const inputButtonGroup = screen.getByRole("group", { name: "DateTimePicker Input Icon Group" })

      await openDateTimePicker()

      const popover = await screen.findByTestId("datetime-picker-popover")
      const withinPopover = within(popover)

      const calendar = withinPopover.getByTestId("datetime-picker-calendar")
      const calendarHeader = withinPopover.getByTestId("datetime-picker-calendar-heading")
      const calendarPrevBtn = withinPopover.getByTestId("datetime-picker-prev-btn")
      const calendarNextBtn = withinPopover.getByTestId("datetime-picker-next-btn")
      const calendarGrid = withinPopover.getByTestId("datetime-picker-calendar-grid")
      const calendarGridHeader = withinPopover.getByTestId("datetime-picker-calendar-header")
      const calendarGridHeaderCells = withinPopover.getAllByTestId("datetime-picker-calendar-header-cell")
      const calendarGridBody = withinPopover.getByTestId("datetime-picker-calendar-body")
      const calendarGridBodyCells = withinPopover.getAllByTestId("datetime-picker-calendar-body-cell")

      expect(dateTimePicker).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      expect(dateTimeInput).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(triggerButton).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(inputButtonGroup).toHaveStyle({ backgroundColor: "rgb(255, 255, 0)" })
      expect(popover).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(calendar).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(calendarHeader).toHaveStyle({ backgroundColor: "rgb(75, 0, 130)" })
      expect(calendarPrevBtn).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
      expect(calendarNextBtn).toHaveStyle({ backgroundColor: "rgb(255, 192, 203)" })
      expect(calendarGrid).toHaveStyle({ backgroundColor: "rgb(255, 0, 255)" })
      expect(calendarGridHeader).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" })
      calendarGridHeaderCells.forEach((cell) => expect(cell).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" }))
      expect(calendarGridBody).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" })
      calendarGridBodyCells.forEach((cell) => expect(cell).toHaveStyle({ backgroundColor: "rgb(0, 255, 255)" }))
    })

    it("accepts custom labels for its internal controls.", async () => {
      const user = userEvent.setup()

      render(
        <DateTimePicker
          aria-label="datetime-picker"
          labels={{
            inputButtonGroupAriaLabel: "Localized date input controls",
            triggerButtonAriaLabel: "Open localized date picker",
            calendarAriaLabel: "Localized date picker calendar",
          }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized date input controls" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: /open localized date picker/iu }))

      expect(await screen.findByTestId("datetime-picker-calendar")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Localized date picker calendar"),
      )
    })

    it("renders a custom trigger icon when ComponentIcon is provided.", () => {
      render(
        <DateTimePicker
          aria-label="datetime-picker"
          ComponentIcon={<span data-testid="custom-datetime-picker-icon">Calendar</span>}
        />,
      )

      expect(screen.getByTestId("custom-datetime-picker-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <DateTimePicker
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-datetime-picker-class"
          style={{ color: "tomato", marginBottom: 10 }}
          aria-label="datetime-picker"
        />,
      )

      const dateTimePicker = screen.getByTestId("datetime-picker")

      expect(dateTimePicker).toHaveClass(styles.dateTimePicker)
      expect(dateTimePicker).toHaveClass("native-datetime-picker-class")
      expect(dateTimePicker).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <DateTimePicker
          isOpen={false}
          textSize={DATETIME_PICKER_SIZE__SM}
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
          labels={{ inputButtonGroupAriaLabel: "Date controls" }}
          aria-label="datetime-picker"
        />,
      )

      const dateTimePicker = screen.getByTestId("datetime-picker")

      expect(dateTimePicker).not.toHaveAttribute("isopen")
      expect(dateTimePicker).not.toHaveAttribute("textsize")
      expect(dateTimePicker).not.toHaveAttribute("geometry")
      expect(dateTimePicker).not.toHaveAttribute("isdisabled")
      expect(dateTimePicker).not.toHaveAttribute("isreadonly")
      expect(dateTimePicker).not.toHaveAttribute("multimonth")
      expect(dateTimePicker).not.toHaveAttribute("enablefocusstyle")
      expect(dateTimePicker).not.toHaveAttribute("offsetfocusring")
      expect(dateTimePicker).not.toHaveAttribute("placement")
      expect(dateTimePicker).not.toHaveAttribute("daylength")
      expect(dateTimePicker).not.toHaveAttribute("hourcycle")
      expect(dateTimePicker).not.toHaveAttribute("granularity")
      expect(dateTimePicker).not.toHaveAttribute("shouldforceleadingzeros")
      expect(dateTimePicker).not.toHaveAttribute("errorstate")
      expect(dateTimePicker).not.toHaveAttribute("warningstate")
      expect(dateTimePicker).not.toHaveAttribute("successstate")
      expect(dateTimePicker).not.toHaveAttribute("componenticon")
      expect(dateTimePicker).not.toHaveAttribute("customstyles")
      expect(dateTimePicker).not.toHaveAttribute("custominputstyles")
      expect(dateTimePicker).not.toHaveAttribute("custombuttonstyles")
      expect(dateTimePicker).not.toHaveAttribute("custominputbuttongroupstyles")
      expect(dateTimePicker).not.toHaveAttribute("custompopoverstyles")
      expect(dateTimePicker).not.toHaveAttribute("customdialogstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendarstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendarheaderstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendarprevbtnstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendarnextbtnstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendargridstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendargridheaderstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendargridheadercellstyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendargridbodystyles")
      expect(dateTimePicker).not.toHaveAttribute("customcalendargridbodycellstyles")
      expect(dateTimePicker).not.toHaveAttribute("labels")
    })
  })
})
