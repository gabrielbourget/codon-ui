export const TIME_ENTRY_PROBE = "codon-owned-time-entry-01"
export const createTimeEntryJournal = (producer: string, write: (encoded: string) => Promise<void>) => {
  const rows: Record<string, unknown>[] = []
  let pending = Promise.resolve()
  return {
    record: (value: Record<string, unknown>) => {
      const row = { ...value, probe: TIME_ENTRY_PROBE, producer, sequence: rows.length + 1, observedAt: Date.now() }
      rows.push(row)
      const encoded = rows.map((item) => JSON.stringify(item)).join("\n") + "\n"
      pending = pending.catch(() => {}).then(() => write(encoded))
      return pending
    },
  }
}
