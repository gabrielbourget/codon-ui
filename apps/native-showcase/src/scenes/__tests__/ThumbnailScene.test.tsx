import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { Dimensions, type ImageProps } from "react-native"
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
  await press("Thumbnail scene")
  return press
}
const image = () => screen.getByTestId("thumbnail-example")
const load = async (width = 48, height = 24) =>
  fireEvent(image(), "load", { nativeEvent: { source: { width, height, uri: image().props.src } } })
const fail = async () => fireEvent(image(), "error", { nativeEvent: { error: "fixture decode failure" } })
const resolveNativeSources = jest.requireActual<{
  getImageSourcesFromImageProps: (props: ImageProps) => readonly {
    uri: string
    scale?: number
    width?: number
    height?: number
  }[]
}>("react-native/Libraries/Image/ImageSourceUtils").getImageSourcesFromImageProps

it("retains fallback progress and caller values through equivalent lists, theme/window/fixture changes and reset", async () => {
  const press = await enter()
  const failedURI = image().props.src
  await fail()
  const successfulURI = image().props.src
  expect(successfulURI).not.toBe(failedURI)
  await load()
  await fireEvent(image(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 48, height: 24 } } })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(
    /Errors: 1\. Loads: 1\. Last load: 48 x 24.*Frame: 48 x 24/,
  )
  await press("Toggle equivalent thumbnail candidates")
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(image().props.src).toBe(successfulURI)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 1\. Loads: 1/)
  await press("Toggle thumbnail zero size")
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  await press("Reset scene")
  await press("Thumbnail scene")
  expect(image().props.src).toBe(failedURI)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Zero size: false\. Errors: 0\. Loads: 0/)
})

it("exhausts failed candidates, preserves explicit zero fallback and starts new source contents immediately", async () => {
  const press = await enter()
  await press("Next thumbnail sources")
  await fail()
  await fail()
  expect(screen.getByTestId("thumbnail-fallback")).toBeOnTheScreen()
  await press("Toggle zero thumbnail fallback")
  expect(within(screen.getByTestId("thumbnail-native-parent")).getByText("0")).toBeOnTheScreen()
  expect(screen.queryByTestId("thumbnail-example")).toBeNull()
  await press("Next thumbnail sources")
  expect(within(screen.getByTestId("thumbnail-native-parent")).getByText("0")).toBeOnTheScreen()
  await press("Next thumbnail sources")
  expect(image().props.src).toBeTruthy()
  await load(32, 32)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(
    /Sources: square.*Errors: 2\. Loads: 1\. Last load: 32 x 32/,
  )
})

it("exercises native/adapter style and alt ownership, zero geometry receipts and deliberate lifetime restart", async () => {
  const press = await enter()
  await fail()
  await load()
  await press("Toggle thumbnail styles")
  expect(image()).toHaveStyle({ width: 120, height: 80, borderWidth: 2, resizeMode: "contain" })
  await press("Toggle thumbnail width constraint")
  expect(image()).toHaveStyle({ width: 140, aspectRatio: 2 })
  await press("Toggle thumbnail renderer")
  expect(image()).toHaveStyle({ width: 140, height: "auto" })
  await press("Toggle empty thumbnail alt")
  expect(image().props.accessibilityLabel).toBe("")
  expect(image().props.accessible).toBe(false)
  await press("Toggle thumbnail zero size")
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  await fireEvent(image(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Frame: 0 x 0/)
  await press("Restart thumbnail lifetime")
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Lifetime: 1/)
  expect(image().props.src).toBe("data:image/png;base64,AA==")
})

it("prepares native density source candidates and exact src precedence without inventing decode events", async () => {
  const press = await enter()
  const originalSrc = image().props.src
  await press("Next thumbnail density set")
  const complete = resolveNativeSources(image().props)
  expect(complete.map((source) => source.scale)).toEqual([1, 2, 3])
  expect(new Set(complete.map((source) => source.uri)).size).toBe(3)
  expect(complete.every((source) => source.width === 32 && source.height === 32)).toBe(true)
  expect(complete.map((source) => source.uri)).not.toContain(originalSrc)
  expect(image()).toHaveStyle({ width: 32, height: 32 })
  expect(image().props.accessibilityLabel).toBe("Thumbnail preview / aperçu")
  await press("Next thumbnail density set")
  const withSrc = resolveNativeSources(image().props)
  expect(withSrc.map((source) => source.scale)).toEqual([2, 3, 1])
  expect(withSrc[2].uri).toBe(originalSrc)
  const host = image().unstable_fiber?.stateNode
  expect(host).toBeTruthy()
  await press("Toggle equivalent thumbnail candidates")
  await press("Dark theme")
  expect(image().unstable_fiber?.stateNode).toBe(host)
  expect(resolveNativeSources(image().props)).toEqual(withSrc)
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, scale: 2 } }))
    expect(screen.getByTestId("thumbnail-density-state")).toHaveTextContent(/Window scale: 2/)
    expect(resolveNativeSources(image().props)).toEqual(withSrc)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 0\. Loads: 0/)
  expect(screen.getByTestId("thumbnail-density-state")).toHaveTextContent(/Last native source: none/)
})

it("keeps a caller-selected density alternative authoritative through adapter state, accessibility, zero and reset", async () => {
  const press = await enter()
  const candidateSrc = image().props.src
  await press("Next thumbnail density set")
  await press("Toggle caller-selected thumbnail src")
  const selectedSrc = image().props.src
  expect(selectedSrc).not.toBe(candidateSrc)
  expect(image().props.srcSet).toBeUndefined()
  expect(resolveNativeSources(image().props).map((source) => source.uri)).toEqual([selectedSrc])
  await load(48, 24)
  expect(screen.getByTestId("thumbnail-density-state")).toHaveTextContent(/Last native source: landscape src/)
  await press("Toggle thumbnail renderer")
  const adapterHost = image().unstable_fiber?.stateNode
  expect(adapterHost).toBeTruthy()
  await press("Toggle equivalent thumbnail candidates")
  await press("Toggle empty thumbnail alt")
  await press("Toggle thumbnail zero size")
  await press("Dark theme")
  expect(image().unstable_fiber?.stateNode).toBe(adapterHost)
  expect(image().props.src).toBe(selectedSrc)
  expect(image().props.srcSet).toBeUndefined()
  expect(image().props.accessibilityLabel).toBe("")
  expect(image().props.accessible).toBe(false)
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 0\. Loads: 1/)
  await press("Toggle caller-selected thumbnail src")
  expect(image().props.src).toBe(candidateSrc)
  expect(resolveNativeSources(image().props).map((source) => source.scale)).toEqual([1, 2, 3])
  await press("Reset scene")
  await press("Thumbnail scene")
  expect(image().props.src).toBe(candidateSrc)
  expect(image().props.srcSet).toBeUndefined()
  expect(screen.getByTestId("thumbnail-density-state")).toHaveTextContent(/Density set: off.*Last native source: none/)
})

it("retires replaced density callbacks and preserves genuine source reporting, candidate fallback and explicit zero", async () => {
  const press = await enter()
  await press("Next thumbnail density set")
  const retired = image().props
  const retiredURI = resolveNativeSources(retired)[0].uri
  await press("Next thumbnail density set")
  await act(() => {
    retired.onLoad({ nativeEvent: { source: { uri: retiredURI, width: 32, height: 32 } } })
    retired.onError({ nativeEvent: { error: "retired density attempt" } })
  })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 0\. Loads: 0/)
  await press("Toggle thumbnail zero size")
  expect(image().props.width).toBe(0)
  expect(image().props.height).toBe(0)
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  await press("Toggle thumbnail zero size")
  expect(image()).toHaveStyle({ width: 32, height: 32 })
  const reportedURI = resolveNativeSources(image().props)[0].uri
  await fireEvent(image(), "load", { nativeEvent: { source: { uri: reportedURI, width: 64, height: 64 } } })
  expect(screen.getByTestId("thumbnail-density-state")).toHaveTextContent(/Last native source: density 2x, 64 pixels/)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 0\. Loads: 1\. Last load: 64 x 64/)
  await fail()
  await fail()
  await fail()
  expect(screen.getByTestId("thumbnail-fallback")).toBeOnTheScreen()
  expect(screen.queryByTestId("thumbnail-example")).toBeNull()
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 3\. Loads: 1/)
  await press("Toggle zero thumbnail fallback")
  expect(within(screen.getByTestId("thumbnail-native-parent")).getByText("0")).toBeOnTheScreen()
  await press("Toggle caller-selected thumbnail src")
  expect(image().props.srcSet).toBeUndefined()
  expect(screen.queryByTestId("thumbnail-fallback")).toBeNull()
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 3\. Loads: 1/)
})

it("keeps reference decoding separate from actual view events and prepares fractional/percentage/retirement checks", async () => {
  const press = await enter()
  const state = () => JSON.parse(screen.getByTestId("thumbnail-native-state").props.accessibilityLabel)
  expect(state().loads).toBe(0)
  expect(state().referenceLoads).toBe(0)
  await fail()
  await load()
  expect(state().events.filter((event: { kind: string }) => event.kind === "load")).toHaveLength(1)
  await fireEvent(screen.getByTestId("thumbnail-native-reference"), "load", {
    nativeEvent: { source: { width: 48, height: 24 } },
  })
  expect(state().referenceLoads).toBe(1)
  expect(state().loads).toBe(1)
  await press("Next thumbnail dimension")
  expect(image()).toHaveStyle({ width: 83.25, aspectRatio: 2 })
  expect(screen.getByTestId("thumbnail-native-reference")).toHaveStyle({ width: 83.25, aspectRatio: 2 })
  await press("Next thumbnail dimension")
  expect(image()).toHaveStyle({ width: "50%", aspectRatio: 2 })
  const retired = image().props
  await press("Toggle thumbnail presence")
  expect(screen.queryByTestId("thumbnail-example")).toBeNull()
  await act(() => retired.onLoad({ nativeEvent: { source: { width: 99, height: 99, uri: retired.src } } }))
  expect(state().loads).toBe(1)
  await press("Toggle thumbnail presence")
  expect(image()).toBeOnTheScreen()
})
