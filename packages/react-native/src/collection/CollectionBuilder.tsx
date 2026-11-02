import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"
import type { View } from "react-native"

import {
  isNativeVisibleCollectionAdmission,
  NativeVisibleCollectionAdmission,
} from "../input/nativeVisibleCollectionAdmission"

import {
  NativeCollectionActionAdmissionContext,
  NativeCollectionActions,
  NativeCollectionActionsContext,
} from "./actions"
import { NativeCollectionNodeContext } from "./binding"
import { useNativeCollectionRefs } from "./context"
import { NativeCollectionModel, nativeCollectionOwnerBinding, type TNativeCollectionModelSnapshot } from "./model"
import {
  createNativeCollectionSnapshot,
  type TNativeCollectionItem,
  type TNativeCollectionNode,
  type TNativeCollectionSnapshot,
} from "./snapshot"

const subscribeIdle = () => () => {}
const idleSnapshot = () => 0
export type TNativeCollectionBuilderProps<T> = {
  items: readonly TNativeCollectionItem<T>[]
  children: (collection: TNativeCollectionSnapshot<T>, model: TNativeCollectionModelSnapshot<T>) => ReactNode
}

const CommitModel = <T,>({
  model,
  snapshot,
  previous,
}: {
  model: NativeCollectionModel<T>
  snapshot: TNativeCollectionModelSnapshot<T>
  previous: { current: TNativeCollectionSnapshot<T> | null }
}) => {
  useLayoutEffect(() => {
    previous.current = snapshot.collection
    return model.commit(snapshot)
  }, [model, snapshot, previous])
  return null
}

const NativeCollectionBuilderBody = <T,>({ items, children }: TNativeCollectionBuilderProps<T>) => {
  const ownerId = useId()
  const [model] = useState(() => new NativeCollectionModel<T>(ownerId))
  const admission = useContext(NativeCollectionActionAdmissionContext)
  const previous = useRef<TNativeCollectionSnapshot<T> | null>(null)
  const snapshot = useMemo(() => model.prepare(createNativeCollectionSnapshot(items, previous.current)), [model, items])
  const actions = useMemo(() => new NativeCollectionActions(model, admission, snapshot), [model, admission, snapshot])
  useSyncExternalStore(admission?.subscribe ?? subscribeIdle, admission?.getSnapshot ?? idleSnapshot, idleSnapshot)
  useLayoutEffect(() => {
    const disconnect = actions.connect()
    return () => {
      disconnect()
      actions.reset()
    }
  }, [actions])
  return (
    <>
      <CommitModel model={model} snapshot={snapshot} previous={previous} />
      <NativeCollectionActionsContext.Provider value={actions}>
        {children(snapshot.collection, snapshot)}
      </NativeCollectionActionsContext.Provider>
    </>
  )
}

export const NativeCollectionBuilder = <T,>(props: TNativeCollectionBuilderProps<T>) => {
  const inherited = useContext(NativeCollectionActionAdmissionContext)
  // Explicit external adapters remain injectable for source fixtures; each production owner gets its own publisher.
  return inherited && !isNativeVisibleCollectionAdmission(inherited) ? (
    <NativeCollectionBuilderBody {...props} />
  ) : (
    <NativeVisibleCollectionAdmission>
      <NativeCollectionBuilderBody {...props} />
    </NativeVisibleCollectionAdmission>
  )
}

// Explicit model authoring replaces the former JSX discovery component.
export const NativeCollection = NativeCollectionBuilder

type TRenderer<T, P, E> = (props: P, ref: ForwardedRef<E>, node: TNativeCollectionNode<T>) => ReactElement | null

// These are visible receivers only: they never register descriptors or inspect authored children.
export const createNativeCollectionLeaf = <T, P extends object, E>(
  type: string,
  render: TRenderer<T, P, E>,
  useCapture?: () => (element: ReactElement) => ReactElement,
) => {
  const Result = forwardRef<E, P>((props, ref) => {
    const admission = useContext(NativeCollectionActionAdmissionContext)
    // Cached receiver elements still need fresh native bindings; keep logical actions and item identity unchanged.
    useSyncExternalStore(admission?.subscribe ?? subscribeIdle, admission?.getSnapshot ?? idleSnapshot, idleSnapshot)
    const node = useContext(NativeCollectionNodeContext)
    const wrap = useCapture?.()
    if (!node) {
      if (render.length >= 3) throw new Error("A native collection item requires an explicit model receiver")
      return (render as (props: P, ref: ForwardedRef<E>) => ReactElement | null)(props as P, ref)
    }
    if (node.type !== type) throw new Error("Collection receiver type does not match its model item")
    const rendered = render(props as P, ref, node as TNativeCollectionNode<T>)
    return rendered && wrap ? wrap(rendered) : rendered
  })
  Result.displayName = `NativeCollectionLeaf(${type})`
  return Result
}

export const createNativeCollectionBranch = <T extends object, P extends object, E>(
  type: string,
  render: TRenderer<T, P, E>,
) => createNativeCollectionLeaf(type, render)

// Register the original root supplied by the existing renderer/ref contract. No extra host is inserted.
export const useNativeCollectionOwnerRef = <T,>(
  snapshot: TNativeCollectionModelSnapshot<T>,
  forwardedRef?: Ref<View>,
) => {
  const admission = useContext(NativeCollectionActionAdmissionContext)
  const [original, setOriginal] = useState<View | null>(null)
  const bind = useCallback((host: View | null) => setOriginal(host), [])
  const merged = useNativeCollectionRefs(forwardedRef, bind)
  const binding = useMemo(() => nativeCollectionOwnerBinding(snapshot), [snapshot])
  useLayoutEffect(() => {
    if (original && admission) return admission.registerOwner(binding, original)
  }, [admission, binding, original])
  return merged
}

// Call only for the actual primary receiver, never inherited descendants such as a remove slot.
export const useNativeCollectionReceiverRef = <T,>(node: TNativeCollectionNode<T>, forwardedRef?: Ref<View>) => {
  const actions = useContext(NativeCollectionActionsContext)
  const [original, setOriginal] = useState<View | null>(null)
  const bind = useCallback((host: View | null) => setOriginal(host), [])
  const merged = useNativeCollectionRefs(forwardedRef, bind)
  useLayoutEffect(() => {
    if (original && actions) return actions.registerReceiver(node, original)
  }, [actions, node, original])
  return merged
}
