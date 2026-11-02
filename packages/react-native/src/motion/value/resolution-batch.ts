import { nativeMotionRuntime } from "../kernel/nativeRuntime"

import type { TNativeMotionResolutionToken } from "./types"

export type TNativeMotionResolutionTicket = {
  settled: (error?: unknown) => void
  ready: Promise<void>
}
type TDeferred = { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void }
type TMember = {
  settled: boolean
  retired: boolean
  stop: () => void
  completion: TDeferred
}
type TCohort = {
  members: TMember[]
  sealed: boolean
  finished: boolean
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

  private pump = (cohort: TCohort) => {
    if (!cohort.sealed || cohort.finished) return
    const live = cohort.members.filter((member) => !member.retired)
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
    member.completion.reject(error)
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
      settled: false,
      retired: false,
      stop: () => {},
      completion: deferred(),
    }
    selected.members.push(member)
    const stop = token.onCancel(() => this.retire(selected, member, failure("resolution cancelled")))
    if (member.retired) stop()
    else member.stop = stop
    return {
      settled: (error) => {
        if (error !== undefined) this.retire(selected, member, error)
        else {
          member.settled = true
          this.pump(selected)
        }
      },
      ready: member.completion.promise,
    }
  }
  cancel = () => {
    for (const cohort of [...this.cohorts])
      for (const member of [...cohort.members]) this.retire(cohort, member, failure("owner cancelled"))
  }
}
