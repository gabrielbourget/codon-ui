import { Time } from "@internationalized/date"
import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, it, expect, vi } from "vitest"
import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
afterEach(cleanup)
it.each(["isReadOnly", "isDisabled"] as const)("records actual focused %s replacement", async (guard) => {
  const events: string[] = [],
    change = vi.fn(),
    value = new Time(13, 45)
  const node = (enabled: boolean) => (
    <>
      <button>Outside focus oracle</button>
      <TimePicker
        aria-label="Clock"
        value={value}
        onChange={change}
        {...{ [guard]: enabled }}
        onFocus={() => events.push("focus")}
        onBlur={() => events.push("blur")}
        onFocusChange={(focused) => events.push("focused:" + focused)}
      />
    </>
  )
  const view = render(node(false)),
    user = userEvent.setup(),
    hour = screen.getAllByRole("spinbutton")[0]
  await user.click(hour)
  await view.rerender(node(true))
  expect(document.activeElement).toBe(hour)
  console.log(
    "TIME_GUARD_FOCUS",
    JSON.stringify({
      guard,
      focused: document.activeElement === hour,
      tabIndex: hour.getAttribute("tabindex"),
      editable: hour.getAttribute("contenteditable"),
      events: [...events],
    }),
  )
  await user.keyboard("{ArrowUp}")
  expect(change).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Outside focus oracle" }))
})
it("records field key veto order for spin versus typed input", async () => {
  const events: string[] = [],
    value = new Time(13, 45)
  render(
    <>
      <button>Outside key veto oracle</button>
      <TimePicker
        aria-label="Clock"
        value={value}
        onChange={(next) => events.push("change:" + next?.toString())}
        onKeyDown={(event) => {
          events.push("key:" + event.key)
          event.preventDefault()
        }}
      />
    </>,
  )
  const user = userEvent.setup()
  await user.click(screen.getAllByRole("spinbutton")[0])
  await user.keyboard("{ArrowUp}2")
  console.log("TIME_KEY_VETO", JSON.stringify(events))
  expect(events).toEqual(["change:14:45:00", "key:ArrowUp", "key:ArrowUp", "key:2", "key:2"])
  await user.click(screen.getByRole("button", { name: "Outside key veto oracle" }))
})
