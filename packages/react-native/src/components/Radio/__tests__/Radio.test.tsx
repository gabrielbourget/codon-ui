import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, Fragment } from "react"
import { Platform, View } from "react-native"

import {
  NativeThemeProvider,
  Radio,
  RadioGroup,
  type RadioProps,
  type TNativeRadioGroupRef,
  type TNativeRadioRef,
} from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const event = { nativeEvent: { timestamp: 100 } }
const hidden = { includeHiddenElements: true }
const checked = (name: string) => screen.getByRole("radio", { name }).props.accessibilityState.checked

it("forwards the original native activation object while retaining group-owned selection", async () => {
  const onPress = jest.fn(),
    onChange = jest.fn()
  await render(
    <RadioGroup aria-label="Choices" value={null} onChange={onChange}>
      <Radio value="one" aria-label="One" onPress={onPress} />
    </RadioGroup>,
  )
  const control = screen.getByRole("radio")
  await fireEvent(control, "press", event)
  expect(onPress.mock.calls).toEqual([[event]])
  expect(onPress.mock.calls[0][0]).toBe(event)
  expect(onChange.mock.calls).toEqual([["one"]])
  expect(control.props.accessibilityState.checked).toBe(false)
  expect(control.props.value).toBeUndefined()
})

it("selects one wrapped member, leaves reselection quiet and preserves native press observation", async () => {
  const onChange = jest.fn(),
    onPress = jest.fn()
  await render(
    <RadioGroup aria-label="Choices" onChange={onChange}>
      <View>
        <Radio value="first" aria-label="First">
          First
        </Radio>
      </View>
      <Radio value="second" aria-label="Second" onPress={onPress}>
        {({ isSelected }) => <>Choice {isSelected ? 2 : 0}</>}
      </Radio>
    </RadioGroup>,
  )
  const user = userEvent.setup()
  await user.press(screen.getByRole("radio", { name: "Second" }))
  await user.press(screen.getByRole("radio", { name: "Second" }))
  expect(onChange.mock.calls).toEqual([["second"]])
  expect(onPress).toHaveBeenCalledTimes(2)
  expect(checked("First")).toBe(false)
  expect(checked("Second")).toBe(true)
  expect(screen.getByText("Choice 2")).toBeOnTheScreen()
})

it("treats null as controlled clearing and waits for parent echo", async () => {
  const onChange = jest.fn()
  const children = (
    <>
      <Radio value="one" aria-label="One" />
      <Radio value="" aria-label="Empty" />
    </>
  )
  const { rerender } = await render(
    <RadioGroup aria-label="Choices" value={null} defaultValue="one" onChange={onChange}>
      {children}
    </RadioGroup>,
  )
  expect(checked("One")).toBe(false)
  await userEvent.setup().press(screen.getByRole("radio", { name: "One" }))
  expect(onChange.mock.calls).toEqual([["one"]])
  expect(checked("One")).toBe(false)
  await rerender(
    <RadioGroup aria-label="Choices" value="one" onChange={onChange}>
      {children}
    </RadioGroup>,
  )
  expect(checked("One")).toBe(true)
  await rerender(
    <RadioGroup aria-label="Choices" value="" onChange={onChange}>
      {children}
    </RadioGroup>,
  )
  expect(checked("Empty")).toBe(true)
  expect(checked("One")).toBe(false)
  await rerender(
    <RadioGroup aria-label="Choices" value={null}>
      {children}
    </RadioGroup>,
  )
  expect(checked("Empty")).toBe(false)
})

it("initializes defaultValue once, including an empty-string choice", async () => {
  const onChange = jest.fn()
  const children = (
    <>
      <Radio value="one" aria-label="One" />
      <Radio value="" aria-label="Empty" />
    </>
  )
  const { rerender } = await render(
    <RadioGroup aria-label="Choices" defaultValue="" onChange={onChange}>
      {children}
    </RadioGroup>,
  )
  expect(checked("Empty")).toBe(true)
  await rerender(
    <RadioGroup aria-label="Choices" defaultValue="one" onChange={onChange}>
      {children}
    </RadioGroup>,
  )
  expect(checked("Empty")).toBe(true)
  await userEvent.setup().press(screen.getByRole("radio", { name: "One" }))
  expect(checked("One")).toBe(true)
  expect(onChange.mock.calls).toEqual([["one"]])
})

it("retains requested selection through removal and reinsertion without an automatic change", async () => {
  const onChange = jest.fn()
  const member = <Radio value="one" aria-label="One" />
  const { rerender } = await render(
    <RadioGroup aria-label="Choices" defaultValue="one" onChange={onChange}>
      {member}
    </RadioGroup>,
  )
  await rerender(<RadioGroup aria-label="Choices" onChange={onChange} />)
  await rerender(
    <RadioGroup aria-label="Choices" onChange={onChange}>
      {member}
    </RadioGroup>,
  )
  expect(checked("One")).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "enforces group %s and applies disabled opacity once per member",
  async (flag) => {
    const onChange = jest.fn(),
      onPress = jest.fn()
    await render(
      <RadioGroup aria-label="Choices" {...{ [flag]: true }} onChange={onChange}>
        <Radio value="one" aria-label="One" isDisabled={false} onPress={onPress} />
      </RadioGroup>,
    )
    const member = screen.getByRole("radio", { name: "One" })
    await fireEvent.press(member, event)
    expect(onChange).not.toHaveBeenCalled()
    expect(onPress).not.toHaveBeenCalled()
    expect(member.props).toMatchObject({
      focusable: flag !== "isDisabled",
      accessibilityState: { checked: false, disabled: flag === "isDisabled" },
    })
    expect(member).toHaveStyle({ opacity: flag === "isDisabled" ? 0.4 : 1 })
    expect(screen.getByTestId("radio-group").props.style.opacity).toBeUndefined()
  },
)

it("allows a member to be disabled independently", async () => {
  const onChange = jest.fn()
  await render(
    <RadioGroup aria-label="Choices" onChange={onChange}>
      <Radio value="one" aria-label="One" isDisabled />
      <Radio value="two" aria-label="Two" />
    </RadioGroup>,
  )
  const user = userEvent.setup()
  await user.press(screen.getByRole("radio", { name: "One" }))
  await user.press(screen.getByRole("radio", { name: "Two" }))
  expect(onChange.mock.calls).toEqual([["two"]])
})

it("isolates nested groups and their guards without cloning children", async () => {
  const outerChange = jest.fn(),
    innerChange = jest.fn()
  await render(
    <RadioGroup aria-label="Outer group" isDisabled defaultValue="one" onChange={outerChange}>
      <Radio value="one" aria-label="Outer" />
      <RadioGroup aria-label="Inner group" onChange={innerChange}>
        <View>
          <Radio value="one" aria-label="Inner" />
        </View>
      </RadioGroup>
    </RadioGroup>,
  )
  await userEvent.setup().press(screen.getByRole("radio", { name: "Inner" }))
  expect(checked("Outer")).toBe(true)
  expect(checked("Inner")).toBe(true)
  expect(innerChange.mock.calls).toEqual([["one"]])
  expect(outerChange).not.toHaveBeenCalled()
})

it("cancels an active gesture when group read-only takes over, balancing native end observation", async () => {
  const onChange = jest.fn(),
    onPressIn = jest.fn(),
    onPressOut = jest.fn(),
    onPress = jest.fn()
  const child = <Radio value="one" aria-label="One" {...{ onPressIn, onPressOut, onPress }} />
  const { rerender } = await render(
    <RadioGroup aria-label="Choices" onChange={onChange}>
      {child}
    </RadioGroup>,
  )
  await fireEvent(screen.getByRole("radio"), "pressIn", event)
  await rerender(
    <RadioGroup aria-label="Choices" isReadOnly onChange={onChange}>
      {child}
    </RadioGroup>,
  )
  await fireEvent(screen.getByRole("radio"), "pressOut", event)
  await fireEvent.press(screen.getByRole("radio"), event)
  expect(onPressIn).toHaveBeenCalledTimes(1)
  expect(onPressOut).toHaveBeenCalledTimes(1)
  expect(onPress).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})

it("preserves separately named member traits and real refs with native identity precedence", async () => {
  const ref = createRef<TNativeRadioRef>(),
    groupRef = createRef<TNativeRadioGroupRef>()
  await render(
    <RadioGroup ref={groupRef} accessibilityLabel="Native group" aria-label="Alias group" defaultValue="one">
      <Radio
        ref={ref}
        value="one"
        accessibilityLabel="Native member"
        aria-label="Alias member"
        testID="native"
        data-testid="alias"
      >
        {["Choose ", <Fragment key="number">3</Fragment>]}
      </Radio>
      <Radio value="two" aria-label="Two">
        <View testID="authored" />
      </Radio>
    </RadioGroup>,
  )
  expect(ref.current).not.toBeNull()
  expect(groupRef.current).not.toBeNull()
  expect(screen.getAllByRole("radio")).toHaveLength(2)
  expect(screen.getByTestId("radio-group").props).toMatchObject({
    accessible: false,
    role: "radiogroup",
    accessibilityLabel: "Native group",
  })
  expect(screen.getByTestId("native")).toBe(screen.getByRole("radio", { name: "Native member" }))
  expect(screen.getByTestId("native").props.accessibilityState).toEqual({ checked: true, disabled: false })
  expect(screen.getByText("Choose 3").props.selectable).toBe(false)
  expect(screen.getByText("Choose 3").props.allowFontScaling).not.toBe(false)
  expect(screen.getByTestId("authored")).toBeOnTheScreen()
})

it("keeps a stable selected fill during hover and press and applies explicit color only to the mark", async () => {
  await render(
    <NativeThemeProvider mode="dark">
      <RadioGroup aria-label="Choices" defaultValue="one">
        <Radio value="one" aria-label="One" color="tomato" order="primary">
          Label
        </Radio>
      </RadioGroup>
    </NativeThemeProvider>,
  )
  const member = screen.getByRole("radio")
  await fireEvent(member, "hoverIn", event)
  await fireEvent(member, "pressIn", event)
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ backgroundColor: "tomato", borderColor: "tomato" })
  expect(screen.getByText("Label")).toHaveStyle({ color: "#ffffff" })
})

it("uses pressed before hover for unselected marks, stable selected action roles and focus options", async () => {
  const child = <Radio value="one" aria-label="One" order="primary" geometry="round" offsetFocusRing={false} />
  const { rerender } = await render(
    <NativeThemeProvider mode="dark">
      <RadioGroup aria-label="Choices">{child}</RadioGroup>
    </NativeThemeProvider>,
  )
  await fireEvent(screen.getByRole("radio"), "hoverIn", event)
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ backgroundColor: "#192237" })
  await fireEvent(screen.getByRole("radio"), "pressIn", event)
  await fireEvent(screen.getByRole("radio"), "focus", event)
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({
    backgroundColor: "#1b2e57",
    borderRadius: 10000,
    outlineWidth: 1.5,
    outlineOffset: 0,
  })
  await rerender(
    <NativeThemeProvider mode="dark">
      <RadioGroup aria-label="Choices" value="one">
        {child}
      </RadioGroup>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ backgroundColor: "#2563eb" })
  await rerender(
    <RadioGroup aria-label="Choices">
      <Radio value="one" aria-label="One" enableFocusStyle={false} />
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-shape", hidden).props.style.outlineWidth).toBeUndefined()
})

it("separates target and mark styles and gives callbacks post-custom defaults", async () => {
  await render(
    <RadioGroup
      aria-label="Choices"
      orientation="horizontal"
      customStyles={{ gap: 17 }}
      style={({ defaultStyle, value }) => [defaultStyle, { padding: value === null ? 5 : 0 }]}
    >
      <Radio
        value="one"
        aria-label="One"
        width={80}
        height={60}
        customStyles={{ width: 24, backgroundColor: "red" }}
        customShapeStyles={{ width: 18, borderColor: "tomato" }}
        style={({ defaultStyle }) => [defaultStyle, { backgroundColor: "blue" }]}
      />
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-group")).toHaveStyle({ flexDirection: "row", flexWrap: "wrap", gap: 17, padding: 5 })
  expect(screen.getByRole("radio")).toHaveStyle({ width: 24, height: 60, backgroundColor: "blue" })
  expect(screen.getByRole("radio").props.style.minWidth).toBeUndefined()
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ width: 18, height: 20, borderColor: "tomato" })
})

it.each(["ios", "android"] as const)("uses %s automatic targets around a fixed 20-unit mark", async (os) => {
  const platform = jest.replaceProperty(Platform, "OS", os)
  try {
    await render(
      <RadioGroup aria-label="Choices">
        <Radio value="one" aria-label="One" />
      </RadioGroup>,
    )
    expect(screen.getByRole("radio")).toHaveStyle({
      minWidth: os === "ios" ? 44 : 48,
      minHeight: os === "ios" ? 44 : 48,
    })
    expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ width: 20, height: 20 })
  } finally {
    platform.restore()
  }
})

it("rejects standalone Radio and invalid runtime values", async () => {
  await expect(render(<Radio value="one" aria-label="One" />)).rejects.toThrow(/RadioGroup ancestor/)
  await expect(
    render(
      <RadioGroup aria-label="Choices">
        <Radio value={undefined as unknown as string} aria-label="One" />
      </RadioGroup>,
    ),
  ).rejects.toThrow(/value must be a string/)
})

it.each(["", "  "])("requires nonempty group and member names %p", async (label) => {
  await expect(render(<RadioGroup aria-label={label} />)).rejects.toThrow(/RadioGroup: a nonempty/)
  await expect(
    render(
      <RadioGroup aria-label="Choices">
        <Radio value="one" aria-label={label}>
          Visible label
        </Radio>
      </RadioGroup>,
    ),
  ).rejects.toThrow(/Radio: a nonempty/)
})

it.each([
  { color: "var(--color)" },
  { customShapeStyles: { backgroundColor: "currentColor" } },
  { style: { borderColor: "var(--color)" } },
] satisfies Partial<RadioProps>[])("rejects unsupported native colors %p", async (props) => {
  await expect(
    render(
      <RadioGroup aria-label="Choices">
        <Radio value="one" aria-label="One" {...props} />
      </RadioGroup>,
    ),
  ).rejects.toThrow(TypeError)
})
