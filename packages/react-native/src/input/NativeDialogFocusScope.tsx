import {
  createContext,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../overlays/floating/scope"

import type { TNativeDialogDescription, TNativeDialogFocusRegistry, TNativeDialogOwner } from "./dialogFocusRegistry"

export const NativeDialogRegistryContext = createContext<TNativeDialogFocusRegistry | null>(null)
export const NativeDialogEntryOwnerContext = createContext<{
  id: string
  registry: TNativeDialogFocusRegistry
  root: RefObject<View | null>
} | null>(null)
const NativeDialogParentContext = createContext<{ id: string; registry: TNativeDialogFocusRegistry } | null>(null)
const target = (ref: RefObject<View | null>) => ({
  node: ref.current,
  tag: ref.current ? (findNodeHandle(ref.current) ?? 0) : 0,
})

export const useNativeDialogFocusOwner = (
  root: RefObject<View | null>,
  canAct: () => boolean,
  reserved: () => boolean,
  contain?: () => boolean,
) => {
  const registry = useContext(NativeDialogRegistryContext)
  const parent = useContext(NativeDialogEntryOwnerContext)
  const parentDialog = useContext(NativeDialogParentContext)
  const id = useId()
  const description: TNativeDialogOwner = {
    parentId: parent?.registry === registry ? parent.id : parentDialog?.registry === registry ? parentDialog.id : "",
    target: () => target(root),
    canAct,
    reserved,
    contain,
  }
  const current = useRef(description)
  const lease = useRef<ReturnType<TNativeDialogFocusRegistry["registerOwner"]> | null>(null)
  useInsertionEffect(() => {
    if (!registry) return
    const registered = registry.registerOwner(id, current.current)
    lease.current = registered
    return () => {
      registered.unregister()
      if (lease.current === registered) lease.current = null
    }
  }, [registry, id])
  useInsertionEffect(() => {
    current.current = description
    lease.current?.update(description)
  })
  useLayoutEffect(() => {
    registry?.flush()
    return () => registry?.flush()
  })
  return useMemo(() => (registry ? { id, registry, root } : null), [id, registry, root])
}

const NativeDialogRegistration = ({
  rootRef,
  children,
  enabled = true,
  entryAllowed = true,
}: {
  rootRef: RefObject<View | null>
  children?: ReactNode
  enabled?: boolean
  entryAllowed?: boolean
}) => {
  const registry = useContext(NativeDialogRegistryContext)
  const parent = useContext(NativeDialogParentContext)
  const owner = useContext(NativeDialogEntryOwnerContext)
  const floating = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const id = useId()
  const description: TNativeDialogDescription = {
    parentId: parent?.registry === registry ? parent.id : "",
    ownerId: owner?.registry === registry ? owner.id : undefined,
    target: () => target(rootRef),
    entryOwner: () => (owner ? target(owner.root).tag : 0),
    entryAllowed,
    canAct: () => floating?.canAct() !== false && windowActive?.() !== false,
  }
  const current = useRef(description)
  const lease = useRef<ReturnType<TNativeDialogFocusRegistry["register"]> | null>(null)
  useInsertionEffect(() => {
    if (!enabled) return
    if (!registry) throw new Error("NativeDialogFocusScope requires an original same-window NativeKeyboardScope")
    const registered = registry.register(id, current.current)
    lease.current = registered
    return () => {
      registered.unregister()
      if (lease.current === registered) lease.current = null
    }
  }, [registry, id, enabled])
  useInsertionEffect(() => {
    current.current = description
    lease.current?.update(description)
  })
  useLayoutEffect(() => {
    registry?.flush()
    return () => registry?.flush()
  })
  const context = useMemo(() => (enabled && registry ? { id, registry } : parent), [registry, id, enabled, parent])
  return <NativeDialogParentContext.Provider value={context}>{children}</NativeDialogParentContext.Provider>
}

export const NativeDialogFocusScope = ({
  rootRef,
  children,
}: {
  rootRef: RefObject<View | null>
  children?: ReactNode
}) => <NativeDialogRegistration rootRef={rootRef}>{children}</NativeDialogRegistration>

const emptySubscription = () => () => {}
const emptySnapshot = () => 0
export const NativeDialogOverlayFocusOwner = ({
  rootRef,
  entryRef,
  canAct,
  children,
}: {
  rootRef: RefObject<View | null>
  entryRef?: RefObject<View | null>
  canAct: () => boolean
  children?: ReactNode
}) => {
  const parent = useContext(NativeDialogEntryOwnerContext)
  const registry = useContext(NativeDialogRegistryContext)
  const parentDialog = useContext(NativeDialogParentContext)
  useSyncExternalStore(
    registry?.subscribe ?? emptySubscription,
    registry?.snapshot ?? emptySnapshot,
    registry?.snapshot ?? emptySnapshot,
  )
  const parentId =
    parent?.registry === registry ? parent.id : parentDialog?.registry === registry ? parentDialog.id : undefined
  const requested = !!parentId && registry?.hasRequested(parentId) === true
  const owner = useNativeDialogFocusOwner(
    rootRef,
    canAct,
    () => true,
    () => requested,
  )
  return (
    <NativeDialogEntryOwnerContext.Provider value={owner}>
      <NativeDialogRegistration rootRef={entryRef ?? rootRef} enabled={requested} entryAllowed={false}>
        {children}
      </NativeDialogRegistration>
    </NativeDialogEntryOwnerContext.Provider>
  )
}

export const useNativeDialogFocusMembership = (rootRef: RefObject<View | null>, canAct: () => boolean) => {
  const parent = useContext(NativeDialogParentContext)
  const owner = useContext(NativeDialogEntryOwnerContext)
  const currentRegistry = useContext(NativeDialogRegistryContext)
  const registry = parent?.registry ?? currentRegistry
  const id = useId()
  const current = useRef({ rootRef, canAct })
  useInsertionEffect(() => {
    current.current = { rootRef, canAct }
  })
  useInsertionEffect(() => {
    if (!registry || (!parent && owner?.registry !== registry)) return
    return registry.registerMember(
      id,
      parent?.registry === registry ? parent.id : "",
      () => target(current.current.rootRef),
      () => current.current.canAct(),
      owner?.registry === registry ? owner.id : "",
    )
  }, [registry, parent?.id, parent?.registry, owner?.id, owner?.registry, id])
  useLayoutEffect(() => {
    if (parent || owner) registry?.flush()
    return () => {
      if (parent || owner) registry?.flush()
    }
  })
}
