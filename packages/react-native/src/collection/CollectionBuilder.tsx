import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from "react"
import { findNodeHandle } from "react-native"

import { encodeCollectionKey } from "../components/collection"

import { NativeCollectionActions, NativeCollectionActionsContext } from "./actions"
import { useNativeCachedChildren, type TNativeCachedChildrenOptions } from "./cachedChildren"
import {
  NativeCollectionMetadataNode,
  NativeCollectionMetadataRoot,
  type TNativeMetadataRootRef,
} from "./NativeCollectionMetadata"
import { NativeCollectionSession, type TNativeCollectionSessionSnapshot } from "./session"
import type {
  TNativeCollectionDescriptor,
  TNativeCollectionKey,
  TNativeCollectionNode,
  TNativeCollectionSnapshot,
} from "./snapshot"

const AuthoringContext = createContext<NativeCollectionSession<unknown> | null>(null)
const CollectionContext = createContext<{ dependencies: readonly unknown[]; idScope?: TNativeCollectionKey } | null>(
  null,
)
const wrapIdentity = (element: ReactElement) => element
type TWrapReceiver = (element: ReactElement) => ReactElement
type TMetadataRootProps = ComponentProps<typeof NativeCollectionMetadataRoot>
type TReceipt = TNativeCollectionSessionSnapshot<unknown>["receipt"]
type TBuilderProps<T> = {
  content: ReactNode
  children: (collection: TNativeCollectionSnapshot<T>, receipt: TReceipt) => ReactNode
} & Pick<TMetadataRootProps, "inspectionRequest" | "onNativeCollectionCommit" | "onNativeCollectionInspection">
type TDraft<T> = Omit<TNativeCollectionDescriptor<T>, "descriptorId" | "descriptorRevision" | "key">
type TSourceProps<T> = {
  id?: TNativeCollectionKey
  value?: T
  textValue?: string
  children?: unknown
  "aria-label"?: string
  colSpan?: number
}

const CollectionReceiver = <T,>({
  session,
  children,
}: {
  session: NativeCollectionSession<unknown>
  children: TBuilderProps<T>["children"]
}) => {
  const { collection, receipt } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  // Context erases heterogeneous authoring types; each original item value remains unchanged.
  return children(collection as TNativeCollectionSnapshot<T>, receipt)
}

const CollectionBuilderRoot = <T,>({
  content,
  children,
  onNativeCollectionCommit,
  ...inspection
}: TBuilderProps<T>) => {
  const id = useId()
  const [session] = useState(
    () =>
      new NativeCollectionSession<unknown>({
        ownerId: `cui-collection-owner:${id}`,
        rootId: `cui-collection-root:${id}`,
        rootRevision: `cui-collection-revision:${id}`,
      }),
  )
  const [actions] = useState(() => new NativeCollectionActions(session))
  const actionRequests = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot)
  const metadataRef = useCallback(
    (host: TNativeMetadataRootRef | null) => {
      if (!host) actions.reset()
      session.bindRootTarget(host ? findNodeHandle(host) : null)
    },
    [session, actions],
  )
  const receive = useCallback<NonNullable<TMetadataRootProps["onNativeCollectionCommit"]>>(
    (event) => {
      event.persist()
      session.receive(event.nativeEvent)
      onNativeCollectionCommit?.(event)
    },
    [session, onNativeCollectionCommit],
  )
  return (
    <>
      <NativeCollectionMetadataRoot
        {...session.scope}
        {...inspection}
        metadataRef={metadataRef}
        actionRequests={actionRequests}
        onNativeCollectionAction={(event) => {
          actions.receive(event.nativeEvent)
        }}
        onNativeCollectionCommit={receive}
      >
        <AuthoringContext.Provider value={session}>{content}</AuthoringContext.Provider>
      </NativeCollectionMetadataRoot>
      <NativeCollectionActionsContext.Provider value={actions}>
        <CollectionReceiver session={session}>{children}</CollectionReceiver>
      </NativeCollectionActionsContext.Provider>
    </>
  )
}

export const NativeCollectionBuilder = <T,>(props: TBuilderProps<T>) => {
  const existing = useContext(AuthoringContext)
  return existing ? props.content : <CollectionBuilderRoot {...props} />
}

export const NativeCollection = <T extends object>(props: Omit<TNativeCachedChildrenOptions<T>, "getReactKey">) => {
  const parent = useContext(CollectionContext)
  const dependencies = (parent?.dependencies ?? []).concat(props.dependencies)
  const idScope = props.idScope ?? parent?.idScope
  const children = useNativeCachedChildren({
    ...props,
    dependencies,
    idScope,
    addIdAndValue: true,
    getReactKey: encodeCollectionKey,
  })
  const context = useMemo(() => ({ dependencies, idScope }), [idScope, ...dependencies])
  return <CollectionContext.Provider value={context}>{children}</CollectionContext.Provider>
}

const DescriptorOwner = <T,>({
  session,
  draft,
  id,
  children,
}: {
  session: NativeCollectionSession<unknown>
  draft: TDraft<T>
  id?: TNativeCollectionKey
  children?: ReactNode
}) => {
  const descriptorId = useId()
  const committedKey = useRef<TNativeCollectionKey | null>(null)
  const [binding, setBinding] = useState<{ draft: TDraft<T>; descriptor: TNativeCollectionDescriptor<T> } | null>(null)
  useLayoutEffect(() => {
    const key = committedKey.current ?? id ?? session.generateKey()
    if (id != null && id !== key) throw new Error("Cannot change the id of an item")
    committedKey.current = key
    const descriptor = Object.freeze({
      ...draft,
      key,
      descriptorId,
      descriptorRevision: session.nextDescriptorRevision(),
    })
    const retire = session.commitDescriptor(descriptor)
    setBinding({ draft, descriptor })
    return retire
  }, [session, draft, id, descriptorId])
  return (
    <NativeCollectionMetadataNode
      ownerId={session.scope.ownerId}
      rootId={session.scope.rootId}
      descriptorId={descriptorId}
      descriptorRevision={binding?.draft === draft ? binding.descriptor.descriptorRevision : "uncommitted"}
    >
      {children}
    </NativeCollectionMetadataNode>
  )
}

type TRenderer<T, P, E> = (props: P, ref: ForwardedRef<E>, node: TNativeCollectionNode<T>) => ReactElement | null
const useDraft = <T, P extends object>(
  type: string,
  props: P,
  ref: unknown,
  rendered: ReactNode,
  render: TNativeCollectionDescriptor<T>["render"],
): { draft: TDraft<T>; id?: TNativeCollectionKey } => {
  return useMemo(() => {
    const { id, value, textValue, ...original } = props as TSourceProps<T>
    const nodeProps = { ...original, ref }
    return {
      id,
      draft: {
        type,
        // Pinned source stores absent values as undefined despite its T|null declaration.
        value: value as T | null,
        props: nodeProps,
        rendered,
        render,
        textValue:
          textValue || (typeof original.children === "string" ? original.children : "") || original["aria-label"] || "",
        "aria-label": original["aria-label"] || undefined,
        colSpan: original.colSpan,
      },
    }
  }, [type, props, ref, rendered, render])
}

export const createNativeCollectionLeaf = <T, P extends object, E>(
  type: string,
  render: TRenderer<T, P, E>,
  useCapture?: () => TWrapReceiver,
) => {
  // React mounts this receiver; the library callback is never used to evaluate authored component elements.
  const Receiver = ({ node }: { node: TNativeCollectionNode<T> }) => render(node.props, node.props.ref, node)
  const Result = forwardRef<E, P>((props, ref) => {
    const session = useContext(AuthoringContext)
    const wrap = useCapture ? useCapture() : wrapIdentity
    const renderNode = useMemo<NonNullable<TNativeCollectionDescriptor<T>["render"]>>(
      () => (node) => wrap(<Receiver node={node as TNativeCollectionNode<T>} />),
      [wrap],
    )
    const original = props as P & { children?: unknown }
    const { draft, id } = useDraft<T, P>(
      type,
      original,
      ref,
      ("children" in original ? original.children : null) as ReactNode,
      renderNode,
    )
    if (!session) {
      if (render.length >= 3) throw new Error("A native collection item cannot be rendered outside a collection")
      return (render as (props: P, ref: ForwardedRef<E>) => ReactElement | null)(original, ref)
    }
    return <DescriptorOwner session={session} draft={draft} id={id} />
  })
  Result.displayName = `NativeCollectionLeaf(${type})`
  return Result
}

const useBranchChildren = <T extends object>(props: TNativeCachedChildrenOptions<T>) =>
  useNativeCachedChildren({ ...props, addIdAndValue: true, getReactKey: encodeCollectionKey })
export const createNativeCollectionBranch = <T extends object, P extends object, E>(
  type: string,
  render: TRenderer<T, P, E>,
  useChildren: (props: P) => ReactNode = useBranchChildren,
) => {
  const Receiver = ({ node }: { node: TNativeCollectionNode<T> }) => render(node.props, node.props.ref, node)
  const renderNode: NonNullable<TNativeCollectionDescriptor<T>["render"]> = (node) => (
    <Receiver node={node as TNativeCollectionNode<T>} />
  )
  const Result = forwardRef<E, P>((props, ref) => {
    const session = useContext(AuthoringContext)
    const original = props as P
    const children = useChildren(original)
    const { draft, id } = useDraft<T, P>(type, original, ref, null, renderNode)
    if (!session) throw new Error("A native collection branch cannot be rendered outside a collection")
    return (
      <DescriptorOwner session={session} draft={draft} id={id}>
        {children}
      </DescriptorOwner>
    )
  })
  Result.displayName = `NativeCollectionBranch(${type})`
  return Result
}
