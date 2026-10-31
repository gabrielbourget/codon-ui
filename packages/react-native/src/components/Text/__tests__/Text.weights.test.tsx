import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Text as RNText, View } from "react-native"

import {
  AVAILABLE_FONT_WEIGHTS,
  Button,
  Counter,
  FormField,
  Link,
  NativeThemeProvider,
  PlaceholderText,
  Tag,
  Text,
  type TNativeTextRef,
} from "../../.."
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeTextStyleProvider } from "../../NativeTextStyleProvider"
import { NativeHeadingContext } from "../context"
import { NativeText, type TNativeTextRender } from "../Text"

beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it.each([false, true])(
  "carries otherwise undeclared family and line height explicitly without changing owned defaults (reset: %s)",
  async (reset) => {
    const ref = createRef<TNativeTextRef>()
    const node = (fontFamily: string, lineHeight: number, themeDefaults: boolean) => (
      <NativeTextStyleProvider style={{ fontStyle: "italic" }}>
        <NativeThemeProvider
          overrides={
            themeDefaults ? { typography: { fontFamilies: { body: "ThemeBody" }, lineHeight: 24 } } : undefined
          }
        >
          <NativeTextStyleProvider reset={reset} style={{ fontFamily, lineHeight, fontSize: 38, fontWeight: "900" }}>
            <View>
              <Text ref={ref}>Inherited metrics</Text>
              <Text customStyles={{ fontFamily: "Owned", lineHeight: 17 }}>Owned metrics</Text>
              <Text
                customStyles={{ fontFamily: "Cleared", lineHeight: 13 }}
                style={{ fontFamily: undefined, lineHeight: undefined }}
              >
                Restored metrics
              </Text>
            </View>
          </NativeTextStyleProvider>
        </NativeThemeProvider>
      </NativeTextStyleProvider>
    )
    const view = await render(node("InheritedBody", 28, false))
    const original = ref.current
    expect(original).not.toBeNull()
    expect(screen.getByText("Inherited metrics")).toHaveStyle({
      fontFamily: "InheritedBody",
      lineHeight: 28,
      fontSize: 14,
      fontWeight: "400",
      fontStyle: reset ? "normal" : "italic",
    })
    expect(screen.getByText("Owned metrics")).toHaveStyle({ fontFamily: "Owned", lineHeight: 17 })
    expect(screen.getByText("Restored metrics")).toHaveStyle({ fontFamily: "InheritedBody", lineHeight: 28 })
    await view.rerender(node("NextBody", 32, false))
    expect(ref.current).toBe(original)
    expect(screen.getByText("Inherited metrics")).toHaveStyle({ fontFamily: "NextBody", lineHeight: 32 })
    expect(screen.getByText("Restored metrics")).toHaveStyle({ fontFamily: "NextBody", lineHeight: 32 })
    await view.rerender(node("NextBody", 32, true))
    expect(ref.current).toBe(original)
    expect(screen.getByText("Inherited metrics")).toHaveStyle({ fontFamily: "ThemeBody", lineHeight: 24 })
    expect(screen.getByText("Restored metrics")).toHaveStyle({ fontFamily: "ThemeBody", lineHeight: 24 })
    expect(screen.getByText("Owned metrics")).toHaveStyle({ fontFamily: "Owned", lineHeight: 17 })
  },
)

const contentOwners = [
  ["Text", () => <Text>Theme weight</Text>],
  ["PlaceholderText", () => <PlaceholderText>Theme weight</PlaceholderText>],
  ["Button", () => <Button>Theme weight</Button>],
  ["Link", () => <Link href="https://example.com">Theme weight</Link>],
  ["Tag", () => <Tag>Theme weight</Tag>],
  ["Counter", () => <Counter value="Theme weight" />],
  ["FormField", () => <FormField label="Theme weight" />],
] as const

it.each(contentOwners)("keeps exact live theme weight endpoints for the owned %s content", async (_, content) => {
  const node = (fontWeight: 500 | "800") => (
    <NativeThemeProvider overrides={{ typography: { fontWeights: { regular: fontWeight } } }}>
      {content()}
    </NativeThemeProvider>
  )
  const view = await render(node(500))
  expect(screen.getByText("Theme weight")).toHaveStyle({ fontWeight: 500 })
  await view.rerender(node("800"))
  expect(screen.getByText("Theme weight")).toHaveStyle({ fontWeight: "800" })
})

it.each(contentOwners)("requires explicit migration of the effective %s theme weight", async (_, content) => {
  await expect(
    render(
      <NativeThemeProvider overrides={{ typography: { fontWeights: { regular: 750.5 } } }}>
        {content()}
      </NativeThemeProvider>,
    ),
  ).rejects.toThrow("Text: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly")
})

it.each(AVAILABLE_FONT_WEIGHTS)("resolves the supported %s theme role without narrowing its value", async (weight) => {
  await render(
    <NativeThemeProvider overrides={{ typography: { fontWeights: { [weight]: 500 } } }}>
      <Text fontWeight={weight}>Role weight</Text>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Role weight")).toHaveStyle({ fontWeight: 500 })
})

it.each(["normal", "bold", "semibold", 100, "300", "900"] as const)(
  "retains the exact supported final weight %s over custom and theme values",
  async (fontWeight) => {
    await render(
      <NativeThemeProvider overrides={{ typography: { fontWeights: { regular: 750.5 } } }}>
        <Text customStyles={{ fontWeight: 725.5 }} style={{ fontWeight }}>
          Final weight
        </Text>
      </NativeThemeProvider>,
    )
    expect(screen.getByText("Final weight")).toHaveStyle({ fontWeight })
  },
)

it.each(["custom", "final", "restored theme"] as const)(
  "requires explicit migration when an unsupported %s value is actually resolved",
  async (owner) => {
    await expect(
      render(
        <NativeThemeProvider
          overrides={owner === "restored theme" ? { typography: { fontWeights: { regular: 750.5 } } } : undefined}
        >
          <Text
            customStyles={{ fontWeight: owner === "custom" ? 750.5 : "700" }}
            style={owner === "custom" ? undefined : { fontWeight: owner === "final" ? 750.5 : undefined }}
          >
            Scalar weight
          </Text>
        </NativeThemeProvider>,
      ),
    ).rejects.toThrow("Text: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly")
  },
)

it("validates only selected context styles while preserving merged refs, events and slot opt-out", async () => {
  const contextRef = createRef<TNativeTextRef>()
  const callerRef = createRef<TNativeTextRef>()
  const namedRef = createRef<TNativeTextRef>()
  const contextPress = jest.fn()
  const callerPress = jest.fn()
  const node = (fontWeight: "500" | "800") => (
    <NativeHeadingContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: {
            customStyles: { fontWeight: 750.5 },
            ref: contextRef,
            onPress: contextPress,
          },
          title: { style: { fontWeight: 750.5 } },
        },
      }}
    >
      <Text ref={callerRef} style={{ fontWeight }} onPress={callerPress}>
        Default slot
      </Text>
      <Text ref={namedRef} slot="title" style={{ fontWeight: "600" }}>
        Named slot
      </Text>
      <Text slot={null}>Unslotted</Text>
    </NativeHeadingContext.Provider>
  )
  const view = await render(node("500"))
  const original = callerRef.current
  const named = namedRef.current
  expect(original).not.toBeNull()
  expect(named).not.toBeNull()
  expect(contextRef.current).toBe(original)
  expect(screen.getByText("Default slot")).toHaveStyle({ fontWeight: "500" })
  expect(screen.getByText("Named slot")).toHaveStyle({ fontWeight: "600" })
  expect(screen.getByText("Unslotted")).toHaveStyle({ fontWeight: "400" })
  await view.rerender(node("800"))
  expect(callerRef.current).toBe(original)
  expect(contextRef.current).toBe(original)
  expect(namedRef.current).toBe(named)
  expect(screen.getByText("Default slot")).toHaveStyle({ fontWeight: "800" })
  const event = { nativeEvent: { target: 17, timestamp: 100 } }
  await fireEvent(screen.getByText("Default slot"), "press", event)
  expect(contextPress.mock.calls).toEqual([[event]])
  expect(callerPress.mock.calls).toEqual([[event]])
  expect(callerPress.mock.calls[0][0]).toBe(event)
  await view.unmount()
  expect(contextRef.current).toBeNull()
  expect(callerRef.current).toBeNull()
  expect(namedRef.current).toBeNull()
})

it("retains original native renderer content, scaling props and refs through a discrete weight update", async () => {
  const ref = createRef<TNativeTextRef>()
  const childRef = createRef<RNText>()
  const renderer = jest.fn((props: Parameters<TNativeTextRender>[0]) => <RNText {...props} />)
  const content = (
    <RNText ref={childRef} style={{ fontSize: 9 }}>
      Original raw child
    </RNText>
  )
  const node = (fontWeight: "400" | "700") => (
    <NativeText
      ref={ref}
      nativeRender={renderer}
      allowFontScaling={false}
      maxFontSizeMultiplier={2}
      style={{ fontWeight }}
    >
      {content}
    </NativeText>
  )
  const view = await render(node("400"))
  const original = ref.current
  const child = childRef.current
  expect(original).not.toBeNull()
  expect(child).not.toBeNull()
  await view.rerender(node("700"))
  expect(ref.current).toBe(original)
  expect(childRef.current).toBe(child)
  expect(renderer.mock.calls.at(-1)?.[0]).toMatchObject({
    allowFontScaling: false,
    maxFontSizeMultiplier: 2,
    style: { fontWeight: "700" },
  })
  expect(renderer.mock.calls.at(-1)?.[0].children).toBe(content)
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(childRef.current).toBeNull()
})
