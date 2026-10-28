import assert from "node:assert/strict"
import { log } from "node:console"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import process from "node:process"
import { pathToFileURL, URL } from "node:url"

const reactRequire = createRequire(new URL("../../../../packages/react/package.json", import.meta.url))
const motionRequire = createRequire(reactRequire.resolve("motion"))
const framerRequire = createRequire(motionRequire.resolve("framer-motion"))
const packageRoot = dirname(dirname(dirname(framerRequire.resolve("motion-dom"))))
const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
assert.equal(version, "12.40.0")
const source = join(packageRoot, "dist/es/projection/styles/scale-box-shadow.mjs")
const { correctBoxShadow } = await import(pathToFileURL(source).href)
const cases = [
  "2px 4px 8px 2px rgba(0,0,0,0.5)",
  "navy 2px 4px",
  "inset -2px 4px 8px -1px #123456",
  "2px -3px",
  "none",
  "0px 2px 3px black, 0px 4px 8px blue",
  "2px 4px, 4px 8px",
]
const results = cases.flatMap((value, index) =>
  [
    [0.5, 1],
    [2, 3],
    [0.75, 1.25],
  ].map(([x, y]) => ({
    id: `shadow-${index}/${x}-${y}`,
    value,
    x,
    y,
    expected: correctBoxShadow.correct(value, {
      treeScale: { x: 1, y: 1 },
      projectionDelta: { x: { scale: x }, y: { scale: y } },
    }),
  })),
)
const result =
  JSON.stringify(
    {
      package: "motion-dom",
      version,
      sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"),
      results,
    },
    null,
    2,
  ) + "\n"
if (process.argv[2]) {
  writeFileSync(process.argv[2], result)
  log(`Wrote ${results.length} pinned shadow correction samples to ${process.argv[2]}`)
} else log(result)
