import assert from "node:assert/strict"

import { createReceiptJournal, type TReceiptFileSystem } from "./receipt"

const writes: { uri: string; contents: string; options: unknown }[] = []
const fileSystem: TReceiptFileSystem = {
  cacheDirectory: "file:///app/Library/Caches/",
  writeAsStringAsync: async (uri, contents, options) => {
    writes.push({ uri, contents, options })
  },
}
const logged: string[] = []
const journal = createReceiptJournal(
  "codon-native-menu-focus-v2",
  () => fileSystem,
  (line) => logged.push(line),
)
const actual = { target: 17, observedAt: 0, selected: false, label: "", value: "ページ", children: [] }
journal.append({ kind: "snapshot", actual })
actual.label = "changed after observation"
journal.append({ kind: "complete", snapshots: 1 })
const first = journal.flush()
assert.equal(journal.flush(), first)
assert.equal(await first, "file:///app/Library/Caches/codon-native-menu-focus-v2.jsonl")
assert.equal(writes.length, 1)
assert.equal(writes[0].contents, logged.join("\n") + "\n")
assert.deepEqual(writes[0].options, { encoding: "utf8", append: false })
const captured = JSON.parse(writes[0].contents.split("CUI_MENU_FOCUS ")[1].split("\n")[0])
assert.equal(captured.actual.label, "")
assert.equal(captured.actual.observedAt, 0)
assert.equal(captured.actual.selected, false)
assert.equal(captured.actual.value, "ページ")
assert.deepEqual(captured.actual.children, [])
assert.throws(() => journal.append({ kind: "late" }), /already complete/)
const failure = new Error("native disk failure")
let attempts = 0
const failing = createReceiptJournal(
  "codon-native-menu-focus-v2",
  () => ({
    cacheDirectory: "file:///cache",
    writeAsStringAsync: async () => {
      attempts += 1
      throw failure
    },
  }),
  () => {},
)
failing.append({ kind: "complete" })
await assert.rejects(failing.flush(), (error) => error === failure)
await assert.rejects(failing.flush(), (error) => error === failure)
assert.equal(attempts, 1)
const missing = createReceiptJournal(
  "codon-native-menu-focus-v2",
  () => ({ ...fileSystem, cacheDirectory: null }),
  () => {},
)
await assert.rejects(missing.flush(), /unavailable/)
assert.throws(
  () =>
    createReceiptJournal(
      "../foreign",
      () => fileSystem,
      () => {},
    ),
  /identity/,
)
process.stdout.write(
  "Receipt checks pass: immutable native serialization, one write, late-record guard, empty/zero/false/Unicode, I/O failure and cache ownership\n",
)
