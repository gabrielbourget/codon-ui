// Execute the actual pinned Motion parser against the portable native scalar
// helper. Matrix dimensions are explicit inputs; this does not execute a view.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const upstreamVersion = "12.40.0"
const upstreamGitHead = "38ebb9480e5b25a51e09e2ec866c101d01d82c60"
const sourceRef = `https://github.com/motiondivision/motion/blob/${upstreamGitHead}/packages/motion-dom/src/render/dom/parse-transform.ts`
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const upstreamRoot = path.join(root, `node_modules/.pnpm/motion-dom@${upstreamVersion}/node_modules/motion-dom`)
assert.equal(JSON.parse(fs.readFileSync(path.join(upstreamRoot, "package.json"), "utf8")).version, upstreamVersion)
const upstreamModule = path.join(upstreamRoot, "dist/es/render/dom/parse-transform.mjs")
const sourceMap = JSON.parse(fs.readFileSync(`${upstreamModule}.map`, "utf8"))
assert.deepEqual(sourceMap.sources, ["../../../../src/render/dom/parse-transform.ts"])
assert.equal(sourceMap.sourcesContent.length, 1)
const upstreamSha256 = sha256(sourceMap.sourcesContent[0])
const executedModuleSha256 = sha256(fs.readFileSync(upstreamModule))
assert.equal(upstreamSha256, "c0e21cc5d0151a3f0d5e76c762c6eee24a659d74b5ede1be04133562f721714c")
assert.equal(executedModuleSha256, "73ce14c6622f4aa9d039bc8a7563862000f5ee2d57eef61106ce86d49395cde7")
const { parseValueFromTransform } = await import(pathToFileURL(upstreamModule).href)
const receivedPaths = [
  "packages/react-native/cpp/motion/NativeTransformValue.h",
  "packages/react-native/cpp/motion/InitialValueStyle.cpp",
  "planning/component-library/fixtures/native-card/NativeTransformValue.test.cpp",
  "planning/component-library/fixtures/native-card/transform-values.oracle.mjs",
]
const received = receivedPaths.map((relative) => ({
  path: relative,
  sha256: sha256(fs.readFileSync(path.join(root, relative))),
}))
const nativeSource = fs.readFileSync(path.join(root, receivedPaths[1]), "utf8")
const nativeReader = nativeSource.slice(
  nativeSource.indexOf("folly::dynamic transformComponent("),
  nativeSource.indexOf("folly::dynamic gradientStops("),
)
assert.match(nativeReader, /BaseViewProps::resolveTransform\(metrics\.frame\.size, props\.transform, \{\}\)\.matrix/u)
assert.match(nativeReader, /readNativeMotionMatrixScalar\(matrix,/u)
assert.doesNotMatch(nativeReader, /operations|ambiguous|arbitrary-native-transform/u)
assert.match(nativeReader, /name == "pathRotation" \|\| name == "rotation"/u)
assert.match(nativeReader, /nativeRotationAlias \? std::string_view\("rotateZ"\)/u)
assert.match(nativeReader, /matrix\[11\] == 0 \? 0 : finite\(-1 \/ matrix\[11\]\)/u)

const names = [
  "x",
  "y",
  "z",
  "translateX",
  "translateY",
  "translateZ",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
  "scaleZ",
  "rotation",
  "pathRotation",
  "transformPerspective",
  "unknown",
]
const matrices = []
const add = (profile, values) => matrices.push({ profile, values })
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const affine = ([a, b, c, d, x, y]) => [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, x, y, 0, 1]
for (const [profile, matrix] of [
  ["identity", [1, 0, 0, 1, 0, 0]],
  ["translation", [1, 0, 0, 1, 71.25, -92.5]],
  ["signed-scale", [-2, 0, 0, 5, 0, 0]],
  ["shear", [2, -3, 4, -5, 6, -7]],
  ["singular", [0, 0, 0, 0, 0, 0]],
  ["quarter-turn", [0, 1, -1, 0, 0, 0]],
  ["negative-quarter-turn", [0, -1, 1, 0, 0, 0]],
  ["signed-zero", [1, -0, -0, 1, -0, -0]],
  ["negative-axis-zero", [-1, -0, 0, -1, 0, 0]],
  ["tiny", [1e-300, -1e-300, 2e-300, -2e-300, 1e-300, -1e-300]],
  ["overflow", [1e308, 1e308, -1e308, 1e308, 0, 0]],
]) {
  add(`2d/${profile}`, matrix)
  add(`3d/affine-${profile}`, affine(matrix))
}
for (const [profile, fields] of [
  ["translation-z", { 12: 7, 13: -11, 14: 23 }],
  ["z-coefficient-not-in-scale", { 0: 3, 1: 4, 2: 100, 4: 12, 5: 5, 6: -73 }],
  ["perspective", { 3: 0.01, 7: -0.02, 11: -0.002, 15: 0.7 }],
  ["all-zero", Object.fromEntries(Array.from({ length: 16 }, (_, index) => [index, 0]))],
  ["reflections", { 0: -2, 5: -3, 10: -4 }],
  ["rotate-x-negative-zero", { 6: -0 }],
  ["rotate-y-negative-zero", { 2: 0 }],
  ["branch-positive", { 0: -1, 1: Number.MIN_VALUE, 2: Number.MIN_VALUE, 5: -1, 6: Number.MIN_VALUE }],
  ["branch-negative", { 0: -1, 1: -Number.MIN_VALUE, 2: -Number.MIN_VALUE, 5: -1, 6: -Number.MIN_VALUE }],
])
  add(`3d/${profile}`, Object.assign(identity(), fields))

// Column-major explicit 4x4 products exercise mixed/repeated authored operations.
// The parser receives only the resulting matrix, as does the native reader.
const product = (left, right) =>
  Array.from({ length: 16 }, (_, index) => {
    const row = index % 4,
      column = Math.floor(index / 4)
    return [0, 1, 2, 3].reduce((sum, inner) => sum + left[inner * 4 + row] * right[column * 4 + inner], 0)
  })
const scale = (x, y, z) => Object.assign(identity(), { 0: x, 5: y, 10: z })
const rotateZ = (angle) =>
  Object.assign(identity(), { 0: Math.cos(angle), 1: Math.sin(angle), 4: -Math.sin(angle), 5: Math.cos(angle) })
const rotateX = (angle) =>
  Object.assign(identity(), { 5: Math.cos(angle), 6: Math.sin(angle), 9: -Math.sin(angle), 10: Math.cos(angle) })
const rotateY = (angle) =>
  Object.assign(identity(), { 0: Math.cos(angle), 2: -Math.sin(angle), 8: Math.sin(angle), 10: Math.cos(angle) })
for (const [profile, operations] of [
  ["repeated-scale", [scale(2, 3, 4), scale(-5, 0.25, 2)]],
  ["repeated-rotate", [rotateZ(-0.3), rotateZ(1.7), rotateZ(-2.9)]],
  ["mixed-axes", [rotateX(-0.7), rotateY(1.3), rotateZ(-2.1)]],
  ["nonuniform-scale-rotation", [scale(3, -2, 5), rotateZ(0.9), scale(0.2, 7, 2), rotateX(-1.3)]],
  ["singular-mixed", [rotateX(0.9), scale(0, 0, 3), rotateY(-0.7)]],
])
  add(`3d/${profile}`, operations.reduce(product, identity()))

let seed = 0x243f6a88
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return (seed / 0x100000000 - 0.5) * 200
}
for (const dimension of [6, 16])
  for (let index = 0; index < 256; index++)
    add(`${dimension === 6 ? "2d" : "3d"}/arbitrary-${index}`, Array.from({ length: dimension }, random))

const numberText = (value) => (Object.is(value, -0) ? "-0" : String(value).replace("e+", "e"))
const queries = matrices.flatMap(({ profile, values }) =>
  names.map((name) => {
    const coefficients = values.map(numberText).join(", ")
    const serialized = `${values.length === 6 ? "matrix" : "matrix3d"}(${coefficients})`
    return { profile, name, values, expected: parseValueFromTransform(serialized, name) }
  }),
)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "codon-transform-value-oracle-"))
try {
  const executable = path.join(scratch, "native-transform-value")
  execFileSync(
    "/usr/bin/clang++",
    [
      "-std=c++20",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-O1",
      "-fsanitize=undefined",
      "-fno-omit-frame-pointer",
      `-I${path.join(root, "packages/react-native/cpp/motion")}`,
      path.join(root, receivedPaths[2]),
      "-o",
      executable,
    ],
    { cwd: root, timeout: 90000, stdio: "pipe" },
  )
  const selfTest = execFileSync(executable, ["--self-test"], { encoding: "utf8", timeout: 90000 }).trim()
  const input =
    queries.map(({ name, values }) => `${values.length} ${name} ${values.map(numberText).join(" ")}`).join("\n") + "\n"
  const output = execFileSync(executable, [], { input, encoding: "utf8", timeout: 90000, maxBuffer: 16 * 1024 * 1024 })
    .trimEnd()
    .split("\n")
  assert.equal(output.length, queries.length)
  let unsupported = 0,
    negativeZeros = 0,
    nonFinite = 0
  for (const [index, { profile, name, expected }] of queries.entries()) {
    const label = `${profile}/${name}`
    if (expected === undefined) {
      assert.equal(output[index], "unsupported", label)
      unsupported++
      continue
    }
    const actual = output[index] === "inf" ? Infinity : output[index] === "-inf" ? -Infinity : Number(output[index])
    if (!Number.isFinite(expected)) {
      assert.equal(actual, expected, label)
      nonFinite++
    } else if (expected === 0) {
      assert.ok(Object.is(actual, expected), `${label}: signed zero ${output[index]}`)
      if (Object.is(actual, -0)) negativeZeros++
    } else {
      assert.ok(
        Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
        `${label}: ${actual} != ${expected}`,
      )
    }
  }
  // The pinned parser intentionally differs by explicit serialization dimension.
  assert.equal(parseValueFromTransform("matrix(-2, 0, 0, 3, 0, 0)", "scaleX"), -2)
  assert.equal(parseValueFromTransform(`matrix3d(${affine([-2, 0, 0, 3, 0, 0]).join(",")})`, "scaleX"), 2)
  const receipt = {
    tier: "portable C++ UBSan helper versus actual pinned Motion parser; no native/browser/view execution",
    upstreamVersion,
    upstreamGitHead,
    upstream: { sourceRef, sourceKind: "npm-source-map-sourcesContent", upstreamSha256, executedModuleSha256 },
    license: {
      path: "packages/react-native/src/motion/kernel/LICENSE.motion-dom.md",
      sha256: sha256(fs.readFileSync(path.join(root, "packages/react-native/src/motion/kernel/LICENSE.motion-dom.md"))),
    },
    received,
    generatedExecutableSha256: sha256(fs.readFileSync(executable)),
    dimensions: {
      explicit2d: matrices.filter(({ values }) => values.length === 6).length,
      explicit3d: matrices.filter(({ values }) => values.length === 16).length,
      native: "always resolved16; never infer CSS serialization dimension",
    },
    nativeAliases: {
      rotation: "rotateZ",
      pathRotation: "rotateZ",
      transformPerspective: "matrix[11] == 0 ? 0 : -1 / matrix[11]; separate native contract",
    },
    selfTest,
    matrices: matrices.length,
    comparisons: queries.length,
    unsupported,
    negativeZeros,
    nonFinite,
    equal: true,
  }
  const outputPath = process.argv[2]
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), JSON.stringify(receipt, null, 2) + "\n")
  console.log(
    JSON.stringify({
      selfTest,
      matrices: matrices.length,
      comparisons: queries.length,
      unsupported,
      negativeZeros,
      nonFinite,
      equal: true,
      output: outputPath ?? null,
    }),
  )
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}
