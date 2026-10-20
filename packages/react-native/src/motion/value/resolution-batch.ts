import { nativeMotionRuntime } from "../kernel/nativeRuntime"

import type { TNativeMotionResolutionToken } from "./types"

export type TNativeMotionResolutionCapture = {
  cohort: object
  frames: ReadonlyMap<string, readonly unknown[]>
  isCurrent: () => boolean
  onChange: (listener: () => void) => () => void
}
export type TNativeMotionResolutionTicket = {
  normalized: (frames: readonly unknown[]) => void
  settled: (error?: unknown) => void
  whenNormalized: Promise<void>
  ready: Promise<void>
  capture: () => TNativeMotionResolutionCapture
}
type TDeferred = { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void }
type TMember = {
  name: string
  token: TNativeMotionResolutionToken
  frames?: readonly unknown[]
  settled: boolean
  retired: boolean
  stop: () => void
  normalization: TDeferred
  completion: TDeferred
}
type TCohort = {
  members: TMember[]
  sealed: boolean
  finished: boolean
  revision: number
  changes: Set<() => void>
  timer: ReturnType<typeof setTimeout>
}
const failure = (message: string) => new Error(`Native motion resolution batch: ${message}`)
const deferred = (): TDeferred => {
  let resolve!: () => void, reject!: (error: unknown) => void
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  void promise.catch(() => {})
  return { promise, resolve, reject }
}

// Registration precedes async reads. A microtask only seals membership; every
// registered member must still finish its initial/color normalization explicitly.
export class NativeMotionResolutionBatch {
  private open?: TCohort
  private readonly cohorts = new Set<TCohort>()

  private change = (cohort: TCohort) => {
    cohort.revision++
    for (const listener of [...cohort.changes]) listener()
  }
  private pump = (cohort: TCohort) => {
    if (!cohort.sealed || cohort.finished) return
    const live = cohort.members.filter((member) => !member.retired)
    if (!live.every((member) => member.frames)) return
    for (const member of live) member.normalization.resolve()
    if (!live.every((member) => member.settled)) return
    cohort.finished = true
    clearTimeout(cohort.timer)
    this.cohorts.delete(cohort)
    for (const member of cohort.members) {
      member.stop()
      if (!member.retired) member.completion.resolve()
    }
  }
  private retire = (cohort: TCohort, member: TMember, error: unknown) => {
    if (member.retired || cohort.finished) return
    member.retired = true
    member.stop()
    member.normalization.reject(error)
    member.completion.reject(error)
    this.change(cohort)
    this.pump(cohort)
  }
  begin = (name: string, token: TNativeMotionResolutionToken): TNativeMotionResolutionTicket => {
    if (!name || !token.isCurrent()) throw failure("current named resolution required")
    let cohort = this.open
    if (!cohort) {
      cohort = {
        members: [],
        sealed: false,
        finished: false,
        revision: 0,
        changes: new Set(),
        timer: setTimeout(() => {
          for (const member of [...cohort!.members]) this.retire(cohort!, member, failure("5000ms deadline exceeded"))
        }, 5000),
      }
      this.open = cohort
      this.cohorts.add(cohort)
      const selected = cohort
      nativeMotionRuntime.queueMicrotask(() => {
        if (this.open === selected) this.open = undefined
        selected.sealed = true
        this.pump(selected)
      })
    }
    const selected = cohort
    const member: TMember = {
      name,
      token,
      settled: false,
      retired: false,
      stop: () => {},
      normalization: deferred(),
      completion: deferred(),
    }
    selected.members.push(member)
    const stop = token.onCancel(() => this.retire(selected, member, failure("resolution cancelled")))
    if (member.retired) stop()
    else member.stop = stop
    return {
      normalized: (frames) => {
        if (member.retired || selected.finished || member.frames) return
        if (!token.isCurrent() || !frames.length) {
          this.retire(selected, member, failure("current complete normalized frames required"))
          return
        }
        member.frames = Object.freeze([...frames])
        this.change(selected)
        this.pump(selected)
      },
      settled: (error) => {
        if (error !== undefined) this.retire(selected, member, error)
        else {
          member.settled = true
          this.pump(selected)
        }
      },
      whenNormalized: member.normalization.promise,
      ready: member.completion.promise,
      capture: () => {
        if (member.retired || !selected.sealed || selected.members.some((item) => !item.retired && !item.frames))
          throw failure("cohort normalization is incomplete")
        const frames = new Map<string, readonly unknown[]>()
        for (const item of selected.members) {
          if (item.retired) continue
          if (frames.has(item.name)) throw failure("duplicate active property in cohort")
          frames.set(item.name, item.frames!)
        }
        const revision = selected.revision
        return {
          cohort: selected,
          frames,
          isCurrent: () => !member.retired && token.isCurrent() && selected.revision === revision,
          onChange: (listener) => {
            if (selected.revision !== revision || member.retired) {
              listener()
              return () => {}
            }
            selected.changes.add(listener)
            return () => {
              selected.changes.delete(listener)
            }
          },
        }
      },
    }
  }
  cancel = () => {
    for (const cohort of [...this.cohorts])
      for (const member of [...cohort.members]) this.retire(cohort, member, failure("owner cancelled"))
  }
}
