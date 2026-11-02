import { createContext } from "react"
import type { GestureResponderEvent, NativeTouchEvent, TextInput, View } from "react-native"

import { captureNativeFocusTarget, focusNativeTarget, getNativeFocusedTarget } from "./focus"
import type { NativeResponderCohortData } from "./specs/CUIFocusViewNativeComponent"

export type TNativeAdmittedPress = Readonly<{
  cohort: "responder" | "mouse" | "touch" | "pen"
  nativeCohort?: string
  originalReceiver: View
  isCurrent: () => boolean
  captureEditorFocus?: (original: TextInput) => (() => boolean) | null
}>
export type TNativeButtonPressOptions = Readonly<{
  lifetimeKey: string
  originalEditor: () => TextInput | null
  canAct: () => boolean
  onPressStart: (event: GestureResponderEvent, admission: TNativeAdmittedPress) => void
}>

// Private receiver metadata stays separate from public Button props and original events.
export const NativeButtonPressContext = createContext<TNativeButtonPressOptions | null>(null)

export const prepareNativeButtonPressFocus = (
  options: TNativeButtonPressOptions,
  admission: TNativeAdmittedPress,
): (() => void) => {
  const editor = options.originalEditor()
  const retainEditor = editor !== null && getNativeFocusedTarget() === editor
  const original = admission.originalReceiver
  const target = admission.cohort === "mouse" ? editor : original
  const retained =
    target === original ? captureNativeFocusTarget(original) : editor ? admission.captureEditorFocus?.(editor) : null
  return () => {
    if (
      retainEditor ||
      (editor !== null && getNativeFocusedTarget() === editor) ||
      options.originalEditor() !== editor ||
      !options.canAct() ||
      !admission.isCurrent() ||
      !retained?.()
    )
      return
    focusNativeTarget(target)
  }
}

type TResponderRecord = NativeResponderCohortData & { retired: boolean; cancelled: boolean }
const responderKey = (surface: number, target: number, identifier: number) =>
  JSON.stringify([surface, target, identifier])
const knownCohort = (value: string): value is "mouse" | "touch" | "pen" =>
  value === "mouse" || value === "touch" || value === "pen"

// Metadata is enqueued by the actual TouchEvent producer before that same original touch event.
export const createNativeResponderCohorts = () => {
  const records = new Map<string, TResponderRecord>()
  let pinned: TResponderRecord | null = null
  let generation = 0
  const keyFor = (value: NativeResponderCohortData) =>
    responderKey(value.surfaceId, value.sourceTarget, value.identifier)
  const retire = () => {
    for (const record of records.values()) record.retired = true
    records.clear()
    pinned = null
  }
  return {
    retire,
    reset: () => {
      retire()
      generation = 0
    },
    receive: (data: NativeResponderCohortData) => {
      if (!Number.isSafeInteger(data.cycleId) || data.cycleId <= 0) return
      if (data.phase === "retire") {
        if (data.cycleId <= generation) return
        generation = data.cycleId
        retire()
        return
      }
      if (
        !Number.isSafeInteger(data.surfaceId) ||
        data.surfaceId <= 0 ||
        !Number.isSafeInteger(data.sourceTarget) ||
        data.sourceTarget <= 0 ||
        !Number.isSafeInteger(data.identifier) ||
        data.identifier < 0
      )
        return
      const key = keyFor(data)
      if (data.phase === "start") {
        if (data.cycleId <= generation) return
        generation = data.cycleId
        const previous = records.get(key)
        if (previous) previous.retired = true
        records.set(key, { ...data, retired: false, cancelled: false })
      } else if (data.phase === "end" || data.phase === "cancel") {
        const record = records.get(key)
        if (!record || record.cycleId !== data.cycleId) return
        record.cancelled = data.phase === "cancel"
        if (record !== pinned) {
          record.retired = true
          records.delete(key)
        }
      }
    },
    grant: (data: NativeTouchEvent) => {
      if (pinned) {
        pinned.retired = true
        records.delete(keyFor(pinned))
        pinned = null
      }
      const surface = (data as NativeTouchEvent & { targetSurface?: unknown }).targetSurface
      const identifier: unknown = data.identifier
      if (
        typeof surface !== "number" ||
        typeof data.target !== "number" ||
        typeof identifier !== "number" ||
        !Number.isSafeInteger(identifier) ||
        identifier < 0
      )
        return null
      const record = records.get(responderKey(surface, data.target, identifier))
      if (!record || record.retired || record.cancelled || (!knownCohort(record.cohort) && record.cohort !== "unknown"))
        return null
      pinned = record
      const semanticCohort: TNativeAdmittedPress["cohort"] = knownCohort(record.cohort) ? record.cohort : "responder"
      return Object.assign(record, { semanticCohort })
    },
    current: (record: TResponderRecord) =>
      pinned === record && !record.retired && !record.cancelled && records.get(keyFor(record)) === record,
    release: () => {
      if (pinned) {
        pinned.retired = true
        records.delete(keyFor(pinned))
        pinned = null
      }
    },
  }
}
