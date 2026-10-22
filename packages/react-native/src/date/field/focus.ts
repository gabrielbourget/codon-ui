/* Adapted from pinned react-aria useDatePickerGroup/FocusScope; Apache-2.0.
 * Source identities: ../entry/UPSTREAM.json. License: ../../collection/LICENSE.react-aria.md. */
import type { View } from "react-native"

import {
  encodeNativeDateFieldBinding,
  sameNativeDateFieldTargets,
  type TNativeDateSegmentFormTarget,
} from "../../form/dateSegments"
import { captureNativeFocusTarget, focusNativeTarget, getNativeFocusedTarget } from "../../input/focus"

import { nativeDateFieldPressIndex, nativeDateFieldVisualIndex } from "./selection"

export { nativeDateFieldPressIndex, nativeDateFieldVisualIndex } from "./selection"

export type TNativeDateFieldFocusRow = TNativeDateSegmentFormTarget & Readonly<{ isPlaceholder: boolean }>
export type TNativeDateFieldFocusSnapshot = Readonly<{
  root: View
  rootTarget: number
  rows: readonly TNativeDateFieldFocusRow[]
}>
export type TNativeDateFieldRect = Readonly<{ x: number; y: number; width: number; height: number }>
type TFocusRuntime = Readonly<{
  capture: (target: View) => (() => boolean) | null
  focused: typeof getNativeFocusedTarget
  focus: (target: View) => boolean
  measure: (target: View) => Promise<TNativeDateFieldRect | null>
}>

type TFocusCapture = Readonly<{ rows: readonly TNativeDateFieldFocusRow[]; current: () => boolean }>

const runtime: TFocusRuntime = {
  capture: captureNativeFocusTarget,
  focused: getNativeFocusedTarget,
  focus: focusNativeTarget,
  measure: (target) =>
    new Promise((resolve) => {
      target.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }))
    }),
}
const finiteRect = (rect: TNativeDateFieldRect | null): rect is TNativeDateFieldRect =>
  rect !== null &&
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
  rect.width >= 0 &&
  rect.height >= 0

// Requests never grant focus completion. Only the original owned host's native
// focus callback can update the shared native focus observer.
export class NativeDateFieldFocusManager {
  #request = 0
  #retired = false
  constructor(
    readonly current: () => TNativeDateFieldFocusSnapshot | null,
    readonly native: TFocusRuntime = runtime,
  ) {}
  retire = () => {
    this.#retired = true
    this.#request++
  }
  #capture = (): TFocusCapture | null => {
    if (this.#retired) return null
    const value = this.current()
    if (!value || value.rows.length === 0) return null
    const { root, rootTarget } = value
    try {
      encodeNativeDateFieldBinding(rootTarget, value.rows)
    } catch {
      return null
    }
    if (new Set(value.rows.map((row) => row.original)).size !== value.rows.length) return null
    // Freeze the authored identity, not a mutable render-owned array.
    const all = value.rows.map((row) =>
      Object.freeze({
        original: row.original,
        identity: Object.freeze({ ...row.identity }),
        isPlaceholder: row.isPlaceholder,
      }),
    )
    const eligible = all
      .map((row) => ({ row, guard: this.native.capture(row.original) }))
      .filter((entry) => entry.guard !== null)
    if (!eligible.length) return null
    const rows = eligible.map((entry) => entry.row)
    const guards = eligible.map((entry) => entry.guard!)
    const current = () => {
      const latest = this.current()
      return (
        !this.#retired &&
        latest !== null &&
        latest.root === root &&
        latest.rootTarget === rootTarget &&
        sameNativeDateFieldTargets(all, latest.rows) &&
        all.every((row, index) => row.isPlaceholder === latest.rows[index].isPlaceholder) &&
        guards.every((guard) => guard())
      )
    }
    return { rows, current }
  }
  #focus = (capture: TFocusCapture, index: number) => {
    const target = capture.rows[index]
    return !!target && capture.current() && this.native.focus(target.original)
  }
  focusFirst = () => {
    this.#request++
    const capture = this.#capture()
    return !!capture && this.#focus(capture, 0)
  }
  focusNext = () => this.#logical(1)
  focusPrevious = () => this.#logical(-1)
  #logical = (direction: -1 | 1) => {
    this.#request++
    const capture = this.#capture()
    if (!capture) return false
    const focused = this.native.focused(),
      index = capture.rows.findIndex((row) => row.original === focused)
    if (index < 0) return this.#focus(capture, direction === 1 ? 0 : capture.rows.length - 1)
    return this.#focus(capture, index + direction)
  }
  focusVisual = async (direction: -1 | 1) => {
    const request = ++this.#request,
      capture = this.#capture()
    if (!capture) return false
    const focused = this.native.focused(),
      index = capture.rows.findIndex((row) => row.original === focused)
    if (index < 0) return false
    let rectangles: (TNativeDateFieldRect | null)[]
    try {
      rectangles = await Promise.all(capture.rows.map((row) => this.native.measure(row.original)))
    } catch {
      return false
    }
    if (
      request !== this.#request ||
      !capture.current() ||
      this.native.focused() !== focused ||
      !rectangles.every(finiteRect)
    )
      return false
    const positions = rectangles.map((rect) => rect.x)
    return this.#focus(capture, nativeDateFieldVisualIndex(positions, positions[index], direction))
  }
  focusFromPress = (predecessor: View | null) => {
    this.#request++
    const capture = this.#capture()
    if (!capture) return false
    const before = predecessor ? capture.rows.findIndex((row) => row.original === predecessor) : null
    return this.#focus(
      capture,
      nativeDateFieldPressIndex(
        capture.rows.map((row) => row.isPlaceholder),
        before,
      ),
    )
  }
}
