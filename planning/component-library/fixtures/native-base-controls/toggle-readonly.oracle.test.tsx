import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ComponentProps } from "react"
import { ToggleButtonGroup, type ToggleButtonRenderProps } from "react-aria-components"
import { expect, it, vi } from "vitest"

import ToggleButton from "../../../../packages/react/src/components/ToggleButton/ToggleButton"

const unsupportedRuntimeProps = { isReadOnly: true }
// @ts-expect-error The canonical public ToggleButton does not advertise this runtime extra.
export const RejectedReadonly = <ToggleButton isReadOnly />
export const SupportedCompositionProps: ComponentProps<typeof ToggleButton> = {
  id: 0,
  slot: "named",
  preventFocusOnPress: true,
}

it("explores untyped standalone read-only requests through activation and state methods", async () => {
  let current!: ToggleButtonRenderProps
  const request = vi.fn(),
    press = vi.fn()
  render(
    <ToggleButton aria-label="Choice" {...unsupportedRuntimeProps} onChange={request} onPress={press}>
      {(state) => {
        current = state
        return "Choice"
      }}
    </ToggleButton>,
  )
  await userEvent.setup().click(screen.getByRole("button"))
  await act(() => current.state.setSelected(true))
  await act(() => current.state.toggle())
  expect(press).toHaveBeenCalledTimes(1)
  expect(request).not.toHaveBeenCalled()
  expect(current.isSelected).toBe(false)
})
it("preserves the pinned grouped read-only distinction and initial member default metadata", async () => {
  let current!: ToggleButtonRenderProps
  const group = vi.fn(),
    member = vi.fn()
  render(
    <ToggleButtonGroup aria-label="Choices" defaultSelectedKeys={[0]} onSelectionChange={group}>
      <ToggleButton id={0} {...unsupportedRuntimeProps} defaultSelected={false} onChange={member}>
        {(state) => {
          current = state
          return "Choice"
        }}
      </ToggleButton>
    </ToggleButtonGroup>,
  )
  expect(current.state.defaultSelected).toBe(true)
  await userEvent.setup().click(screen.getByRole("radio"))
  expect(group.mock.calls.map(([keys]) => [...keys])).toEqual([[]])
  expect(member).not.toHaveBeenCalled()
  await act(() => current.state.setSelected(true))
  expect(group.mock.calls.map(([keys]) => [...keys])).toEqual([[], [0]])
  expect(current.isSelected).toBe(true)
})
