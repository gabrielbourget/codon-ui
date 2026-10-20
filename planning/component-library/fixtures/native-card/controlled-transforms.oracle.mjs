// Actual locked Motion12.40.0 methods with explicit geometry inputs. This does
// not execute a browser/native view or admit asynchronous passive-effect fidelity.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const upstreamRoot = path.join(root, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom")
const upstreamPackage = JSON.parse(fs.readFileSync(path.join(upstreamRoot, "package.json"), "utf8"))
assert.equal(upstreamPackage.version, "12.40.0")
const metadata = JSON.parse(
  fs.readFileSync(path.join(root, "packages/react-native/src/motion/value/UPSTREAM.json"), "utf8"),
)
assert.equal(metadata.package.version, upstreamPackage.version)
const upstreamGitHead = metadata.package.gitHead
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const modules = [
  "animation/keyframes/DOMKeyframesResolver",
  "animation/keyframes/KeyframesResolver",
  "animation/keyframes/utils/unit-conversion",
  "render/utils/keys-transform",
  "value/index",
]
const upstream = modules.map((name) => {
  const modulePath = path.join(upstreamRoot, `dist/es/${name}.mjs`)
  const sourceMap = JSON.parse(fs.readFileSync(`${modulePath}.map`, "utf8"))
  assert.equal(sourceMap.sourcesContent.length, 1)
  return {
    sourceRef: `https://github.com/motiondivision/motion/blob/${upstreamGitHead}/packages/motion-dom/src/${name}.ts`,
    sourceKind: "npm-source-map-sourcesContent",
    upstreamSha256: sha256(sourceMap.sourcesContent[0]),
    executedModuleSha256: sha256(fs.readFileSync(modulePath)),
  }
})
const receivedPaths = [
  "packages/react-native/src/motion/value/isolated-probe.ts",
  "packages/react-native/src/motion/owner/NativeMotionOwner.ts",
  "packages/react-native/src/motion/measurement/isolatedGeometry.ts",
  "packages/react-native/src/motion/visual/types.ts",
  "packages/react-native/src/motion/kernel/engine/value/index.ts",
]
const received = receivedPaths.map((relative) => ({
  path: relative,
  sha256: sha256(fs.readFileSync(path.join(root, relative))),
}))
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "codon-controlled-transform-oracle-"))
const bundle = path.join(scratch, "native.mjs")
try {
  const entry = path.join(scratch, "entry.ts")
  fs.writeFileSync(
    entry,
    [
      `export { NativeMotionProbeIsolation } from ${JSON.stringify(path.join(root, "packages/react-native/src/motion/value/isolated-probe"))}`,
      `export { motionValue } from ${JSON.stringify(path.join(root, "packages/react-native/src/motion/kernel"))}`,
      `export { NATIVE_MOTION_TRANSFORM_ORDER } from ${JSON.stringify(path.join(root, "packages/react-native/src/motion/visual/types"))}`,
    ].join("\n") + "\n",
  )
  execFileSync(
    path.join(root, "node_modules/.bin/esbuild"),
    [entry, "--bundle", "--platform=node", "--format=esm", `--outfile=${bundle}`],
    { cwd: root, stdio: "pipe" },
  )
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  globalThis.__DEV__ = false
  globalThis.window = { getComputedStyle: () => ({ boxSizing: "border-box" }), pageYOffset: 0 }
  const base = pathToFileURL(path.join(upstreamRoot, "dist/es/")).href
  const [
    { removeNonTranslationalTransform },
    { DOMKeyframesResolver },
    { motionValue: upstreamValue },
    { transformPropOrder },
    native,
  ] = await Promise.all([
    import(base + "animation/keyframes/utils/unit-conversion.mjs"),
    import(base + "animation/keyframes/DOMKeyframesResolver.mjs"),
    import(base + "value/index.mjs"),
    import(base + "render/utils/keys-transform.mjs"),
    import(pathToFileURL(bundle).href),
  ])
  assert.deepEqual([...native.NATIVE_MOTION_TRANSFORM_ORDER], transformPropOrder)
  const token = { isCurrent: () => true, onCancel: () => () => {} }
  const names = [...transformPropOrder, "pathRotation"]
  const profiles = []
  for (const profile of ["plain", "defaults", "passive", "multiple", "shared"]) {
    const execute = (source) => {
      const trace = [],
        values = new Map(),
        factory = source ? upstreamValue : native.motionValue
      for (const [index, name] of names.entries())
        values.set(name, factory(profile === "defaults" ? (name.startsWith("scale") ? 1 : 0) : index + 2))
      values.set("width", factory(100))
      if (profile === "shared") values.set("rotate", values.get("scale"))
      if (profile === "passive" || profile === "multiple")
        values.get("scale").attach(
          (next, update) => {
            trace.push(["effect", next])
            if (profile === "multiple") {
              update(next)
              update(next + 1)
            } else update(next * 2)
          },
          () => trace.push(["effect-stop"]),
        )
      for (const [name, value] of values) value.on("change", (next) => trace.push([name, next]))
      const isolation = source ? undefined : new native.NativeMotionProbeIsolation()
      const removed = source ? removeNonTranslationalTransform({ getValue: (name) => values.get(name) }) : []
      if (!source)
        for (const name of native.NATIVE_MOTION_TRANSFORM_ORDER) {
          if (["x", "y", "z"].includes(name)) continue
          const value = values.get(name)
          removed.push([name, value.get()])
          isolation.setProbe(name, value, name.startsWith("scale") ? 1 : 0, "target", token)
        }
      const measured = values.get("width")
      let resolver
      if (source) {
        const element = {
          current: {},
          getValue: (name) => values.get(name),
          measureViewportBox: () => ({ x: { min: 0, max: 100 }, y: { min: 0, max: 40 } }),
        }
        resolver = new DOMKeyframesResolver([100, "auto"], () => {}, "width", measured, element)
        resolver.measureInitialState()
        element.measureViewportBox = () => ({ x: { min: 0, max: 200 }, y: { min: 0, max: 40 } })
      } else isolation.probe("width", measured, "auto", "target", token)
      for (const [name, original] of removed) {
        if (source) values.get(name).set(original)
        else isolation.setProbe(name, values.get(name), original, "restored", token)
      }
      if (source) resolver.measureEndState()
      else isolation.probe("width", measured, 100, "restored", token)
      return { trace, current: Object.fromEntries([...values].map(([key, value]) => [key, value.get()])) }
    }
    const expected = execute(true),
      actual = execute(false)
    assert.deepEqual(actual, expected, profile)
    profiles.push({
      profile,
      notifications: actual.trace.length,
      trace: actual.trace,
      finalValues: actual.current,
      equal: true,
    })
  }
  const receipt = {
    tier: "actual pinned runtime methods with explicit geometry model; no browser/native execution",
    upstreamVersion: upstreamPackage.version,
    upstreamGitHead,
    upstream,
    received,
    generatedBundleSha256: sha256(fs.readFileSync(bundle)),
    profiles,
  }
  const output = process.argv[2]
  if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(receipt, null, 2) + "\n")
  console.log(
    JSON.stringify({
      profiles: profiles.map(({ profile, notifications, equal }) => ({ profile, notifications, equal })),
      upstreamInputs: upstream.length,
      receivedInputs: received.length,
      output: output ?? null,
    }),
  )
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}
