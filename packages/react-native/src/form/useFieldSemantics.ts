import {
  useCallback,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { findNodeHandle } from "react-native"

import {
  encodeNativeFieldSemantics,
  NATIVE_FIELD_SEMANTIC_LABELS,
  type TNativeFieldSemanticBinding,
  type TNativeFieldSemanticLabels,
} from "./semantics"

const targetNames = ["input", "label", "description", "errorMessage", "value", "list"] as const
type TTargetName = (typeof targetNames)[number]
type TTargets = Readonly<Record<TTargetName, number>>
type TOptions = Readonly<{
  ids: Readonly<Record<TTargetName, string>>
  refs: Readonly<Record<TTargetName, RefObject<object | null>>>
  inputAliases?: readonly string[]
  labelledBy?: readonly string[]
  describedBy?: readonly string[]
  errorMessageBy?: readonly string[]
  detailsBy?: readonly string[]
  labels?: Partial<TNativeFieldSemanticLabels>
  flags: Pick<TNativeFieldSemanticBinding, "disabled" | "readOnly" | "required" | "invalid" | "expanded">
  activeDescendant: TNativeFieldSemanticBinding["activeDescendant"]
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
  const [targets, setTargets] = useState<TTargets>({
    input: 0,
    label: 0,
    description: 0,
    errorMessage: 0,
    value: 0,
    list: 0,
  })
  useLayoutEffect(() => {
    const next = Object.fromEntries(
      targetNames.map((key) => {
        const ref = options.refs[key].current
        const target = ref ? findNodeHandle(ref as Parameters<typeof findNodeHandle>[0]) : 0
        return [key, target && Number.isSafeInteger(target) && target > 0 ? target : 0]
      }),
    ) as TTargets
    setTargets((previous) => (targetNames.every((key) => previous[key] === next[key]) ? previous : next))
  })
  const labels = Object.fromEntries(
    Object.entries(NATIVE_FIELD_SEMANTIC_LABELS).map(([key, fallback]) => [
      key,
      options.labels?.[key as keyof TNativeFieldSemanticLabels] ?? fallback,
    ]),
  ) as TNativeFieldSemanticLabels
  const payload = {
    aliases: [
      ...targetNames.flatMap((key) => (targets[key] ? [{ id: options.ids[key], target: targets[key] }] : [])),
      ...(targets.input
        ? (options.inputAliases ?? []).filter((id) => id.length > 0).map((id) => ({ id, target: targets.input }))
        : []),
    ],
    labelledBy: [...(options.labelledBy ?? []), ...(targets.label ? [options.ids.label] : [])],
    describedBy: [...(options.describedBy ?? []), ...(targets.description ? [options.ids.description] : [])],
    errorMessageBy: [
      ...(options.errorMessageBy ?? []),
      ...(options.flags.invalid && targets.errorMessage ? [options.ids.errorMessage] : []),
    ],
    detailsBy: options.detailsBy ?? [],
    controls: options.flags.expanded && targets.list ? [options.ids.list] : [],
    activeDescendant: options.activeDescendant,
    ...options.flags,
    labels,
  }
  const signature = JSON.stringify(payload)
  return useMemo(
    () =>
      encodeNativeFieldSemantics({
        ...(JSON.parse(signature) as Omit<TNativeFieldSemanticBinding, "revision">),
        revision: `${owner}:semantics:${++nextSemanticRevision}`,
      }),
    [owner, signature],
  )
}
