import { useInsertionEffect, useRef, type RefCallback } from "react"
import type { View } from "react-native"

type TThumbLifetime = { target: View | null; body: View | null }

export const useNativeSliderHosts = () => {
  const targetRefs = useRef(new Map<number, View>())
  const bodyRefs = useRef(new Map<number, View>())
  const committed = useRef(new Map<number, TThumbLifetime>())
  const targetBinders = useRef(new Map<number, RefCallback<View>>())
  const bodyBinders = useRef(new Map<number, RefCallback<View>>())
  const pending = new Map<number, TThumbLifetime>()
  useInsertionEffect(() => {
    for (const lifetime of committed.current.values()) {
      lifetime.target = null
      lifetime.body = null
    }
    for (const [index, lifetime] of pending) {
      lifetime.target = targetRefs.current.get(index) ?? null
      lifetime.body = bodyRefs.current.get(index) ?? null
    }
    committed.current = pending
  })
  useInsertionEffect(
    () => () => {
      for (const lifetime of committed.current.values()) {
        lifetime.target = null
        lifetime.body = null
      }
    },
    [],
  )
  const binder = (kind: "target" | "body", index: number) => {
    const binders = kind === "target" ? targetBinders.current : bodyBinders.current
    const refs = kind === "target" ? targetRefs.current : bodyRefs.current
    if (!binders.has(index)) {
      let current: View | null = null
      const release = (original: View | null) => {
        if (!original) return
        if (refs.get(index) === original) refs.delete(index)
        const lifetime = committed.current.get(index)
        if (lifetime?.[kind] === original) lifetime[kind] = null
        if (current === original) current = null
      }
      binders.set(index, (node) => {
        if (!node) {
          release(current)
          return
        }
        current = node
        refs.set(index, node)
        const lifetime = committed.current.get(index)
        if (lifetime) lifetime[kind] = node
        return () => release(node)
      })
    }
    return binders.get(index)!
  }
  return {
    targetRefs,
    bodyRefs,
    bindTarget: (index: number) => binder("target", index),
    bindBody: (index: number) => binder("body", index),
    lifetimeFor: (index: number) => {
      const lifetime: TThumbLifetime = { target: null, body: null }
      pending.set(index, lifetime)
      return lifetime
    },
  }
}
