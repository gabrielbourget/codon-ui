import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import type { ProgressBarRenderProps } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import CircularProgress from "../CircularProgress"

const UnmountedLabel = vi.fn(() => <span>Value label content must stay unmounted</span>)
const element = <UnmountedLabel />
const fragment = <>One quarter</>
const array = ["1", " of ", 4]
const promise = Promise.resolve("One quarter")
const cases: { name: string; label: ReactNode; expectedText: string; expectedState: ReactNode }[] = [
  { name: "undefined", label: undefined, expectedText: "25%", expectedState: "25%" },
  { name: "null", label: null, expectedText: "25%", expectedState: "25%" },
  { name: "false", label: false, expectedText: "25%", expectedState: "25%" },
  { name: "empty string", label: "", expectedText: "25%", expectedState: "25%" },
  { name: "numeric zero", label: 0, expectedText: "25%", expectedState: "25%" },
  { name: "bigint zero", label: 0n, expectedText: "25%", expectedState: "25%" },
  { name: "numeric label", label: 4, expectedText: "4", expectedState: 4 },
  { name: "bigint label", label: 4n, expectedText: "4", expectedState: 4n },
  { name: "string zero", label: "0", expectedText: "0", expectedState: "0" },
  { name: "true", label: true, expectedText: "true", expectedState: true },
  { name: "text", label: "One quarter", expectedText: "One quarter", expectedState: "One quarter" },
  { name: "array", label: array, expectedText: "1, of ,4", expectedState: array },
  { name: "fragment", label: fragment, expectedText: "[object Object]", expectedState: fragment },
  { name: "element", label: element, expectedText: "[object Object]", expectedState: element },
  { name: "promise", label: promise, expectedText: "[object Promise]", expectedState: promise },
]

describe("CircularProgress inherited valueLabel contract", () => {
  it.each(cases)("retains $name callback identity and DOM semantic serialization without rendering it", (testCase) => {
    const style = vi.fn((state: ProgressBarRenderProps) => ({ opacity: state.isIndeterminate ? 0.5 : 1 }))
    render(<CircularProgress aria-label="Task" value={25} valueLabel={testCase.label} style={style} />)
    expect(screen.getByRole("progressbar", { name: "Task" })).toHaveAttribute("aria-valuetext", testCase.expectedText)
    expect(style.mock.calls.at(-1)?.[0].valueText).toBe(testCase.expectedState)
    expect(screen.queryByText("Value label content must stay unmounted")).not.toBeInTheDocument()
    expect(screen.queryByTestId("circular-progress-text")).not.toBeInTheDocument()
    expect(UnmountedLabel).not.toHaveBeenCalled()
  })

  it.each(cases)("omits $name label from indeterminate semantics and render state", (testCase) => {
    const style = vi.fn((state: ProgressBarRenderProps) => ({ opacity: state.isIndeterminate ? 0.5 : 1 }))
    render(<CircularProgress aria-label="Task" value={25} valueLabel={testCase.label} isIndeterminate style={style} />)
    expect(screen.getByRole("progressbar", { name: "Task" })).not.toHaveAttribute("aria-valuetext")
    expect(style.mock.calls.at(-1)?.[0].valueText).toBeUndefined()
    expect(style.mock.calls.at(-1)?.[0].percentage).toBeUndefined()
    expect(UnmountedLabel).not.toHaveBeenCalled()
  })
})
