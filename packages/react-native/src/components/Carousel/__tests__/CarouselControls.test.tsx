import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import type { View } from "react-native"
import { Platform, StyleSheet } from "react-native"

import { CarouselCloseButton, NativeThemeProvider, Text } from "../../.."
import type { TNativeButtonChildrenState, TNativeButtonStyleState } from "../../Button/types"
import { CarouselNextButton, CarouselPrevButton } from "../CarouselControls"
import {
  DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS,
  NativeCarouselControlsContext,
  type TNativeCarouselControlsContext,
} from "../context"

const hidden = { includeHiddenElements: true }
const contextValue = (changes: Partial<TNativeCarouselControlsContext> = {}): TNativeCarouselControlsContext => ({
  canScrollPrev: true,
  canScrollNext: true,
  scrollPrev: jest.fn(),
  scrollNext: jest.fn(),
  labels: DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS,
  ...changes,
})
const withContext = (children: ReactNode, value = contextValue()) => (
  <NativeCarouselControlsContext.Provider value={value}>{children}</NativeCarouselControlsContext.Provider>
)

afterEach(() => jest.restoreAllMocks())

describe.each([
  { Component: CarouselCloseButton, name: "Close Carousel", icon: "close" },
  { Component: CarouselPrevButton, name: "Previous Item", icon: "previous" },
  { Component: CarouselNextButton, name: "Next Item", icon: "next" },
] as const)("$name native chrome", ({ Component, name, icon }) => {
  it("preserves canonical defaults, decorative currentColor vector and native ref/event", async () => {
    const ref = createRef<View>()
    const onPress = jest.fn(),
      onLayout = jest.fn()
    await render(withContext(<Component ref={ref} onPress={onPress} onLayout={onLayout} />))
    const button = screen.getByRole("button", { name })
    expect(button).toHaveStyle({
      backgroundColor: "rgba(0,0,0,0.75)",
      padding: 5,
      borderRadius: 10000,
      minHeight: Platform.OS === "ios" ? 44 : 48,
    })
    const glyph = screen.getByTestId(`carousel-${icon}-icon`, hidden)
    expect(glyph.props).toMatchObject({
      bbWidth: 20,
      bbHeight: 20,
      vbWidth: 24,
      vbHeight: 24,
      pointerEvents: "none",
      accessible: false,
    })
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(ref.current?.measure).toEqual(expect.any(Function))
    const press = { nativeEvent: { pageX: 10, pageY: 20 } }
    await fireEvent.press(button, press)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress.mock.calls[0][0].nativeEvent).toMatchObject(press.nativeEvent)
    const layout = { nativeEvent: { layout: { x: 1, y: 2, width: 44, height: 44 } } }
    await fireEvent(button, "layout", layout)
    expect(onLayout).toHaveBeenCalledWith(layout)
    expect(onLayout.mock.calls[0][0]).toBe(layout)
  })

  it.each([0, "", false])("retains explicit falsy children %j without replacing them by an icon", async (children) => {
    await render(withContext(<Component>{children}</Component>))
    expect(screen.queryByTestId(`carousel-${icon}-icon`, hidden)).toBeNull()
    if (children === 0) expect(screen.getByText("0")).toBeOnTheScreen()
  })

  it("uses literal custom children and restores the default vector for null children", async () => {
    const { rerender } = await render(withContext(<Component>Custom control</Component>))
    expect(screen.getByRole("button", { name })).toHaveTextContent("Custom control")
    expect(screen.queryByTestId(`carousel-${icon}-icon`, hidden)).toBeNull()
    await rerender(withContext(<Component>{null}</Component>))
    expect(screen.getByTestId(`carousel-${icon}-icon`, hidden)).toBeOnTheScreen()
  })

  it("forwards caller render children to the actual Button state and ignores nested children override", async () => {
    const children = jest.fn(({ isDisabled, foregroundColor }: TNativeButtonChildrenState) => (
      <Text testID="render-content" color={foregroundColor}>
        {String(isDisabled)}
      </Text>
    ))
    await render(
      withContext(
        <Component isDisabled customButtonProps={{ children: "Injected child" }}>
          {children}
        </Component>,
      ),
    )
    expect(screen.getByTestId("render-content")).toHaveTextContent("true")
    expect(screen.queryByText("Injected child")).toBeNull()
    expect(children).toHaveBeenCalledWith(
      expect.objectContaining({ isDisabled: true, isPending: false, foregroundColor: expect.anything() }),
    )
  })

  it("merges registered outer/inner styles before the final actual Button style callback", async () => {
    const registered = StyleSheet.create({ outer: { backgroundColor: "red", padding: 7, color: "turquoise" } })
    const style = jest.fn(({ defaultStyle }: TNativeButtonStyleState) => ({ ...defaultStyle, padding: 9 }))
    await render(
      withContext(
        <Component
          customStyles={registered.outer}
          style={{ padding: 8 }}
          customButtonProps={{ customStyles: [{ backgroundColor: "blue" }, { padding: 3 }], style }}
        />,
      ),
    )
    expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: "blue", padding: 9 })
    expect(screen.getByTestId(`carousel-${icon}-icon`, hidden).props.color).toBe("turquoise")
    expect(style).toHaveBeenCalledWith(
      expect.objectContaining({ defaultStyle: expect.objectContaining({ backgroundColor: "blue", padding: 3 }) }),
    )
  })

  it("retains explicit zero geometry and late callback/disabled ownership", async () => {
    const outer = jest.fn(),
      inner = jest.fn()
    await render(
      withContext(
        <Component
          isDisabled
          onPress={outer}
          customStyles={{ width: 0, height: 0, padding: 0 }}
          customButtonProps={{ isDisabled: false, onPress: inner }}
        />,
      ),
    )
    const button = screen.getByRole("button")
    expect(button).toHaveStyle({ width: 0, height: 0, padding: 0 })
    expect(button).not.toBeDisabled()
    await fireEvent.press(button)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it("preserves disabled and pending press guards from the native Button", async () => {
    const action = jest.fn()
    const { rerender } = await render(withContext(<Component onPress={action} isDisabled />))
    await fireEvent.press(screen.getByRole("button"))
    expect(action).not.toHaveBeenCalled()
    await rerender(withContext(<Component onPress={action} isPending />))
    await fireEvent.press(screen.getByRole("button"))
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByRole("button").props.accessibilityState.busy).toBe(true)
  })

  it("updates actual provider foreground/round geometry without remounting the native ref", async () => {
    const ref = createRef<View>()
    const { rerender } = await render(<NativeThemeProvider>{withContext(<Component ref={ref} />)}</NativeThemeProvider>)
    const current = ref.current
    await rerender(
      <NativeThemeProvider mode="dark" overrides={{ colors: { foreground: "orange" }, radius: { round: 79 } }}>
        {withContext(<Component ref={ref} />)}
      </NativeThemeProvider>,
    )
    expect(ref.current).toBe(current)
    expect(screen.getByRole("button")).toHaveStyle({ borderRadius: 79 })
    expect(screen.getByTestId(`carousel-${icon}-icon`, hidden).props.color).toBe("orange")
  })
})

it("uses the global close label standalone and preserves nullish/empty override precedence", async () => {
  const { rerender } = await render(<CarouselCloseButton labels={{ closeButtonAriaLabel: "Dismiss viewer" }} />)
  expect(screen.getByRole("button", { name: "Dismiss viewer" })).toBeOnTheScreen()
  await rerender(
    withContext(
      <CarouselCloseButton />,
      contextValue({
        labels: { ...DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS, closeButtonAriaLabel: "Context close should not apply" },
      }),
    ),
  )
  expect(screen.getByRole("button", { name: "Close Carousel" })).toBeOnTheScreen()
  await rerender(<CarouselCloseButton labels={{ closeButtonAriaLabel: "" }} />)
  expect(screen.getByRole("button").props.accessibilityLabel).toBe("")
  await rerender(<CarouselCloseButton aria-label="Outer name" customButtonProps={{ "aria-label": "Inner name" }} />)
  expect(screen.getByRole("button", { name: "Inner name" })).toBeOnTheScreen()
})

it.each([
  {
    Component: CarouselPrevButton,
    action: "scrollPrev",
    available: "canScrollPrev",
    label: "previousItemButtonAriaLabel",
  },
  { Component: CarouselNextButton, action: "scrollNext", available: "canScrollNext", label: "nextItemButtonAriaLabel" },
] as const)(
  "requires context and follows $action state/action/labels without publishing a root",
  async ({ Component, action, available, label }) => {
    await expect(render(<Component />)).rejects.toThrow(/within Carousel/)
    const value = contextValue({
      [available]: false,
      labels: { ...DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS, [label]: "Localized navigation" },
    })
    const { rerender } = await render(withContext(<Component />, value))
    expect(screen.getByRole("button", { name: "Localized navigation" })).toBeDisabled()
    await fireEvent.press(screen.getByRole("button"))
    expect(value[action]).not.toHaveBeenCalled()
    await rerender(withContext(<Component />, { ...value, [available]: true }))
    await fireEvent.press(screen.getByRole("button"))
    expect(value[action]).toHaveBeenCalledTimes(1)
    await rerender(withContext(<Component labels={{ ...value.labels, [label]: "Local navigation" }} />, value))
    expect(screen.getByRole("button", { name: "Local navigation" })).toBeOnTheScreen()
    await rerender(withContext(<Component labels={{ ...value.labels, [label]: "" }} />, value))
    expect(screen.getByRole("button").props.accessibilityLabel).toBe("")
  },
)

it("replaces the actual callback and consumes wrapper-only props", async () => {
  const first = jest.fn(),
    second = jest.fn()
  const { rerender } = await render(
    <CarouselCloseButton
      onPress={first}
      labels={{ closeButtonAriaLabel: "Close" }}
      customButtonProps={{ testID: "close" }}
    />,
  )
  await rerender(
    <CarouselCloseButton
      onPress={second}
      labels={{ closeButtonAriaLabel: "Close" }}
      customButtonProps={{ testID: "close" }}
    />,
  )
  await fireEvent.press(screen.getByTestId("close"))
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  for (const key of ["labels", "customButtonProps", "defaultLabel", "defaultPress", "defaultDisabled", "kind"])
    expect(screen.getByTestId("close").props[key]).toBeUndefined()
})
