export const RESPONDER_PROBE = "codon-original-editor-responder-01"

export const createResponderJournal = (producer: string, write: (encoded: string) => Promise<void>) => {
  const rows: Record<string, unknown>[] = []
  let pending = Promise.resolve()
  return {
    record: (value: Record<string, unknown>) => {
      const row = { ...value, probe: RESPONDER_PROBE, producer, sequence: rows.length + 1, observedAt: Date.now() }
      rows.push(row)
      return row
    },
    persist: () => {
      const encoded = rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
      pending = pending.catch(() => {}).then(() => write(encoded))
      return pending
    },
  }
}
