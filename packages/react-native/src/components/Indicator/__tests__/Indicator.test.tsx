import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import {
  AVAILABLE_INDICATOR_SHAPES,
  Button,
  Indicator,
  NativeThemeProvider,
  type TNativeIndicatorRef,
  type TNativeIndicatorStyleState,
} from "../../.."

it("CAP.indicator.001 renders the active circular native defaults without an extra accessible target", async () => {
  await render(<Indicator />)
  const indicator = screen.getByTestId("indicator")
  expect(indicator).toHaveStyle({
    width: 10,
    height: 10,
    borderWidth: 0,
    borderRadius: 10000,
    backgroundColor: "#171717",
    borderColor: "#171717",
    flexShrink: 0,
  })
  expect(indicator.props.accessible).toBe(false)
})

it("CAP.indicator.002 keeps inactive fill independent of the active border and controlled owner", async () => {
  const { rerender } = await render(<Indicator isActive={false} color="lime" inactiveColor="gray" />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "gray", borderColor: "lime" })
  await rerender(<Indicator isActive color="lime" inactiveColor="gray" />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "lime", borderColor: "lime" })
  await rerender(<Indicator isActive={false} color="lime" />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "transparent", borderColor: "lime" })
})

it("CAP.indicator.003 preserves computed, custom and final root style precedence", async () => {
  await render(
    <Indicator
      color="green"
      borderColor="black"
      borderWidth={2}
      shape="rounded"
      size={14}
      customStyles={{ backgroundColor: "purple", marginTop: 5 }}
      style={{ backgroundColor: "tomato", marginBottom: 10 }}
    />,
  )
  expect(screen.getByTestId("indicator")).toHaveStyle({
    width: 14,
    height: 14,
    borderRadius: 5,
    borderColor: "black",
    borderWidth: 2,
    backgroundColor: "tomato",
    marginTop: 5,
    marginBottom: 10,
  })
})

it("CAP.indicator.004 maps logical sizes and square shape without CSS unit props", async () => {
  const { rerender } = await render(<Indicator size={14} borderWidth={2} shape="square" />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ width: 14, height: 14, borderWidth: 2, borderRadius: 0 })
  await rerender(<Indicator size="50%" />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ width: "50%", height: "50%" })
  await rerender(<Indicator size={0} borderWidth={0} />)
  expect(screen.getByTestId("indicator")).toHaveStyle({ width: 0, height: 0, borderWidth: 0 })
})

it("CAP.indicator.005 consumes wrapper props and forwards native identity/layout/ref/name precedence", async () => {
  const ref = createRef<TNativeIndicatorRef>()
  const layout = jest.fn()
  await render(
    <Indicator
      ref={ref}
      nativeID="native-indicator"
      testID="chosen-id"
      data-testid="alias-id"
      accessibilityLabel="Native name"
      aria-label="Alias name"
      accessible
      role="img"
      pointerEvents="none"
      collapsable={false}
      onLayout={layout}
      isActive={false}
      color="red"
      inactiveColor="blue"
      borderColor="black"
      borderWidth={2}
      shape="rounded"
      size={20}
      customStyles={{ opacity: 0.8 }}
    />,
  )
  const root = screen.getByTestId("chosen-id")
  expect(root.props).toMatchObject({
    nativeID: "native-indicator",
    accessibilityLabel: "Native name",
    accessible: true,
    role: "img",
    pointerEvents: "none",
    collapsable: false,
  })
  expect(screen.queryByTestId("alias-id")).toBeNull()
  expect(typeof ref.current?.measure).toBe("function")
  const event = { nativeEvent: { layout: { x: 2, y: 4, width: 20, height: 20 } } }
  await fireEvent(root, "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
  for (const prop of [
    "isActive",
    "size",
    "color",
    "inactiveColor",
    "borderColor",
    "borderWidth",
    "shape",
    "customStyles",
    "data-testid",
  ])
    expect(root.props[prop]).toBeUndefined()
})

it.each(AVAILABLE_INDICATOR_SHAPES)(
  "NATIVE.display.001 uses current theme radii and foreground for shape %s",
  async (shape) => {
    const { rerender } = await render(
      <NativeThemeProvider>
        <Indicator shape={shape} />
      </NativeThemeProvider>,
    )
    await rerender(
      <NativeThemeProvider mode="dark">
        <Indicator shape={shape} />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "#ffffff", borderColor: "#ffffff" })
    await rerender(
      <NativeThemeProvider
        mode="dark"
        overrides={{ colors: { foreground: "orange" }, radius: { rounded: 8, round: 99 } }}
      >
        <Indicator shape={shape} />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("indicator")).toHaveStyle({
      backgroundColor: "orange",
      borderColor: "orange",
      borderRadius: shape === "circle" ? 99 : shape === "rounded" ? 8 : 0,
    })
  },
)

it("NATIVE.display.001 inherits the public Button's owned foreground and live theme updates", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <Button order="primary">
        <Indicator />
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "#ffffff", borderColor: "#ffffff" })
  await rerender(
    <NativeThemeProvider overrides={{ actions: { primary: { foreground: "orange" } } }}>
      <Button order="primary">
        <Indicator />
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "orange", borderColor: "orange" })
})

it("NATIVE.display.001 supplies current controlled state and post-custom defaultStyle to callbacks", async () => {
  const states: TNativeIndicatorStyleState[] = []
  const callback = (state: TNativeIndicatorStyleState) => {
    states.push(state)
    return [state.defaultStyle, { backgroundColor: state.isActive ? "red" : "blue", width: 40 }]
  }
  const { rerender } = await render(
    <Indicator isActive={false} size={10} customStyles={{ width: 30, opacity: 0 }} style={callback} />,
  )
  expect(states.at(-1)).toMatchObject({ isActive: false, defaultStyle: { width: 30, height: 10, opacity: 0 } })
  expect(screen.getByTestId("indicator")).toHaveStyle({ width: 40, height: 10, opacity: 0, backgroundColor: "blue" })
  await rerender(<Indicator isActive size={10} style={callback} />)
  expect(states.at(-1)?.isActive).toBe(true)
  expect(screen.getByTestId("indicator")).toHaveStyle({ backgroundColor: "red" })
})

it("NATIVE.display.002 supports dynamic colors and registered/array styles", async () => {
  const color = PlatformColor("systemBlueColor")
  const styles = StyleSheet.create({ custom: { opacity: 0.5, borderRadius: 3 } })
  await render(<Indicator color={color} customStyles={[false, styles.custom]} style={[undefined, { opacity: 0 }]} />)
  expect(screen.getByTestId("indicator")).toHaveStyle({
    backgroundColor: color,
    borderColor: color,
    opacity: 0,
    borderRadius: 3,
  })
})

it.each([-1, NaN, Infinity])("NATIVE.display.002 rejects invalid size %s", async (size) => {
  await expect(render(<Indicator size={size} />)).rejects.toThrow(/Indicator: size/)
})

it.each([-1, NaN, Infinity])("NATIVE.display.002 rejects invalid border width %s", async (borderWidth) => {
  await expect(render(<Indicator borderWidth={borderWidth} />)).rejects.toThrow(/Indicator: borderWidth/)
})

it.each(["color", "inactiveColor", "borderColor"] as const)(
  "NATIVE.display.002 validates explicit native %s",
  async (field) => {
    await expect(render(<Indicator {...{ [field]: "var(--unsupported)" }} />)).rejects.toThrow(
      /unsupported native color/,
    )
  },
)

it("NATIVE.display.002 validates authored style colors including callback output", async () => {
  await expect(render(<Indicator customStyles={{ backgroundColor: "var(--unsupported)" }} />)).rejects.toThrow(
    /unsupported native color/,
  )
  await expect(render(<Indicator style={() => ({ borderColor: "var(--unsupported)" })} />)).rejects.toThrow(
    /unsupported native color/,
  )
})

it("NATIVE.display.003 preserves explicit empty name and identity aliases", async () => {
  await render(<Indicator testID="" data-testid="fallback-id" accessibilityLabel="" aria-label="Fallback label" />)
  expect(screen.getByTestId("").props.accessibilityLabel).toBe("")
  expect(screen.queryByTestId("fallback-id")).toBeNull()
})
