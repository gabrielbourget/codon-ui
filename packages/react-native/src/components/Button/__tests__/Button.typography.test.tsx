import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, Fragment, useState } from "react"
import { AccessibilityInfo, PlatformColor, StyleSheet, Text as RNText, View } from "react-native"

import {
  Button,
  NativeFocusView,
  NativeThemeProvider,
  Text,
  type TNativeButtonProps,
  type TNativeButtonStyleState,
} from "../../.."
import { NativeTextStyleProvider } from "../../NativeTextStyleProvider"
import { NativeButton } from "../Button"

beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it.each([
  ["primitive", "Save 0"],
  ["array", ["Save ", 0]],
  ["fragment", <>Save {0}</>],
  ["nested fragment", ["Save ", <Fragment key="value">{0}</Fragment>]],
  ["render callback", () => <>Save {0}</>],
] as const)("applies root typography to the owned %s phrase", async (_name, children) => {
  await render(
    <Button
      customStyles={{
        fontFamily: "CustomBody",
        fontSize: 22,
        fontWeight: "700",
        fontStyle: "italic",
        letterSpacing: 1,
        lineHeight: 28,
        textTransform: "uppercase",
        textAlign: "right",
      }}
    >
      {children}
    </Button>,
  )
  const label = screen.getByText("Save 0")
  expect(label).toHaveStyle({
    fontFamily: "CustomBody",
    fontSize: 22,
    fontWeight: "700",
    fontStyle: "italic",
    letterSpacing: 1,
    lineHeight: 28,
    textTransform: "uppercase",
    textAlign: "right",
  })
  const host = StyleSheet.flatten(screen.getByRole("button").props.style)
  for (const field of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "textAlign",
    "color",
  ])
    expect(host[field]).toBeUndefined()
})

it("retains registered/custom/final callback precedence and the post-custom defaultStyle", async () => {
  const styles = StyleSheet.create({ custom: { fontSize: 18, fontWeight: "600", padding: 9 } })
  const style = jest.fn((state: TNativeButtonStyleState) => {
    expect(state.defaultStyle.fontSize).toBe(18)
    expect(state.defaultStyle.fontWeight).toBe("600")
    return [state.defaultStyle, { fontSize: 24, letterSpacing: 0 }]
  })
  await render(
    <Button customStyles={styles.custom} style={style}>
      Save
    </Button>,
  )
  expect(style).toHaveBeenCalled()
  expect(screen.getByRole("button")).toHaveStyle({ padding: 9 })
  expect(screen.getByText("Save")).toHaveStyle({ fontSize: 24, fontWeight: "600", letterSpacing: 0 })
})

it("keeps supplied zero values and restores theme defaults when final undefined clears typography", async () => {
  const { rerender } = await render(
    <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: 19 } } }}>
      <Button
        customStyles={{ fontSize: 18, fontWeight: "700" }}
        style={{ fontSize: 0, lineHeight: 0, letterSpacing: 0 }}
      >
        Save
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Save")).toHaveStyle({ fontSize: 0, lineHeight: 0, letterSpacing: 0 })
  await rerender(
    <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: 19 } } }}>
      <Button customStyles={{ fontSize: 18, fontWeight: "700" }} style={{ fontSize: undefined, fontWeight: undefined }}>
        Save
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Save")).toHaveStyle({ fontSize: 19, fontWeight: "400" })
})

it("preserves authored child identity and typography across root changes and keyed reorder", async () => {
  const initialize = jest.fn()
  const Authored = ({ name }: { name: string }) => {
    useState(() => {
      initialize(name)
      return 0
    })
    return (
      <Text testID={name} customStyles={{ fontSize: 11, fontWeight: "400" }}>
        {name}
      </Text>
    )
  }
  const { rerender } = await render(
    <Button customStyles={{ fontSize: 22, fontWeight: "700" }}>
      <Authored key="a" name="A" />
      Owned
      <Authored key="b" name="B" />
    </Button>,
  )
  await rerender(
    <Button customStyles={{ fontSize: 24, fontWeight: "800" }}>
      <Authored key="b" name="B" />
      Owned
      <Authored key="a" name="A" />
    </Button>,
  )
  expect(initialize).toHaveBeenCalledTimes(2)
  expect(screen.getByText("Owned")).toHaveStyle({ fontSize: 24, fontWeight: "800" })
  expect(screen.getByTestId("A")).toHaveStyle({ fontSize: 11, fontWeight: "400" })
  expect(screen.getByTestId("B")).toHaveStyle({ fontSize: 11, fontWeight: "400" })
})

it("keeps mounted theme defaults live while authored fonts win independently", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <Button>Default</Button>
      <Button customStyles={{ fontSize: 22 }}>Owned</Button>
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{ typography: { fontSizes: { b10: 19 }, fontFamilies: { body: "LiveBody" } } }}
    >
      <Button>Default</Button>
      <Button customStyles={{ fontSize: 22 }}>Owned</Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Default")).toHaveStyle({ fontSize: 19, fontFamily: "LiveBody" })
  expect(screen.getByText("Owned")).toHaveStyle({ fontSize: 22, fontFamily: "LiveBody" })
})

it("keeps text decorations/native opaque paint with text and layout/shadow with the button", async () => {
  const paint = PlatformColor("labelColor")
  await render(
    <Button
      customStyles={{
        textDecorationLine: "underline",
        textDecorationColor: paint,
        textShadowColor: paint,
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 3,
        textAlignVertical: "center",
        includeFontPadding: false,
        fontVariant: ["tabular-nums"],
        shadowColor: "black",
        shadowRadius: 8,
      }}
    >
      Styled
    </Button>,
  )
  expect(screen.getByText("Styled")).toHaveStyle({
    textDecorationLine: "underline",
    textDecorationColor: paint,
    textShadowColor: paint,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
    textAlignVertical: "center",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  })
  expect(screen.getByRole("button")).toHaveStyle({ shadowColor: "black", shadowRadius: 8 })
})

it("updates render-state typography without changing pending/disabled or press callbacks", async () => {
  const onPress = jest.fn()
  await render(
    <Button onPress={onPress} style={(state) => ({ fontSize: state.isPressed ? 24 : 18 })}>
      Action
    </Button>,
  )
  const root = screen.getByRole("button")
  await fireEvent(root, "pressIn", { nativeEvent: { timestamp: 1 } })
  expect(screen.getByText("Action")).toHaveStyle({ fontSize: 24 })
  await fireEvent(root, "press", { nativeEvent: { timestamp: 1 } })
  expect(onPress).toHaveBeenCalledTimes(1)
})

it.each([false, true])(
  "keeps explicit content and original refs without a native typography scope (custom renderer: %s)",
  async (customRenderer) => {
    const rootRef = createRef<View>()
    const childRef = createRef<RNText>()
    const content = (
      <View>
        <RNText ref={childRef} testID="raw-custom" style={{ fontWeight: "500", color: "green" }}>
          Explicit raw text
        </RNText>
        <Text testID="owned-custom" customStyles={{ fontWeight: "700" }}>
          Owned text
        </Text>
        <NativeTextStyleProvider style={{ letterSpacing: 3 }}>
          <NativeFocusView testID="nested-explicit" />
        </NativeTextStyleProvider>
      </View>
    )
    const renderer: TNativeButtonProps["render"] = customRenderer
      ? (props) => <NativeFocusView {...props} />
      : undefined
    const node = (fontWeight: "600" | "800") => (
      <NativeTextStyleProvider style={{ fontWeight: "900" }}>
        <NativeTextStyleProvider style={{ fontWeight: "900" }}>
          <NativeFocusView testID="independent-owner" />
        </NativeTextStyleProvider>
        <Button ref={rootRef} render={renderer} customStyles={{ fontWeight, letterSpacing: 2 }}>
          Owned phrase
          {content}
        </Button>
      </NativeTextStyleProvider>
    )
    const view = await render(node("800"))
    const originalRoot = rootRef.current
    const originalChild = childRef.current
    expect(originalRoot).not.toBeNull()
    expect(originalChild).not.toBeNull()
    expect(screen.getByRole("button").props.nativeTypographyStyle).toBeUndefined()
    expect(screen.getByTestId("nested-explicit").props.nativeTypographyStyle).toBeUndefined()
    expect(screen.getByTestId("independent-owner").props.nativeTypographyStyle).toBeUndefined()
    expect(screen.getByText("Owned phrase")).toHaveStyle({ fontWeight: "800", letterSpacing: 2 })
    expect(screen.getByTestId("owned-custom")).toHaveStyle({ fontWeight: "700", letterSpacing: 2 })
    expect(screen.getByTestId("raw-custom")).toHaveStyle({ fontWeight: "500", color: "green" })
    await view.rerender(node("600"))
    expect(rootRef.current).toBe(originalRoot)
    expect(childRef.current).toBe(originalChild)
    expect(screen.getByText("Owned phrase")).toHaveStyle({ fontWeight: "600", letterSpacing: 2 })
    expect(screen.getByTestId("owned-custom")).toHaveStyle({ fontWeight: "700", letterSpacing: 2 })
    expect(screen.getByTestId("raw-custom")).toHaveStyle({ fontWeight: "500", color: "green" })
    await view.unmount()
    expect(rootRef.current).toBeNull()
    expect(childRef.current).toBeNull()
  },
)

it("keeps independent Button defaults through explicit ancestor metric updates without native transport", async () => {
  const rootRef = createRef<View>()
  const childRef = createRef<RNText>()
  const node = (lineHeight: number) => (
    <NativeTextStyleProvider style={{ fontWeight: "900", lineHeight }}>
      <NativeFocusView testID="ancestor-owner">
        <Button ref={rootRef}>
          Independent defaults
          <RNText ref={childRef} style={{ fontWeight: "500", color: "green" }}>
            Explicit raw text
          </RNText>
        </Button>
      </NativeFocusView>
    </NativeTextStyleProvider>
  )
  const view = await render(node(38))
  const root = rootRef.current
  const child = childRef.current
  expect(root).not.toBeNull()
  expect(child).not.toBeNull()
  const inherited = () => screen.getByTestId("ancestor-owner").props.nativeTypographyStyle
  const boundary = () => screen.getByRole("button").props.nativeTypographyStyle
  expect(inherited()).toBeUndefined()
  expect(boundary()).toBeUndefined()
  expect(screen.getByText("Independent defaults")).toHaveStyle({
    fontWeight: "400",
    fontStyle: "normal",
    letterSpacing: 0,
    textAlign: "center",
  })
  expect(StyleSheet.flatten(screen.getByText("Independent defaults").props.style).lineHeight).toBeUndefined()
  await view.rerender(node(42))
  expect(inherited()).toBeUndefined()
  expect(boundary()).toBeUndefined()
  await view.rerender(node(28))
  expect(inherited()).toBeUndefined()
  expect(boundary()).toBeUndefined()
  expect(rootRef.current).toBe(root)
  expect(childRef.current).toBe(child)
  expect(screen.getByText("Independent defaults")).toHaveStyle({
    fontWeight: "400",
    fontStyle: "normal",
    letterSpacing: 0,
    textAlign: "center",
  })
  expect(StyleSheet.flatten(screen.getByText("Independent defaults").props.style).lineHeight).toBeUndefined()
  expect(screen.getByText("Explicit raw text")).toHaveStyle({ fontWeight: "500", color: "green" })
})

it("retains exact supported weight endpoints through final style and theme updates", async () => {
  const node = (fontWeight: "normal" | "bold" | "semibold" | 500 | "800") => (
    <NativeThemeProvider overrides={{ typography: { fontWeights: { regular: fontWeight } } }}>
      <Button customStyles={{ fontWeight: "700" }} style={{ fontWeight: undefined }}>
        Theme weight
      </Button>
      <Button customStyles={{ fontWeight: "700" }} style={() => ({ fontWeight })}>
        Final weight
      </Button>
    </NativeThemeProvider>
  )
  const view = await render(node("normal"))
  for (const fontWeight of ["bold", "semibold", 500, "800"] as const) {
    await view.rerender(node(fontWeight))
    expect(screen.getByText("Theme weight")).toHaveStyle({ fontWeight })
    expect(screen.getByText("Final weight")).toHaveStyle({ fontWeight })
  }
})

it.each(["custom", "final", "composed"] as const)(
  "requires an explicit migration for an unsupported %s weight",
  async (owner) => {
    const fontWeight = 750.5
    await expect(
      render(
        owner === "composed" ? (
          <NativeButton
            nativeStyle={() => ({
              viewStyle: {},
              textStyle: { fontWeight },
              foregroundColor: "black",
              target: 44,
            })}
          >
            Scalar weight
          </NativeButton>
        ) : (
          <Button
            customStyles={owner === "custom" ? { fontWeight } : undefined}
            style={owner === "final" ? () => ({ fontWeight }) : undefined}
          >
            Scalar weight
          </Button>
        ),
      ),
    ).rejects.toThrow(
      "Button: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly",
    )
  },
)
