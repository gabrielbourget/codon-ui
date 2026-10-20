import { PlatformColor } from "react-native"

import { buildNativeMotionOrigin, buildNativeMotionTransform } from "../visual/nativeTransform"
import { resolveNativeMotionVisualStyle } from "../visual/styles"
import type {
  TNativeMotionTransform,
  TNativeMotionTransformTemplate,
  TNativeMotionTransformValues,
} from "../visual/types"

it("keeps pinned transform ordering, aliases, defaults and additive path rotation", () => {
  const result = buildNativeMotionTransform({
    rotate: 20,
    x: "50%",
    scale: 1,
    y: 0,
    translateX: -5,
    skew: "0.1rad",
    transformPerspective: 500,
    pathRotation: 10,
  })
  expect(result).toEqual([
    { perspective: 500 },
    { translateX: "50%" },
    { translateX: -5 },
    { rotate: "20deg" },
    { skewX: "0.1rad" },
    { rotate: "10deg" },
  ])
  expect(buildNativeMotionTransform({ x: 0, scale: 1, rotate: "0deg" })).toEqual([])
})
it("represents both native z translations as ordered 4x4 matrix slots", () => {
  const result = buildNativeMotionTransform({ z: 5, translateZ: 20, rotateX: 10 })
  expect(result).toEqual([
    { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1] },
    { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 20, 1] },
    { rotateX: "10deg" },
  ])
})
it("gives native templates resolved angles, defaults and the generated native array", () => {
  const template = jest.fn<TNativeMotionTransform, Parameters<TNativeMotionTransformTemplate>>((_values, generated) => [
    { scale: 2 },
    ...generated,
  ])
  expect(buildNativeMotionTransform({ x: 0, rotate: 10, scale: 1 }, template)).toEqual([
    { scale: 2 },
    { rotate: "10deg" },
  ])
  expect(template.mock.calls[0]).toEqual([{ x: 0, scale: 1, rotate: "10deg" }, [{ rotate: "10deg" }]])
  expect(() => buildNativeMotionTransform({}, (() => "scale(2)") as unknown as TNativeMotionTransformTemplate)).toThrow(
    /native transform array/,
  )
})
it.each([{ x: "10px" }, { scale: "2" }, { rotate: "10%" }, { z: "5%" }, { x: Infinity }, { rotate: NaN }])(
  "rejects incompatible native transform inputs %p",
  (values) => {
    expect(() => buildNativeMotionTransform(values as unknown as TNativeMotionTransformValues)).toThrow(TypeError)
  },
)
it("owns all origin coordinates with the pinned defaults and preserves zero", () => {
  expect(buildNativeMotionOrigin({ originX: 0, originZ: 5 })).toEqual(["0%", "50%", 5])
  expect(buildNativeMotionOrigin({ originY: "75%" })).toEqual(["50%", "75%", 0])
})
it("applies computed/custom/final precedence, then resolved motion styles", () => {
  const resolved = resolveNativeMotionVisualStyle(
    { width: 10, opacity: 1, fontSize: 16 },
    [{ width: 20, color: "red" }],
    { width: 0, color: "blue" },
    { opacity: 0, fontSize: 0, x: 10 },
  )
  expect(resolved.view).toEqual({ width: 0, opacity: 0, transform: [{ translateX: 10 }] })
  expect(resolved.text).toEqual({ color: "blue", fontSize: 0 })
})
it("preserves opaque static native colors and lets removed typography restore native defaults", () => {
  const opaque = PlatformColor("labelColor")
  const resolved = resolveNativeMotionVisualStyle(
    { color: "red", fontSize: 16 },
    { color: opaque },
    { fontSize: undefined },
    {},
  )
  expect(resolved.text.color).toBe(opaque)
  expect(resolved.text).not.toHaveProperty("fontSize")
  expect(() => resolveNativeMotionVisualStyle({}, { color: "var(--color)" }, {}, {})).toThrow(
    /unsupported native color/,
  )
})
it("honors explicit motion transform ownership and origin ownership", () => {
  const template = jest.fn<TNativeMotionTransform, Parameters<TNativeMotionTransformTemplate>>(
    (_values, generated) => generated,
  )
  const explicit = [{ scale: 3 }]
  const resolved = resolveNativeMotionVisualStyle(
    { transform: [{ scale: 2 }], transformOrigin: [0, 0, 20] },
    {},
    {},
    { transform: explicit, x: 10, originY: 0 },
    template,
  )
  expect(resolved.view.transform).toBe(explicit)
  expect(template).not.toHaveBeenCalled()
  expect(resolved.view.transformOrigin).toEqual(["50%", "0%", 0])
  expect(resolveNativeMotionVisualStyle({ transform: explicit }, {}, {}, { x: 10 }).view.transform).toEqual([
    { translateX: 10 },
  ])
  expect(resolveNativeMotionVisualStyle({ transform: explicit }, {}, {}, {}).view.transform).toBe(explicit)
})
