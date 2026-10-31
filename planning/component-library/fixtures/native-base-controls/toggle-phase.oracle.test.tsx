import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { ToggleButtonGroup } from "react-aria-components"
import { expect, it } from "vitest"

import ToggleButton from "../../../../packages/react/src/components/ToggleButton/ToggleButton"

it("runs ancestor capture before toolbar focus even when the ancestor prevents the key default", async () => {
  const trace: string[] = []
  render(
    <div
      onKeyDownCapture={(event) => {
        trace.push("capture:" + event.key)
        event.preventDefault()
      }}
      onKeyDown={() => trace.push("bubble")}
    >
      <ToggleButtonGroup aria-label="Capture order">
        <ToggleButton id="first" onKeyDown={() => trace.push("target")}>
          First
        </ToggleButton>
        <ToggleButton id="second" onFocus={() => trace.push("focus:second")}>
          Second
        </ToggleButton>
      </ToggleButtonGroup>
    </div>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("radio", { name: "First" }))
  trace.length = 0
  await user.keyboard("{ArrowRight}")
  expect(screen.getByRole("radio", { name: "Second" })).toHaveFocus()
  expect(trace).toEqual(["capture:ArrowRight", "focus:second"])
  trace.length = 0
  await user.keyboard("{Home}")
  expect(screen.getByRole("radio", { name: "Second" })).toHaveFocus()
  expect(trace).toEqual(["capture:Home", "bubble"])
})
