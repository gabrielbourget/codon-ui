import { render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { AVAILABLE_FONT_VARIANTS, AVAILABLE_FONT_WEIGHTS, Button, Link, NativeThemeProvider, Tag, Text } from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it.each(AVAILABLE_FONT_VARIANTS)(
  "restores computed %s size when final undefined clears a custom font",
  async (variant) => {
    await render(
      <Text variant={variant} customStyles={{ fontSize: 17 }} style={{ fontSize: undefined }}>
        Reset
      </Text>,
    )
    expect(screen.getByText("Reset")).toHaveStyle({
      fontSize: resolveNativeTheme("light").typography.fontSizes[variant],
    })
  },
)

it.each(AVAILABLE_FONT_WEIGHTS)("restores computed %s weight after clearing custom weight", async (fontWeight) => {
  await render(
    <Text fontWeight={fontWeight} customStyles={{ fontWeight: "900" }} style={{ fontWeight: undefined }}>
      Reset
    </Text>,
  )
  expect(screen.getByText("Reset")).toHaveStyle({
    fontWeight: resolveNativeTheme("light").typography.fontWeights[fontWeight],
  })
})

it.each([
  ["b10", "Body"],
  ["h1", "Heading"],
  ["d1", "Display"],
] as const)("restores the configured %s font family", async (variant, expected) => {
  await render(
    <NativeThemeProvider
      overrides={{ typography: { fontFamilies: { body: "Body", heading: "Heading", display: "Display" } } }}
    >
      <Text variant={variant} customStyles={{ fontFamily: "Custom" }} style={{ fontFamily: undefined }}>
        Reset
      </Text>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Reset")).toHaveStyle({ fontFamily: expected })
})

it("retains the current font-style prop when final undefined clears a custom style", async () => {
  await render(
    <Text fontStyle="italic" customStyles={{ fontStyle: "normal" }} style={{ fontStyle: undefined }}>
      Reset
    </Text>,
  )
  expect(screen.getByText("Reset")).toHaveStyle({ fontStyle: "italic" })
})

it("restores live theme line-height/size and current props without holding earlier defaults", async () => {
  const { rerender } = await render(
    <NativeThemeProvider overrides={{ typography: { lineHeight: 28, fontSizes: { b10: 19 } } }}>
      <Text customStyles={{ fontSize: 17, lineHeight: 18 }} style={{ fontSize: undefined, lineHeight: undefined }}>
        Reset
      </Text>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Reset")).toHaveStyle({ fontSize: 19, lineHeight: 28 })
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ typography: { lineHeight: 32, fontSizes: { h1: 34 } } }}>
      <Text
        variant="h1"
        fontWeight="bold"
        customStyles={{ fontSize: 17, lineHeight: 18 }}
        style={{ fontSize: undefined, lineHeight: undefined }}
      >
        Reset
      </Text>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Reset")).toHaveStyle({ fontSize: 34, lineHeight: 32, fontWeight: "700" })
})

it("keeps zero/empty values and native fields without restoring unowned defaults", async () => {
  await render(
    <Text
      style={{
        fontSize: 0,
        lineHeight: 0,
        letterSpacing: 0,
        fontFamily: "",
        includeFontPadding: false,
        margin: 0,
        textDecorationLine: "underline",
      }}
    >
      Zero
    </Text>,
  )
  expect(screen.getByText("Zero")).toHaveStyle({
    fontSize: 0,
    lineHeight: 0,
    letterSpacing: 0,
    fontFamily: "",
    includeFontPadding: false,
    margin: 0,
    textDecorationLine: "underline",
  })
})

it("keeps defined final overrides above custom and computed typography", async () => {
  await render(
    <Text variant="h1" customStyles={{ fontSize: 17, fontWeight: "600" }} style={{ fontSize: 23, fontWeight: "800" }}>
      Final
    </Text>,
  )
  expect(screen.getByText("Final")).toHaveStyle({ fontSize: 23, fontWeight: "800" })
})

it("restores an owned Link phrase after root typography is cleared", async () => {
  await render(
    <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: 19 } } }}>
      <Link
        href="https://example.com"
        customStyles={{ fontSize: 22, fontWeight: "700" }}
        style={{ fontSize: undefined, fontWeight: undefined }}
      >
        Link reset
      </Link>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Link reset")).toHaveStyle({ fontSize: 19, fontWeight: "400" })
})

it.each([false, true])(
  "restores a Tag phrase with pressable=%s after root typography is cleared",
  async (pressable) => {
    const shared = {
      customStyles: { fontSize: 22, fontWeight: "700" as const },
      style: { fontSize: undefined, fontWeight: undefined },
    }
    await render(
      <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: 19 } } }}>
        {pressable ? (
          <Tag {...shared} pressable isPressed={false} onPress={() => undefined}>
            Tag reset
          </Tag>
        ) : (
          <Tag {...shared}>Tag reset</Tag>
        )}
      </NativeThemeProvider>,
    )
    expect(screen.getByText("Tag reset")).toHaveStyle({ fontSize: 19, fontWeight: "400" })
  },
)

it("preserves the Button-owned reset behavior through the common Text component", async () => {
  await render(
    <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: 19 } } }}>
      <Button customStyles={{ fontSize: 22 }} style={{ fontSize: undefined }}>
        Button reset
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Button reset")).toHaveStyle({ fontSize: 19, fontWeight: "400" })
})
