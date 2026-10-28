import {
  createContext,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react"
import { AppState, findNodeHandle, type TextInput, type View } from "react-native"

import {
  captureNativeFocusTarget,
  focusNativeTarget,
  getNativeFocusedTarget,
  subscribeNativeFocus,
} from "../../input/focus"
import { NativeDialogRegistryContext } from "../../input/NativeDialogFocusScope"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { OverlayParentContext, OverlayRegistryContext } from "../../overlays/NativeOverlayProvider"

type TTarget = View | TextInput
type TScope = ReturnType<typeof useNativeKeyScope>
export const NativePanelFocusIntentContext = createContext<string | number | undefined>(undefined)
const subscribeNone = () => () => {}
const zero = () => 0
const sessionKey = (scope: TScope) => {
  const session = scope?.acknowledgedSession()
  return JSON.stringify([scope?.ownerId, session?.windowId, session?.epoch])
}

// This hook runs before useOverlay so admission cannot hide the previously focused parent target first.
export const useNativePanelReturnFocus = (open: boolean, restoreRef?: RefObject<TTarget | null>) => {
  const input = useNativeKeyScope()
  const registry = useContext(OverlayRegistryContext)
  const parent = useContext(OverlayParentContext)
  useSyncExternalStore(input?.subscribe ?? subscribeNone, input?.snapshot ?? zero, zero)
  const current = useRef({ open: false, restoreRef, input, registry, parent })
  const appState = useRef(AppState.currentState)
  const retained = useRef<{
    target: TTarget
    isCurrent: () => boolean
    session: string
    entered: boolean
  } | null>(null)
  const frame = useRef<number | null>(null)
  const generation = useRef(0)
  const cancel = useCallback(() => {
    generation.current++
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  const invalidate = useCallback(() => {
    cancel()
    retained.current = null
  }, [cancel])
  useInsertionEffect(() => {
    const previous = current.current
    if (
      previous.input !== input ||
      previous.registry !== registry ||
      previous.parent !== parent ||
      previous.restoreRef !== restoreRef
    )
      invalidate()
    current.current = { open, restoreRef, input, registry, parent }
    if (open && !previous.open) {
      invalidate()
      const target = restoreRef === undefined ? getNativeFocusedTarget() : restoreRef.current
      const lease = target && captureNativeFocusTarget(target)
      if (target && lease && appState.current === "active")
        retained.current = { target, isCurrent: lease, session: sessionKey(input), entered: false }
    }
    if (open) cancel()
  }, [open, restoreRef, input, registry, parent, cancel, invalidate])
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        if (retained.current && retained.current.session !== sessionKey(input)) invalidate()
        else cancel()
      }),
    [input, invalidate, cancel],
  )
  useLayoutEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      appState.current = state
      if (state !== "active") invalidate()
    })
    return () => subscription.remove()
  }, [invalidate])
  const restore = useCallback(() => {
    const owner = current.current
    const target = retained.current
    retained.current = null
    if (
      !target?.entered ||
      target.session !== sessionKey(owner.input) ||
      appState.current !== "active" ||
      owner.registry?.canRestore(owner.parent) !== true ||
      (owner.input && !owner.input.isNativeReady()) ||
      (owner.restoreRef !== undefined && owner.restoreRef.current !== target.target) ||
      !target.isCurrent()
    )
      return
    focusNativeTarget(target.target)
  }, [])
  useLayoutEffect(
    () => () => {
      cancel()
      // No deferred work survives teardown; a still-valid parent may receive a synchronous return request.
      restore()
    },
    [cancel, restore],
  )
  return useCallback(
    (mounted: boolean) => {
      cancel()
      const owner = current.current
      const target = retained.current
      if (!target) return
      if (mounted) {
        target.entered = true
        return
      }
      if (owner.open || !target.entered || (owner.input && !owner.input.isNativeReady())) return
      if (!owner.registry?.canRestore(owner.parent)) {
        invalidate()
        return
      }
      const revision = owner.input?.snapshot()
      const epoch = generation.current
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        if (
          generation.current !== epoch ||
          retained.current !== target ||
          current.current.open ||
          current.current.input?.snapshot() !== revision
        )
          return
        restore()
      })
    },
    [cancel, invalidate, restore],
  )
}

export const useNativePanelInitialFocus = (
  open: boolean,
  ready: boolean,
  isActive: () => boolean,
  root: RefObject<View | null>,
  initialRef?: RefObject<TTarget | null>,
) => {
  const input = useNativeKeyScope()
  const dialogs = useContext(NativeDialogRegistryContext)
  const intent = useContext(NativePanelFocusIntentContext)
  const revision = useSyncExternalStore(input?.subscribe ?? subscribeNone, input?.snapshot ?? zero, zero)
  const current = useRef({ open, ready, isActive, initialRef, intent, intentRevision: 0 })
  const acquired = useRef<{ session: string; intentRevision: number } | null>(null)
  const explicitObservation = useRef<{ target: TTarget; session: string; intentRevision: number } | null>(null)
  const appState = useRef(AppState.currentState)
  const appGeneration = useRef(0)
  const [appRevision, setAppRevision] = useState(0)
  useInsertionEffect(() => {
    const intentRevision = current.current.intentRevision + Number(current.current.intent !== intent)
    current.current = { open, ready, isActive, initialRef, intent, intentRevision }
    if (!open) {
      acquired.current = null
      explicitObservation.current = null
    }
  })
  const session = sessionKey(input)
  useLayoutEffect(() => {
    const observed = () => {
      const owner = current.current,
        target = owner.initialRef?.current
      if (!owner.open || !owner.isActive() || !input?.isNativeReady() || !target || getNativeFocusedTarget() !== target)
        return
      const next = { target, session: sessionKey(input), intentRevision: owner.intentRevision }
      if (
        explicitObservation.current?.target === target &&
        explicitObservation.current.session === next.session &&
        explicitObservation.current.intentRevision === next.intentRevision
      )
        return
      explicitObservation.current = next
      dialogs?.flush()
    }
    observed()
    return subscribeNativeFocus(observed)
  }, [input, dialogs])
  useLayoutEffect(() => {
    let live = true
    const subscription = AppState.addEventListener("change", (state) => {
      if (!live) return
      appState.current = state
      appGeneration.current++
      setAppRevision((value) => value + 1)
    })
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  useLayoutEffect(() => {
    if (
      !open ||
      !ready ||
      !isActive() ||
      !input?.isNativeReady() ||
      (acquired.current?.session === session && acquired.current.intentRevision === current.current.intentRevision) ||
      appState.current !== "active"
    )
      return
    dialogs?.flush()
    const ref = initialRef ?? root
    if (initialRef === undefined && root.current && dialogs?.hasEntryFor(findNodeHandle(root.current) ?? 0)) {
      acquired.current = { session, intentRevision: current.current.intentRevision }
      return
    }
    const target = ref.current
    const intentRevision = current.current.intentRevision
    let retired = false
    const appEpoch = appGeneration.current
    const frame = requestAnimationFrame(() => {
      const owner = current.current
      if (
        retired ||
        appEpoch !== appGeneration.current ||
        appState.current !== "active" ||
        !owner.open ||
        !owner.ready ||
        !owner.isActive() ||
        owner.initialRef !== initialRef ||
        owner.intentRevision !== intentRevision ||
        ref.current !== target ||
        input.snapshot() !== revision ||
        !input.isNativeReady() ||
        sessionKey(input) !== session
      )
        return
      dialogs?.flush()
      if (initialRef === undefined && root.current && dialogs?.hasEntryFor(findNodeHandle(root.current) ?? 0)) {
        acquired.current = { session, intentRevision }
        return
      }
      if (focusNativeTarget(target)) acquired.current = { session, intentRevision }
    })
    return () => {
      retired = true
      cancelAnimationFrame(frame)
    }
  }, [open, ready, isActive, initialRef, root, input, dialogs, revision, session, appRevision, intent])
  return useCallback(() => {
    const owner = current.current,
      observed = explicitObservation.current
    return (
      owner.initialRef !== undefined &&
      !(
        observed &&
        observed.target === owner.initialRef.current &&
        observed.session === sessionKey(input) &&
        observed.intentRevision === owner.intentRevision
      )
    )
  }, [input])
}
