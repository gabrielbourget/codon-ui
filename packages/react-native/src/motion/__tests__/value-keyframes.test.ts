import { motionValue } from "../kernel"
import { canAnimateNativeKeyframes, nativeTargetKeyframes, resolveNativeMotionKeyframes } from "../value"
import type { TNativeMotionValueContext, TNativeMotionValueOptions, TNativeMotionResolutionToken } from "../value"

const token: TNativeMotionResolutionToken = { isCurrent: () => true, onCancel: () => () => {} }
const options = (
  frames: unknown[],
  context: Partial<TNativeMotionValueContext> = {},
  name = "width",
): TNativeMotionValueOptions => ({
  keyframes: frames,
  name,
  motionValue: motionValue<unknown>(10),
  context: {
    isCurrent: () => true,
    readValue: () => {
      throw new Error("missing native read")
    },
    ...context,
  },
})

it.each([
  ["opacity", 1, [null, 1]],
  ["opacity", [null, 1], [null, 1]],
  ["transform", [{ translateX: 10 }], [null, [{ translateX: 10 }]]],
  ["transform", [[{ translateX: 0 }], [{ translateX: 10 }]], [[{ translateX: 0 }], [{ translateX: 10 }]]],
  ["transformOrigin", ["50%", "50%", 0], [null, ["50%", "50%", 0]]],
  ["fontVariant", ["small-caps"], [null, ["small-caps"]]],
  ["boxShadow", [], [null, []]],
  ["boxShadow", [{ offsetX: 0, offsetY: 2, color: "red" }], [null, [{ offsetX: 0, offsetY: 2, color: "red" }]]],
  ["boxShadow", ["0px 0px red", "2px 2px blue"], ["0px 0px red", "2px 2px blue"]],
])("distinguishes native structured %s targets from keyframe arrays", (name, target, expected) => {
  expect(nativeTargetKeyframes(name as string, target)).toEqual(expected)
})
it("fills wildcards without changing frozen targets and preserves unchanged native object identity", () => {
  const transform = Object.freeze([{ translateX: 10 }])
  const frames = Object.freeze([transform, null, transform])
  const resolved = resolveNativeMotionKeyframes(options([...frames], {}, "transform"), token)
  expect(resolved).toEqual({ keyframes: [transform, transform, transform] })
  expect((resolved as { keyframes: unknown[] }).keyframes[0]).toBe(transform)
  expect(canAnimateNativeKeyframes((resolved as { keyframes: unknown[] }).keyframes, "transform", "keyframes")).toBe(
    false,
  )
  expect(frames[1]).toBeNull()
})
it("reads an unavailable first value from the actual provider and initializes the MotionValue", async () => {
  let resolve!: (value: unknown) => void
  const readValue = jest.fn(
    () =>
      new Promise<unknown>((accept) => {
        resolve = accept
      }),
  )
  const configuration = options([null, null, 30], { readValue })
  configuration.motionValue = motionValue<unknown>(undefined)
  const pending = resolveNativeMotionKeyframes(configuration, token)
  expect(readValue).toHaveBeenCalledWith("width", 30, token)
  resolve(15)
  await expect(pending).resolves.toEqual({ keyframes: [15, 15, 30] })
  expect(configuration.motionValue.get()).toBe(15)
})
it("rejects unavailable initial values without substituting the target", () => {
  const configuration = options([null, 30], { readValue: () => undefined })
  configuration.motionValue = motionValue<unknown>(undefined)
  expect(() => resolveNativeMotionKeyframes(configuration, token)).toThrow(/initial value unavailable/)
})
it.each([
  [[], /empty/],
  [[undefined, 10], /missing actual/],
  [[0, NaN], /finite/],
  [[{ scale: Infinity }, { scale: 1 }], /finite/],
])("rejects invalid keyframes %p", (frames, message) => {
  expect(() => resolveNativeMotionKeyframes(options(frames as unknown[]), token)).toThrow(message as RegExp)
})
it.each([
  [0, "50%"],
  ["auto", 100],
  ["0deg", "1rad"],
  [0, "100px"],
  [0, "10"],
  [[{ translateX: 0 }], [{ translateX: "50%" }]],
  [[{ scale: 1 }], [{ translateX: 10 }]],
])("requires native geometry for incompatible units or structures %p -> %p", (from, to) => {
  expect(() => resolveNativeMotionKeyframes(options([from, to]), token)).toThrow(/actual native keyframe geometry/)
})
it("accepts matching native structures independent of object key order", () => {
  expect(
    resolveNativeMotionKeyframes(
      options([
        { offsetX: 0, offsetY: 10 },
        { offsetY: 20, offsetX: 30 },
      ]),
      token,
    ),
  ).toEqual({
    keyframes: [
      { offsetX: 0, offsetY: 10 },
      { offsetY: 20, offsetX: 30 },
    ],
  })
})
it("retains the original auto/percentage endpoint after actual geometry resolution", async () => {
  const resolveGeometry = jest.fn(async () => ({ keyframes: [20, 80] }))
  await expect(resolveNativeMotionKeyframes(options([20, "auto"], { resolveGeometry }), token)).resolves.toEqual({
    keyframes: [20, 80],
    finalKeyframe: "auto",
  })
  expect(resolveGeometry).toHaveBeenCalledWith("width", [20, "auto"], token)
})
it("rejects partial or still-unresolved geometry", async () => {
  await expect(
    resolveNativeMotionKeyframes(options([0, "50%"], { resolveGeometry: async () => ({ keyframes: [0] }) }), token),
  ).rejects.toThrow(/incomplete/)
  expect(() =>
    resolveNativeMotionKeyframes(options([0, "50%"], { resolveGeometry: () => ({ keyframes: [0, "50%"] }) }), token),
  ).toThrow(/incomplete/)
})
it("samples every structured native color endpoint and preserves authored final representation", async () => {
  const from = Object.freeze([{ offsetX: 0, offsetY: 2, color: Object.freeze({ semantic: ["labelColor"] }) }])
  const to = Object.freeze([{ offsetX: 0, offsetY: 4, color: "red" }])
  const resolveColors = jest.fn(async () => ["rgba(0, 0, 0, 1)", "rgba(255, 0, 0, 1)"])
  const result = await resolveNativeMotionKeyframes(options([from, to], { resolveColors }, "boxShadow"), token)
  expect(resolveColors).toHaveBeenCalledWith([from[0].color, "red"], token)
  expect(result.keyframes).toEqual([
    [{ offsetX: 0, offsetY: 2, color: "rgba(0, 0, 0, 1)" }],
    [{ offsetX: 0, offsetY: 4, color: "rgba(255, 0, 0, 1)" }],
  ])
  expect(result.finalKeyframe).toBe(to)
  expect(from[0].color).toEqual({ semantic: ["labelColor"] })
})
it("requires color sampling and rejects incomplete sample batches", async () => {
  expect(() => resolveNativeMotionKeyframes(options(["red", "blue"], {}, "color"), token)).toThrow(
    /actual native color/,
  )
  await expect(
    resolveNativeMotionKeyframes(
      options(["red", "blue"], { resolveColors: async () => ["rgba(0, 0, 0, 1)"] }, "color"),
      token,
    ),
  ).rejects.toThrow(/incomplete/)
})
it("ignores a native initial read resolved after its lease expires", async () => {
  let accept!: (value: unknown) => void,
    current = true
  const configuration = options([null, 30], {
    readValue: () =>
      new Promise((resolve) => {
        accept = resolve
      }),
  })
  configuration.motionValue = motionValue<unknown>(undefined)
  const pending = resolveNativeMotionKeyframes(configuration, { ...token, isCurrent: () => current })
  current = false
  accept(100)
  await expect(pending).rejects.toThrow(/retired/)
  expect(configuration.motionValue.get()).toBeUndefined()
})
it("preserves source nonanimatable exceptions and velocity-driven equal springs", () => {
  expect(canAnimateNativeKeyframes([0, 0], "x", "spring", 10)).toBe(true)
  expect(canAnimateNativeKeyframes([0, 0], "x", "keyframes", 10)).toBe(false)
  expect(canAnimateNativeKeyframes([0, 10], "zIndex", "keyframes")).toBe(false)
  expect(canAnimateNativeKeyframes(["none", "block"], "display", "keyframes")).toBe(true)
  expect(canAnimateNativeKeyframes(["url(image)", "url(other)"], "backgroundImage", "keyframes")).toBe(false)
})
it("keeps a static or single opaque color in its original native representation without interpolation queries", () => {
  const opaque = Object.freeze({ semantic: ["labelColor"] }),
    resolveColors = jest.fn()
  expect(resolveNativeMotionKeyframes(options([opaque, opaque], { resolveColors }, "color"), token)).toEqual({
    keyframes: [opaque, opaque],
  })
  expect(resolveNativeMotionKeyframes(options([opaque], { resolveColors }, "color"), token)).toEqual({
    keyframes: [opaque],
  })
  expect(resolveColors).not.toHaveBeenCalled()
})
it("rejects non-finite values returned by a geometry provider", async () => {
  await expect(
    resolveNativeMotionKeyframes(
      options([0, "auto"], { resolveGeometry: async () => ({ keyframes: [0, NaN] }) }),
      token,
    ),
  ).rejects.toThrow(/finite/)
})
