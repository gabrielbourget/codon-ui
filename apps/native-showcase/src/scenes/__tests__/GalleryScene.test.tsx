import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Gallery scene")
  return press
}
const measureGrid = async (width = 280) =>
  fireEvent(screen.getByTestId("thumbnail-showcase-grid"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 60 } },
  })

it("preserves keyed caller actions through reorder/columns/theme/window changes and explicit restart", async () => {
  const press = await enter()
  await measureGrid()
  expect(screen.getAllByTestId("thumbnail-showcase-secondary-slot")).toHaveLength(4)
  expect(screen.getByTestId("gallery-overflow")).toHaveTextContent("+1")
  await press("Gallery A, count 0")
  await press("Reorder gallery items")
  await press("Next gallery column count")
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(screen.getByRole("button", { name: "Gallery A, count 1" })).toBeOnTheScreen()
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Columns: 2.*Actions: 1/)
  await press("Gallery overflow 1")
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Overflow actions: 1/)
  await press("Restart gallery content")
  expect(screen.getByRole("button", { name: "Gallery A, count 0" })).toBeOnTheScreen()
  await press("Reset scene")
  await press("Gallery scene")
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Mode: all.*Columns: default.*Actions: 0.*Lifetime: 0/)
})

it("retains nullish/falsy primary semantics and count normalization without inventing source values", async () => {
  const press = await enter()
  await press("Toggle empty gallery items")
  await press("Next gallery primary")
  expect(screen.getByTestId("gallery-primary-placeholder")).toBeOnTheScreen()
  expect(screen.queryByTestId("thumbnail-showcase-grid")).toBeNull()
  await press("Next gallery primary")
  expect(screen.getByTestId("gallery-primary-placeholder")).toBeOnTheScreen()
  await press("Next gallery primary")
  expect(screen.queryByTestId("gallery-primary-placeholder")).toBeNull()
  expect(screen.getByTestId("thumbnail-showcase-primary")).toHaveTextContent("0")
  expect(screen.getAllByTestId("gallery-secondary-placeholder")).toHaveLength(4)
  await press("Next gallery primary")
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Primary: false/)
  expect(screen.getAllByTestId("gallery-secondary-placeholder")).toHaveLength(4)
  await press("Next gallery primary")
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Primary: empty/)
  for (const count of ["2", "0", "2.9", "NaN", "Infinity"]) {
    await press("Next gallery slot count")
    expect(screen.getByTestId("gallery-state")).toHaveTextContent(new RegExp(`Slots: ${count.replace(".", "\\.")}\\.`))
    const expected = count === "0" ? 0 : count === "2" || count === "2.9" ? 2 : 4
    expect(screen.queryAllByTestId("gallery-secondary-placeholder")).toHaveLength(expected)
  }
})

it("exercises all modes, style owners, caller disabled guards and native frame readouts", async () => {
  const press = await enter()
  await press("Toggle gallery five items")
  expect(screen.getAllByTestId("gallery-secondary-placeholder")).toHaveLength(3)
  await press("Toggle gallery actions disabled")
  await press("Gallery A, count 0")
  expect(screen.getByTestId("gallery-state")).toHaveTextContent(/Actions: 0/)
  await press("Toggle gallery styles")
  await measureGrid(238)
  expect(screen.getByTestId("gallery-example")).toHaveStyle({ width: 260, padding: 5, gap: 12 })
  expect(screen.getByTestId("thumbnail-showcase-primary")).toHaveStyle({ aspectRatio: 2, borderWidth: 2 })
  expect(screen.getAllByTestId("thumbnail-showcase-secondary-slot")[0]).toHaveStyle({ width: 40, borderWidth: 1 })
  await press("Next gallery mode")
  expect(screen.queryByTestId("thumbnail-showcase-grid")).toBeNull()
  await press("Next gallery mode")
  expect(screen.queryByTestId("thumbnail-showcase-primary")).toBeNull()
  expect(screen.getByTestId("thumbnail-showcase-grid")).toBeOnTheScreen()
  await press("Toggle gallery styles")
  await press("Toggle gallery zero width")
  expect(screen.getByTestId("gallery-example")).toHaveStyle({ width: 0 })
  await fireEvent(screen.getByTestId("gallery-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
  })
  expect(screen.getByTestId("gallery-frames")).toHaveTextContent(/root 0 x 0/)
})
