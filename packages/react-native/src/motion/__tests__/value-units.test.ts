import { normalizeNativeMotionKeyframeUnits } from "../value/units"

it.each([
  ["rotate", ["90deg", `${Math.PI}rad`], [90, 180]],
  ["originX", [0.5, "75%"], [0.5, 0.75]],
  ["transform", [[{ rotate: "0deg" }], [{ rotate: `${Math.PI}rad` }]], [[{ rotate: "0deg" }], [{ rotate: "180deg" }]]],
])("normalizes valid native %s units without consulting Yoga", (name, frames, expected) => {
  expect(normalizeNativeMotionKeyframeUnits(name as string, frames as unknown[])).toEqual(expected)
})
it("preserves native structure order, missing fields, frozen endpoints and opaque unchanged identities", () => {
  const original = Object.freeze([{ scale: 1 }, { translateX: "50%" }])
  const target = Object.freeze([{ translateX: 20 }, { rotate: "1rad" }])
  const frames = normalizeNativeMotionKeyframeUnits("transform", [original, target])
  expect(frames[0]).toBe(original)
  expect((frames[1] as object[])[0]).toEqual({ translateX: 20 })
  expect(Object.keys((frames[1] as object[])[1])).toEqual(["rotate"])
  expect(target[1]).toEqual({ rotate: "1rad" })
})
it("retains valid optional native shadow fields as absent rather than inventing metrics", () => {
  const endpoint = Object.freeze([{ offsetX: 2, offsetY: 4, blurRadius: undefined }])
  expect(normalizeNativeMotionKeyframeUnits("boxShadow", [endpoint])).toEqual([[{ offsetX: 2, offsetY: 4 }]])
  expect(endpoint[0]).toHaveProperty("blurRadius", undefined)
})

it("preserves numeric strings and native offset representations for actual native authority", () => {
  expect(normalizeNativeMotionKeyframeUnits("width", [0, "10"])).toEqual([0, "10"])
  expect(normalizeNativeMotionKeyframeUnits("opacity", ["0.1", "1e0"])).toEqual(["0.1", "1e0"])
  const offset = Object.freeze({ width: "0", height: 2 })
  expect(normalizeNativeMotionKeyframeUnits("shadowOffset", [offset])[0]).toBe(offset)
})
