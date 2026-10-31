import type { MotionValue } from "../kernel"
import type { TNativeMotionValueBinding } from "../visual/types"

import type { TNativeMotionResolutionToken } from "./types"

type TProbePhase = "target" | "restored"
type TProbeOperation = "jump" | "set"
type THold = {
  name: string
  key: string
  token: TNativeMotionResolutionToken
  cell: TCell
  active: boolean
  unsubscribe?: () => void
}
type TCell = {
  value: MotionValue<unknown>
  binding: TNativeMotionValueBinding<unknown>
  listeners: Set<(value: unknown) => void>
  observers: Set<() => void>
  holds: Set<THold>
  active: boolean
  finishing: boolean
  external: boolean
  abort: boolean
  visible: unknown
  restore: unknown
  restoreOperation: TProbeOperation
  owned: unknown
  hasOwned: boolean
  pendingPublication: boolean
  writing?: {
    expected: unknown
    previous: unknown
    initialPrevious: unknown
    operation: TProbeOperation
    notified: boolean
  }
  stopForward?: () => void
  stopTracker?: () => void
  stopDestroy?: () => void
}
export type TNativeMotionProbeIsolationOptions = {
  canAct?: () => boolean
  onError?: (error: unknown) => void
}
export class NativeMotionProbeRetiredError extends Error {
  constructor(message: string) {
    super(`Native motion isolated probe: ${message}`)
  }
}

// The original MotionValue owns every public jump/notification. Only private
// renderer bindings are masked; no value, style, native node or ref is mirrored.
export class NativeMotionProbeIsolation {
  private readonly cells = new WeakMap<MotionValue<unknown>, TCell>()
  private readonly active = new Set<TCell>()
  private readonly holds = new Map<string, THold>()
  private readonly retired = new WeakSet<TNativeMotionResolutionToken>()
  private depth = 0
  private errors: unknown[] = []

  constructor(private readonly options: TNativeMotionProbeIsolationOptions = {}) {}

  private run = (work: () => void, direct: boolean) => {
    this.depth++
    try {
      work()
    } catch (error) {
      this.errors.unshift(error)
    } finally {
      this.depth--
    }
    if (this.depth) return
    const errors = this.errors.splice(0)
    let notificationFailed = false
    for (const error of errors) {
      try {
        this.options.onError?.(error)
      } catch (notificationError) {
        errors.push(notificationError)
        notificationFailed = true
        break
      }
    }
    if (errors.length && (direct || !this.options.onError || notificationFailed)) throw errors[0]
  }

  private attempt = (work: () => void) => {
    try {
      work()
    } catch (error) {
      this.errors.push(error)
    }
  }

  private forward = (cell: TCell) => {
    if (cell.stopForward) return
    cell.stopForward = cell.value.on("change", () => {
      if (cell.active) return
      this.run(() => {
        for (const listener of [...cell.listeners]) {
          if (cell.active) {
            cell.pendingPublication = true
            break
          }
          if (cell.listeners.has(listener)) this.attempt(() => listener(cell.value.get()))
        }
      }, false)
    })
  }

  private releaseForward = (cell: TCell) => {
    if (cell.active || cell.listeners.size || !cell.stopForward) return
    const stop = cell.stopForward
    cell.stopForward = undefined
    this.attempt(stop)
  }

  private cell = <T>(value: MotionValue<T>): TCell => {
    const source = value as MotionValue<unknown>
    const existing = this.cells.get(source)
    if (existing) return existing
    const cell: TCell = {
      value: source,
      binding: {
        get: () => (cell.active ? cell.visible : source.get()),
        on: (_event, listener) => {
          cell.listeners.add(listener)
          this.forward(cell)
          let subscribed = true
          return () => {
            if (!subscribed) return
            subscribed = false
            cell.listeners.delete(listener)
            this.run(() => this.releaseForward(cell), false)
          }
        },
      },
      listeners: new Set(),
      observers: new Set(),
      holds: new Set(),
      active: false,
      finishing: false,
      external: false,
      abort: false,
      visible: undefined,
      restore: undefined,
      restoreOperation: "jump",
      owned: undefined,
      hasOwned: false,
      pendingPublication: false,
    }
    this.cells.set(source, cell)
    return cell
  }

  binding = <T>(value: MotionValue<T>): TNativeMotionValueBinding<T> =>
    this.cell(value).binding as TNativeMotionValueBinding<T>

  isProbing = <T>(value: MotionValue<T>) => this.cells.get(value as MotionValue<unknown>)?.active === true

  observeRestored = <T>(value: MotionValue<T>, listener: () => void) => {
    const cell = this.cell(value)
    cell.observers.add(listener)
    return () => {
      cell.observers.delete(listener)
    }
  }

  private remove = (hold: THold) => {
    if (!hold.active) return
    hold.active = false
    if (this.holds.get(hold.key) === hold) this.holds.delete(hold.key)
    hold.cell.holds.delete(hold)
    const unsubscribe = hold.unsubscribe
    hold.unsubscribe = undefined
    if (unsubscribe) this.attempt(unsubscribe)
  }

  private retireCell = (cell: TCell, external: boolean) => {
    if (!cell.active) return
    cell.external ||= external
    const cells = new Set([cell]),
      tokens = new Set<TNativeMotionResolutionToken>()
    for (const selected of cells) {
      for (const hold of selected.holds) tokens.add(hold.token)
      for (const hold of this.holds.values()) if (tokens.has(hold.token)) cells.add(hold.cell)
    }
    for (const token of tokens) this.retired.add(token)
    for (const hold of [...this.holds.values()]) {
      if (!cells.has(hold.cell)) continue
      this.remove(hold)
    }
    for (const selected of cells) selected.abort = true
    for (const selected of cells) this.finish(selected)
  }

  private track = (cell: TCell) => {
    const previous = cell.stopTracker
    cell.stopTracker = undefined
    if (previous) this.attempt(previous)
    this.forward(cell)
    // Reappend before each jump so already registered public callbacks run
    // first. An identical reentrant set can only be detected when this public
    // change delivery reaches us; no public methods or private fields are patched.
    cell.stopTracker = cell.value.on("change", (latest) => {
      if (!cell.active) return
      const write = cell.writing
      if (
        write?.operation === "set" &&
        Object.is(latest, cell.value.get()) &&
        Object.is(cell.value.getPrevious(), write.previous)
      ) {
        write.expected = write.previous = latest
        write.notified = true
        cell.owned = latest
        return
      }
      if (
        write &&
        Object.is(latest, write.expected) &&
        Object.is(cell.value.get(), write.expected) &&
        Object.is(cell.value.getPrevious(), write.previous)
      )
        return
      this.run(() => {
        if (!cell.external) this.errors.push(new NativeMotionProbeRetiredError("external value replaced the probe"))
        this.retireCell(cell, true)
      }, false)
    })
    cell.stopDestroy ??= cell.value.on("destroy", () => {
      this.run(() => {
        this.errors.push(new NativeMotionProbeRetiredError("source value destroyed"))
        this.retireCell(cell, false)
      }, false)
    })
  }

  private write = (cell: TCell, next: unknown, operation: TProbeOperation = "jump") => {
    if (cell.writing) {
      this.retireCell(cell, false)
      throw new NativeMotionProbeRetiredError("reentrant probe transaction")
    }
    const write = {
      expected: next,
      previous: cell.value.get(),
      initialPrevious: cell.value.getPrevious(),
      operation,
      notified: false,
    }
    cell.writing = write
    cell.owned = next
    cell.hasOwned = true
    this.track(cell)
    let failed = false
    try {
      if (operation === "set") cell.value.set(next)
      else cell.value.jump(next, false)
    } catch (error) {
      failed = true
      this.errors.unshift(error)
      // A throwing public callback interrupts jump before its velocity reset.
      // This public helper completes that reset only for our still-owned value.
      if (operation === "jump" && Object.is(cell.value.get(), next)) cell.value.setPrevFrameValue(cell.value.get())
    } finally {
      cell.writing = undefined
    }
    if (operation === "set" && !cell.external) {
      const current = cell.value.get(),
        previous = cell.value.getPrevious()
      const untouched = Object.is(current, write.previous) && Object.is(previous, write.initialPrevious)
      if (!write.notified && (untouched || Object.is(previous, write.previous))) cell.owned = current
      else if (!write.notified || !Object.is(current, write.expected)) {
        if (Object.is(previous, write.previous)) cell.owned = current
        else {
          this.errors.push(new NativeMotionProbeRetiredError("external value replaced the probe"))
          this.retireCell(cell, true)
        }
      }
    }
    const expected = operation === "set" ? cell.owned : next
    if (!Object.is(cell.value.get(), expected)) {
      if (!cell.external) this.errors.push(new NativeMotionProbeRetiredError("external value replaced the probe"))
      this.retireCell(cell, true)
    } else if (failed) this.retireCell(cell, false)
    else if (!cell.finishing) {
      try {
        if (this.options.canAct?.() === false) {
          this.errors.push(new NativeMotionProbeRetiredError("native owner retired"))
          this.retireCell(cell, false)
        }
      } catch (error) {
        this.errors.unshift(error)
        this.retireCell(cell, false)
      }
    }
    if (!cell.finishing) this.finish(cell)
  }

  private finish = (cell: TCell) => {
    if (!cell.active || cell.writing || cell.finishing || (cell.holds.size && !cell.abort)) return
    cell.finishing = true
    if (cell.abort && !cell.external && cell.hasOwned && Object.is(cell.value.get(), cell.owned))
      this.write(cell, cell.restore, cell.restoreOperation)
    const visible = cell.visible
    cell.active = false
    cell.finishing = false
    cell.hasOwned = false
    cell.writing = undefined
    this.active.delete(cell)
    const stop = cell.stopTracker
    cell.stopTracker = undefined
    if (stop) this.attempt(stop)
    const stopDestroy = cell.stopDestroy
    cell.stopDestroy = undefined
    if (stopDestroy) this.attempt(stopDestroy)
    if (!Object.is(cell.value.get(), visible) || cell.pendingPublication) {
      cell.pendingPublication = false
      for (const listener of [...cell.listeners]) {
        if (cell.active) {
          cell.pendingPublication = true
          break
        }
        if (cell.listeners.has(listener)) this.attempt(() => listener(cell.value.get()))
      }
    }
    for (const observer of [...cell.observers]) {
      if (cell.active) break
      if (cell.observers.has(observer)) this.attempt(observer)
    }
    this.releaseForward(cell)
  }

  private cancelHold = (hold: THold) => {
    if (!hold.active) return
    this.retired.add(hold.token)
    const cells = new Set<TCell>()
    for (const selected of [...this.holds.values()]) {
      if (selected.token !== hold.token) continue
      this.remove(selected)
      cells.add(selected.cell)
    }
    for (const cell of cells) {
      if (cell.holds.size) continue
      cell.abort = true
      this.finish(cell)
    }
  }

  private apply = <T>(
    name: string,
    value: MotionValue<T>,
    next: T,
    phase: TProbePhase,
    token: TNativeMotionResolutionToken,
    operation: TProbeOperation,
  ) => {
    this.run(() => {
      const key = `${operation}:${name}`
      const existing = this.holds.get(key)
      if (phase === "restored") {
        if (!existing || existing.token !== token || existing.cell.value !== value) return
        if (!token.isCurrent() || this.retired.has(token)) {
          this.cancelHold(existing)
          return
        }
        existing.cell.restore = next
        existing.cell.restoreOperation = operation
        this.write(existing.cell, next, operation)
        this.remove(existing)
        this.finish(existing.cell)
        return
      }
      let canAct: boolean | undefined
      try {
        canAct = this.options.canAct?.()
      } catch (error) {
        for (const cell of [...this.active]) this.retireCell(cell, false)
        throw error
      }
      if (canAct === false) {
        for (const cell of [...this.active]) this.retireCell(cell, false)
        throw new NativeMotionProbeRetiredError("native owner or resolution retired")
      }
      if (!name || !token.isCurrent() || this.retired.has(token)) {
        if (existing?.token === token) this.cancelHold(existing)
        throw new NativeMotionProbeRetiredError("native owner or resolution retired")
      }
      if (existing && (existing.token !== token || existing.cell.value !== value)) this.cancelHold(existing)
      const cell = this.cell(value)
      if (cell.writing) {
        this.retireCell(cell, false)
        throw new NativeMotionProbeRetiredError("reentrant probe transaction")
      }
      let hold = this.holds.get(key)
      if (!hold) {
        if (!cell.active) {
          cell.visible = cell.restore = value.get()
          cell.restoreOperation = operation
          cell.active = true
          cell.external = cell.abort = false
          cell.hasOwned = false
          this.active.add(cell)
        }
        hold = { name, key, token, cell, active: true }
        this.holds.set(key, hold)
        cell.holds.add(hold)
        const registered = hold
        try {
          const unsubscribe = token.onCancel(() => this.run(() => this.cancelHold(registered), false))
          if (hold.active) hold.unsubscribe = unsubscribe
          else this.attempt(unsubscribe)
        } catch (error) {
          this.cancelHold(hold)
          throw error
        }
      }
      if (!hold.active || !token.isCurrent())
        throw new NativeMotionProbeRetiredError("resolution cancelled during registration")
      this.write(cell, next, operation)
    }, true)
  }

  probe = <T>(name: string, value: MotionValue<T>, next: T, phase: TProbePhase, token: TNativeMotionResolutionToken) =>
    this.apply(name, value, next, phase, token, "jump")

  setProbe = <T>(
    name: string,
    value: MotionValue<T>,
    next: T,
    phase: TProbePhase,
    token: TNativeMotionResolutionToken,
  ) => this.apply(name, value, next, phase, token, "set")

  cancel = () => {
    this.run(() => {
      for (const cell of [...this.active]) this.retireCell(cell, false)
    }, false)
  }
}
