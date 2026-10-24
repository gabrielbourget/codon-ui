import type { TimeValue } from "../../../../packages/react-native/src/date/state/types"
import {
  CalendarDateTime,
  Time,
  ZonedDateTime,
  parseZonedDateTime,
} from "../../../../packages/react-native/src/date/values"

export const TIME_ENTRY_VALUES: readonly TimeValue[] = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]
export const timeEntryValueClass = (value: TimeValue) =>
  value instanceof ZonedDateTime
    ? "ZonedDateTime"
    : value instanceof CalendarDateTime
      ? "CalendarDateTime"
      : value instanceof Time
        ? "Time"
        : "foreign"

export const TIME_ENTRY_PROBE = "codon-owned-time-entry-01"
export const createTimeEntryJournal = (producer: string, write: (encoded: string) => Promise<void>) => {
  const rows: string[] = []
  const payloads = new WeakMap<object, number>()
  let payloadSequence = 0
  let pending = Promise.resolve()
  return {
    record: (value: Record<string, unknown>) => {
      const payload = value.data
      let originalPayloadId: number | undefined
      if (payload !== null && typeof payload === "object") {
        originalPayloadId = payloads.get(payload)
        if (originalPayloadId === undefined) {
          originalPayloadId = ++payloadSequence
          payloads.set(payload, originalPayloadId)
        }
      }
      const row = JSON.stringify({
        ...value,
        originalPayloadId,
        probe: TIME_ENTRY_PROBE,
        producer,
        sequence: rows.length + 1,
        observedAt: Date.now(),
      })
      rows.push(row)
      const encoded = rows.join("\n") + "\n"
      pending = pending.catch(() => {}).then(() => write(encoded))
      return pending
    },
  }
}
