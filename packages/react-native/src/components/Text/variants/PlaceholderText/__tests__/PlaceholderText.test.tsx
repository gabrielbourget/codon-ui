import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"

import {
  AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS,
  NativeThemeProvider,
  PlaceholderText,
  Text,
  type TNativePlaceholderTextRef,
} from "../../../../.."

it("uses scalable italic b11 and the existing placeholder role instead of inherited foreground", async () => {
  await render(
    <NativeThemeProvider
      overrides={{ colors: { controlPlaceholder: "tomato" }, typography: { fontSizes: { b11: 19 } } }}
    >
      <Text color="blue">
        <PlaceholderText>Choose</PlaceholderText>
      </Text>
    </NativeThemeProvider>,
  )
  const text = screen.getByTestId("placeholder-text")
  expect(text).toHaveStyle({ fontSize: 19, fontStyle: "italic", color: "tomato", textAlign: "left" })
  expect(text.props.allowFontScaling).not.toBe(false)
  expect(text.props.maxFontSizeMultiplier).toBeUndefined()
  expect(AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS).toEqual(["left", "center"])
  expect(text.props.align).toBeUndefined()
})

it("preserves native style precedence, selection, refs and native label/test aliases", async () => {
  const ref = createRef<TNativePlaceholderTextRef>()
  const layout = jest.fn()
  const { unmount } = await render(
    <PlaceholderText
      ref={ref}
      align="center"
      accessibilityLabel="Native"
      aria-label="Alias"
      testID="native"
      data-testid="alias"
      selectable={false}
      customStyles={{ color: "green", fontSize: 20, textAlign: "left" }}
      style={{ color: "blue", fontSize: 24 }}
      onLayout={layout}
    >
      Choose
    </PlaceholderText>,
  )
  const text = screen.getByTestId("native")
  expect(text).toHaveStyle({ color: "blue", fontSize: 24, textAlign: "left", fontStyle: "italic" })
  expect(text.props.accessibilityLabel).toBe("Native")
  expect(text.props.selectable).toBe(false)
  expect(ref.current).not.toBeNull()
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 20 } } }
  await fireEvent(text, "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
  await unmount()
  expect(ref.current).toBeNull()
  await render(
    <PlaceholderText align="center" aria-label="Alias only" data-testid="alias-only">
      Empty
    </PlaceholderText>,
  )
  expect(screen.getByTestId("alias-only")).toHaveStyle({ textAlign: "center" })
  expect(screen.getByTestId("alias-only").props.accessibilityLabel).toBe("Alias only")
})

it("retains Text color validation in custom and final style layers", async () => {
  await expect(
    render(<PlaceholderText customStyles={{ color: "var(--placeholder)" }}>Invalid</PlaceholderText>),
  ).rejects.toThrow(/customStyles.color/)
  await expect(render(<PlaceholderText style={{ color: "currentColor" }}>Invalid</PlaceholderText>)).rejects.toThrow(
    /style.color/,
  )
})
