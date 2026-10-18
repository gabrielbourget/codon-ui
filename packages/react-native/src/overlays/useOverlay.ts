import {
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react"
import { AccessibilityInfo, Platform, type View } from "react-native"

import { OverlayParentContext, OverlayRegistryContext } from "./NativeOverlayProvider"

const subscribeNone = () => () => undefined
const zero = () => 0

export const useOverlay = (requested: boolean, required: boolean, leaf = false, restore?: RefObject<View | null>) => {
  const registry = useContext(OverlayRegistryContext)
  const parent = useContext(OverlayParentContext)
  const id = useId()
  const revision = useSyncExternalStore(registry?.subscribe ?? subscribeNone, registry?.snapshot ?? zero, zero)
  const generation = useRef(0)
  const alive = useRef(false)
  const restoreTarget = useRef(restore)
  restoreTarget.current = restore
  const frames = useRef(new Set<ReturnType<typeof requestAnimationFrame>>())
  if (required && !registry) throw new Error("Modal: NativeOverlayProvider is required")
  useInsertionEffect(() => {
    alive.current = true
    registry?.register(id, parent, leaf, requested, false)
    const scheduled = frames.current
    return () => {
      alive.current = false
      generation.current++
      for (const frame of scheduled) cancelAnimationFrame(frame)
      scheduled.clear()
      registry?.unregister(id, false)
    }
    // Registration owns one stable identity; subsequent requests use the update effect.
  }, [registry, id, parent, leaf])
  useInsertionEffect(() => {
    generation.current++
    registry?.request(id, requested, false)
  }, [registry, id, requested])
  // Stage the whole React commit before validating/admitting root replacements.
  useLayoutEffect(() => {
    registry?.flush()
  }, [registry, id, requested])
  useLayoutEffect(() => () => registry?.flush(), [registry, id])
  const state = registry?.state(id)
  const schedule = (work: () => void) => {
    const epoch = generation.current
    const frame = requestAnimationFrame(() => {
      frames.current.delete(frame)
      if (alive.current && generation.current === epoch) work()
    })
    frames.current.add(frame)
  }
  const dismissed = () => {
    if (!registry?.dismissed(id)) return
    schedule(() => {
      if (registry.canRestore(parent) && restoreTarget.current?.current)
        AccessibilityInfo.sendAccessibilityEvent(restoreTarget.current.current, "focus")
    })
  }
  useLayoutEffect(() => {
    if (!state?.closing || Platform.OS === "ios") return
    // Android has no onDismiss contract. Handoff follows the committed hidden frame.
    const frame = requestAnimationFrame(dismissed)
    return () => cancelAnimationFrame(frame)
    // Only a lifecycle transition schedules the barrier, not every subscriber update.
  }, [state?.closing, registry, id])
  return {
    id,
    managed: !!registry,
    visible: state?.visible ?? requested,
    mounted: state?.mounted ?? requested,
    covered: state?.covered ?? false,
    active: state?.active ?? true,
    isActive: () => (registry ? registry.state(id).active : true),
    shown: () => registry?.shown(id),
    dismissed,
    focus: (target: RefObject<View | null>) =>
      schedule(() => {
        if (registry?.state(id).active && target.current)
          AccessibilityInfo.sendAccessibilityEvent(target.current, "focus")
      }),
    revision,
  }
}
