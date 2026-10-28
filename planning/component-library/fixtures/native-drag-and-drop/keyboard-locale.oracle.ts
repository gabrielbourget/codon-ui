import { deepStrictEqual, equal } from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

import { navigateNativeDropTarget } from "../../../../packages/react-native/src/collection/dragAndDrop/keyboardNavigation.ts"
import { nativeDragFormatter } from "../../../../packages/react-native/src/collection/dragAndDrop/messages.ts"
import { nativeDragMessages } from "../../../../packages/react-native/src/collection/dragAndDrop/strings.ts"
import { dragCollection } from "../../../../packages/react-native/src/collection/dragAndDrop/__tests__/fixtures.ts"
import type { TNativeDropTarget } from "../../../../packages/react-native/src/collection/dragAndDrop/types.ts"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const load = createRequire(realpathSync(root + "packages/react-native/node_modules/react-stately/package.json"))
const formatterModule = await import(pathToFileURL(load.resolve("@internationalized/string")).href)
const { LocalizedStringDictionary, LocalizedStringFormatter } = formatterModule.default ?? formatterModule
const originalMessages: Record<string, Record<string, unknown>> = {}
const inputHashes: Record<string, string> = {}
for (const locale of Object.keys(nativeDragMessages)) {
  const path = root + "packages/react/node_modules/react-aria/dist/private/intl/dnd/" + locale + ".js"
  originalMessages[locale] = (await import(pathToFileURL(path).href)).default
  inputHashes[path] = createHash("sha256").update(readFileSync(path)).digest("hex")
}
const dictionary = new LocalizedStringDictionary(originalMessages)
let messages = 0
for (const locale of [...Object.keys(nativeDragMessages), "en-GB", "fr-CA", "zz-ZZ", "pt", "ar"])
  for (const key of Object.keys(nativeDragMessages["en-US"]))
    for (const count of [0, 1, 2, 3, 5, 11, 101, 1001]) {
      const args = { count, itemText: "Original 長い名前", beforeItemText: "", afterItemText: "Zero" }
      equal(
        nativeDragFormatter(locale).format(key, args),
        new LocalizedStringFormatter(locale, dictionary).format(key, args),
        `${locale}:${key}:${count}`,
      )
      messages++
    }
const path = root + "packages/react/node_modules/react-aria/dist/private/dnd/DropTargetKeyboardNavigation.js"
const { navigate } = await import(pathToFileURL(path).href)
inputHashes[path] = createHash("sha256").update(readFileSync(path)).digest("hex")
const collection = dragCollection(),
  keys = [0, "", "folder", "child"]
const targets: (TNativeDropTarget | null)[] = [
  null,
  { type: "root" },
  ...keys.flatMap((key) =>
    (["before", "on", "after"] as const).map((dropPosition) => ({ type: "item" as const, key, dropPosition })),
  ),
]
let navigation = 0
for (const rtl of [false, true])
  for (const wrap of [false, true])
    for (const direction of ["left", "right", "up", "down"] as const)
      for (const target of targets) {
        const delegate = {
          getFirstKey: () => keys[0],
          getLastKey: () => keys.at(-1),
          getKeyAbove: (key: string | number) => keys[keys.indexOf(key) - 1] ?? null,
          getKeyBelow: (key: string | number) => keys[keys.indexOf(key) + 1] ?? null,
          getKeyLeftOf: (key: string | number) => keys[keys.indexOf(key) - 1] ?? null,
          getKeyRightOf: (key: string | number) => keys[keys.indexOf(key) + 1] ?? null,
        }
        deepStrictEqual(
          navigateNativeDropTarget(delegate, collection, target, direction, rtl, wrap),
          navigate(delegate, collection, target, direction, rtl, wrap),
        )
        navigation++
      }
const result = {
  kind: "DATA ONLY — actual installed pinned source algorithm/locale comparison; no native keyboard/AT or platform delivery proof",
  localeCount: Object.keys(nativeDragMessages).length,
  messages,
  navigation,
  inputHashes,
}
const output = process.env.CODON_DRAG_ORACLE_OUTPUT
if (!output?.startsWith("/private/tmp/codon-collection-drag-integration-"))
  throw new Error("A fresh owned oracle output path is required")
writeFileSync(output, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ locales: result.localeCount, messages, navigation }))
