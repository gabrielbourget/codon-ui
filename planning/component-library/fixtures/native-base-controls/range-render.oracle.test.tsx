import { render, screen } from "@testing-library/react"
import { createRef, type ComponentPropsWithRef } from "react"
import { expect, it } from "vitest"

import LinearProgress from "../../../../packages/react/src/components/LinearProgress/LinearProgress"
import Meter from "../../../../packages/react/src/components/Meter/Meter"

it.each([
  ["progressbar", LinearProgress],
  ["meter", Meter],
] as const)(
  "keeps the original %s ref, owned children and current state through its inherited renderer",
  (role, Component) => {
    const ref = createRef<HTMLDivElement>()
    const states: unknown[] = []
    const view = render(
      <Component
        ref={ref}
        value={25}
        aria-label="Rendered"
        render={(
          props: ComponentPropsWithRef<"div">,
          state: { percentage: number | undefined; valueText: string | undefined; isIndeterminate?: boolean },
        ) => {
          states.push(state)
          return <div {...props} data-testid="rendered-range" />
        }}
      />,
    )
    const original = ref.current
    expect(original).not.toBeNull()
    expect(screen.getByRole(role)).toBe(original)
    expect(states.at(-1)).toEqual(
      role === "meter"
        ? { percentage: 25, valueText: "25%" }
        : { percentage: 25, valueText: "25%", isIndeterminate: false },
    )
    expect(screen.getByTestId(role === "meter" ? "meter-bar" : "linear-progress-bar")).toBeInTheDocument()
    view.rerender(
      <Component
        ref={ref}
        value={0}
        aria-label="Updated"
        render={(
          props: ComponentPropsWithRef<"div">,
          state: { percentage: number | undefined; valueText: string | undefined; isIndeterminate?: boolean },
        ) => {
          states.push(state)
          return <div {...props} data-testid="rendered-range" />
        }}
      />,
    )
    expect(ref.current).toBe(original)
    expect(states.at(-1)).toEqual(
      role === "meter"
        ? { percentage: 0, valueText: "0%" }
        : { percentage: 0, valueText: "0%", isIndeterminate: false },
    )
    view.unmount()
    expect(ref.current).toBeNull()
  },
)
