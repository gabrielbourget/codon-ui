import { render, screen } from "@testing-library/react-native"
import { Text } from "react-native"

import { NativeThemeProvider, useNativeTheme } from "../.."
import type { TNativeThemeProviderProps } from "../NativeThemeProvider"

const ThemeProbe = ({ label = "theme" }: { label?: string }) => {
  const theme = useNativeTheme()
  return <Text testID={label}>{JSON.stringify(theme)}</Text>
}

const readTheme = (label = "theme") =>
  JSON.parse(screen.getByTestId(label).props.children) as ReturnType<typeof useNativeTheme>

const renderTheme = async (props: TNativeThemeProviderProps = {}) =>
  render(
    <NativeThemeProvider {...props}>
      <ThemeProbe />
    </NativeThemeProvider>,
  )

describe("NativeThemeProvider public contract", () => {
  it("retains defaults for explicitly undefined partial overrides", async () => {
    await renderTheme({
      overrides: {
        colors: { foreground: undefined },
        actions: { primary: { background: undefined } },
        spacing: { unit: undefined },
        typography: { fontSizes: { b10: undefined }, fontFamilies: { body: undefined } },
      },
    })
    expect(readTheme().colors.foreground).toBe("#171717")
    expect(readTheme().actions.primary.background).toBe("#2563eb")
    expect(readTheme().spacing.unit).toBe(5)
    expect(readTheme().typography.fontSizes.b10).toBe(14)
    expect(readTheme().typography.fontFamilies.body).toBeUndefined()
  })

  it("provides the light defaults without a provider", async () => {
    await render(<ThemeProbe />)
    expect(readTheme().mode).toBe("light")
    expect(readTheme().colors.background).toBe("#ffffff")
    expect(readTheme().spacing.unit).toBe(5)
    expect(readTheme().typography.fontSizes.b10).toBe(14)
    expect(Object.keys(readTheme().typography.fontSizes)).toHaveLength(31)
  })

  it("switches modes while retaining only explicit overrides", async () => {
    const overrides = { colors: { focusRing: "#123456" }, typography: { fontSizes: { b10: 18 } } }
    const { rerender } = await renderTheme({ overrides })
    await rerender(
      <NativeThemeProvider mode="dark" overrides={overrides}>
        <ThemeProbe />
      </NativeThemeProvider>,
    )
    expect(readTheme().colors).toMatchObject({ background: "#171717", foreground: "#ffffff", focusRing: "#123456" })
    expect(readTheme().typography.fontSizes).toMatchObject({ b10: 18, h1: 38 })
  })

  it("merges partial action and typography entries without losing siblings", async () => {
    await renderTheme({
      overrides: {
        actions: { primary: { background: "#010203" } },
        typography: { fontFamilies: { body: "CustomBody" }, fontWeights: { regular: "500" } },
      },
    })
    expect(readTheme().actions.primary).toMatchObject({
      background: "#010203",
      hoverBackground: "#2358cb",
      foreground: "#ffffff",
    })
    expect(readTheme().actions.tertiary.background).toBe("#2f7d18")
    expect(readTheme().typography.fontWeights.bold).toBe("700")
    expect(readTheme().typography.fontFamilies.body).toBe("CustomBody")
  })

  it("isolates nested providers and leaves sibling/default consumers unchanged", async () => {
    await render(
      <>
        <NativeThemeProvider mode="dark" overrides={{ colors: { foreground: "#abcdef" } }}>
          <ThemeProbe label="outer" />
          <NativeThemeProvider>
            <ThemeProbe label="inner" />
          </NativeThemeProvider>
          <ThemeProbe label="sibling" />
        </NativeThemeProvider>
        <ThemeProbe label="default" />
      </>,
    )
    expect(readTheme("outer").colors.foreground).toBe("#abcdef")
    expect(readTheme("sibling").colors.foreground).toBe("#abcdef")
    expect(readTheme("inner").colors.foreground).toBe("#171717")
    expect(readTheme("default").colors.foreground).toBe("#171717")
  })

  it("restores mode defaults when overrides are removed without mutating the caller", async () => {
    const overrides = Object.freeze({ colors: Object.freeze({ foreground: "#abcdef" }) })
    const { rerender } = await renderTheme({ mode: "dark", overrides })
    await rerender(
      <NativeThemeProvider mode="dark">
        <ThemeProbe />
      </NativeThemeProvider>,
    )
    expect(readTheme().colors.foreground).toBe("#ffffff")
    expect(overrides.colors.foreground).toBe("#abcdef")
  })

  it.each(["light", "dark"] as const)("matches canonical outline sRGB blends in %s mode", async (mode) => {
    await renderTheme({ mode })
    const theme = readTheme()
    const blend = (foreground: string, background: string, amount: number) =>
      "#" +
      [1, 3, 5]
        .map((offset) =>
          Math.round(
            Number.parseInt(foreground.slice(offset, offset + 2), 16) * amount +
              Number.parseInt(background.slice(offset, offset + 2), 16) * (1 - amount),
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    for (const action of Object.values(theme.actions)) {
      expect(action.border).toMatch(/^#[0-9a-f]{6}$/)
      expect(theme.colors.background).toMatch(/^#[0-9a-f]{6}$/)
      expect(action.outlineHoverBackground).toBe(blend(String(action.border), String(theme.colors.background), 0.15))
      expect(action.outlinePressedBackground).toBe(blend(String(action.border), String(theme.colors.background), 0.3))
    }
  })

  it("preserves canonical light/dark action roles and native line metrics", async () => {
    const { rerender } = await renderTheme()
    expect(readTheme().actions.primary).toMatchObject({
      background: "#2563eb",
      pressedBackground: "#2250b6",
      outlineHoverBackground: "#dee8fc",
    })
    expect(readTheme().typography.lineHeight).toBeUndefined()
    await rerender(
      <NativeThemeProvider mode="dark">
        <ThemeProbe />
      </NativeThemeProvider>,
    )
    expect(readTheme().actions.primary).toMatchObject({
      hoverBackground: "#467aee",
      pressedBackground: "#5c8af0",
      outlineHoverBackground: "#192237",
      outlinePressedBackground: "#1b2e57",
    })
    expect(readTheme().opacity.disabled).toBe(0.4)
  })
})

it.each([
  [
    "light",
    {
      controlPlaceholder: "#707070",
      controlHoverBackground: "#efefef",
      controlPressedBackground: "#c6c6c6",
      controlSelectedBackground: "#2563eb",
      controlSelectedHoverBackground: "#245bd6",
      controlSelectedPressedBackground: "#2254c1",
      controlSelectedForeground: "#ffffff",
      controlTrackBackground: "#c6c6c6",
      controlTrackInvertedBackground: "#2c2c2c",
      validationErrorBorder: "#b73434",
      validationWarningBorder: "#a66b00",
      validationSuccessBorder: "#2f7d18",
    },
  ],
  [
    "dark",
    {
      controlPlaceholder: "#878787",
      controlHoverBackground: "#2c2c2c",
      controlPressedBackground: "#3d3d3d",
      controlSelectedBackground: "#2563eb",
      controlSelectedHoverBackground: "#3b73ed",
      controlSelectedPressedBackground: "#5182ef",
      controlSelectedForeground: "#ffffff",
      controlTrackBackground: "#3d3d3d",
      controlTrackInvertedBackground: "#efefef",
      validationErrorBorder: "#ff6b5f",
      validationWarningBorder: "#f0b429",
      validationSuccessBorder: "#6ad060",
    },
  ],
] as const)("copies the twelve canonical control roles in %s mode", async (mode, expected) => {
  await renderTheme({ mode })
  expect(readTheme().colors).toMatchObject(expected)
})

it("overrides added control roles while retaining mode defaults and isolated children", async () => {
  await render(
    <NativeThemeProvider
      mode="dark"
      overrides={{ colors: { controlSelectedBackground: "#abcdef", validationErrorBorder: "#123456" } }}
    >
      <ThemeProbe label="outer" />
      <NativeThemeProvider>
        <ThemeProbe label="inner" />
      </NativeThemeProvider>
    </NativeThemeProvider>,
  )
  expect(readTheme("outer").colors).toMatchObject({
    controlSelectedBackground: "#abcdef",
    validationErrorBorder: "#123456",
    controlPlaceholder: "#878787",
  })
  expect(readTheme("inner").colors).toMatchObject({
    controlSelectedBackground: "#2563eb",
    validationErrorBorder: "#b73434",
  })
})
