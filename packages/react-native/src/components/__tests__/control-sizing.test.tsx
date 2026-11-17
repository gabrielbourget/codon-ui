import { render, screen } from "@testing-library/react-native"
import { Platform, StyleSheet, type ViewStyle } from "react-native"

import {
  Button,
  Checkbox,
  Input,
  Link,
  ListBoxItem,
  NativeThemeProvider,
  Radio,
  RadioGroup,
  Switch,
  TextArea,
} from "../.."
import { getNativeControlRootStyle } from "../selection"

type TProbeProps = {
  geometry?: "round"
  customStyles?: ViewStyle
  style?: ViewStyle | ((state: { defaultStyle: ViewStyle }) => ViewStyle)
}
const plain = ({ customStyles, style }: TProbeProps) => ({ customStyles, style })
const controls = [
  {
    name: "Checkbox",
    node: (props: TProbeProps) => (
      <Checkbox testID="target" {...plain(props)}>
        X
      </Checkbox>
    ),
  },
  {
    name: "Switch",
    node: (props: TProbeProps) => <Switch testID="target" accessibilityLabel="Setting" {...plain(props)} />,
  },
  {
    name: "Radio",
    node: (props: TProbeProps) => (
      <RadioGroup accessibilityLabel="Choices">
        <Radio testID="target" value="one" accessibilityLabel="Choice" {...plain(props)}>
          X
        </Radio>
      </RadioGroup>
    ),
  },
  {
    name: "Link",
    node: (props: TProbeProps) => (
      <Link testID="target" href="https://example.invalid" {...plain(props)}>
        X
      </Link>
    ),
  },
  {
    name: "ListBoxItem",
    node: (props: TProbeProps) => <ListBoxItem testID="target" id="one" textValue="Choice" {...plain(props)} />,
  },
  {
    name: "Button",
    node: (props: TProbeProps) => (
      <Button testID="target" {...props}>
        X
      </Button>
    ),
  },
  { name: "Input", node: (props: TProbeProps) => <Input testID="target" {...props} /> },
  {
    name: "TextArea",
    node: (props: TProbeProps) => <TextArea testID="target" accessibilityLabel="Notes" {...props} />,
  },
]
const resolved = () => StyleSheet.flatten(screen.getByTestId("target").props.style)
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it.each(controls.flatMap((control) => ["ios", "android"].map((platform) => ({ ...control, platform }))))(
  "sizes $name naturally on $platform",
  async ({ node, platform }) => {
    jest.replaceProperty(Platform, "OS", platform as "ios" | "android")
    await render(node({}))
    expect(resolved().minWidth).toBeUndefined()
    expect(resolved().minHeight).toBeUndefined()
    expect(resolved().padding).toBe(5)
    expect(resolved().paddingHorizontal).toBeUndefined()
  },
)

it.each(controls)("preserves zero dimensions and explicit $name minima", async ({ node }) => {
  const style = jest.fn(({ defaultStyle }) => ({ ...defaultStyle, minWidth: 9, minHeight: 11 }))
  await render(node({ customStyles: { width: 0, height: 0, minWidth: 0, minHeight: 0, padding: 0 }, style }))
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({
      defaultStyle: expect.objectContaining({ width: 0, height: 0, minWidth: 0, minHeight: 0, padding: 0 }),
    }),
  )
  expect(resolved()).toMatchObject({ width: 0, height: 0, minWidth: 9, minHeight: 11, padding: 0 })
})

it.each(
  controls
    .filter(({ name }) => ["Button", "Input", "TextArea"].includes(name))
    .flatMap((control) => [0, 3, 11].map((padding) => ({ ...control, padding }))),
)("honors scalar $name padding $padding with round geometry", async ({ node, padding }) => {
  await render(node({ geometry: "round", customStyles: { padding } }))
  expect(resolved().padding).toBe(padding)
  expect(resolved().paddingHorizontal).toBeUndefined()
})

it.each(controls)("retains assigned $name axis and edge padding", async ({ node }) => {
  await render(
    node({
      customStyles: { padding: 8, paddingHorizontal: 3, paddingLeft: 0 },
      style: { paddingTop: 1, paddingRight: 2 },
    }),
  )
  expect(resolved()).toMatchObject({ padding: 8, paddingHorizontal: 3, paddingLeft: 0, paddingTop: 1, paddingRight: 2 })
})

it("preserves assigned theme spacing without imposing horizontal padding", async () => {
  await render(
    <NativeThemeProvider overrides={{ spacing: { unit: 0 } }}>
      <Input testID="target" />
    </NativeThemeProvider>,
  )
  expect(resolved().padding).toBe(0)
  expect(resolved().paddingHorizontal).toBeUndefined()
})

it("keeps explicit base minima and final zero overrides in shared control styles", () => {
  const style = jest.fn(({ defaultStyle }) => ({ ...defaultStyle, minHeight: 0 }))
  const result = getNativeControlRootStyle("Probe", { padding: 5, minWidth: 13, minHeight: 17 }, undefined, style, {})
  expect(style).toHaveBeenCalledWith({ defaultStyle: { padding: 5, minWidth: 13, minHeight: 17 } })
  expect(result).toMatchObject({ padding: 5, minWidth: 13, minHeight: 0 })
})
