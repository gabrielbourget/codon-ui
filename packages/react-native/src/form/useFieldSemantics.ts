import { useCallback, useId, useInsertionEffect, useMemo, useRef, useState, type RefObject } from "react"

import {
  encodeNativeFieldSemantics,
  encodeNativeDateFieldSemantics,
  NATIVE_FIELD_SEMANTIC_LABELS,
  type TNativeFieldSemanticBinding,
  type TNativeFieldSemanticLabels,
  type TNativeDateFieldSemanticBinding,
  type TNativeFieldSemanticText,
} from "./semantics"

type TTargetName = "input" | "label" | "description" | "errorMessage" | "value" | "list"
type TOptions = Readonly<{
  text?: TNativeFieldSemanticText
  ids?: Readonly<Record<TTargetName, string>>
  refs?: Readonly<Record<TTargetName, RefObject<object | null>>>
  inputAliases?: readonly string[]
  labelledBy?: readonly string[]
  describedBy?: readonly string[]
  errorMessageBy?: readonly string[]
  detailsBy?: readonly string[]
  labels?: Partial<TNativeFieldSemanticLabels>
  flags: Pick<TNativeFieldSemanticBinding, "disabled" | "readOnly" | "required" | "invalid" | "expanded">
  activeDescendant: TNativeFieldSemanticBinding["activeDescendant"]
  dateField?: TNativeDateFieldSemanticBinding["dateField"]
}>
let nextSemanticRevision = 0

// Slot children and portal content may mount without rendering their owner.
export const useNativeFieldSemanticRef = <T extends object>() => {
  const ref = useRef<T | null>(null)
  const live = useRef(false)
  const [, setRevision] = useState(0)
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const bind = useCallback((value: T | null) => {
    if (ref.current === value) return
    ref.current = value
    if (live.current) setRevision((revision) => revision + 1)
  }, [])
  return [ref, bind] as const
}

export const useNativeFieldSemantics = (options: TOptions) => {
  const owner = useId()
  const labels = Object.fromEntries(
    Object.entries(NATIVE_FIELD_SEMANTIC_LABELS).map(([key, fallback]) => [
      key,
      options.labels?.[key as keyof TNativeFieldSemanticLabels] ?? fallback,
    ]),
  ) as TNativeFieldSemanticLabels
  const payload = {
    text: options.text ?? {},
    activeDescendant: options.activeDescendant,
    ...options.flags,
    labels,
    ...(options.dateField ? { dateField: options.dateField } : {}),
  }
  const signature = JSON.stringify(payload)
  return useMemo(() => {
    const value = {
      ...(JSON.parse(signature) as Omit<TNativeFieldSemanticBinding, "revision">),
      revision: `${owner}:semantics:${++nextSemanticRevision}`,
    }
    return options.dateField
      ? encodeNativeDateFieldSemantics({ ...value, dateField: options.dateField })
      : encodeNativeFieldSemantics(value)
  }, [owner, signature])
}
