import { Time } from "@internationalized/date"
import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import textStyles from "../../../../packages/react/src/components/Text/TextStyles.module.css"
import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"

it("preserves canonical temporal render state, style owners and original controlled segments", () => {
  const held = new Time(13, 45),
    requests = vi.fn(),
    styles = vi.fn()
  const node = (changed: boolean) => (
    <TimePicker
      aria-label="Clock"
      value={held}
      onChange={requests}
      textSize={changed ? "owner-defined-size" : "medium"}
      isReadOnly={changed}
      isRequired
      width={80}
      customStyles={{ width: 100 }}
      style={(state) => {
        styles(state)
        return { width: changed ? 160 : 140 }
      }}
      render={(native, state) => {
        expect(state.state.segments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "hour", value: held.hour }),
            expect.objectContaining({ type: "minute", value: held.minute }),
          ]),
        )
        expect(state.isDisabled).toBe(false)
        expect(state.isReadOnly).toBe(changed)
        expect(state.isRequired).toBe(true)
        expect(state.isInvalid).toBe(false)
        return <div {...native} data-owner-phase={changed ? "changed" : "initial"} />
      }}
    />
  )
  const view = render(node(false))
  const originalRoot = screen.getByTestId("time-picker"),
    originalSegment = screen.getAllByRole("spinbutton")[0]
  expect(originalRoot).toHaveStyle({ width: "140px" })
  expect(originalRoot).toContainElement(originalSegment)
  expect(originalSegment).toHaveClass(textStyles.b10)
  expect(styles).toHaveBeenLastCalledWith(expect.objectContaining({ defaultStyle: {}, isReadOnly: false }))
  view.rerender(node(true))
  expect(screen.getByTestId("time-picker")).toBe(originalRoot)
  expect(screen.getAllByRole("spinbutton")[0]).toBe(originalSegment)
  expect(originalRoot).toHaveStyle({ width: "160px" })
  expect(originalRoot).toHaveAttribute("data-owner-phase", "changed")
  expect(originalSegment).toHaveClass(textStyles.b10)
  expect(styles).toHaveBeenLastCalledWith(expect.objectContaining({ defaultStyle: {}, isReadOnly: true }))
  expect(requests).not.toHaveBeenCalled()
  view.unmount()
  expect(originalRoot).not.toBeInTheDocument()
})
