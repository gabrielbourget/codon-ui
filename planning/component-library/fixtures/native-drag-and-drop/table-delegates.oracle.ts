import { deepStrictEqual, equal } from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { dragCollection } from "../../../../packages/react-native/src/collection/dragAndDrop/__tests__/fixtures.ts"
import { NativeListKeyboardDelegate } from "../../../../packages/react-native/src/collection/dragAndDrop/NativeListKeyboardDelegate.ts"
import type { TNativeDropTarget } from "../../../../packages/react-native/src/collection/dragAndDrop/types.ts"
import { NativeTreeDropTargetDelegate } from "../../../../packages/react-native/src/components/Table/NativeTreeDropTargetDelegate.ts"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const load = createRequire(realpathSync(root + "packages/react/node_modules/react-aria/package.json"))
const typescript = createRequire(root + "packages/react-native/package.json")("typescript")
const hashes: Record<string, string> = {}
const original = (path: string, name: string, dependencies: Record<string, unknown> = {}) => {
  const full = root + path,
    raw = readFileSync(full),
    map = JSON.parse(raw.toString())
  hashes[path] = createHash("sha256").update(raw).digest("hex")
  const source = map.sourcesContent[0].replace(/^import .*;$/gm, "")
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS },
  }).outputText
  const exports: Record<string, unknown> = {}
  // Expose the actual pinned class, substituting only DOM geometry/scroll inputs.
  new Function("exports", ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies))
  return exports[name] as typeof NativeTreeDropTargetDelegate & typeof NativeListKeyboardDelegate
}
const Tree = original(
  "packages/react/node_modules/react-aria-components/dist/private/TreeDropTargetDelegate.js.map",
  "TreeDropTargetDelegate",
)
let scrollable = false
const List = original(
  "packages/react/node_modules/react-aria/dist/private/selection/ListKeyboardDelegate.js.map",
  "ListKeyboardDelegate",
  {
    isScrollable: () => scrollable,
    DOMLayoutDelegate: class {
      constructor() {
        throw new Error("Original explicit layout delegate was omitted")
      }
    },
  },
)
equal(typeof load.resolve("react"), "string")
const collection = dragCollection(),
  keys = [0, "", "folder", "child"]
let treeCases = 0,
  listCases = 0
for (const direction of ["ltr", "rtl"] as const)
  for (const expanded of [[], ["folder"], [0, "", "folder"]])
    for (const rejected of [null, "on", "before", "after"])
      for (const key of keys)
        for (const dropPosition of ["before", "on", "after"] as const) {
          const target: TNativeDropTarget = { type: "item", key, dropPosition }
          const make = () => ({ getDropTargetFromPoint: () => ({ ...target }) })
          const native = new NativeTreeDropTargetDelegate(),
            upstream = new Tree()
          const state = { collection, expandedKeys: new Set(expanded) }
          native.setup(make(), state, direction)
          upstream.setup(make(), state, direction)
          const valid = (target: TNativeDropTarget) => target.type === "root" || target.dropPosition !== rejected
          for (const [x, y] of [
            [30, 20],
            [30, 40],
            [10, 40],
            [10, 46],
            [35, 46],
            [35, 38],
            [55, 60],
            [0, 5],
          ]) {
            deepStrictEqual(native.getDropTargetFromPoint(x, y, valid), upstream.getDropTargetFromPoint(x, y, valid))
            treeCases++
          }
        }
for (const layout of ["stack", "grid"] as const)
  for (const orientation of ["vertical", "horizontal"] as const)
    for (const direction of ["ltr", "rtl"] as const)
      for (const disabledBehavior of ["all", "selection"] as const)
        for (const disabled of [[], [0], [""], [0, "", "folder", "child"]])
          for (const scroller of [false, true])
            for (const delegated of [false, true]) {
              scrollable = scroller
              const geometry = {
                getItemRect: (key: string | number) => {
                  const index = keys.indexOf(key)
                  return index < 0
                    ? null
                    : {
                        x: layout === "grid" ? (index % 2) * 40 : orientation === "horizontal" ? index * 40 : 0,
                        y: layout === "grid" ? Math.floor(index / 2) * 30 : orientation === "vertical" ? index * 30 : 0,
                        width: 40,
                        height: 30,
                      }
                },
                ...(delegated
                  ? {
                      getKeyLeftOf: (key: string | number) => keys[keys.indexOf(key) - 1] ?? null,
                      getKeyRightOf: (key: string | number) => keys[keys.indexOf(key) + 1] ?? null,
                    }
                  : {}),
                getVisibleRect: () => ({ x: 0, y: 0, width: 80, height: 60 }),
                getContentSize: () => ({ width: 160, height: 120 }),
              }
              const options = {
                collection,
                ref: { current: {} },
                layout,
                orientation,
                direction,
                disabledBehavior,
                disabledKeys: new Set(disabled),
                layoutDelegate: geometry,
                collator: new Intl.Collator("en"),
                isScrollable: () => scroller,
              }
              const native = new NativeListKeyboardDelegate({ ...options, ref: options.ref as never }),
                upstream = new List(options as never)
              for (const method of ["getFirstKey", "getLastKey"] as const) {
                deepStrictEqual(native[method](), upstream[method]())
                listCases++
              }
              for (const key of keys)
                for (const method of [
                  "getNextKey",
                  "getPreviousKey",
                  "getKeyAbove",
                  "getKeyBelow",
                  "getKeyLeftOf",
                  "getKeyRightOf",
                  "getKeyPageAbove",
                  "getKeyPageBelow",
                ] as const) {
                  deepStrictEqual(native[method]?.(key), upstream[method]?.(key))
                  listCases++
                }
              for (const search of ["", "f", "c", "unmatched"])
                for (const key of [undefined, ...keys]) {
                  deepStrictEqual(native.getKeyForSearch(search, key), upstream.getKeyForSearch(search, key))
                  listCases++
                }
            }
const output = process.env.CODON_TABLE_DRAG_ORACLE_OUTPUT
if (!output?.startsWith("/private/tmp/codon-table-drag-family-"))
  throw new Error("A fresh owned source output is required")
writeFileSync(
  output,
  JSON.stringify(
    {
      kind: "DATA ONLY pinned class algorithm comparison; no native geometry/input/fidelity proof",
      treeCases,
      listCases,
      hashes,
    },
    null,
    2,
  ) + "\n",
)
console.log(JSON.stringify({ treeCases, listCases }))
