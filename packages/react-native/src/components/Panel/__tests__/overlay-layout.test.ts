import type { TextStyle, ViewStyle } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativePanelOverlayLayout } from "../overlayLayout"
import { getNativePanelStyles } from "../styles"

const theme = resolveNativeTheme("light")
const resolve = (body: TextStyle = {}, overlay: ViewStyle = {}, blur = false) => {
  const styles = getNativePanelStyles(
    { accessibilityLabel: "Layout", customStyles: body, customOverlayStyles: overlay },
    theme,
    1280,
  )
  return getNativePanelOverlayLayout(styles, styles.view, blur)
}

it("keeps default viewport-fixed and viewport-height ownership distinct from authored native absolute and percentage values", () => {
  expect(resolve()).toMatchObject({ panelPosition: "fixed", panelViewportHeight: true, panelViewportWidth: true })
  expect(resolve({ position: "absolute", width: "50%", height: "100%" })).toMatchObject({
    panelPosition: "absolute",
    panelViewportHeight: false,
    panelViewportWidth: false,
  })
  expect(resolve({ position: "relative" }).panelPosition).toBe("relative")
  expect(resolve({ position: "static" }).panelPosition).toBe("static")
})

it.each<ViewStyle>([{ transform: [{ translateX: 0 }] }, { filter: "brightness(100%)" }, { filter: "opacity(100%)" }])(
  "retains an explicitly authored identity transform/filter as a containing block (%j)",
  (overlay) => {
    expect(resolve({}, { ...overlay, overflow: "hidden" })).toMatchObject({
      establishesContainingBlock: true,
      host: { overflow: "hidden" },
    })
  },
)

it.each<ViewStyle>([
  { opacity: 0 },
  { isolation: "isolate" },
  { mixBlendMode: "multiply" },
  { transform: [], filter: "none" },
])("keeps fixed descendants outside ordinary overlay clipping (%j)", (overlay) => {
  expect(resolve({}, { ...overlay, overflow: "hidden" })).toMatchObject({
    establishesContainingBlock: false,
    host: { overflow: "visible" },
    paint: { overflow: "hidden" },
  })
})

it("keeps clipping for authored flow and absolute children and includes the existing blur in containing-block ownership", () => {
  expect(resolve({ position: "relative" }, { overflow: "hidden" }).host.overflow).toBe("hidden")
  expect(resolve({ position: "absolute" }, { overflow: "hidden" }).host.overflow).toBe("hidden")
  expect(resolve({}, { overflow: "hidden" }, true)).toMatchObject({
    establishesContainingBlock: true,
    host: { overflow: "hidden" },
  })
})

it("gives the host real box geometry while preserving original backdrop ink and excluding geometry from that paint leaf", () => {
  const result = resolve(
    {},
    {
      left: 40,
      top: 30,
      width: 240,
      height: 180,
      padding: 10,
      borderWidth: 4,
      borderColor: "red",
      backgroundColor: "plum",
      opacity: 0.4,
    },
  )
  expect(result).toMatchObject({
    host: { left: 40, top: 30, width: 240, height: 180, padding: 10, borderWidth: 4, borderColor: "transparent" },
    paint: { borderWidth: 4, borderColor: "red", backgroundColor: "plum" },
    opacity: 0.4,
  })
  for (const field of ["left", "top", "width", "height", "padding", "opacity"])
    expect(result.paint).not.toHaveProperty(field)
  expect(result.host).not.toHaveProperty("backgroundColor")
})

it("removes the overlay compositing box for contents without changing the original body position ownership", () => {
  expect(
    resolve({}, { display: "contents", opacity: 0, transform: [{ translateX: 20 }], filter: "blur(2px)" }, true),
  ).toMatchObject({
    panelPosition: "fixed",
    establishesContainingBlock: false,
    opacity: 1,
    host: { display: "contents", transform: undefined, filter: undefined },
  })
})

it("leaves intermediate numeric appearance dimensions on the original property clock", () => {
  const styles = getNativePanelStyles({ accessibilityLabel: "Clock" }, theme, 1280)
  expect(getNativePanelOverlayLayout(styles, { ...styles.view, height: 600, width: 350 }, false)).toMatchObject({
    panelViewportHeight: false,
    panelViewportWidth: false,
  })
})
