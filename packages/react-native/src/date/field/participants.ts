import type { RefObject } from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

import { encodeNativeDateFieldBinding, sameNativeDateFieldTargets } from "../../form/dateSegments"
import {
  captureNativeFocusTarget,
  focusNativeTarget,
  getNativeFocusedTarget,
  isNativeFocusTarget,
} from "../../input/focus"
import FormDocument from "../../input/specs/NativeCUIFormDocument"

import { NativeDateFieldFocusManager, type TNativeDateFieldFocusSnapshot } from "./focus"
import { nativeDateFieldPressIndex, nativeDateFieldVisualIndex } from "./selection"

export type TNativeExtraFocusParticipants = readonly RefObject<TextInput | View | null>[]
type TCurrent = Readonly<{
  owned: TNativeDateFieldFocusSnapshot
  root: View
  participants: TNativeExtraFocusParticipants
}>
type TMember = Readonly<{ original: View; target: number; isPlaceholder: boolean }>
type TNativeRow = Readonly<{ target: number; eligible: boolean; tabStop: boolean; x: number }>
type TRead = (request: { rootTarget: number; targets: readonly number[]; pressTarget?: number }) => Promise<string>
const read: TRead = (request) => {
  if (!FormDocument) return Promise.reject(new Error("Native focus participant queries are unavailable"))
  return FormDocument.readFocusParticipants(JSON.stringify(request))
}

// Extra originals never acquire a date-segment identity or form-value ownership.
// Queries observe native membership; a later focus request is not completion.
export class NativeDateFieldParticipantFocusManager {
  #request = 0
  #retired = false
  readonly owned: NativeDateFieldFocusManager
  constructor(
    readonly current: () => TCurrent | null,
    readonly native = {
      read,
      capture: captureNativeFocusTarget,
      focus: focusNativeTarget,
      focused: getNativeFocusedTarget,
    },
  ) {
    this.owned = new NativeDateFieldFocusManager(() => current()?.owned ?? null)
  }
  retire = () => {
    this.#retired = true
    this.#request++
    this.owned.retire()
  }
  #capture = () => {
    if (this.#retired) return null
    const value = this.current()
    if (!value) return null
    const { owned, root } = value
    const ownedRoot = owned.root,
      ownedRootTarget = owned.rootTarget
    const rootTarget = findNodeHandle(root)
    if (!rootTarget) return null
    try {
      encodeNativeDateFieldBinding(owned.rootTarget, owned.rows)
    } catch {
      return null
    }
    const ownedRows = owned.rows.map((row) => ({ ...row, identity: { ...row.identity } }))
    const refs = value.participants.map((ref) => ({ ref, original: ref.current }))
    const members: TMember[] = ownedRows.map((row) => ({
      original: row.original,
      target: row.identity.target,
      isPlaceholder: row.isPlaceholder,
    }))
    for (const { original } of refs) {
      if (!original) continue
      if (!isNativeFocusTarget(original))
        throw new Error(
          "extraFocusParticipants requires original TextInput or NativeFocusView refs; opaque controls need an explicit adapter",
        )
      const target = findNodeHandle(original)
      if (!target || members.some((member) => member.original === original || member.target === target))
        throw new Error("extraFocusParticipants must contain distinct original controls")
      members.push({ original, target, isPlaceholder: false })
    }
    const guards = members.map((member) => this.native.capture(member.original))
    const current = () => {
      const latest = this.current()
      return (
        !this.#retired &&
        latest?.root === root &&
        latest.owned.root === ownedRoot &&
        latest.owned.rootTarget === ownedRootTarget &&
        sameNativeDateFieldTargets(ownedRows, latest.owned.rows) &&
        ownedRows.every((row, index) => row.isPlaceholder === latest.owned.rows[index].isPlaceholder) &&
        latest.participants.length === refs.length &&
        refs.every(({ ref, original }, index) => latest.participants[index] === ref && ref.current === original) &&
        guards.every((guard) => !guard || guard())
      )
    }
    return { rootTarget, windowId: ownedRows[0]?.identity.windowId, members, guards, current }
  }
  #run = (
    select: (rows: readonly TNativeRow[], members: readonly TMember[], before: number | null) => number,
    pressTarget?: number,
  ) => {
    const capture = this.#capture(),
      request = ++this.#request,
      focused = this.native.focused()
    if (!capture) return false
    void this.native
      .read({
        rootTarget: capture.rootTarget,
        targets: capture.members.map((row) => row.target),
        ...(pressTarget ? { pressTarget } : {}),
      })
      .then((encoded) => {
        const value: unknown = JSON.parse(encoded)
        if (!value || typeof value !== "object") return
        const snapshot = value as {
          rootTarget?: unknown
          windowId?: unknown
          rows?: unknown
          before?: unknown
          pressIndependent?: unknown
        }
        if (
          snapshot.pressIndependent === true ||
          snapshot.rootTarget !== capture.rootTarget ||
          snapshot.windowId !== capture.windowId ||
          (typeof snapshot.before !== "number" && snapshot.before !== null) ||
          !Array.isArray(snapshot.rows) ||
          snapshot.rows.length !== capture.members.length
        )
          return
        const seen = new Set<number>()
        const rows: TNativeRow[] = []
        const members: TMember[] = []
        for (const raw of snapshot.rows as TNativeRow[]) {
          const index = capture.members.findIndex((member) => member.target === raw.target)
          if (
            index < 0 ||
            seen.has(raw.target) ||
            typeof raw.eligible !== "boolean" ||
            typeof raw.tabStop !== "boolean" ||
            !Number.isFinite(raw.x)
          )
            return
          seen.add(raw.target)
          if (raw.eligible && capture.guards[index]?.()) {
            rows.push(raw)
            members.push(capture.members[index])
          }
        }
        if (request !== this.#request || !capture.current() || this.native.focused() !== focused) return
        const before = snapshot.before === null ? null : rows.findIndex((row) => row.target === snapshot.before)
        const index = select(rows, members, before)
        const member = members[index]
        if (member && capture.current()) this.native.focus(member.original)
      })
      .catch(() => {})
    return true
  }
  #extra = () => !!this.current()?.participants.length
  focusFirst = () => (this.#extra() ? this.#run(() => 0) : this.owned.focusFirst())
  focusFromInput = (original: View, kind: "next" | "previous") => {
    if (!this.#extra()) return this.owned.focusFromInput(original, kind)
    if (this.native.focused() !== original) return false
    return this.#run((_rows, members) => {
      const index = members.findIndex((row) => row.original === original)
      return index < 0 ? -1 : index + (kind === "next" ? 1 : -1)
    })
  }
  #logical = (direction: -1 | 1) =>
    this.#run((_rows, members) => {
      const index = members.findIndex((row) => row.original === this.native.focused())
      return index < 0 ? -1 : index + direction
    })
  focusNext = () => (this.#extra() ? this.#logical(1) : this.owned.focusNext())
  focusPrevious = () => (this.#extra() ? this.#logical(-1) : this.owned.focusPrevious())
  focusVisual = (direction: -1 | 1) =>
    this.#extra()
      ? this.#run((rows, members) => {
          const focused = members.findIndex((row) => row.original === this.native.focused())
          if (focused < 0) return -1
          const positions = rows.map((row) => (row.tabStop ? row.x : NaN))
          return nativeDateFieldVisualIndex(positions, rows[focused].x, direction)
        })
      : this.owned.focusVisual(direction)
  capturePress = (target: object): (() => boolean) | null => {
    if (!this.#extra()) return this.owned.capturePress(target)
    const capture = this.#capture(),
      tag = findNodeHandle(target as View)
    if (!capture || !tag) return null
    // A control owns its own touch focus, whether registered or independent.
    const root = this.current()?.root
    const visited = new Set<object>()
    const controlled = (node: object, withinControl: boolean): boolean => {
      if (visited.has(node)) return false
      visited.add(node)
      const inside = withinControl || (node !== root && isNativeFocusTarget(node) && !!this.native.capture(node))
      if (node === target) return inside
      for (const child of (node as { childNodes?: Iterable<object> }).childNodes ?? [])
        if (controlled(child, inside)) return true
      return false
    }
    if ((isNativeFocusTarget(target) && this.native.capture(target)) || (root && controlled(root, false))) return null
    const request = ++this.#request
    return () =>
      request === this.#request &&
      capture.current() &&
      this.#run((rows, members, before) => {
        const tabs = rows.map((row, index) => ({ row, member: members[index] })).filter(({ row }) => row.tabStop)
        const predecessor = before === null ? null : tabs.findIndex(({ row }) => row.target === rows[before]?.target)
        const index = nativeDateFieldPressIndex(
          tabs.map(({ member }) => member.isPlaceholder),
          predecessor,
        )
        return index < 0 ? -1 : members.indexOf(tabs[index].member)
      }, tag)
  }
}
