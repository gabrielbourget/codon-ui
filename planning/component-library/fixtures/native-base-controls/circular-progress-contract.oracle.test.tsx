import { render, screen } from "@testing-library/react"
import { cloneElement, createRef, type PropsWithChildren, type ReactElement } from "react"
import { Label, ProgressBarContext } from "react-aria-components"
import { expect, it } from "vitest"
import Counter from "../../../../packages/react/src/components/Counter/Counter"
import counterCSS from "../../../../packages/react/src/components/Counter/CounterStyles.module.css?inline"
import CircularProgress from "../../../../packages/react/src/components/CircularProgress/CircularProgress"

it("merges context at the semantic root without rewriting wrapper drawing geometry", () => {
  const ref = createRef<HTMLDivElement>()
  const renderStates: unknown[] = []
  const styleStates: unknown[] = []
  const view = render(<CircularProgress value={50} />)
  const drawing = screen.getByTestId("circular-progress-path").style.strokeDashoffset
  view.rerender(
    <ProgressBarContext.Provider
      value={{
        ref,
        maxValue: 200,
        style: (state) => {
          styleStates.push(state)
          return { padding: 7 }
        },
        render: (props, state) => {
          renderStates.push(state)
          return <div {...props} />
        },
      }}
    >
      <CircularProgress value={50} />
    </ProgressBarContext.Provider>,
  )
  const host = screen.getByTestId("circular-progress")
  expect(ref.current).toBe(host)
  expect(host).toHaveAttribute("aria-valuemax", "200")
  expect(host).toHaveAttribute("aria-valuenow", "50")
  expect(host).toHaveAttribute("aria-valuetext", "25%")
  expect(styleStates.at(-1)).toMatchObject({ percentage: 25, valueText: "25%", isIndeterminate: false })
  expect(renderStates.length).toBeGreaterThan(0)
  expect(renderStates.at(-1)).toMatchObject({ percentage: 25, valueText: "25%", isIndeterminate: false })
  expect(screen.getByTestId("circular-progress-path").style.strokeDashoffset).toBe(drawing)
  view.unmount()
  expect(ref.current).toBeNull()
})

it("keeps the exported source Label context reachable through original renderer children", () => {
  render(
    <CircularProgress
      value={25}
      render={(props) => {
        const provider = props.children as ReactElement<PropsWithChildren>
        return (
          <div {...props}>
            {cloneElement(
              provider,
              undefined,
              <>
                <Label>Transfer progress</Label>
                {provider.props.children}
              </>,
            )}
          </div>
        )
      }}
    />,
  )
  expect(screen.getByRole("progressbar", { name: "Transfer progress" })).toHaveAttribute("aria-valuenow", "25")
})

it("applies the owned Counter empty-child selector while respecting an explicit display override", () => {
  const style = document.createElement("style")
  style.textContent = counterCSS
  document.head.append(style)
  const view = render(
    <Counter value={0}>
      <div data-testid="empty-child" style={{ height: 20, width: 20 }} />
    </Counter>,
  )
  expect(getComputedStyle(screen.getByTestId("empty-child")).display).toBe("none")
  view.rerender(
    <Counter value={0}>
      <div data-testid="empty-child" style={{ display: "flex", height: 20, width: 20 }} />
    </Counter>,
  )
  expect(getComputedStyle(screen.getByTestId("empty-child")).display).toBe("flex")
  view.unmount()
  style.remove()
})

it("keeps the reachable source label's authored identity current in automatic relationships", () => {
  const node = (id: string | undefined, combined = false) => (
    <>
      <span id="external-one">First</span>
      <span id="external-two">Second</span>
      <CircularProgress
        id="task-progress"
        aria-label={combined ? "Task" : undefined}
        aria-labelledby={combined ? "external-one external-two" : undefined}
        value={25}
        render={(props) => {
          const provider = props.children as ReactElement<PropsWithChildren>
          return (
            <div {...props}>
              {cloneElement(
                provider,
                undefined,
                <>
                  <Label id={id}>Explicit transfer label</Label>
                  {provider.props.children}
                </>,
              )}
            </div>
          )
        }}
      />
    </>
  )
  const view = render(node("transfer-one"))
  expect(screen.getByRole("progressbar", { name: "Explicit transfer label" })).toHaveAttribute(
    "aria-labelledby",
    "transfer-one",
  )
  view.rerender(node("transfer-two"))
  expect(screen.getByRole("progressbar", { name: "Explicit transfer label" })).toHaveAttribute(
    "aria-labelledby",
    "transfer-two",
  )
  view.rerender(node("transfer-two", true))
  expect(screen.getByRole("progressbar", { name: "Task Explicit transfer label First Second" })).toHaveAttribute(
    "aria-labelledby",
    "task-progress transfer-two external-one external-two",
  )
  view.rerender(node(undefined))
  const label = screen.getByText("Explicit transfer label")
  expect(screen.getByRole("progressbar", { name: "Explicit transfer label" })).toHaveAttribute(
    "aria-labelledby",
    label.id,
  )
})
