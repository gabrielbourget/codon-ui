import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Fragment, useState } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import { Button, NativeThemeProvider, Text, ThumbnailShowcase, type ThumbnailShowcaseSecondaryItem } from "../../.."

const placeholder = <Text testID="primary-placeholder">Missing primary</Text>
const secondaryPlaceholder = ({ index }: { index: number }) => (
  <Text testID="secondary-placeholder">Missing {index}</Text>
)
const slots = () => screen.queryAllByTestId("thumbnail-showcase-secondary-slot")
const grid = () => screen.getByTestId("thumbnail-showcase-grid")
const measure = async (width: number) =>
  fireEvent(grid(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 60 } } })
const items = (count: number): ThumbnailShowcaseSecondaryItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    content: <Text testID="secondary-media">Media {index}</Text>,
  }))

it("CAP.thumbnail-showcase.001 renders only the primary placeholder when no media is available", async () => {
  const secondary = jest.fn(secondaryPlaceholder)
  await render(<ThumbnailShowcase primaryPlaceholder={placeholder} renderSecondaryPlaceholder={secondary} />)
  expect(screen.getByTestId("primary-placeholder")).toBeOnTheScreen()
  expect(slots()).toHaveLength(0)
  expect(secondary).not.toHaveBeenCalled()
  expect(screen.queryByTestId("thumbnail-showcase-grid")).toBeNull()
})

it.each([false, 0, ""] as const)(
  "CAP.thumbnail-showcase.001 preserves primary value %s as available media",
  async (primaryContent) => {
    const secondary = jest.fn(secondaryPlaceholder)
    await render(
      <ThumbnailShowcase
        primaryContent={primaryContent}
        primaryPlaceholder={placeholder}
        renderSecondaryPlaceholder={secondary}
      />,
    )
    expect(screen.queryByTestId("primary-placeholder")).toBeNull()
    expect(slots()).toHaveLength(4)
    expect(secondary.mock.calls.map((call) => call[0])).toEqual([
      { index: 0 },
      { index: 1 },
      { index: 2 },
      { index: 3 },
    ])
    if (primaryContent === 0) expect(screen.getByText("0")).toBeOnTheScreen()
  },
)

it.each([null, undefined])("CAP.thumbnail-showcase.001 uses nullish fallback for %s", async (primaryContent) => {
  await render(<ThumbnailShowcase primaryContent={primaryContent} primaryPlaceholder={placeholder} />)
  expect(screen.getByTestId("primary-placeholder")).toBeOnTheScreen()
  expect(slots()).toHaveLength(0)
})

it("CAP.thumbnail-showcase.002 renders media and the exact remaining placeholder indexes", async () => {
  const secondary = jest.fn(secondaryPlaceholder)
  await render(
    <ThumbnailShowcase
      primaryContent={<Text>Primary</Text>}
      primaryPlaceholder={placeholder}
      secondaryItems={items(1)}
      renderSecondaryPlaceholder={secondary}
    />,
  )
  expect(screen.getAllByTestId("secondary-media")).toHaveLength(1)
  expect(screen.getAllByTestId("secondary-placeholder")).toHaveLength(3)
  expect(secondary.mock.calls.map((call) => call[0])).toEqual([{ index: 1 }, { index: 2 }, { index: 3 }])
  expect(slots()[0]).toHaveStyle({
    width: "100%",
    aspectRatio: 1,
    minWidth: 0,
    overflow: "hidden",
    position: "relative",
  })
})

it("CAP.thumbnail-showcase.002 preserves falsy item content and only delegates nullish content", async () => {
  const secondary = jest.fn(secondaryPlaceholder)
  await render(
    <ThumbnailShowcase
      primaryPlaceholder={placeholder}
      secondaryItems={[
        { id: 0, content: false },
        { id: "", content: 0 },
        { id: 1n, content: "" },
        { id: "null", content: null },
      ]}
      renderSecondaryPlaceholder={secondary}
    />,
  )
  expect(slots()).toHaveLength(4)
  expect(secondary).toHaveBeenCalledTimes(1)
  expect(secondary).toHaveBeenCalledWith({ index: 3 })
  expect(screen.getByText("0")).toBeOnTheScreen()
})

it.each([
  [-2, 0],
  [0, 0],
  [0.9, 0],
  [2.9, 2],
  [NaN, 4],
  [Infinity, 4],
  [-Infinity, 4],
])("CAP.thumbnail-showcase.002 normalizes slot count %s to %s", async (count, expected) => {
  await render(
    <ThumbnailShowcase
      primaryContent={0}
      primaryPlaceholder={placeholder}
      secondarySlotCount={count}
      renderSecondaryPlaceholder={secondaryPlaceholder}
    />,
  )
  expect(slots()).toHaveLength(expected)
})

it("CAP.thumbnail-showcase.003 mounts only the requested primary/secondary content", async () => {
  const secondary = jest.fn(secondaryPlaceholder)
  const { rerender } = await render(
    <ThumbnailShowcase
      primaryContent={<Text testID="primary-media">Primary</Text>}
      primaryPlaceholder={placeholder}
      renderingMode="primary"
      secondaryItems={items(1)}
      renderSecondaryPlaceholder={secondary}
    />,
  )
  expect(screen.getByTestId("primary-media")).toBeOnTheScreen()
  expect(screen.queryByTestId("secondary-media")).toBeNull()
  expect(secondary).not.toHaveBeenCalled()
  await rerender(
    <ThumbnailShowcase
      primaryContent={<Text testID="primary-media">Primary</Text>}
      primaryPlaceholder={placeholder}
      renderingMode="secondary"
      secondaryItems={items(1)}
    />,
  )
  expect(screen.queryByTestId("primary-media")).toBeNull()
  expect(screen.getByTestId("secondary-media")).toBeOnTheScreen()
  await rerender(<ThumbnailShowcase primaryPlaceholder={placeholder} renderingMode="secondary" />)
  expect(screen.queryByTestId("thumbnail-showcase-primary")).toBeNull()
  expect(slots()).toHaveLength(0)
})

it("CAP.thumbnail-showcase.004 replaces the final slot but preserves the canonical hidden count", async () => {
  const overflow = jest.fn(({ hiddenItemCount }: { hiddenItemCount: number }) => (
    <Text testID="overflow">+{hiddenItemCount}</Text>
  ))
  await render(
    <ThumbnailShowcase primaryPlaceholder={placeholder} secondaryItems={items(5)} renderOverflow={overflow} />,
  )
  expect(slots()).toHaveLength(4)
  expect(screen.getAllByTestId("secondary-media")).toHaveLength(3)
  expect(screen.getByTestId("overflow")).toHaveTextContent("+1")
  expect(overflow).toHaveBeenCalledTimes(1)
  expect(overflow).toHaveBeenCalledWith({ hiddenItemCount: 1 })
  await measure(300)
  expect(overflow).toHaveBeenCalledTimes(1)
})

it("CAP.thumbnail-showcase.004 leaves the final visible item when no overflow renderer exists", async () => {
  await render(<ThumbnailShowcase primaryPlaceholder={placeholder} secondaryItems={items(5)} />)
  expect(screen.getAllByTestId("secondary-media")).toHaveLength(4)
  expect(screen.getByText("Media 3")).toBeOnTheScreen()
  expect(screen.queryByText("Media 4")).toBeNull()
})

it("CAP.thumbnail-showcase.004 accepts zero/Fragment overflow output without an invented action", async () => {
  await render(
    <ThumbnailShowcase
      primaryPlaceholder={placeholder}
      secondaryItems={items(5)}
      renderOverflow={() => <Fragment>{0}</Fragment>}
    />,
  )
  expect(screen.getByText("0")).toBeOnTheScreen()
  expect(screen.queryByRole("button")).toBeNull()
})

it("CAP.thumbnail-showcase.005 maps normalized native width and final root styles", async () => {
  const { rerender } = await render(
    <ThumbnailShowcase
      primaryPlaceholder={placeholder}
      testID="showcase"
      width={375}
      style={{ backgroundColor: "tomato" }}
    />,
  )
  expect(screen.getByTestId("showcase")).toHaveStyle({
    width: 375,
    backgroundColor: "tomato",
    flexDirection: "column",
    gap: 10,
  })
  await rerender(<ThumbnailShowcase primaryPlaceholder={placeholder} testID="showcase" width={0} />)
  expect(screen.getByTestId("showcase")).toHaveStyle({ width: 0 })
  await rerender(
    <ThumbnailShowcase
      primaryPlaceholder={placeholder}
      testID="showcase"
      width="50%"
      style={[{ width: 80 }, { width: 120, gap: 0 }]}
    />,
  )
  expect(screen.getByTestId("showcase")).toHaveStyle({ width: 120, gap: 0 })
  await rerender(<ThumbnailShowcase primaryPlaceholder={placeholder} testID="showcase" width="auto" />)
  expect(screen.getByTestId("showcase")).toHaveStyle({ width: "auto" })
})

it("NATIVE.thumbnail-showcase.styles keeps all four style owners and equal tracks independent of authored slot width", async () => {
  const opaque = PlatformColor("systemBlueColor")
  const registered = StyleSheet.create({ slot: { borderRadius: 3, backgroundColor: "green" } })
  await render(
    <ThumbnailShowcase
      primaryContent={0}
      primaryPlaceholder={placeholder}
      testID="showcase"
      width={300}
      style={{ backgroundColor: "red" }}
      primarySlotStyle={{ width: 90, height: 30 }}
      secondaryRowStyle={{ padding: 10, backgroundColor: "blue", columnGap: 0, rowGap: 4 }}
      secondarySlotStyle={[registered.slot, { width: 40, borderColor: opaque }]}
    />,
  )
  await measure(280)
  expect(screen.getByTestId("showcase")).toHaveStyle({ width: 300, backgroundColor: "red" })
  expect(screen.getByTestId("thumbnail-showcase-primary")).toHaveStyle({ width: 90, height: 30 })
  expect(grid().parent).toHaveStyle({ width: "100%", padding: 10, backgroundColor: "blue" })
  expect(grid()).toHaveStyle({ columnGap: 0, rowGap: 4 })
  expect(slots()[0]).toHaveStyle({ width: 40, borderColor: opaque, borderRadius: 3, backgroundColor: "green" })
  expect(slots()[0].parent).toHaveStyle({ width: 70 })
})

it("NATIVE.thumbnail-showcase.grid maps percentage gaps and independent wrapped columns", async () => {
  const { rerender } = await render(
    <ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} secondaryRowStyle={{ columnGap: "10%" }} />,
  )
  await measure(300)
  expect(slots()[0].parent).toHaveStyle({ width: 52.5 })
  expect(grid()).toHaveStyle({ columnGap: "10%", flexWrap: "nowrap" })
  await rerender(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} secondaryColumnCount={2} />)
  expect(slots()[0].parent).toHaveStyle({ width: 145 })
  expect(grid()).toHaveStyle({ flexWrap: "wrap" })
  await rerender(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} secondaryColumnCount={6} />)
  expect(slots()[0].parent).toHaveStyle({ width: 41.666666 })
  expect(slots()).toHaveLength(4)
})

it("NATIVE.thumbnail-showcase.grid preserves authored keyed state across reorder, columns and provider/style changes", async () => {
  const Counter = () => {
    const [value, setValue] = useState(0)
    return (
      <Text testID="counter" onPress={() => setValue((current) => current + 1)}>
        {value}
      </Text>
    )
  }
  const first = [
    { id: 0, content: <Counter /> },
    { id: "other", content: <Text>Other</Text> },
  ]
  const { rerender } = await render(
    <NativeThemeProvider>
      <ThumbnailShowcase primaryPlaceholder={placeholder} secondaryItems={first} />
    </NativeThemeProvider>,
  )
  await fireEvent.press(screen.getByTestId("counter"))
  await measure(300)
  await rerender(
    <NativeThemeProvider mode="dark">
      <ThumbnailShowcase
        primaryPlaceholder={placeholder}
        secondaryItems={[first[1], first[0]]}
        secondaryColumnCount={2}
        secondarySlotStyle={{ borderWidth: 1 }}
      />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("counter")).toHaveTextContent("1")
  await measure(400)
  expect(screen.getByTestId("counter")).toHaveTextContent("1")
})

it("NATIVE.thumbnail-showcase.grid updates private measurement precision without invoking content renderers", async () => {
  const secondary = jest.fn(secondaryPlaceholder)
  await render(
    <ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} renderSecondaryPlaceholder={secondary} />,
  )
  await measure(300)
  const before = StyleSheet.flatten(slots()[0].parent!.props.style).width
  await measure(300.00005)
  expect(StyleSheet.flatten(slots()[0].parent!.props.style).width).toBe(before)
  await measure(304)
  expect(slots()[0].parent).toHaveStyle({ width: 68.5 })
  expect(secondary).toHaveBeenCalledTimes(4)
})

it("NATIVE.thumbnail-showcase.grid ignores invalid/retired measurements and allows a fresh mounted grid", async () => {
  const { rerender } = await render(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} />)
  await measure(NaN)
  await measure(-1)
  expect(StyleSheet.flatten(slots()[0].parent!.props.style).width).toBeUndefined()
  const retired = grid().props.onLayout
  await rerender(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} renderingMode="primary" />)
  await act(() => retired({ nativeEvent: { layout: { width: 999 } } }))
  await rerender(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} />)
  expect(StyleSheet.flatten(slots()[0].parent!.props.style).width).toBeUndefined()
  await measure(300)
  expect(slots()[0].parent).toHaveStyle({ width: 67.5 })
})

it("NATIVE.thumbnail-showcase.root retains native identity and exact layout payloads while consuming wrapper props", async () => {
  const onLayout = jest.fn()
  await render(
    <ThumbnailShowcase
      primaryContent={false}
      primaryPlaceholder={placeholder}
      testID=""
      data-testid="alias"
      nativeID="native"
      accessibilityLabel="Layout"
      accessible={false}
      onLayout={onLayout}
      secondarySlotCount={0}
      width={0}
    />,
  )
  const root = screen.getByTestId("")
  const event = { nativeEvent: { layout: { width: 0, height: 0, x: 2, y: 3 } } }
  await fireEvent(root, "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
  expect(root.props.nativeID).toBe("native")
  expect(root.props.accessible).toBe(false)
  for (const field of [
    "primaryContent",
    "primaryPlaceholder",
    "primarySlotStyle",
    "secondaryItems",
    "secondarySlotCount",
    "secondaryColumnCount",
    "renderOverflow",
    "width",
    "data-testid",
  ])
    expect(root.props[field]).toBeUndefined()
})

it("NATIVE.thumbnail-showcase.content keeps caller actions and never creates a duplicate target", async () => {
  const onPress = jest.fn()
  await render(
    <ThumbnailShowcase
      primaryContent={<Button onPress={onPress}>Open primary</Button>}
      primaryPlaceholder={placeholder}
      secondaryItems={items(5)}
      renderOverflow={({ hiddenItemCount }) => <Button onPress={onPress}>Open {hiddenItemCount} more</Button>}
    />,
  )
  expect(screen.getAllByRole("button")).toHaveLength(2)
  await fireEvent.press(screen.getByRole("button", { name: "Open 1 more" }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

it.each([0, -1, 1.5, NaN, Infinity])(
  "NATIVE.thumbnail-showcase.columns rejects invalid explicit column count %s",
  async (secondaryColumnCount) => {
    await expect(
      render(<ThumbnailShowcase primaryPlaceholder={placeholder} secondaryColumnCount={secondaryColumnCount} />),
    ).rejects.toThrow("positive integer")
  },
)

it("NATIVE.thumbnail-showcase.grid preserves zero layout inputs without a control-sized minimum", async () => {
  await render(
    <ThumbnailShowcase
      primaryContent={0}
      primaryPlaceholder={placeholder}
      testID="showcase"
      width={0}
      secondaryColumnCount={2}
    />,
  )
  await measure(0)
  expect(screen.getByTestId("showcase")).toHaveStyle({ width: 0 })
  expect(slots()[0].parent).toHaveStyle({ width: 0 })
  expect(grid()).toHaveStyle({ height: 10, flexWrap: "nowrap" })
})

it("NATIVE.thumbnail-showcase.grid rejects a retired layout callback after parent configuration changes", async () => {
  const { rerender } = await render(
    <ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} width={300} />,
  )
  await measure(300)
  const oldLayout = grid().props.onLayout
  await rerender(<ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} width={400} />)
  await act(() => oldLayout({ nativeEvent: { layout: { width: 999 } } }))
  expect(slots()[0].parent).toHaveStyle({ width: 67.5 })
  await measure(400)
  expect(slots()[0].parent).toHaveStyle({ width: 92.5 })
})

it("NATIVE.thumbnail-showcase.grid accepts an in-flight measurement through an equivalent parent rerender", async () => {
  const { rerender } = await render(
    <ThumbnailShowcase primaryContent={0} primaryPlaceholder={placeholder} width={300} />,
  )
  const inFlight = grid().props.onLayout
  await rerender(<ThumbnailShowcase primaryContent={false} primaryPlaceholder={placeholder} width={300} />)
  await act(() => inFlight({ nativeEvent: { layout: { width: 300 } } }))
  expect(slots()[0].parent).toHaveStyle({ width: 67.5 })
})
