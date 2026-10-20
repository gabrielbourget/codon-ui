import { requireNativeModule } from "expo"
import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
  type RefCallback,
} from "react"
import { findNodeHandle, Modal, PixelRatio, Text, View, type NativeSyntheticEvent } from "react-native"

import { NativeThemeProvider } from "../../../../packages/react-native/src"
import {
  createNativeCollectionBranch,
  createNativeCollectionLeaf,
  NativeCollection,
  NativeCollectionBuilder,
} from "../../../../packages/react-native/src/collection/CollectionBuilder"
import type { TNativeCollectionSessionSnapshot } from "../../../../packages/react-native/src/collection/session"
import {
  getNativeCollectionMetadataIdentity,
  type TNativeCollectionKey,
  type TNativeCollectionNode,
  type TNativeCollectionSnapshot,
} from "../../../../packages/react-native/src/collection/snapshot"
import type {
  NativeCollectionCommitData,
  NativeCollectionInspectionData,
} from "../../../../packages/react-native/src/input/specs/CUICollectionRootNativeComponent"

import { MetadataGate } from "./App"
import {
  AUTHORING_ORDERS,
  AUTHORING_PHASES,
  AUTHORING_PROBE,
  type TAuthoringPhase,
  type TAuthoringValue,
  type TObservedNode,
} from "./authoring"
import { inspectionRequest } from "./gate"
import { SOURCE_PRODUCER } from "./identity"

type TRecord = Record<string, unknown>
type TCollection = TNativeCollectionSnapshot<TAuthoringValue>
type TReceipt = TNativeCollectionSessionSnapshot<unknown>["receipt"]
type TItemProps = { id?: TNativeCollectionKey; value: TAuthoringValue; textValue?: string; children?: ReactNode }
type TEntries = ReadonlyMap<string, { value: TAuthoringValue; ref: RefCallback<View> }>
type TController = { order: (value: readonly string[]) => void }
type TFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (path: string, value: string, options: { encoding: "utf8" }) => Promise<void>
}
const AuthorContext = createContext("first")
const RenderContext = createContext<TCollection | null>(null)
const JournalContext = createContext<(value: TRecord) => void>(() => {})
const INITIAL = ["generated", "a", "b", "c"] as const

const VisibleRow = ({ node, rowRef }: { node: TNativeCollectionNode<TAuthoringValue>; rowRef: ForwardedRef<View> }) => {
  const collection = useContext(RenderContext)
  const record = useContext(JournalContext)
  const instance = useId()
  const [held] = useState(7)
  useLayoutEffect(() => {
    record({ kind: "visible-lifetime", role: node.value?.role, key: node.key, instance, held, attached: true })
    return () =>
      record({ kind: "visible-lifetime", role: node.value?.role, key: node.key, instance, held, attached: false })
  }, [record, node.key, node.value?.role, instance, held])
  return (
    <View ref={rowRef} collapsable={false}>
      <Text>{node.textValue}</Text>
      {collection && [...collection.getChildren(node.key)].map((child) => <RenderNode key={child.key} node={child} />)}
    </View>
  )
}
const renderRow = (_props: TItemProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<TAuthoringValue>) => (
  <VisibleRow node={node} rowRef={ref} />
)
const Item = createNativeCollectionLeaf<TAuthoringValue, TItemProps, View>("item", renderRow)
const Section = createNativeCollectionBranch<TAuthoringValue, TItemProps, View>("section", renderRow)
const RenderNode = ({ node }: { node: TNativeCollectionNode<TAuthoringValue> }) => node.render?.(node) ?? null

const Opaque = ({
  order,
  hidden,
  entries,
  controller,
}: {
  order: readonly string[]
  hidden: boolean
  entries: TEntries
  controller: { current: TController | null }
}) => {
  const [local, setLocal] = useState<readonly string[] | null>(null)
  const context = useContext(AuthorContext)
  const record = useContext(JournalContext)
  const instance = useId()
  useLayoutEffect(() => {
    const current = { order: setLocal }
    controller.current = current
    record({ kind: "author-lifetime", instance, attached: true })
    return () => {
      if (controller.current === current) controller.current = null
      record({ kind: "author-lifetime", instance, attached: false })
    }
  }, [controller, instance, record])
  return (
    <NativeCollection>
      {(local ?? order).map((role) => {
        const entry = entries.get(role)!
        return (
          <Activity key={role} mode={hidden && role === "b" ? "hidden" : "visible"}>
            {role === "a" ? (
              <Section id="a" value={entry.value} ref={entry.ref} textValue={`a:${context}`}>
                <Item id="nested" value={entries.get("nested")!.value} ref={entries.get("nested")!.ref}>
                  {`nested:${context}`}
                </Item>
              </Section>
            ) : (
              <Item id={role === "generated" ? undefined : role} value={entry.value} ref={entry.ref}>
                {`${role}:${context}`}
              </Item>
            )}
          </Activity>
        )
      })}
    </NativeCollection>
  )
}

const Observe = ({
  collection,
  receipt,
  limit,
  observe,
}: {
  collection: TCollection
  receipt: TReceipt
  limit: number
  observe: (collection: TCollection, receipt: TReceipt, limit: number) => void
}) => {
  useLayoutEffect(() => observe(collection, receipt, limit), [collection, receipt, limit, observe])
  return (
    <RenderContext value={collection}>
      {[...collection].slice(0, limit).map((node) => (
        <RenderNode key={node.key} node={node} />
      ))}
    </RenderContext>
  )
}

const AuthoringGate = () => {
  const [order, setOrder] = useState<readonly string[]>(INITIAL)
  const [hidden, setHidden] = useState(false)
  const [rootHidden, setRootHidden] = useState(false)
  const [context, setContext] = useState("first")
  const [limit, setLimit] = useState(Infinity)
  const [generation, setGeneration] = useState(0)
  const [modal, setModal] = useState(false)
  const [request, setRequest] = useState("")
  const controller = useRef<TController | null>(null)
  const phase = useRef<TAuthoringPhase>("initial")
  const pending = useRef(false)
  const stopped = useRef(false)
  const closed = useRef(false)
  const modalShown = useRef(false)
  const awaitingModal = useRef(false)
  const rows = useRef<string[]>([])
  const targets = useRef(new Map<string, number>())
  const packet = useRef<NativeCollectionCommitData | null>(null)
  const previous = useRef<NativeCollectionCommitData | null>(null)
  const tokens = useRef(new WeakMap<object, number>())
  const tokenSequence = useRef(0)
  const next = useRef<() => void>(() => {})
  const record = useCallback((value: TRecord) => {
    if (closed.current) return
    const line = `CUI_COLLECTION_AUTHORING ${JSON.stringify({ probe: AUTHORING_PROBE, sequence: rows.current.length + 1, observedAt: Date.now(), phase: phase.current, ...value })}`
    rows.current.push(line)
    const parts = Math.ceil(line.length / 768)
    for (let part = 0; part < parts; part++) {
      console.warn(
        `CUI_COLLECTION_AUTHORING_CHUNK ${JSON.stringify({ probe: AUTHORING_PROBE, recordSequence: rows.current.length, part, parts, content: line.slice(part * 768, (part + 1) * 768) })}`,
      )
    }
  }, [])
  const persist = useCallback(
    async (outcome: string) => {
      record({ kind: "terminal", outcome })
      closed.current = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("No native cache directory")
      await fs.writeAsStringAsync(
        `${fs.cacheDirectory.replace(/\/?$/, "/")}${AUTHORING_PROBE}.jsonl`,
        rows.current.join("\n") + "\n",
        { encoding: "utf8" },
      )
    },
    [record],
  )
  const fail = useCallback(
    (error: unknown) => {
      if (stopped.current) return
      stopped.current = true
      record({ kind: "failure", error: String(error) })
      void persist("failed").catch((reason: unknown) =>
        console.warn(`CUI_COLLECTION_AUTHORING_PERSIST ${String(reason)}`),
      )
    },
    [persist, record],
  )
  const [entries] = useState<TEntries>(
    () =>
      new Map(
        ["generated", "a", "nested", "b", "c"].map((role) => [
          role,
          {
            value: Object.freeze({ role }),
            ref: (host: View | null) => {
              const target = host ? findNodeHandle(host) : null
              if (target === null) targets.current.delete(role)
              else targets.current.set(role, target)
              record({ kind: "visible-ref", role, target })
            },
          },
        ]),
      ),
  )
  useInsertionEffect(() => {
    record({
      kind: "begin",
      sourceProducer: SOURCE_PRODUCER,
      fontScale: PixelRatio.getFontScale(),
      pixelRatio: PixelRatio.get(),
      input:
        "React authoring commands; original native receipts and SDK inspections; no simulated callback or business action",
    })
  }, [record])
  useEffect(() => {
    const timeout = setTimeout(() => fail("native-authoring-gate-timeout"), 45000)
    return () => clearTimeout(timeout)
  }, [fail])
  const finish = () => {
    stopped.current = true
    void persist("native-records-complete").catch(fail)
  }
  next.current = () => {
    previous.current = packet.current
    const following = AUTHORING_PHASES[AUTHORING_PHASES.indexOf(phase.current) + 1]
    pending.current = false
    if (!following) {
      if (!modalShown.current) awaitingModal.current = true
      else finish()
      return
    }
    phase.current = following
    record({ kind: "authoring-command" })
    if (following === "parent-reorder") setOrder(["b", "generated", "c", "a"])
    else if (following === "local-reorder") controller.current?.order(["c", "a", "b", "generated"])
    else if (following === "hidden-child") setHidden(true)
    else if (following === "restored-child") setHidden(false)
    else if (following === "context") setContext("second")
    else if (following === "one-row") setLimit(1)
    else if (following === "zero-rows") setLimit(0)
    else if (following === "all-rows") setLimit(Infinity)
    else if (following === "root-hidden") setRootHidden(true)
    else if (following === "root-restored") {
      setRootHidden(false)
      setRequest("")
    } else if (following === "empty") controller.current?.order([])
    else if (following === "reinserted") controller.current?.order(INITIAL)
    else if (following === "remounted") {
      setOrder(INITIAL)
      setContext("first")
      setRequest("")
      setGeneration((value) => value + 1)
    } else if (following === "modal") {
      setRequest("")
      setGeneration((value) => value + 1)
      setModal(true)
    }
  }
  const token = (event: object) => {
    let value = tokens.current.get(event)
    if (value === undefined) {
      value = ++tokenSequence.current
      tokens.current.set(event, value)
    }
    return value
  }
  const onCommit = (event: NativeSyntheticEvent<NativeCollectionCommitData>) => {
    event.persist()
    record({ kind: "native-commit", eventToken: token(event), actual: event.nativeEvent })
    if (stopped.current) return
    if (!pending.current && phase.current === "root-hidden" && event.nativeEvent.error === "metadata-root-hidden") {
      pending.current = true
      record({ kind: "hidden-root-observed", visibleTargets: Object.fromEntries(targets.current) })
      packet.current = event.nativeEvent
      setTimeout(() => next.current(), 0)
    }
  }
  const observe = useCallback(
    (collection: TCollection, receipt: TReceipt, currentLimit: number) => {
      try {
        const logical: TObservedNode[] = []
        const visit = (node: TNativeCollectionNode<TAuthoringValue>) => {
          const role = node.value?.role ?? "missing"
          const entry = entries.get(role)
          logical.push({
            key: node.key,
            role,
            type: node.type,
            parentKey: node.parentKey,
            prevKey: node.prevKey,
            nextKey: node.nextKey,
            index: node.index,
            textValue: node.textValue,
            originalValue: node.value === entry?.value,
            originalRef: node.props.ref === entry?.ref,
            ...getNativeCollectionMetadataIdentity(node),
          })
          for (const child of collection.getChildren(node.key)) visit(child)
        }
        for (const node of collection) visit(node)
        record({
          kind: "collection-commit",
          status: receipt.status,
          error: receipt.error,
          lease: receipt.lease,
          logical,
          lookup: [...collection.getKeys()],
          size: collection.size,
          materializedLimit: Number.isFinite(currentLimit) ? currentLimit : null,
          visibleTargets: Object.fromEntries(targets.current),
        })
        if (
          stopped.current ||
          pending.current ||
          phase.current === "root-hidden" ||
          receipt.status !== "confirmed" ||
          !receipt.lease
        )
          return
        if (JSON.stringify(logical.map((node) => node.role)) !== JSON.stringify(AUTHORING_ORDERS[phase.current])) return
        const expectedContext = [
          "initial",
          "parent-reorder",
          "local-reorder",
          "hidden-child",
          "restored-child",
          "remounted",
          "modal",
        ].includes(phase.current)
          ? "first"
          : "second"
        if (logical.some((node) => node.textValue !== `${node.role}:${expectedContext}`)) return
        if (logical.some((node) => !node.originalValue || !node.originalRef))
          throw new Error("Lost original JavaScript value/ref identity")
        pending.current = true
        packet.current = { ...receipt.lease, hierarchy: "" }
        record({
          kind: "selected-collection",
          lease: receipt.lease,
          logical,
          lookup: [...collection.getKeys()],
          size: collection.size,
          materializedLimit: Number.isFinite(currentLimit) ? currentLimit : null,
          visibleTargets: Object.fromEntries(targets.current),
        })
        setRequest(inspectionRequest(packet.current, `${phase.current}:current`))
      } catch (error) {
        fail(error)
      }
    },
    [entries, fail, record],
  )
  const onInspection = (event: NativeSyntheticEvent<NativeCollectionInspectionData>) => {
    event.persist()
    record({ kind: "native-inspection", eventToken: token(event), actual: event.nativeEvent })
    if (stopped.current) return
    const actual = event.nativeEvent
    if (actual.requestId === `${phase.current}:current`) {
      if (!actual.accepted) {
        fail("Current joined collection failed the actual SDK inspection")
        return
      }
      if (
        previous.current &&
        packet.current &&
        inspectionRequest(previous.current, "compare") !== inspectionRequest(packet.current, "compare")
      ) {
        setRequest(inspectionRequest(previous.current, `${phase.current}:stale`))
        return
      }
    } else if (actual.requestId === `${phase.current}:stale`) {
      if (actual.accepted) {
        fail("Stale joined collection passed the actual SDK inspection")
        return
      }
    } else return
    setTimeout(() => next.current(), 0)
  }
  const content = useMemo(
    () => (
      <AuthorContext value={context}>
        <Opaque {...{ order, hidden, entries, controller }} />
      </AuthorContext>
    ),
    [context, order, hidden, entries],
  )
  const tree = (
    <Activity mode={rootHidden ? "hidden" : "visible"}>
      <NativeCollectionBuilder<TAuthoringValue>
        key={generation}
        content={content}
        inspectionRequest={request}
        onNativeCollectionCommit={onCommit}
        onNativeCollectionInspection={onInspection}
      >
        {(collection, receipt) => <Observe {...{ collection, receipt, limit, observe }} />}
      </NativeCollectionBuilder>
    </Activity>
  )
  return (
    <JournalContext value={record}>
      <View style={{ flex: 1, padding: 24, backgroundColor: "white" }}>
        <Text>Native React collection authoring gate</Text>
        {modal ? (
          <Modal
            visible
            onShow={() => {
              modalShown.current = true
              record({ kind: "native-modal-show" })
              if (awaitingModal.current) finish()
            }}
            onRequestClose={() => {}}
          >
            <View style={{ flex: 1, padding: 24, backgroundColor: "white" }}>{tree}</View>
          </Modal>
        ) : (
          tree
        )}
      </View>
    </JournalContext>
  )
}

export default () => {
  const [authoring, setAuthoring] = useState(false)
  const completeMetadata = useCallback(() => setAuthoring(true), [])
  return (
    <NativeThemeProvider>
      {authoring ? <AuthoringGate /> : <MetadataGate onComplete={completeMetadata} />}
    </NativeThemeProvider>
  )
}
