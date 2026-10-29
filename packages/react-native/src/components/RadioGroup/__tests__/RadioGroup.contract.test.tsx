import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import { View, type ViewProps } from "react-native"

import { Radio, RadioGroup } from "../../.."

it("delivers the original native group root/ref/events and current state to its inherited renderer", async () => {
  const ref = createRef<View>()
  const layout = jest.fn()
  const renderer = jest.fn((props: ViewProps & RefAttributes<View>, state: unknown) => (
    <View {...props} testID="rendered-radio-group" accessibilityHint={JSON.stringify(state)} />
  ))
  const adapter = { render: renderer }
  const view = await render(
    <RadioGroup {...adapter} aria-label="Choices" ref={ref} value="one" onLayout={layout}>
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  expect(renderer).toHaveBeenCalled()
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  expect(renderer.mock.calls.at(-1)?.[1]).toEqual({ value: "one", isDisabled: false, isReadOnly: false })
  expect(screen.getByRole("radio")).toBeChecked()
  await view.rerender(
    <RadioGroup {...adapter} aria-label="Choices" ref={ref} value={null} isReadOnly onLayout={layout}>
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toEqual({ value: null, isDisabled: false, isReadOnly: true })
  expect(screen.getByRole("radio")).not.toBeChecked()
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 180, height: 44 } } }
  await fireEvent(screen.getByTestId("rendered-radio-group"), "layout", event)
  expect(layout.mock.calls).toEqual([[event]])
  expect(layout.mock.calls[0][0]).toBe(event)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("runs style before root rendering and preserves original member context through veto, echo and read-only", async () => {
  const trace: string[] = []
  const change = jest.fn()
  const member = (
    <Radio aria-label="First" value="one">
      First
    </Radio>
  )
  const adapter = {
    render: (props: ViewProps & RefAttributes<View>) => {
      trace.push("render")
      expect(props.children).toBe(member)
      return <View {...props} />
    },
  }
  const view = await render(
    <RadioGroup
      {...adapter}
      aria-label="Choices"
      value={null}
      onChange={change}
      style={() => {
        trace.push("style")
        return {}
      }}
    >
      {member}
    </RadioGroup>,
  )
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  const original = screen.getByRole("radio")
  await fireEvent.press(original, { nativeEvent: { timestamp: 1 } })
  expect(change.mock.calls).toEqual([["one"]])
  expect(original).not.toBeChecked()
  await view.rerender(
    <RadioGroup {...adapter} aria-label="Choices" value="one" onChange={change}>
      {member}
    </RadioGroup>,
  )
  expect(screen.getByRole("radio")).toBe(original)
  expect(original).toBeChecked()
  await fireEvent.press(original, { nativeEvent: { timestamp: 2 } })
  expect(change).toHaveBeenCalledTimes(1)
  await view.rerender(
    <RadioGroup {...adapter} aria-label="Choices" value={null} isReadOnly onChange={change}>
      {member}
    </RadioGroup>,
  )
  await fireEvent.press(original, { nativeEvent: { timestamp: 3 } })
  expect(change).toHaveBeenCalledTimes(1)
})

it("centers both orientations while keeping final layout overrides and approved member-only disabled opacity", async () => {
  const view = await render(
    <RadioGroup aria-label="Choices">
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-group")).toHaveStyle({ alignItems: "center", flexDirection: "column", gap: 10 })
  await view.rerender(
    <RadioGroup
      aria-label="Choices"
      orientation="horizontal"
      isDisabled
      customStyles={{ alignItems: "flex-end" }}
      style={({ defaultStyle }) => [defaultStyle, { alignItems: "stretch" }]}
    >
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-group")).toHaveStyle({ alignItems: "stretch", flexDirection: "row" })
  expect(screen.getByTestId("radio-group").props.style.opacity).toBeUndefined()
  expect(screen.getByRole("radio")).toHaveStyle({ opacity: 0.4 })
})
