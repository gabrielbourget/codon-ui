import { Time } from "@internationalized/date"
import { cleanup, render, screen } from "@testing-library/react"
import { FieldError, I18nProvider, Label, Text, TimeFieldStateContext } from "react-aria-components"
import { useContext } from "react"
import { afterEach, expect, it } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
import { getNativeDateFieldDescription } from "../../../../packages/react-native/src/date/entry/semantics"
import type { TimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"

afterEach(cleanup)
it.each([undefined, "Caller clock"])("records canonical label and description ownership with label %s", (name) => {
  render(
    <I18nProvider locale="en-GB">
      <TimePicker
        value={new Time(13, 45)}
        aria-label={name}
        render={(props) => (
          <div {...props}>
            <Label>Visible clock</Label>
            <Text slot="description">Time helper</Text>
            {props.children}
            <FieldError />
          </div>
        )}
      />
    </I18nProvider>,
  )
  const parts = screen.getAllByRole("spinbutton")
  expect(parts).toHaveLength(2)
  expect(parts[0]).toHaveAccessibleName(name ? "hour, Caller clock, Visible clock" : "hour, Visible clock")
  expect(parts[0].getAttribute("aria-describedby")).toContain(screen.getByText("Time helper").id)
  expect(parts[1].getAttribute("aria-describedby")).toBeNull()
})

it.each([false, true])("retains the selected-value description and invalid error relations: %s", (invalid) => {
  let state: TimeFieldState | null = null
  const Probe = () => {
    state = useContext(TimeFieldStateContext)
    return null
  }
  render(
    <I18nProvider locale="en-GB">
      <TimePicker
        value={new Time(13, 45)}
        validationBehavior="aria"
        validate={() => (invalid ? "Rejected clock" : null)}
        ComponentIcon={<Probe />}
        render={(props) => (
          <div {...props}>
            <Label>Visible clock</Label>
            <Text slot="description">Time helper</Text>
            {props.children}
            <FieldError />
          </div>
        )}
      />
    </I18nProvider>,
  )
  const parts = screen.getAllByRole("spinbutton")
  const descriptions = (part: HTMLElement) =>
    (part.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent)
  expect(state).not.toBeNull()
  const selected = getNativeDateFieldDescription(state!, "en-GB")
  expect(descriptions(parts[0])).toContain(selected)
  expect(descriptions(parts[0])).toContain("Time helper")
  expect(descriptions(parts[1])).toEqual(invalid ? descriptions(parts[0]) : [])
  if (invalid) expect(descriptions(parts[0])).toContain("Rejected clock")
})

it("preserves the pinned details filter and explicit description order", () => {
  render(
    <>
      <span id="outside-description">Outside helper</span>
      <span id="outside-details">Outside details</span>
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        aria-describedby="outside-description"
        aria-details="outside-details"
      />
    </>,
  )
  expect(document.querySelectorAll("[aria-details]")).toHaveLength(0)
  const parts = screen.getAllByRole("spinbutton")
  expect(parts.every((part) => !part.hasAttribute("aria-details"))).toBe(true)
  const ids = parts[0].getAttribute("aria-describedby")!.split(/\s+/)
  expect(ids[1]).toBe("outside-description")
  expect(document.getElementById(ids[0])?.textContent).toMatch(/^Selected Time:/)
})

it("preserves separate nested field ownership and parent-before-icon form entry order", () => {
  const view = render(
    <form>
      <TimePicker
        name="parent"
        value={new Time(13, 45)}
        aria-label="Parent clock"
        ComponentIcon={<TimePicker name="nested" value={new Time(9, 20)} aria-label="Nested clock" />}
      />
    </form>,
  )
  expect([...new FormData(view.container.querySelector("form")!).entries()]).toEqual([
    ["parent", "13:45:00"],
    ["nested", "09:20:00"],
  ])
  expect(screen.getAllByRole("spinbutton")).toHaveLength(4)
})
