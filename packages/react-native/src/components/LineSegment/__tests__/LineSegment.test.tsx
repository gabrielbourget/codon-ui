import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import {
  AVAILABLE_LINE_SEGMENT_DIRECTIONS,
  LineSegment,
  NativeThemeProvider,
  type TNativeLineSegmentRef,
  type TNativeLineSegmentStyleState,
} from "../../.."

it("CAP.line-segment.001 renders the public native host", async () => {
  await render(<LineSegment />)
  expect(screen.getByTestId("line-segment")).toBeOnTheScreen()
})
it("CAP.line-segment.002 retains default canonical height-by-size geometry and semantic border", async () => {
  await render(<LineSegment />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ height: 50, width: 2.5, backgroundColor: "#9e9e9e" })
})
it("CAP.line-segment.003 uses height and size for the horizontal token", async () => {
  await render(<LineSegment direction="horizontal" height={80} size={4} color="red" />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ height: 80, width: 4, backgroundColor: "red" })
})
it("CAP.line-segment.004 retains default width-by-size geometry for the vertical token", async () => {
  await render(<LineSegment direction="vertical" />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ width: 50, height: 2.5 })
})
it("CAP.line-segment.005 uses width and size for the vertical token", async () => {
  await render(<LineSegment direction="vertical" width={100} size={5} color="blue" />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ width: 100, height: 5, backgroundColor: "blue" })
})
it("CAP.line-segment.006 maps authored classes to native styling", async () => {
  await render(<LineSegment customStyles={{ opacity: 0.7, borderRadius: 2 }} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ opacity: 0.7, borderRadius: 2, height: 50, width: 2.5 })
})
it("CAP.line-segment.007 retains computed/custom/final precedence", async () => {
  await render(
    <LineSegment
      color="green"
      customStyles={{ backgroundColor: "purple", opacity: 0.5 }}
      style={{ backgroundColor: "tomato", marginTop: 5 }}
    />,
  )
  expect(screen.getByTestId("line-segment")).toHaveStyle({
    backgroundColor: "tomato",
    height: 50,
    width: 2.5,
    marginTop: 5,
    opacity: 0.5,
  })
})
it("CAP.line-segment.008 merges native custom styles with computed geometry", async () => {
  await render(<LineSegment customStyles={{ opacity: 0.5, borderRadius: 4 }} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ opacity: 0.5, borderRadius: 4, height: 50, width: 2.5 })
})
it("CAP.line-segment.009 lets custom styles override shorthand colors", async () => {
  await render(<LineSegment color="green" customStyles={{ backgroundColor: "purple" }} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ backgroundColor: "purple" })
})
it("CAP.line-segment.010 maps CSS lengths to native units and preserves percentages and zero", async () => {
  const { rerender } = await render(<LineSegment height={100} size={3} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ height: 100, width: 3 })
  await rerender(<LineSegment height="50%" size={0} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ height: "50%", width: 0 })
  await rerender(<LineSegment direction="vertical" width="80%" size={5} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ width: "80%", height: 5 })
  await rerender(<LineSegment direction="vertical" width={0} size={0} />)
  expect(screen.getByTestId("line-segment")).toHaveStyle({ width: 0, height: 0 })
})
it("CAP.line-segment.011 consumes wrapper props while forwarding native refs, names and layout payloads", async () => {
  const ref = createRef<TNativeLineSegmentRef>()
  const layout = jest.fn()
  await render(
    <LineSegment
      ref={ref}
      height={40}
      width={50}
      size={5}
      direction="vertical"
      color="green"
      customStyles={{ opacity: 0.5 }}
      nativeID="native-line"
      onLayout={layout}
      testID="native-id"
      data-testid="alias-id"
      accessibilityLabel="Native name"
      aria-label="Alias name"
      accessible
      role="separator"
      collapsable={false}
    />,
  )
  const root = screen.getByTestId("native-id")
  expect(root.props).toMatchObject({
    nativeID: "native-line",
    accessibilityLabel: "Native name",
    accessible: true,
    role: "separator",
    collapsable: false,
  })
  expect(screen.queryByTestId("alias-id")).toBeNull()
  expect(typeof ref.current?.measure).toBe("function")
  const event = { nativeEvent: { layout: { x: 1, y: 2, height: 5, width: 50 } } }
  await fireEvent(root, "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
  for (const prop of ["height", "width", "size", "direction", "color", "customStyles", "data-testid"])
    expect(root.props[prop]).toBeUndefined()
})
it.each(AVAILABLE_LINE_SEGMENT_DIRECTIONS)(
  "NATIVE.display.001 supplies current direction %s and post-custom callback defaults",
  async (direction) => {
    const states: TNativeLineSegmentStyleState[] = []
    await render(
      <LineSegment
        direction={direction}
        customStyles={{ width: 17, backgroundColor: "purple" }}
        style={(state) => {
          states.push(state)
          return [state.defaultStyle, { width: 24 }]
        }}
      />,
    )
    expect(states.at(-1)).toMatchObject({ direction, defaultStyle: { width: 17, backgroundColor: "purple" } })
    expect(screen.getByTestId("line-segment")).toHaveStyle({ width: 24 })
  },
)
it("NATIVE.display.001 follows mounted theme and direction changes", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <LineSegment />
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider mode="dark">
      <LineSegment direction="vertical" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("line-segment")).toHaveStyle({ backgroundColor: "#474747", width: 50, height: 2.5 })
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ colors: { controlBorder: "orange" } }}>
      <LineSegment direction="vertical" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("line-segment")).toHaveStyle({ backgroundColor: "orange", width: 50, height: 2.5 })
})
it("NATIVE.display.002 supports native colors and registered style arrays", async () => {
  const color = PlatformColor("systemBlueColor")
  const registered = StyleSheet.create({ root: { borderRadius: 3 } })
  await render(
    <LineSegment color={color} customStyles={[undefined, registered.root]} style={[false, { opacity: 0 }]} />,
  )
  expect(screen.getByTestId("line-segment")).toHaveStyle({ backgroundColor: color, borderRadius: 3, opacity: 0 })
})
it.each(["height", "width", "size"] as const)("NATIVE.display.002 rejects invalid numeric %s", async (field) => {
  await expect(render(<LineSegment {...{ [field]: -1 }} />)).rejects.toThrow(/finite nonnegative native dimension/)
  await expect(render(<LineSegment {...{ [field]: NaN }} />)).rejects.toThrow(/finite nonnegative native dimension/)
})
it("NATIVE.display.002 validates shorthand, custom and callback colors", async () => {
  await expect(render(<LineSegment color="var(--unsupported)" />)).rejects.toThrow(/unsupported native color/)
  await expect(render(<LineSegment customStyles={{ backgroundColor: "var(--unsupported)" }} />)).rejects.toThrow(
    /unsupported native color/,
  )
  await expect(render(<LineSegment style={() => ({ borderColor: "var(--unsupported)" })} />)).rejects.toThrow(
    /unsupported native color/,
  )
})
it("NATIVE.display.003 preserves decorative defaults and explicit empty name/identity values", async () => {
  await render(<LineSegment testID="" data-testid="fallback" accessibilityLabel="" aria-label="Fallback" />)
  const root = screen.getByTestId("")
  expect(root.props.accessible).toBe(false)
  expect(root.props.accessibilityLabel).toBe("")
  expect(screen.queryByTestId("fallback")).toBeNull()
})
