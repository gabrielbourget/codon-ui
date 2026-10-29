import { act, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import Input from "../../../../packages/react/src/components/Input/Input"
import TextArea from "../../../../packages/react/src/components/TextArea/TextArea"

it("preserves canonical Input root/ref/current focus and style-before-render order", () => {
  const ref = createRef<HTMLInputElement>()
  const trace: string[] = []
  const view = render(
    <Input
      aria-label="Editor"
      ref={ref}
      defaultValue="Original"
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <input {...props} data-testid="rendered-editor" data-focused={String(state.isFocused)} />
      }}
    />,
  )
  const original = ref.current
  expect(original).toBe(screen.getByTestId("rendered-editor"))
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  act(() => original?.focus())
  expect(screen.getByTestId("rendered-editor")).toHaveAttribute("data-focused", "true")
  expect(ref.current).toBe(original)
  view.unmount()
  expect(ref.current).toBeNull()
})

it("preserves canonical TextArea root/ref/current focus and style-before-render order", () => {
  const ref = createRef<HTMLTextAreaElement>()
  const trace: string[] = []
  const view = render(
    <TextArea
      aria-label="Editor"
      ref={ref}
      defaultValue="Original"
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <textarea {...props} data-testid="rendered-editor" data-focused={String(state.isFocused)} />
      }}
    />,
  )
  const original = ref.current
  expect(original).toBe(screen.getByTestId("rendered-editor"))
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  act(() => original?.focus())
  expect(screen.getByTestId("rendered-editor")).toHaveAttribute("data-focused", "true")
  expect(ref.current).toBe(original)
  view.unmount()
  expect(ref.current).toBeNull()
})
