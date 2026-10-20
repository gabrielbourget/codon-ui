import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const source = path.join(
  repository,
  "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom/dist/es/animation/keyframes/utils/unit-conversion.mjs",
)
const { positionalValues } = await import(pathToFileURL(source))
const box = { x: { min: 301.25, max: 438.75 }, y: { min: -10, max: 72.75 } }
const computed = {
  boxSizing: "content-box",
  paddingLeft: "10.25px",
  paddingRight: "7.5px",
  paddingTop: "3.25px",
  paddingBottom: "8.5px",
  borderLeftWidth: "11px",
  borderRightWidth: "13px",
  borderTopWidth: "17px",
  borderBottomWidth: "19px",
  left: "23.5px",
  top: "-8.25px",
}
let assertions = 0
const check = (name, expected, styles = computed, bounds = box) => {
  assert.equal(positionalValues[name](bounds, styles), expected)
  assertions++
}
check("width", 119.75)
check("height", 71)
check("width", 137.5, { ...computed, boxSizing: "border-box" })
check("height", 82.75, { ...computed, boxSizing: "border-box" })
check("width", 137.5, { boxSizing: "content-box" })
check("height", 82.75, { boxSizing: "content-box" })
check("left", 23.5)
check("top", -8.25)
check("right", 161)
check("bottom", 74.5)
check("right", 298.5, computed, { ...box, x: { min: 0, max: 275 } })
check("bottom", 157.25, computed, { ...box, y: { min: 0, max: 165.5 } })
check("width", 257.25, computed, { ...box, x: { min: 0, max: 275 } })
check("height", 153.75, computed, { ...box, y: { min: 0, max: 165.5 } })
assert.ok(Number.isNaN(positionalValues.left(box, { left: "auto" })))
assert.ok(Number.isNaN(positionalValues.top(box, { top: "auto" })))
assertions += 2
console.log(
  JSON.stringify({
    assertions,
    upstream: "Motion12.40.0 positionalValues",
    sourceSha256: createHash("sha256")
      .update(await readFile(source))
      .digest("hex"),
    tier: "Executed pinned scalar metric oracle with synthetic bounds/computed styles; no native Yoga, layout, drawing or installed fidelity proof",
  }),
)
