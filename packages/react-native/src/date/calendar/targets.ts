import type { CalendarDate } from "@internationalized/date"
import type { View } from "react-native"

export type TNativeCalendarTarget = Readonly<{
  date: CalendarDate
  outsideMonth: boolean
  original: () => View | null
  active: () => boolean
  request: (run: () => void) => void
}>

// Original physical day refs remain separate from requested calendar focus.
export class NativeCalendarTargets {
  #targets = new Set<TNativeCalendarTarget>()
  add = (target: TNativeCalendarTarget) => {
    this.#targets.add(target)
    return () => {
      this.#targets.delete(target)
    }
  }
  forDate = (date: CalendarDate) => {
    const matches = [...this.#targets].filter((target) => target.date.compare(date) === 0 && target.active())
    return matches.find((target) => !target.outsideMonth) ?? matches[0]
  }
  hit = async (x: number, y: number): Promise<CalendarDate | null> => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const targets = [...this.#targets]
    const matches = await Promise.all(
      targets.map(
        (target) =>
          new Promise<CalendarDate | null>((resolve) => {
            const original = target.original()
            if (!original || !target.active()) return resolve(null)
            original.measureInWindow((left, top, width, height) => {
              resolve(
                this.#targets.has(target) &&
                  target.original() === original &&
                  target.active() &&
                  width > 0 &&
                  height > 0 &&
                  x >= left &&
                  x < left + width &&
                  y >= top &&
                  y < top + height
                  ? target.date
                  : null,
              )
            })
          }),
      ),
    )
    return matches.find((date) => date !== null) ?? null
  }
}
