import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import {
  AVAILABLE_FONT_VARIANTS,
  AVAILABLE_FONT_WEIGHTS,
  NativeThemeProvider,
  PlaceholderText,
  Text,
  type TNativeTextRef,
} from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe("Text public native contract", () => {
  it.each([
    ["Text", Text],
    ["PlaceholderText", PlaceholderText],
  ] as const)(
    "keeps %s content and callbacks under caller ownership through empty, deferred and removed content",
    async (_, Component) => {
      const ref = createRef<TNativeTextRef>()
      const previousPress = jest.fn(),
        currentPress = jest.fn()
      const view = await render(
        <Component ref={ref} testID="owned-content" onPress={previousPress}>
          Initial
        </Component>,
      )
      const original = ref.current
      expect(original).not.toBeNull()
      for (const content of [0, "", false, null, "Restored"] as const) {
        await view.rerender(
          <Component ref={ref} testID="owned-content" onPress={currentPress}>
            {content}
          </Component>,
        )
        expect(screen.getByTestId("owned-content")).toHaveTextContent(
          content === 0 ? "0" : typeof content === "string" ? content : "",
          { exact: true },
        )
        expect(ref.current).toBe(original)
      }
      const content = await Promise.resolve("Deferred owner content")
      await view.rerender(
        <Component ref={ref} testID="owned-content" onPress={currentPress}>
          {content}
        </Component>,
      )
      expect(screen.getByTestId("owned-content")).toHaveTextContent(content, { exact: true })
      expect(previousPress).not.toHaveBeenCalled()
      expect(currentPress).not.toHaveBeenCalled()
      const event = { nativeEvent: { target: 17, timestamp: 100 } }
      await fireEvent(screen.getByTestId("owned-content"), "press", event)
      expect(currentPress.mock.calls).toEqual([[event]])
      expect(currentPress.mock.calls[0][0]).toBe(event)
      expect(previousPress).not.toHaveBeenCalled()
      await view.rerender(<></>)
      expect(ref.current).toBeNull()
      await view.rerender(
        <Component ref={ref} testID="owned-content" onPress={currentPress}>
          Reinserted
        </Component>,
      )
      expect(ref.current).not.toBeNull()
      expect(screen.getByTestId("owned-content")).toHaveTextContent("Reinserted", { exact: true })
      expect(currentPress).toHaveBeenCalledTimes(1)
      await view.unmount()
      expect(ref.current).toBeNull()
      expect(currentPress).toHaveBeenCalledTimes(1)
    },
  )

  it("retains the original Text ref and exact native events through caller updates and clears it on unmount", async () => {
    const ref = createRef<TNativeTextRef>(),
      onPress = jest.fn(),
      onLayout = jest.fn()
    const view = await render(
      <Text ref={ref} variant="h1" onPress={onPress} onLayout={onLayout}>
        Original
      </Text>,
    )
    const original = ref.current
    expect(original).not.toBeNull()
    const press = { nativeEvent: { target: 17, timestamp: 100 } }
    const layout = { nativeEvent: { target: 17, layout: { x: 3, y: 4, width: 160, height: 44 } } }
    await fireEvent(screen.getByTestId("text"), "press", press)
    await fireEvent(screen.getByTestId("text"), "layout", layout)
    expect(onPress.mock.calls).toEqual([[press]])
    expect(onPress.mock.calls[0][0]).toBe(press)
    expect(onLayout.mock.calls).toEqual([[layout]])
    expect(onLayout.mock.calls[0][0]).toBe(layout)
    await view.rerender(
      <Text ref={ref} variant="b11" accessibilityLabel="Updated" style={{ color: "tomato" }}>
        Updated
      </Text>,
    )
    expect(ref.current).toBe(original)
    expect(screen.getByTestId("text").props.accessibilityLabel).toBe("Updated")
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onLayout).toHaveBeenCalledTimes(1)
    await view.unmount()
    expect(ref.current).toBeNull()
  })

  it("uses scalable b10 regular defaults and strips wrapper props", async () => {
    await render(<Text>Default text</Text>)
    const text = screen.getByTestId("text")
    expect(text).toHaveStyle({ fontSize: 14, fontWeight: "400", color: "#171717", fontStyle: "normal" })
    expect(text.props.selectable).toBe(true)
    expect(text.props.allowFontScaling).not.toBe(false)
    expect(text.props.maxFontSizeMultiplier).toBeUndefined()
    for (const prop of ["variant", "fontWeight", "fontStyle", "elementType", "customStyles", "composedInLink"]) {
      expect(text.props[prop]).toBeUndefined()
    }
  })

  it("resolves every variant and weight through the actual provider", async () => {
    const variants = Object.fromEntries(AVAILABLE_FONT_VARIANTS.map((variant, index) => [variant, 20 + index]))
    await render(
      <NativeThemeProvider overrides={{ typography: { fontSizes: variants } }}>
        {AVAILABLE_FONT_VARIANTS.map((variant) => (
          <Text key={variant} testID={variant} variant={variant}>
            {variant}
          </Text>
        ))}
        {AVAILABLE_FONT_WEIGHTS.map((fontWeight) => (
          <Text key={fontWeight} testID={fontWeight} fontWeight={fontWeight}>
            {fontWeight}
          </Text>
        ))}
      </NativeThemeProvider>,
    )
    AVAILABLE_FONT_VARIANTS.forEach((variant, index) =>
      expect(screen.getByTestId(variant)).toHaveStyle({ fontSize: 20 + index }),
    )
    const expectedWeights = ["300", "400", "500", "600", "700", "800"] as const
    AVAILABLE_FONT_WEIGHTS.forEach((weight, index) =>
      expect(screen.getByTestId(weight)).toHaveStyle({ fontWeight: expectedWeights[index] }),
    )
  })

  it("resolves heading/link intent and explicit native role precedence without forcing strong weight", async () => {
    await render(
      <>
        <Text elementType="h2">Heading</Text>
        <Text elementType="h1" composedInLink>
          Linked heading
        </Text>
        <Text elementType="h3" role="button">
          Explicit role
        </Text>
        <Text elementType="h4" accessibilityRole="link">
          Explicit native role
        </Text>
        <Text elementType="strong">Strong intent</Text>
      </>,
    )
    expect(screen.getByRole("heading", { name: "Heading" })).toBeOnTheScreen()
    expect(screen.getByRole("link", { name: "Linked heading" })).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Explicit role" })).toBeOnTheScreen()
    expect(screen.getByRole("link", { name: "Explicit native role" })).toBeOnTheScreen()
    expect(screen.getByText("Strong intent")).toHaveStyle({ fontWeight: "400" })
  })

  it("gives native labels/IDs precedence over aliases, including empty values", async () => {
    await render(
      <>
        <Text testID="native" data-testid="alias" accessibilityLabel="Native label" aria-label="Alias label">
          Content
        </Text>
        <Text testID="" data-testid="fallback" accessibilityLabel="" aria-label="fallback label">
          Empty wins
        </Text>
        <Text data-testid="alias-only" aria-label="Alias only">
          Alias
        </Text>
      </>,
    )
    expect(screen.getByTestId("native").props.accessibilityLabel).toBe("Native label")
    expect(screen.queryByTestId("alias")).toBeNull()
    expect(screen.getByTestId("").props.accessibilityLabel).toBe("")
    expect(screen.getByTestId("alias-only").props.accessibilityLabel).toBe("Alias only")
  })

  it("preserves selection overrides, style arrays and registered styles above provider defaults", async () => {
    const registered = StyleSheet.create({ final: { color: "#abcdef", fontSize: 24 } })
    await render(
      <NativeThemeProvider mode="dark">
        <Text
          elementType="label"
          selectable
          color="red"
          fontStyle="italic"
          customStyles={[undefined, { color: "green", fontSize: 20 }]}
          style={[false, registered.final]}
        >
          Styled label
        </Text>
        <Text testID="label-default" elementType="label">
          Label
        </Text>
      </NativeThemeProvider>,
    )
    expect(screen.getByText("Styled label")).toHaveStyle({ color: "#abcdef", fontSize: 24, fontStyle: "italic" })
    expect(screen.getByText("Styled label").props.selectable).toBe(true)
    expect(screen.getByTestId("label-default").props.selectable).toBe(false)
  })

  it("retains nested text and forwards native press/layout payloads", async () => {
    const press = jest.fn()
    const layout = jest.fn()
    const user = userEvent.setup()
    await render(
      <Text color="red" onPress={press} onLayout={layout}>
        Parent <Text fontWeight="bold">Nested</Text>
      </Text>,
    )
    await user.press(screen.getByText("Parent Nested"))
    expect(press).toHaveBeenCalledTimes(1)
    expect(press.mock.calls[0][0]).toEqual(expect.objectContaining({ nativeEvent: expect.any(Object) }))
    const event = { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 30 } } }
    await fireEvent(screen.getByText("Parent Nested"), "layout", event)
    expect(layout).toHaveBeenCalledWith(event)
    expect(screen.getByText("Nested")).toHaveStyle({ fontWeight: "700", color: "red" })
  })

  it.each(["var(--cui-foreground)", "currentColor", "not-a-color"])(
    "rejects invalid owned colors: %s",
    async (color) => {
      await expect(render(<Text color={color}>Invalid</Text>)).rejects.toThrow(
        /Text: unsupported native color in color/,
      )
    },
  )

  it("rejects invalid color fields in resolved style layers", async () => {
    await expect(render(<Text style={{ textDecorationColor: "var(--line)" }}>Invalid style</Text>)).rejects.toThrow(
      /style.textDecorationColor/,
    )
  })

  it("accepts native platform colors", async () => {
    await render(<Text color={PlatformColor("labelColor")}>Platform color</Text>)
    expect(screen.getByText("Platform color")).toBeOnTheScreen()
  })

  it("rejects unresolved colors in structured and string native shadows", async () => {
    await expect(
      render(<Text style={{ boxShadow: [{ color: "var(--shadow)", offsetX: 0, offsetY: 1 }] }}>Shadow</Text>),
    ).rejects.toThrow(/style.boxShadow\[0\].color/)
    await expect(render(<Text style={{ boxShadow: "0 1px 2px var(--shadow)" }}>Shadow string</Text>)).rejects.toThrow(
      /style.boxShadow/,
    )
  })
})
