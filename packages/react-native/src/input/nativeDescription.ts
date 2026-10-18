import { findNodeHandle, type View } from "react-native"

import type { TNativeFloatingMeasurable } from "../overlays/floating/measurement"

export type TNativeDescriptionBinding = Readonly<{ tag: number; label: string }>
type TSource = {
  listeners: Set<(binding: TNativeDescriptionBinding | null) => void>
  descriptions: Map<object, TNativeDescriptionBinding>
}
const sources = new WeakMap<TNativeFloatingMeasurable, TSource>()
const current = (source: TSource) => [...source.descriptions.values()].at(-1) ?? null
const publish = (source: TSource) => {
  for (const listener of source.listeners) listener(current(source))
}

export const registerNativeDescriptionSource = (
  target: View,
  update: (binding: TNativeDescriptionBinding | null) => void,
) => {
  let source = sources.get(target)
  if (!source) {
    source = { listeners: new Set(), descriptions: new Map() }
    sources.set(target, source)
  }
  const listener = (binding: TNativeDescriptionBinding | null) => update(binding)
  source.listeners.add(listener)
  update(current(source))
  return () => {
    source.listeners.delete(listener)
  }
}

// Only owned native hosts admit this binding. No ref replacement, JS label copy or editor write is involved.
export const bindNativeDescription = (
  target: TNativeFloatingMeasurable | null,
  description: View | null,
  label: string,
): (() => void) | undefined => {
  const source = target && sources.get(target)
  if (!source?.listeners.size || !description) return undefined
  const tag = findNodeHandle(description)
  if (tag === null || !Number.isSafeInteger(tag) || tag <= 0) return undefined
  const token = {}
  source.descriptions.set(token, { tag, label })
  publish(source)
  return () => {
    if (source.descriptions.delete(token)) publish(source)
  }
}
