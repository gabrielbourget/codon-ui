import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import { View, type ViewProps } from "react-native"

import { Checkbox, CheckboxGroup, type TNativeCheckboxGroupRenderState } from "../../.."

it("passes the original root props/ref and current group flags to its inherited renderer", async () => {
  const ref = createRef<View>()
  const layout = jest.fn()
  const renderer = jest.fn((props: ViewProps & RefAttributes<View>, state: unknown) => (
    <View {...props} testID="rendered-group" accessibilityHint={JSON.stringify(state)} />
  ))
  const adapter = { render: renderer }
  const view = await render(
    <CheckboxGroup {...adapter} ref={ref} value={["one"]} onLayout={layout}>
      <Checkbox value="one">Member</Checkbox>
    </CheckboxGroup>,
  )
  expect(renderer).toHaveBeenCalled()
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  expect(renderer.mock.calls.at(-1)?.[1]).toEqual({ value: ["one"], isDisabled: false, isReadOnly: false })
  expect(screen.getByRole("checkbox")).toBeChecked()
  await view.rerender(
    <CheckboxGroup {...adapter} ref={ref} value={[]} isReadOnly onLayout={layout}>
      <Checkbox value="one">Member</Checkbox>
    </CheckboxGroup>,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toEqual({ value: [], isDisabled: false, isReadOnly: true })
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 180, height: 44 } } }
  await fireEvent(screen.getByTestId("rendered-group"), "layout", event)
  expect(layout.mock.calls).toEqual([[event]])
  expect(layout.mock.calls[0][0]).toBe(event)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("runs style, children and root renderers in order and retains member context through owner veto and echo", async () => {
  const trace: string[] = []
  const change = jest.fn()
  const children = jest.fn((state: TNativeCheckboxGroupRenderState & { defaultChildren: undefined }) => {
    trace.push("children")
    expect(state.defaultChildren).toBeUndefined()
    return <Checkbox value="one">{state.isReadOnly ? "Read only" : "Member"}</Checkbox>
  })
  const adapter = {
    children,
    render: (props: ViewProps & RefAttributes<View>) => {
      trace.push("render")
      return <View {...props} />
    },
  }
  const view = await render(
    <CheckboxGroup
      {...adapter}
      value={[]}
      onChange={change}
      style={() => {
        trace.push("style")
        return {}
      }}
    />,
  )
  expect(children).toHaveBeenCalled()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  await fireEvent.press(screen.getByRole("checkbox"), { nativeEvent: { timestamp: 1 } })
  expect(change.mock.calls).toEqual([[["one"]]])
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  await view.rerender(<CheckboxGroup {...adapter} value={["one"]} onChange={change} />)
  expect(screen.getByRole("checkbox")).toBeChecked()
  await view.rerender(<CheckboxGroup {...adapter} value={[]} isReadOnly onChange={change} />)
  expect(screen.getByText("Read only")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("checkbox"), { nativeEvent: { timestamp: 2 } })
  expect(change).toHaveBeenCalledTimes(1)
})

it("centers the canonical group cross axis while retaining authored layout and the accepted single-dimming policy", async () => {
  const view = await render(
    <CheckboxGroup>
      <Checkbox>Member</Checkbox>
    </CheckboxGroup>,
  )
  expect(screen.getByTestId("checkbox-group")).toHaveStyle({ alignItems: "center", flexDirection: "column", gap: 10 })
  await view.rerender(
    <CheckboxGroup
      isDisabled
      customStyles={{ alignItems: "flex-end" }}
      style={({ defaultStyle }) => [defaultStyle, { alignItems: "stretch" }]}
    >
      <Checkbox>Member</Checkbox>
    </CheckboxGroup>,
  )
  expect(screen.getByTestId("checkbox-group")).toHaveStyle({ alignItems: "stretch" })
  expect(screen.getByTestId("checkbox-group").props.style.opacity).toBeUndefined()
  expect(screen.getByRole("checkbox")).toHaveStyle({ opacity: 0.4 })
})

it("wraps primitive and Fragment callback output without replacing authored member nodes", async () => {
  const children = ({ value }: TNativeCheckboxGroupRenderState) => (
    <>
      {0}
      {" selected "}
      {value.length}
      <Checkbox value="one">Member</Checkbox>
    </>
  )
  const view = await render(<CheckboxGroup value={[]}>{children}</CheckboxGroup>)
  const member = screen.getByRole("checkbox")
  expect(screen.getByText("0 selected 0")).toBeOnTheScreen()
  await view.rerender(<CheckboxGroup value={["one"]}>{children}</CheckboxGroup>)
  expect(screen.getByText("0 selected 1")).toBeOnTheScreen()
  expect(screen.getByRole("checkbox")).toBe(member)
  expect(member).toBeChecked()
})
