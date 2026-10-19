import { useEffect, useId, useInsertionEffect, useRef } from "react"

import { resolveVariantFromProps } from "../animation"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"

import type { TNativePresence } from "./context"

// Source exit sequencing plus native owner/generation retirement. A callback never completes a re-entered owner.
export const useNativeMotionPresence = (
  owner: NativeMotionOwner,
  presence: TNativePresence | null,
  error: (error: unknown) => void,
) => {
  const id = useId(),
    committed = useRef(presence),
    previous = useRef<boolean | undefined>(undefined)
  const generation = useRef(0),
    completed = useRef(false),
    running = useRef<(() => boolean) | undefined>(undefined)
  useInsertionEffect(() => {
    committed.current = presence
  })
  useEffect(() => presence?.register(id), [presence?.register, id])
  useEffect(() => {
    if (!presence) return
    const present = presence.isPresent
    const interrupted = running.current && !running.current()
    if (previous.current === present && !interrupted) return
    const before = previous.current
    previous.current = present
    const pass = ++generation.current,
      current = owner.captureAnimationLease()
    running.current = current
    const report = (failure: unknown) => {
      if (pass === generation.current && current()) error(failure)
    }
    if (owner.isStatic()) {
      if (!present) presence.onExitComplete(id)
      return
    }
    if (!current()) return
    if (present && before === false) {
      if (completed.current) {
        const initial = owner.getProps().initial
        if (typeof initial === "string" || (initial && typeof initial === "object" && !Array.isArray(initial))) {
          const resolved = resolveVariantFromProps(owner.getProps(), initial)
          if (resolved) {
            const { transition: _transition, transitionEnd: _end, ...target } = resolved
            void _transition
            void _end
            for (const [key, value] of Object.entries(target)) owner.getValue(key)?.jump(value)
          }
        }
        owner.animationState.reset()
        void owner.animationState.animateChanges().catch(report)
      } else void owner.animationState.setActive("exit", false).catch(report)
      completed.current = false
      return
    }
    if (interrupted && !present) owner.animationState.reset()
    void owner.animationState
      .setActive("exit", !present)
      .then(() => {
        if (!present && pass === generation.current && current() && committed.current?.isPresent === false) {
          completed.current = true
          committed.current.onExitComplete(id)
        }
      })
      .catch(report)
  })
  useInsertionEffect(
    () => () => {
      generation.current++
      running.current = undefined
    },
    [],
  )
}
