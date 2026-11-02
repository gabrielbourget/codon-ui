import { nativeMotionInitialValue } from "../value/initialValue"

it.each(["width", "height", "marginStart", "padding", "borderRadius", "fontSize"])(
  "requires an authored %s and preserves explicit zero",
  (name) => {
    expect(() => nativeMotionInitialValue(name, {})).toThrow("explicit initial value")
    expect(nativeMotionInitialValue(name, { [name]: 0 })).toBe(0)
    expect(nativeMotionInitialValue(name, { [name]: "25%" })).toBe("25%")
  },
)

it("uses identity defaults without inspecting a host or decomposing an authored transform", () => {
  expect(nativeMotionInitialValue("opacity", {})).toBe(1)
  expect(nativeMotionInitialValue("x", {})).toBe(0)
  expect(nativeMotionInitialValue("scale", {})).toBe(1)
  expect(nativeMotionInitialValue("originX", {})).toBe(0.5)
  expect(() => nativeMotionInitialValue("x", { transform: [{ translateX: 30 }] })).toThrow("explicit initial")
  expect(() => nativeMotionInitialValue("originX", { transformOrigin: [20, 30, 0] })).toThrow("explicit initial")
  expect(nativeMotionInitialValue("x", { x: 20, transform: [{ translateX: 30 }] })).toBe(20)
})
