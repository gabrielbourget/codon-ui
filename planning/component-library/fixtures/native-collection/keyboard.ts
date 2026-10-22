export const KEYBOARD_PROBE = "codon-original-editor-keyboard-01"
export const KEYBOARD_MODES = ["veto", "allow", "late", "throw"] as const
export type TKeyboardMode = (typeof KEYBOARD_MODES)[number]

export const createKeyboardJournal = (producer: string, write: (encoded: string) => Promise<void>) => {
  const rows: Record<string, unknown>[] = []
  let pending = Promise.resolve()
  return {
    record: (value: Record<string, unknown>) => {
      const row = { ...value, probe: KEYBOARD_PROBE, producer, sequence: rows.length + 1, observedAt: Date.now() }
      rows.push(row)
      return row
    },
    persist: () => {
      // Capture now and serialize writes, so an older prefix cannot replace a newer readiness receipt.
      const encoded = rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
      pending = pending.catch(() => {}).then(() => write(encoded))
      return pending
    },
  }
}
