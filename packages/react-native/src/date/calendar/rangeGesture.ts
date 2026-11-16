import { isSameDay, type CalendarDate } from "@internationalized/date"
import type { RangeCalendarState } from "react-stately/useRangeCalendarState"

export type TNativeCalendarPointer = Readonly<{ id: number | string; target?: object; type: "mouse" | "pen" | "touch" }>
type TOwner = Readonly<{
  state: RangeCalendarState
  revision: string
  canAct: () => boolean
  admit: (date: CalendarDate, run: (state: RangeCalendarState) => void) => void
}>
export type TNativeCalendarPress = { claimed: boolean; cancelled: boolean }
type TStream = {
  pointer: TNativeCalendarPointer
  revision: string
  date: CalendarDate
  releasing: boolean
  boundary: boolean
  anchor: boolean
  claimed: boolean
  cancelledTap: boolean
  press?: TNativeCalendarPress
  timer: ReturnType<typeof setTimeout> | undefined
}

// Adapted from the pinned useCalendarCell/useRangeCalendar press lifecycle.
// The owner admits each command against the current original day descriptor.
export class NativeCalendarRangeGesture {
  #stream: TStream | null = null
  #press: {
    date: CalendarDate
    target: object
    revision: string
    ticket: TNativeCalendarPress
    awaitingDown: boolean
  } | null = null
  constructor(private readonly owner: () => TOwner) {}
  currentPointer = () => this.#stream?.pointer ?? null
  #current = (stream: TStream) =>
    this.#stream === stream && this.owner().revision === stream.revision && this.owner().canAct()
  #selectable = (state: RangeCalendarState, date: CalendarDate) =>
    !state.isDisabled && !state.isReadOnly && !state.isCellDisabled(date) && !state.isCellUnavailable(date)
  #request = (stream: TStream, date: CalendarDate, run: (state: RangeCalendarState) => void) => {
    if (!this.#current(stream)) return
    this.owner().admit(date, (state) => {
      if (this.#current(stream) && this.#selectable(state, date)) run(state)
    })
  }
  #focus = (state: RangeCalendarState, date: CalendarDate) => {
    state.setFocusedDate(date)
    state.setFocused(true)
  }
  #retire = (cancelled: boolean) => {
    const stream = this.#stream
    if (!stream) return
    if (stream.timer) clearTimeout(stream.timer)
    if (cancelled && stream.press) stream.press.cancelled = true
    this.#stream = null
    if (this.owner().state.isDragging) this.owner().state.setDragging(false)
  }
  beginPress = (date: CalendarDate, target: object): TNativeCalendarPress => {
    const stream = this.#stream
    const matches =
      stream &&
      this.#current(stream) &&
      !stream.releasing &&
      !stream.press &&
      isSameDay(stream.date, date) &&
      (stream.pointer.target === undefined || stream.pointer.target === target)
    const ticket = { claimed: false, cancelled: false }
    if (matches) {
      stream.press = ticket
      ticket.claimed = stream.claimed
      ticket.cancelled = stream.cancelledTap
    } else this.#retire(true)
    this.#press = { date, target, revision: this.owner().revision, ticket, awaitingDown: !matches }
    return ticket
  }
  takePress = (ticket: TNativeCalendarPress) => {
    if (ticket.claimed || ticket.cancelled) return false
    const press = this.#press
    if (press?.ticket === ticket && press.revision !== this.owner().revision) return false
    const stream = this.#stream
    if (stream?.press === ticket) {
      if (!this.#current(stream)) return false
      this.#retire(false)
    }
    if (this.#press?.ticket === ticket) this.#press = null
    return true
  }
  #claim = (stream: TStream) => {
    stream.claimed = true
    if (stream.press) stream.press.claimed = true
  }
  down = (date: CalendarDate, pointer: TNativeCalendarPointer) => {
    const pending = this.#press
    this.#retire(true)
    this.#press = null
    const owner = this.owner(),
      state = owner.state
    if (!owner.canAct() || !this.#selectable(state, date)) {
      if (pending) pending.ticket.cancelled = true
      return false
    }
    const stream: TStream = {
      pointer,
      revision: owner.revision,
      date,
      releasing: false,
      boundary: false,
      anchor: false,
      claimed: false,
      cancelledTap: false,
      timer: undefined,
    }
    if (
      pending?.awaitingDown &&
      pending.revision === owner.revision &&
      isSameDay(pending.date, date) &&
      (pointer.target === undefined || pending.target === pointer.target)
    ) {
      stream.press = pending.ticket
      pending.awaitingDown = false
      this.#press = pending
    }
    this.#stream = stream
    if (state.anchorDate || pointer.type === "pen") return true
    if (state.highlightedRange && !state.isInvalid(date)) {
      const { start, end } = state.highlightedRange
      if (isSameDay(date, start) || isSameDay(date, end)) {
        this.#claim(stream)
        this.#request(stream, date, (current) => {
          current.setAnchorDate(isSameDay(date, start) ? end : start)
          this.#focus(current, date)
          current.setDragging(true)
          stream.boundary = true
        })
        return true
      }
    }
    const start = () => {
      stream.timer = undefined
      this.#claim(stream)
      this.#request(stream, date, (current) => {
        current.setDragging(true)
        current.selectDate(date)
        this.#focus(current, date)
        stream.anchor = true
      })
    }
    if (pointer.type === "touch") stream.timer = setTimeout(start, 200)
    else start()
    return true
  }
  enter = (date: CalendarDate, pointer: TNativeCalendarPointer) => {
    const stream = this.#stream,
      owner = this.owner()
    if (stream?.releasing) return
    if (stream && (stream.pointer.id !== pointer.id || stream.pointer.type !== pointer.type)) return
    if (
      !owner.canAct() ||
      !this.#selectable(owner.state, date) ||
      (pointer.type === "touch" && !owner.state.isDragging)
    )
      return
    if (stream) this.#request(stream, date, (state) => state.highlightDate(date))
    else
      owner.admit(date, (state) => {
        if (this.owner().canAct() && this.#selectable(state, date)) state.highlightDate(date)
      })
  }
  exitOriginal = () => {
    const stream = this.#stream
    if (!stream || stream.releasing) return
    if (stream.timer) clearTimeout(stream.timer)
    stream.timer = undefined
    stream.anchor = false
    stream.boundary = false
    stream.cancelledTap = true
    if (!stream.claimed && stream.press) stream.press.cancelled = true
  }
  up = (
    date: CalendarDate | null,
    pointer: TNativeCalendarPointer,
    navigation = false,
    focusWithin = this.owner().state.isFocused,
  ) => {
    const stream = this.#stream
    if (!stream || stream.releasing || stream.pointer.id !== pointer.id || stream.pointer.type !== pointer.type)
      return false
    if (!this.#current(stream)) {
      this.cancel()
      return false
    }
    stream.releasing = true
    if (stream.timer) clearTimeout(stream.timer)
    stream.timer = undefined
    if (!stream.claimed) {
      this.#retire(false)
      return true
    }
    const same =
      date !== null &&
      isSameDay(date, stream.date) &&
      (stream.pointer.target === undefined || stream.pointer.target === pointer.target)
    const owner = this.owner()
    const validDate = date !== null && this.#selectable(owner.state, date)
    const target = validDate ? date! : owner.state.focusedDate
    this.#request(stream, target, (state) => {
      if (date && validDate) {
        if (same && stream.boundary) state.setAnchorDate(date)
        else if (state.anchorDate && !(same && stream.anchor)) {
          state.selectDate(date)
          this.#focus(state, date)
        }
      } else if (!date && !navigation && focusWithin && state.anchorDate) state.selectFocusedDate()
      state.setDragging(false)
      if (this.#stream === stream) this.#stream = null
    })
    return true
  }
  cancel = () => {
    if (this.#press) this.#press.ticket.cancelled = true
    this.#press = null
    this.#retire(true)
  }
}

export const activateNativeRangeCalendarDay = (
  state: RangeCalendarState,
  date: CalendarDate,
  origin: "keyboard" | "virtual" | "touch",
) => {
  if (state.isReadOnly || state.isDisabled || state.isCellDisabled(date) || state.isCellUnavailable(date)) return
  const anchor = state.anchorDate
  state.selectDate(date)
  if (origin === "keyboard" && !anchor) {
    let next = date.add({ days: 1 })
    if (state.isInvalid(next)) next = date.subtract({ days: 1 })
    if (!state.isInvalid(next)) {
      state.setFocusedDate(next)
      state.setFocused(true)
    }
  } else {
    state.setFocusedDate(date)
    state.setFocused(true)
  }
}
