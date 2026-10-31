import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { Platform, PlatformColor, StyleSheet } from "react-native"

import {
  Avatar,
  NativeThemeProvider,
  type TNativeAvatarProps,
  type TNativeAvatarRef,
  type TNativeAvatarStyleState,
} from "../../.."

const graphic = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const fallback = () => screen.queryByTestId("avatar-fallback", { includeHiddenElements: true })

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("CAP.avatar.001 renders a single named image root with canonical inverse colors and initials", async () => {
  await render(<Avatar />)
  expect(screen.getByRole("img", { name: "Name Unknown" })).toHaveStyle({
    width: 30,
    height: 30,
    borderRadius: 10000,
    backgroundColor: "#171717",
    overflow: "hidden",
  })
  expect(graphic("text")).toHaveTextContent("NU")
  expect(graphic("text")).toHaveStyle({ color: "#ffffff" })
  expect(graphic("text").props.allowFontScaling).not.toBe(false)
  expect(graphic("text").props.selectable).toBe(false)
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.queryByTestId("avatar-image", { includeHiddenElements: true })).toBeNull()
})

it("NATIVE.avatar.002 exposes an enabled passive image without taking the enclosing control's touch responder", async () => {
  const onPress = jest.fn()
  const { rerender } = await render(<Avatar name1="Alice" onPress={onPress} />)
  const root = screen.getByRole("img", { name: "Alice" })
  expect(root).not.toBeDisabled()
  expect(root.props.pointerEvents).toBe("none")
  await fireEvent.press(root, { nativeEvent: { timestamp: 1 } })
  expect(onPress).not.toHaveBeenCalled()
  await rerender(<Avatar name1="Alice" pointerEvents="box-none" />)
  expect(screen.getByRole("img").props.pointerEvents).toBe("box-none")
})

it("NATIVE.avatar.001 retains successful image/fallback lifetime when clickable mode changes", async () => {
  const { rerender } = await render(<Avatar imageURL="a" clickable onPress={() => undefined} />)
  await fireEvent(graphic("avatar-image"), "load", {})
  expect(fallback()).toBeNull()
  const retiredError = graphic("avatar-image").props.onError
  await rerender(<Avatar imageURL="a" clickable={false} onPress={() => undefined} />)
  expect(fallback()).toBeNull()
  expect(screen.getByRole("img")).not.toBeDisabled()
  await act(() => retiredError({}))
  expect(fallback()).toBeNull()
})

it("NATIVE.avatar.001 keeps the actual native root instance stable across image URI changes", async () => {
  const ref = createRef<TNativeAvatarRef>()
  const onPress = jest.fn()
  const { rerender } = await render(<Avatar ref={ref} imageURL="a" clickable onPress={onPress} />)
  const originalRoot = ref.current
  await rerender(<Avatar ref={ref} imageURL="b" clickable onPress={onPress} />)
  expect(ref.current).toBe(originalRoot)
  expect(fallback()).not.toBeNull()
  expect(onPress).not.toHaveBeenCalled()
})

it.each([50, "50", " 50 ", "50%", "auto", 0] as const)("CAP.avatar.002 preserves native size %s", async (size) => {
  await render(<Avatar size={size} />)
  const expected = size === "50" || size === " 50 " ? 50 : size
  expect(screen.getByTestId("avatar")).toHaveStyle({ width: expected, height: expected })
})

it.each([
  ["round", 10000],
  ["rounded", 5],
  ["orthogonal", 0],
] as const)("CAP.avatar.003 retains geometry %s", async (geometry, radius) => {
  await render(<Avatar geometry={geometry} />)
  expect(screen.getByTestId("avatar")).toHaveStyle({ borderRadius: radius })
})

it("CAP.avatar.004 toggles raised styling without retaining a stale shadow", async () => {
  const { rerender } = await render(<Avatar raised />)
  expect(screen.getByTestId("avatar")).toHaveStyle({ elevation: 2, shadowOpacity: 0.24 })
  await rerender(<Avatar raised={false} />)
  expect(StyleSheet.flatten(screen.getByTestId("avatar").props.style).shadowOpacity).toBeUndefined()
})

it("CAP.avatar.005 resolves foreground before color and keeps live theme/provider updates", async () => {
  const { rerender } = await render(<Avatar color="red" foreground="green" background="blue" />)
  expect(screen.getByTestId("avatar")).toHaveStyle({ backgroundColor: "blue" })
  expect(graphic("text")).toHaveStyle({ color: "green" })
  await rerender(<Avatar color="red" />)
  expect(graphic("text")).toHaveStyle({ color: "red" })
  await rerender(
    <NativeThemeProvider mode="dark">
      <Avatar />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("avatar")).toHaveStyle({ backgroundColor: "#ffffff" })
  expect(graphic("text")).toHaveStyle({ color: "#171717" })
  await rerender(
    <NativeThemeProvider overrides={{ colors: { foreground: "purple", background: "orange" }, radius: { rounded: 9 } }}>
      <Avatar geometry="rounded" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("avatar")).toHaveStyle({ backgroundColor: "purple", borderRadius: 9 })
  expect(graphic("text")).toHaveStyle({ color: "orange" })
})

it("CAP.avatar.006 mounts a hidden loading image, reveals success and restores fallback on error", async () => {
  await render(<Avatar imageURL="https://example.test/alice.png" name1="Alice" />)
  const image = graphic("avatar-image")
  expect(image.props.source).toEqual({ uri: "https://example.test/alice.png" })
  expect(image.props.resizeMode).toBe("contain")
  expect(image).toHaveStyle({ opacity: 0, width: "100%", height: "100%", borderRadius: 10000 })
  expect(fallback()).not.toBeNull()
  await fireEvent(image, "load", { nativeEvent: { source: { width: 40, height: 40 } } })
  expect(StyleSheet.flatten(graphic("avatar-image").props.style).opacity).toBeUndefined()
  expect(fallback()).toBeNull()
  await fireEvent(image, "error", { nativeEvent: { error: "decode failed" } })
  expect(graphic("avatar-image")).toHaveStyle({ opacity: 0 })
  expect(fallback()).not.toBeNull()
})

it("CAP.avatar.006 retires old image callbacks across A/B/A, empty URL and unmount", async () => {
  const { rerender, unmount } = await render(<Avatar imageURL="a" />)
  const staleLoad = graphic("avatar-image").props.onLoad
  const staleError = graphic("avatar-image").props.onError
  await rerender(<Avatar imageURL="b" />)
  await fireEvent(graphic("avatar-image"), "load", {})
  await act(() => staleError({}))
  expect(fallback()).toBeNull()
  await rerender(<Avatar imageURL="a" />)
  await act(() => staleLoad({}))
  expect(fallback()).not.toBeNull()
  const finalLoad = graphic("avatar-image").props.onLoad
  await rerender(<Avatar imageURL="" />)
  await act(() => finalLoad({}))
  expect(screen.queryByTestId("avatar-image", { includeHiddenElements: true })).toBeNull()
  expect(fallback()).not.toBeNull()
  await unmount()
  await act(() => {
    staleLoad({})
    staleError({})
    finalLoad({})
  })
})

it.each([
  ["Alice", "Smith", "AS", "Alice Smith"],
  ["Alice", undefined, "A", "Alice"],
  [undefined, "Smith", "S", "Smith"],
  ["", "", "NU", "Name Unknown"],
  [" alice", "smith", " S", " alice smith"],
] as const)("CAP.avatar.007 preserves exact initials/name for %s/%s", async (name1, name2, initials, name) => {
  await render(<Avatar name1={name1} name2={name2} />)
  expect(graphic("text").props.children).toBe(initials)
  expect(screen.getByRole("img", { name })).toBeOnTheScreen()
})

it("CAP.avatar.008 localizes anonymous labels and preserves explicit empty strings", async () => {
  const { rerender } = await render(
    <Avatar labels={{ placeholderFirstName: "Anonymous", placeholderLastName: "Person" }} />,
  )
  expect(screen.getByRole("img", { name: "Anonymous Person" })).toBeOnTheScreen()
  expect(graphic("text")).toHaveTextContent("AP")
  await rerender(<Avatar labels={{ placeholderFirstName: "", placeholderLastName: "" }} />)
  expect(graphic("text").props.children).toBe("")
  expect(screen.getByTestId("avatar").props.accessibilityLabel).toBe(" ")
})

it("CAP.avatar.009–.011 keeps all four style owners, text overrides and post-custom callback defaults", async () => {
  const states: TNativeAvatarStyleState[] = []
  await render(
    <Avatar
      imageURL="a"
      color="red"
      customStyles={[{ backgroundColor: "green", color: "orange", width: 40 }, { opacity: 0.8 }]}
      style={(state) => {
        states.push(state)
        return { backgroundColor: "blue", color: "purple", width: 50 }
      }}
      customImageStyles={{
        backgroundColor: "pink",
        borderRadius: 3,
        opacity: 0.6,
        tintColor: "red",
        position: "relative",
      }}
      customFallbackStyles={{ backgroundColor: "yellow", color: "gray" }}
      customTextProps={{
        testID: "initials",
        allowFontScaling: false,
        variant: "b9",
        customStyles: { color: "green", fontSize: 20 },
        style: { color: "blue" },
      }}
      customTextStyles={{ color: "red", fontSize: 24 }}
    />,
  )
  expect(states.at(-1)).toMatchObject({
    foregroundColor: "orange",
    defaultStyle: { width: 40, color: "orange", opacity: 0.8 },
  })
  expect(screen.getByTestId("avatar")).toHaveStyle({ width: 50, height: 30, backgroundColor: "blue", opacity: 0.8 })
  expect(StyleSheet.flatten(screen.getByTestId("avatar").props.style).color).toBeUndefined()
  expect(graphic("avatar-fallback")).toHaveStyle({ backgroundColor: "yellow" })
  expect(graphic("initials")).toHaveStyle({ color: "blue", fontSize: 24 })
  expect(graphic("initials").props.allowFontScaling).toBe(false)
  await fireEvent(graphic("avatar-image"), "load", {})
  expect(graphic("avatar-image")).toHaveStyle({
    backgroundColor: "pink",
    borderRadius: 3,
    opacity: 0.6,
    tintColor: "red",
  })
})

it("CAP.avatar.009–.011 inherits fallback color while keeping custom text styles above custom text props", async () => {
  const { rerender } = await render(<Avatar customFallbackStyles={{ color: "green" }} />)
  expect(graphic("text")).toHaveStyle({ color: "green" })
  await rerender(
    <Avatar customTextProps={{ customStyles: { color: "green" } }} customTextStyles={{ color: "purple" }} />,
  )
  expect(graphic("text")).toHaveStyle({ color: "purple" })
})

it("CAP.avatar.012 forwards actual native identity/ref/layout/press payloads and consumes wrappers", async () => {
  const ref = createRef<TNativeAvatarRef>()
  const onPress = jest.fn()
  const onLayout = jest.fn()
  await render(
    <Avatar
      ref={ref}
      clickable
      onPress={onPress}
      onLayout={onLayout}
      testID="native-avatar"
      data-testid="alias"
      nativeID="person"
      accessibilityLabel="Native name"
      aria-label="Alias name"
      name1="Alice"
      size={40}
      foreground="white"
      background="black"
      imageURL="a"
      geometry="round"
      raised
      fallbackDelay={10}
      labels={{ placeholderFirstName: "Person" }}
      customTextStyles={{ color: "blue" }}
    />,
  )
  const root = screen.getByRole("button", { name: "Native name" })
  expect(root.props.nativeID).toBe("person")
  expect(screen.queryByTestId("alias")).toBeNull()
  expect(typeof ref.current?.measure).toBe("function")
  const layout = { nativeEvent: { layout: { x: 1, y: 2, width: 30, height: 30 } } }
  const press = { nativeEvent: { timestamp: 20 } }
  await fireEvent(root, "layout", layout)
  await fireEvent.press(root, press)
  expect(onLayout).toHaveBeenCalledWith(layout)
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onPress).toHaveBeenCalledWith(
    expect.objectContaining({ nativeEvent: expect.objectContaining(press.nativeEvent) }),
  )
  const inset = ((Platform.OS === "ios" ? 44 : 48) - 30) / 2
  expect(screen.getByTestId("native-avatar").props.hitSlop).toEqual({
    top: inset,
    bottom: inset,
    left: inset,
    right: inset,
  })
  for (const prop of [
    "size",
    "foreground",
    "background",
    "imageURL",
    "name1",
    "geometry",
    "raised",
    "fallbackDelay",
    "labels",
    "customTextStyles",
    "clickable",
    "data-testid",
    "aria-label",
  ])
    expect(root.props[prop]).toBeUndefined()
})

it("NATIVE.avatar.001 retains one fallback eligibility lifetime through URI/name/theme/delay changes", async () => {
  const { rerender, unmount } = await render(
    <NativeThemeProvider>
      <Avatar imageURL="a" fallbackDelay={100} />
    </NativeThemeProvider>,
  )
  expect(fallback()).toBeNull()
  await act(() => jest.advanceTimersByTime(50))
  await rerender(
    <NativeThemeProvider mode="dark">
      <Avatar imageURL="b" name1="Alice" fallbackDelay={100} />
    </NativeThemeProvider>,
  )
  await act(() => jest.advanceTimersByTime(50))
  expect(fallback()).not.toBeNull()
  await rerender(
    <NativeThemeProvider>
      <Avatar imageURL="c" name1="Smith" fallbackDelay={1000} />
    </NativeThemeProvider>,
  )
  expect(fallback()).not.toBeNull()
  expect(graphic("text")).toHaveTextContent("S")
  await unmount()
})

it("NATIVE.avatar.001 cancels its own pending eligibility timer on unmount", async () => {
  const schedule = jest.spyOn(globalThis, "setTimeout")
  const cancel = jest.spyOn(globalThis, "clearTimeout")
  const { unmount } = await render(<Avatar fallbackDelay={91337} />)
  const index = schedule.mock.calls.findIndex((call) => call[1] === 91337)
  expect(index).toBeGreaterThanOrEqual(0)
  const timer = schedule.mock.results[index].value
  await unmount()
  expect(cancel).toHaveBeenCalledWith(timer)
})

it("NATIVE.avatar.001 preserves the pending timer across mounted content updates, cancels changed delays", async () => {
  const { rerender } = await render(<Avatar imageURL="a" fallbackDelay={100} />)
  await act(() => jest.advanceTimersByTime(60))
  await rerender(<Avatar imageURL="b" name1="Alice" fallbackDelay={100} />)
  await act(() => jest.advanceTimersByTime(40))
  expect(fallback()).not.toBeNull()
  await rerender(<Avatar imageURL="c" fallbackDelay={200} />)
  expect(fallback()).not.toBeNull()
})

it("NATIVE.avatar.001 cancels pending delay changes/removal and schedules explicit zero", async () => {
  const { rerender } = await render(<Avatar fallbackDelay={100} />)
  await act(() => jest.advanceTimersByTime(50))
  await rerender(<Avatar fallbackDelay={200} />)
  await act(() => jest.advanceTimersByTime(100))
  expect(fallback()).toBeNull()
  await rerender(<Avatar />)
  await act(() => jest.advanceTimersByTime(1000))
  expect(fallback()).toBeNull()
  await rerender(<Avatar fallbackDelay={0} />)
  expect(fallback()).toBeNull()
  await act(() => jest.advanceTimersByTime(0))
  expect(fallback()).not.toBeNull()
})

it("NATIVE.avatar.002 requires clickable plus handler, guards disabled, cancels takeover and keeps decorative children", async () => {
  const onPress = jest.fn()
  const { rerender } = await render(<Avatar onPress={onPress} />)
  await fireEvent.press(screen.getByTestId("avatar"), {})
  expect(onPress).not.toHaveBeenCalled()
  await rerender(<Avatar clickable />)
  expect(screen.queryByRole("button")).toBeNull()
  await rerender(<Avatar clickable onPress={onPress} />)
  const start = { nativeEvent: { timestamp: 1 } }
  await fireEvent(screen.getByTestId("avatar"), "pressIn", start)
  await rerender(<Avatar clickable disabled onPress={onPress} />)
  expect(screen.getByRole("button")).toBeDisabled()
  await rerender(<Avatar clickable onPress={onPress} hitSlop={0} />)
  await fireEvent.press(screen.getByTestId("avatar"), start)
  expect(onPress).not.toHaveBeenCalled()
  const next = { nativeEvent: { timestamp: 2 } }
  await fireEvent(screen.getByTestId("avatar"), "pressIn", next)
  await fireEvent(screen.getByTestId("avatar"), "pressOut", next)
  await fireEvent.press(screen.getByTestId("avatar"), next)
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("avatar").props.hitSlop).toBe(0)
  expect(graphic("avatar-fallback").props.importantForAccessibility).toBe("no-hide-descendants")
  expect(graphic("text").props.accessible).toBe(false)
  await rerender(<Avatar accessible={false} aria-label="Alias name" />)
  expect(screen.getByTestId("avatar").props.accessible).toBe(false)
  expect(screen.getByTestId("avatar").props.accessibilityLabel).toBe("Alias name")
})

it("NATIVE.avatar.003 accepts registered/array and dynamic color styles at every owner", async () => {
  const color = PlatformColor("systemBlueColor")
  const styles = StyleSheet.create({
    root: { backgroundColor: "green" },
    text: { fontSize: 18 },
    image: { tintColor: color },
  })
  await render(
    <Avatar
      foreground={color}
      customStyles={[styles.root, { color }]}
      customFallbackStyles={[{ backgroundColor: color }]}
      customTextStyles={[styles.text, { color }]}
      customImageStyles={styles.image}
    />,
  )
  expect(graphic("text")).toHaveStyle({ color, fontSize: 18 })
  expect(graphic("avatar-fallback")).toHaveStyle({ backgroundColor: color })
})

it.each([
  { size: "2rem" },
  { size: "" },
  { size: -1 },
  { size: NaN },
  { fallbackDelay: Infinity },
  { foreground: "var(--avatar-color)" },
  { customFallbackStyles: { color: "var(--bad)" } },
  { customImageStyles: { tintColor: "var(--bad)" } },
] as unknown as TNativeAvatarProps[])("NATIVE.avatar.003 rejects unsupported native calibration %j", async (props) => {
  await expect(render(<Avatar {...props} />)).rejects.toThrow(/Avatar:/)
})
