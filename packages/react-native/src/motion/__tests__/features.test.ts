import { NativeMotionFeatures, NATIVE_MOTION_FEATURE_PROPS } from "../owner/NativeMotionFeatures"
import type { TNativeMotionFeature } from "../owner/NativeMotionFeatures"
import type { TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"

const { execFileSync } = jest.requireActual<{
  execFileSync: (file: string, args: string[], options: { encoding: "utf8"; timeout: number }) => string
}>("node:child_process")
const { realpathSync } = jest.requireActual<{ realpathSync: (path: string) => string }>("node:fs")
const { resolve } = jest.requireActual<{ resolve: (...parts: string[]) => string }>("node:path")
const nativeProcess = jest.requireActual<{ execPath: string }>("node:process")
declare const __dirname: string

it("matches all nine actual pinned feature predicates and retains committed feature lifetimes", () => {
  const cases: Record<string, unknown>[] = [
    {},
    { animate: false },
    { animate: [] },
    { variants: {} },
    { exit: { opacity: 0 } },
    { drag: "x" },
    { dragControls: "$callback" },
    { whileFocus: "focus" },
    { onHoverEnd: "$callback" },
    { onTapStart: "$callback" },
    { onPanEnd: "$callback" },
    { onViewportLeave: "$callback" },
    { layoutId: "" },
    { layoutId: "card" },
    { layout: false },
    { ignoreStrict: true },
    {},
  ]
  const decode = (value: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, item === "$callback" ? () => {} : item]),
    ) as TNativeMotionOwnerProps
  const source = resolve(
    realpathSync(resolve(__dirname, "../../../../../packages/react/node_modules/motion")),
    "../framer-motion/dist/es/motion/features/definitions.mjs",
  )
  const script = `import {pathToFileURL} from 'node:url';
    const {getInitializedFeatureDefinitions}=await import(pathToFileURL(process.argv[1]));
    const definitions=getInitializedFeatureDefinitions();
    const cases=${JSON.stringify(cases)};
    console.log(JSON.stringify(cases.map(props=>Object.keys(definitions).filter(key=>definitions[key].isEnabled(props)))));`
  const expected = JSON.parse(
    execFileSync(nativeProcess.execPath, ["--input-type=module", "-e", script, source], {
      encoding: "utf8",
      timeout: 5000,
    }),
  ) as TNativeMotionFeature[][]
  const registry = new NativeMotionFeatures(),
    retained = new Set<TNativeMotionFeature>()
  cases.forEach((entry, index) => {
    const props = decode(entry),
      probe = new NativeMotionFeatures()
    expect(
      Object.keys(NATIVE_MOTION_FEATURE_PROPS).filter((key) => probe.has(key as TNativeMotionFeature, props, false)),
    ).toEqual(expected[index])
    registry.update(props, false)
    expected[index]!.forEach((feature) => retained.add(feature))
    expect(registry.snapshot()).toEqual([...retained])
  })
  expect([...retained]).toHaveLength(9)
  expect(new NativeMotionFeatures().snapshot()).toEqual([])
})
it("does not commit speculative props or admit static feature instances", () => {
  const registry = new NativeMotionFeatures()
  expect(registry.has("tap", { onTap: () => {} }, false)).toBe(true)
  expect(registry.has("tap", {}, false)).toBe(false)
  registry.update({ onTap: () => {}, whileFocus: "focus", layout: true }, true)
  expect(registry.snapshot()).toEqual([])
  expect(registry.has("tap", { onTap: () => {} }, true)).toBe(false)
})
