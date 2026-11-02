import type { TextStyle, ViewStyle } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativePanelOverlayLayout } from "../overlayLayout"
import { getNativePanelStyles } from "../styles"

const theme = resolveNativeTheme("light")
const resolve = (body: TextStyle = {}, overlay: ViewStyle = {}) => {
  const styles = getNativePanelStyles(
    { accessibilityLabel: "Layout", customStyles: body, customOverlayStyles: overlay },
    theme,
    1280,
  )
  return getNativePanelOverlayLayout(styles)
}

it("passes native flex and percentage layout to the original overlay owner without browser block defaults", () => {
  const overlay: ViewStyle = {
    width: "60%",
    height: "auto",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 30,
  }
  expect(resolve({ position: "relative" }, overlay).host).toMatchObject(overlay)
  expect(resolve({}, { display: "flex" }).host.flexDirection).toBeUndefined()
  expect(resolve({}, { display: "flex" }).host.alignContent).toBeUndefined()
})

it.each<TextStyle>([{}, { position: "absolute" }, { position: "relative" }, { position: "static" }])(
  "keeps authored native clipping on the actual composition owner (%j)",
  (body) => {
    const result = resolve(body, { overflow: "hidden", transform: [{ translateX: 0 }], filter: "brightness(100%)" })
    expect(result.host).toMatchObject({
      overflow: "hidden",
      transform: [{ translateX: 0 }],
      filter: [{ brightness: 1 }],
    })
    expect(resolve(body, { overflow: "hidden" }).host.overflow).toBe("hidden")
  },
)

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
    paintPlane: { margin: -4 },
    opacity: 0.4,
  })
  for (const field of ["left", "top", "width", "height", "padding", "opacity"])
    expect(result.paint).not.toHaveProperty(field)
  expect(result.host).not.toHaveProperty("backgroundColor")
})

it("extends the retained underlay and paint over native border insets with physical and logical overrides", () => {
  expect(
    resolve({}, { borderWidth: 4, borderTopWidth: 2, borderLeftWidth: 0, borderStartWidth: 8 }).paintPlane,
  ).toEqual({
    margin: -4,
    marginTop: -2,
    marginLeft: -0,
    marginStart: -8,
  })
})

it("removes only paint and group effects for native display contents while retaining the body", () => {
  expect(
    resolve({}, { display: "contents", opacity: 0, transform: [{ translateX: 20 }], filter: "blur(2px)" }),
  ).toMatchObject({
    opacity: 1,
    host: { display: "contents", transform: undefined, filter: undefined },
    paintPlane: { display: "none" },
  })
})
