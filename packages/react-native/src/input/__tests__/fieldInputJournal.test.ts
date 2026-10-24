import { createTimeEntryJournal } from "../../../../../planning/component-library/fixtures/native-time-picker/sdk"

it("retains original payload identity across receivers without rewriting earlier observations", async () => {
  const writes: string[] = []
  const journal = createTimeEntryJournal("producer", async (encoded) => {
    writes.push(encoded)
  })
  const original = { target: 11, key: "ArrowRight", fieldDispatch: "original" }
  await journal.record({ kind: "child-key", data: original })
  original.key = "ArrowLeft"
  await journal.record({ kind: "field-key", data: original })
  await journal.record({ kind: "field-key", data: { ...original } })
  const rows = writes
    .at(-1)!
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  expect(rows.map((row) => row.sequence)).toEqual([1, 2, 3])
  expect(rows[0].originalPayloadId).toBe(rows[1].originalPayloadId)
  expect(rows[2].originalPayloadId).not.toBe(rows[1].originalPayloadId)
  expect(rows[0].data.key).toBe("ArrowRight")
  expect(rows[1].data.key).toBe("ArrowLeft")
  expect(original).toEqual({ target: 11, key: "ArrowLeft", fieldDispatch: "original" })
})

it("keeps asynchronous native-cache writes in journal order", async () => {
  const writes: string[] = []
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const journal = createTimeEntryJournal("producer", async (encoded) => {
    writes.push(encoded)
    if (writes.length === 1) await held
  })
  const first = journal.record({ kind: "field-state", value: "13:45:00" })
  const second = journal.record({ kind: "field-state", value: "14:45:00" })
  await Promise.resolve()
  await Promise.resolve()
  expect(writes).toHaveLength(1)
  release()
  await Promise.all([first, second])
  expect(writes).toHaveLength(2)
  expect(writes[0].trim().split("\n")).toHaveLength(1)
  expect(writes[1].trim().split("\n")).toHaveLength(2)
})
