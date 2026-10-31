import { expect, it } from "vitest"

import { createKeyboardJournal, KEYBOARD_PROBE } from "./keyboard"

it("preserves registration failure before the first SDK inspection", async () => {
  const writes: string[] = []
  const journal = createKeyboardJournal("model-only", async (encoded) => {
    writes.push(encoded)
  })
  journal.record({ kind: "keyboard-status", ready: false, error: "original-editor-unavailable" })
  await journal.persist()
  expect(JSON.parse(writes[0]!.trim())).toMatchObject({
    kind: "keyboard-status",
    ready: false,
    error: "original-editor-unavailable",
    probe: KEYBOARD_PROBE,
    producer: "model-only",
    sequence: 1,
  })
})

it("serializes captured prefixes while the first native write is pending", async () => {
  const writes: string[] = []
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const journal = createKeyboardJournal("model-only", async (encoded) => {
    if (!writes.length) await held
    writes.push(encoded)
  })
  journal.record({ kind: "scope-status" })
  const first = journal.persist()
  journal.record({ kind: "keyboard-status" })
  const second = journal.persist()
  await Promise.resolve()
  expect(writes).toEqual([])
  release()
  await Promise.all([first, second])
  expect(
    writes.map((text) =>
      text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).kind),
    ),
  ).toEqual([["scope-status"], ["scope-status", "keyboard-status"]])
})

it("reports a failed write and retains the original rows for a subsequent diagnostic write", async () => {
  const writes: string[] = []
  let attempts = 0
  const journal = createKeyboardJournal("model-only", async (encoded) => {
    if (++attempts === 1) throw new Error("Original native cache write failed")
    writes.push(encoded)
  })
  journal.record({ kind: "keyboard-status", ready: false })
  await expect(journal.persist()).rejects.toThrow("Original native cache write failed")
  journal.record({ kind: "metadata-status", ready: false })
  await journal.persist()
  expect(writes[0]!.trim().split("\n")).toHaveLength(2)
})

it("protects producer and monotonic row identity from diagnostic payload fields", async () => {
  let encoded = ""
  const journal = createKeyboardJournal("model-only", async (value) => {
    encoded = value
  })
  journal.record({ kind: "sdk-snapshot", sequence: 900, producer: "foreign", probe: "foreign" })
  await journal.persist()
  expect(JSON.parse(encoded)).toMatchObject({
    kind: "sdk-snapshot",
    sequence: 1,
    producer: "model-only",
    probe: KEYBOARD_PROBE,
  })
})
