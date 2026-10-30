import { act, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { Button, TooltipContext, TooltipTrigger, type TooltipRenderProps } from "react-aria-components"
import { expect, it } from "vitest"

import HoverPopover from "../../../../packages/react/src/components/HoverPopover/HoverPopover"
import Tooltip from "../../../../packages/react/src/components/Tooltip/Tooltip"

it.each([Tooltip, HoverPopover])(
  "retains the original renderer, context and complete source state",
  async (Component) => {
    const ref = createRef<HTMLDivElement>()
  const triggerRef = createRef<HTMLButtonElement>()
    let latest!: TooltipRenderProps
    const node = (spacing: number) => (
      <TooltipTrigger defaultOpen delay={0} closeDelay={0}>
        <Button ref={triggerRef}>Trigger</Button>
        <TooltipContext.Provider value={{ triggerRef, style: () => ({ fontStyle: "italic", letterSpacing: 9 }) }}>
          <Component
            ref={ref}
            data-testid="source-tooltip"
            customStyles={{ letterSpacing: spacing }}
            render={(props, state) => {
              latest = state
              return <div {...props} />
            }}
          >
            Description
          </Component>
        </TooltipContext.Provider>
      </TooltipTrigger>
    )
    const view = render(node(3))
    const original = ref.current
    expect(original).toBe(screen.getByTestId("source-tooltip"))
    expect(original!.style.fontStyle).toBe("italic")
    expect(original!.style.letterSpacing).toBe("3px")
    expect(Object.keys(latest).sort()).toEqual(["isEntering", "isExiting", "placement", "state"])
    expect(Object.keys(latest.state).sort()).toEqual(["close", "isOpen", "open"])
    expect(latest.state.isOpen).toBe(true)
    view.rerender(node(0))
    expect(ref.current).toBe(original)
    expect(original!.style.letterSpacing).toMatch(/^0(?:px)?$/)
    await act(() => latest.state.close(true))
    expect(screen.queryByTestId("source-tooltip")).toBeNull()
    expect(ref.current).toBeNull()
  },
)
