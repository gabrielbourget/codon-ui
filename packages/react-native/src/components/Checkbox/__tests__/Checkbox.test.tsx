import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Fragment, createRef } from "react"
import { View } from "react-native"

import {
  Checkbox,
  CheckboxGroup,
  NativeThemeProvider,
  type TNativeCheckboxRef,
  type TNativeCheckboxGroupRef,
} from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const event = { nativeEvent: { timestamp: 100 } }
const hidden = { includeHiddenElements: true }

describe("Checkbox public native contract", () => {
  it("forwards the original native activation object while retaining owned selection", async () => {
    const onPress = jest.fn(),
      onChange = jest.fn()
    await render(<Checkbox isSelected={false} onPress={onPress} onChange={onChange} aria-label="Choice" />)
    const control = screen.getByRole("checkbox")
    await fireEvent(control, "press", event)
    expect(onPress.mock.calls).toEqual([[event]])
    expect(onPress.mock.calls[0][0]).toBe(event)
    expect(onChange.mock.calls).toEqual([[true]])
    expect(control.props.accessibilityState.checked).toBe(false)
    for (const prop of ["isSelected", "defaultSelected", "onChange", "isDisabled", "isReadOnly"]) {
      expect(control.props[prop]).toBeUndefined()
    }
  })

  it("renders one full-size control and wraps composed labels", async () => {
    await render(<Checkbox>{["Choose ", <Fragment key="count">{3}</Fragment>]}</Checkbox>)
    const checkbox = screen.getByRole("checkbox", { name: "Choose 3" })
    expect(checkbox).toHaveStyle({ minWidth: 44, minHeight: 44 })
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({
      width: 20,
      height: 20,
      borderRadius: 5,
      borderColor: "#9e9e9e",
    })
    expect(screen.getByText("Choose 3").props.selectable).toBe(false)
    expect(screen.getByText("Choose 3")).toHaveStyle({ flexShrink: 1 })
    expect(checkbox.props.accessibilityState).toEqual({ checked: false, disabled: false })
  })

  it("changes uncontrolled selection once and reports effective state to children", async () => {
    const onChange = jest.fn(),
      onPress = jest.fn()
    await render(<Checkbox {...{ onChange, onPress }}>{({ isSelected }) => <>Choice {isSelected ? 1 : 0}</>}</Checkbox>)
    await userEvent.setup().press(screen.getByRole("checkbox"))
    expect(onChange.mock.calls).toEqual([[true]])
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Choice 1")).toBeOnTheScreen()
  })

  it("requests controlled changes and only updates when the prop changes", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(
      <Checkbox isSelected={false} onChange={onChange}>
        Controlled
      </Checkbox>,
    )
    await userEvent.setup().press(screen.getByRole("checkbox"))
    expect(onChange.mock.calls).toEqual([[true]])
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false)
    await rerender(
      <Checkbox isSelected onChange={onChange}>
        Controlled
      </Checkbox>,
    )
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true)
  })

  it("keeps authored mixed state after activation and shows its line with showIcon false", async () => {
    const onChange = jest.fn()
    await render(
      <Checkbox isIndeterminate showIcon={false} onChange={onChange}>
        Mixed
      </Checkbox>,
    )
    const control = screen.getByRole("checkbox")
    expect(control.props.accessibilityState.checked).toBe("mixed")
    expect(screen.getByTestId("checkbox-mixed", hidden)).toBeOnTheScreen()
    await userEvent.setup().press(control)
    expect(onChange.mock.calls).toEqual([[true]])
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe("mixed")
  })

  it("hides only the selected glyph when showIcon is false", async () => {
    await render(
      <Checkbox isSelected showIcon={false}>
        Selected
      </Checkbox>,
    )
    expect(screen.queryByTestId("checkbox-check", hidden)).toBeNull()
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ backgroundColor: "#2563eb" })
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true)
  })

  it.each(["isDisabled", "isReadOnly"] as const)("blocks mutation and activation with %s", async (flag) => {
    const onChange = jest.fn(),
      onPress = jest.fn()
    await render(<Checkbox {...{ [flag]: true, onChange, onPress }}>Blocked</Checkbox>)
    await fireEvent.press(screen.getByRole("checkbox"), event)
    expect(onChange).not.toHaveBeenCalled()
    expect(onPress).not.toHaveBeenCalled()
    expect(screen.getByRole("checkbox").props.accessibilityState.disabled).toBe(flag === "isDisabled")
  })

  it("uses final style precedence and leaves visual dimensions independent from root dimensions", async () => {
    await render(
      <Checkbox
        width={28}
        height={26}
        customStyles={{ width: 24, height: 24, backgroundColor: "red" }}
        style={({ defaultStyle }) => [defaultStyle, { backgroundColor: "blue", minHeight: 12 }]}
      />,
    )
    expect(screen.getByRole("checkbox")).toHaveStyle({ width: 24, height: 24, backgroundColor: "blue", minHeight: 12 })
    expect(screen.getByRole("checkbox").props.style.minWidth).toBeUndefined()
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ width: 28, height: 26 })
  })

  it("resolves pressed before hover and keeps dark unselected feedback on outline roles", async () => {
    const { rerender } = await render(
      <NativeThemeProvider mode="dark">
        <Checkbox order="primary" />
      </NativeThemeProvider>,
    )
    await fireEvent(screen.getByRole("checkbox"), "hoverIn", event)
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ backgroundColor: "#192237" })
    await fireEvent(screen.getByRole("checkbox"), "pressIn", event)
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ backgroundColor: "#1b2e57" })
    await rerender(
      <NativeThemeProvider mode="dark">
        <Checkbox order="primary" isSelected />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ backgroundColor: "#5c8af0" })
  })

  it("honors selected custom colors, geometry, provider icon overrides and focus opt-out", async () => {
    const { rerender } = await render(
      <NativeThemeProvider overrides={{ colors: { controlSelectedForeground: "#123456" } }}>
        <Checkbox isSelected color="tomato" geometry="orthogonal" raised />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({
      backgroundColor: "tomato",
      borderColor: "tomato",
      borderRadius: 0,
      elevation: 2,
    })
    expect(screen.getByTestId("checkbox-check", hidden)).toHaveStyle({ borderColor: "#123456" })
    await fireEvent(screen.getByRole("checkbox"), "focus", event)
    expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({ outlineWidth: 1.5 })
    await rerender(<Checkbox enableFocusStyle={false} />)
    expect(screen.getByTestId("checkbox-shape", hidden).props.style.outlineWidth).toBeUndefined()
  })

  it("forwards refs, native identity props and authored child elements", async () => {
    const ref = createRef<TNativeCheckboxRef>()
    await render(
      <Checkbox ref={ref} testID="native" data-testid="alias" accessibilityLabel="Native" aria-label="Alias">
        <View testID="authored" style={{ width: 7 }} />
      </Checkbox>,
    )
    expect(ref.current).not.toBeNull()
    expect(screen.getByRole("checkbox", { name: "Native" })).toBe(screen.getByTestId("native"))
    expect(screen.getByTestId("authored")).toHaveStyle({ width: 7 })
  })

  it.each([{ color: "var(--color)" }, { customStyles: { borderColor: "var(--color)" } }, { height: -1 }])(
    "rejects invalid native values %p",
    async (props) => {
      await expect(render(<Checkbox {...props} />)).rejects.toThrow(TypeError)
    },
  )
})

describe("CheckboxGroup actual member composition", () => {
  it("retains the original group ref and layout event through native identity precedence and clears it on unmount", async () => {
    const ref = createRef<TNativeCheckboxGroupRef>(),
      onLayout = jest.fn()
    const content = (selected: readonly string[], name: string, label: string) => (
      <CheckboxGroup
        ref={ref}
        value={selected}
        testID={name}
        data-testid="alias-group"
        accessibilityLabel={label}
        aria-label="Alias group"
        onLayout={onLayout}
        orientation="horizontal"
        isReadOnly
      >
        <Checkbox value="one">One</Checkbox>
      </CheckboxGroup>
    )
    const view = await render(content([], "native-group", "Native group"))
    const original = ref.current
    expect(original).not.toBeNull()
    const group = screen.getByTestId("native-group")
    expect(group.props.accessibilityLabel).toBe("Native group")
    expect(group.props.accessible).toBe(false)
    expect(screen.queryByTestId("alias-group")).toBeNull()
    for (const prop of ["value", "defaultValue", "onChange", "orientation", "isReadOnly", "isDisabled"]) {
      expect(group.props[prop]).toBeUndefined()
    }
    const event = { nativeEvent: { layout: { x: 3, y: 4, width: 160, height: 44 }, target: 17 } }
    await fireEvent(group, "layout", event)
    expect(onLayout.mock.calls).toEqual([[event]])
    expect(onLayout.mock.calls[0][0]).toBe(event)
    await view.rerender(content(["one"], "", ""))
    expect(ref.current).toBe(original)
    expect(screen.getByTestId("").props.accessibilityLabel).toBe("")
    await view.unmount()
    expect(ref.current).toBeNull()
  })

  it("preserves array order and immutability through nested wrappers and reports group before member", async () => {
    const source = Object.freeze(["unrendered", "first"])
    const calls: unknown[] = []
    await render(
      <CheckboxGroup defaultValue={source} onChange={(next) => calls.push(["group", next])}>
        <View>
          <Checkbox value="first" onChange={(next) => calls.push(["member", next])}>
            First
          </Checkbox>
        </View>
        <View>
          <Checkbox value="second">Second</Checkbox>
        </View>
      </CheckboxGroup>,
    )
    const user = userEvent.setup()
    await user.press(screen.getByRole("checkbox", { name: "Second" }))
    await user.press(screen.getByRole("checkbox", { name: "First" }))
    expect(calls).toEqual([
      ["group", ["unrendered", "first", "second"]],
      ["group", ["unrendered", "second"]],
      ["member", false],
    ])
    expect(source).toEqual(["unrendered", "first"])
    expect(screen.getByRole("checkbox", { name: "Second" }).props.accessibilityState.checked).toBe(true)
  })

  it("lets controlled group value own selection over member state props", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(
      <CheckboxGroup value={[]} onChange={onChange}>
        <Checkbox value="first" isSelected defaultSelected>
          First
        </Checkbox>
      </CheckboxGroup>,
    )
    await userEvent.setup().press(screen.getByRole("checkbox"))
    expect(onChange.mock.calls).toEqual([[["first"]]])
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false)
    await rerender(
      <CheckboxGroup value={["first"]} onChange={onChange}>
        <Checkbox value="first" isSelected={false}>
          First
        </Checkbox>
      </CheckboxGroup>,
    )
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true)
  })

  it.each(["isDisabled", "isReadOnly"] as const)("enforces group %s despite child false", async (flag) => {
    const groupChange = jest.fn(),
      memberChange = jest.fn()
    await render(
      <CheckboxGroup {...{ [flag]: true }} onChange={groupChange}>
        <View>
          <Checkbox value="first" isDisabled={false} isReadOnly={false} onChange={memberChange}>
            First
          </Checkbox>
        </View>
      </CheckboxGroup>,
    )
    await fireEvent.press(screen.getByRole("checkbox"), event)
    expect(groupChange).not.toHaveBeenCalled()
    expect(memberChange).not.toHaveBeenCalled()
  })

  it("isolates nested groups and leaves a value-less checkbox locally controlled", async () => {
    const onChange = jest.fn()
    await render(
      <CheckboxGroup isDisabled defaultValue={["first"]} onChange={onChange}>
        <Checkbox value="first">Outer</Checkbox>
        <CheckboxGroup>
          <Checkbox value="first">Inner</Checkbox>
          <Checkbox defaultSelected>Standalone</Checkbox>
        </CheckboxGroup>
      </CheckboxGroup>,
    )
    await userEvent.setup().press(screen.getByRole("checkbox", { name: "Inner" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("checkbox", { name: "Inner" }).props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    })
    await userEvent.setup().press(screen.getByRole("checkbox", { name: "Standalone" }))
    expect(screen.getByRole("checkbox", { name: "Standalone" }).props.accessibilityState.checked).toBe(false)
  })

  it("keeps group children individually accessible and preserves root styles without squaring disabled opacity", async () => {
    await render(
      <CheckboxGroup
        isDisabled
        orientation="horizontal"
        customStyles={{ gap: 17 }}
        style={({ defaultStyle }) => defaultStyle}
      >
        <Checkbox>First</Checkbox>
        <Checkbox>Second</Checkbox>
      </CheckboxGroup>,
    )
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    expect(screen.getByTestId("checkbox-group").props.accessible).toBe(false)
    expect(screen.getByTestId("checkbox-group")).toHaveStyle({ flexDirection: "row", gap: 17 })
    expect(screen.getByTestId("checkbox-group").props.style.opacity).toBeUndefined()
    expect(screen.getByRole("checkbox", { name: "First" })).toHaveStyle({ opacity: 0.4 })
  })
})
