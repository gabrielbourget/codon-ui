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
  useRef,
  useState,
} from "react"
import { Modal, PixelRatio, View, type NativeSyntheticEvent } from "react-native"

import { Button, NativeThemeProvider, Text } from "../../../../packages/react-native/src"
import {
  NativeCollectionMetadataNode,
  NativeCollectionMetadataRoot,
} from "../../../../packages/react-native/src/collection/NativeCollectionMetadata"
import type {
  NativeCollectionCommitData,
  NativeCollectionInspectionData,
} from "../../../../packages/react-native/src/input/specs/CUICollectionRootNativeComponent"

import { inspectionRequest, matches, PHASES, PROBE, type TPhase } from "./gate"
import { SOURCE_PRODUCER } from "./identity"

type TRecord = Record<string, unknown>
type TControls = { order: readonly string[]; hidden: boolean; duplicate: boolean; foreign: boolean }
type TController = { order: (value: readonly string[]) => void }
type TFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (path: string, value: string, options: { encoding: "utf8" }) => Promise<void>
}
const Context = createContext("first")
const INITIAL = ["generated", "a", "b", "c"] as const

const Generated = ({ ownerId, rootId }: { ownerId: string; rootId: string }) => {
  const id = useId()
  const context = useContext(Context)
  return (
    <NativeCollectionMetadataNode
      ownerId={ownerId}
      rootId={rootId}
      descriptorId={`generated:${id}`}
      descriptorRevision={`generated:${context}`}
    />
  )
}

const Opaque = ({
  ownerId,
  rootId,
  controls,
  controller,
  record,
}: {
  ownerId: string
  rootId: string
  controls: TControls
  controller: { current: TController | null }
  record: (value: TRecord) => void
}) => {
  const [localOrder, setLocalOrder] = useState<readonly string[] | null>(null)
  const context = useContext(Context)
  useLayoutEffect(() => {
    const current = { order: setLocalOrder }
    controller.current = current
    record({ kind: "author-mount", ownerId, rootId })
    return () => {
      if (controller.current === current) controller.current = null
      record({ kind: "author-retire", ownerId, rootId })
    }
  }, [controller, ownerId, rootId, record])
  return (
    <>
      {(localOrder ?? controls.order).map((key) =>
        key === "generated" ? (
          <Generated key={key} {...{ ownerId, rootId }} />
        ) : (
          <Activity key={key} mode={controls.hidden && key === "b" ? "hidden" : "visible"}>
            <NativeCollectionMetadataNode
              ownerId={ownerId}
              rootId={rootId}
              descriptorId={key}
              descriptorRevision={`${key}:${context}`}
            >
              {key === "a" && (
                <NativeCollectionMetadataNode
                  ownerId={ownerId}
                  rootId={rootId}
                  descriptorId="nested"
                  descriptorRevision={`nested:${context}`}
                />
              )}
            </NativeCollectionMetadataNode>
          </Activity>
        ),
      )}
      {controls.duplicate && (
        <NativeCollectionMetadataNode
          ownerId={ownerId}
          rootId={rootId}
          descriptorId="a"
          descriptorRevision="duplicate"
        />
      )}
      {controls.foreign && (
        <NativeCollectionMetadataNode
          ownerId="foreign"
          rootId={rootId}
          descriptorId="foreign"
          descriptorRevision="foreign"
        />
      )}
    </>
  )
}

const Gate = () => {
  const id = useId()
  const [controls, setControls] = useState<TControls>({
    order: INITIAL,
    hidden: false,
    duplicate: false,
    foreign: false,
  })
  const [context, setContext] = useState("first")
  const [generation, setGeneration] = useState(0)
  const [modal, setModal] = useState(false)
  const [request, setRequest] = useState("")
  const controller = useRef<TController | null>(null)
  const phase = useRef<TPhase>("initial")
  const pending = useRef(false)
  const stopped = useRef(false)
  const modalShown = useRef(false)
  const awaitingModalShow = useRef(false)
  const rows = useRef<string[]>([])
  const journalClosed = useRef(false)
  const previous = useRef<NativeCollectionCommitData | null>(null)
  const packet = useRef<NativeCollectionCommitData | null>(null)
  const tokens = useRef(new WeakMap<object, number>())
  const eventSequence = useRef(0)
  const next = useRef<() => void>(() => {})
  const record = useCallback((value: TRecord) => {
    if (journalClosed.current) return
    const line = `CUI_COLLECTION_GATE ${JSON.stringify({ probe: PROBE, sequence: rows.current.length + 1, observedAt: Date.now(), ...value })}`
    rows.current.push(line)
    const parts = Math.ceil(line.length / 768)
    for (let part = 0; part < parts; part++) {
      console.warn(
        `CUI_COLLECTION_GATE_CHUNK ${JSON.stringify({ probe: PROBE, recordSequence: rows.current.length, part, parts, content: line.slice(part * 768, (part + 1) * 768) })}`,
      )
    }
  }, [])
  const token = (event: object) => {
    let value = tokens.current.get(event)
    if (value === undefined) {
      value = ++eventSequence.current
      tokens.current.set(event, value)
    }
    return value
  }
  const persist = useCallback(
    async (outcome: string) => {
      record({ kind: "terminal", outcome, phase: phase.current })
      journalClosed.current = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("No native cache directory")
      await fs.writeAsStringAsync(
        `${fs.cacheDirectory.replace(/\/?$/, "/")}${PROBE}.jsonl`,
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
      record({ kind: "failure", phase: phase.current, error: String(error) })
      void persist("failed").catch((reason: unknown) => console.warn(`CUI_COLLECTION_GATE_PERSIST ${String(reason)}`))
    },
    [persist, record],
  )
  useInsertionEffect(() => {
    record({
      kind: "begin",
      sourceProducer: SOURCE_PRODUCER,
      fontScale: PixelRatio.getFontScale(),
      pixelRatio: PixelRatio.get(),
      input: "authoring changes use React state; native callbacks are never invoked by this fixture",
    })
  }, [record])
  useEffect(() => {
    const timeout = setTimeout(() => fail("native-metadata-gate-timeout"), 45000)
    return () => clearTimeout(timeout)
  }, [fail])
  next.current = () => {
    const index = PHASES.indexOf(phase.current)
    const following = PHASES[index + 1]
    pending.current = false
    previous.current = packet.current
    if (!following) {
      if (!modalShown.current) {
        awaitingModalShow.current = true
        return
      }
      stopped.current = true
      void persist("native-records-complete").catch(fail)
      return
    }
    phase.current = following
    record({ kind: "authoring-command", phase: following })
    if (following === "parent-reorder") setControls((value) => ({ ...value, order: ["b", "generated", "c", "a"] }))
    else if (following === "local-reorder") controller.current?.order(["c", "a", "b", "generated"])
    else if (following === "hidden") setControls((value) => ({ ...value, hidden: true }))
    else if (following === "restored") setControls((value) => ({ ...value, hidden: false }))
    else if (following === "context") setContext("second")
    else if (following === "duplicate") setControls((value) => ({ ...value, duplicate: true }))
    else if (following === "duplicate-recovered") setControls((value) => ({ ...value, duplicate: false }))
    else if (following === "owner-mismatch") setControls((value) => ({ ...value, foreign: true }))
    else if (following === "owner-recovered") setControls((value) => ({ ...value, foreign: false }))
    else if (following === "empty") controller.current?.order([])
    else if (following === "reinserted") controller.current?.order(INITIAL)
    else if (following === "remounted") {
      setRequest("")
      setControls({ order: INITIAL, hidden: false, duplicate: false, foreign: false })
      setGeneration((value) => value + 1)
    } else if (following === "modal") {
      setRequest("")
      setContext("first")
      setGeneration((value) => value + 1)
      setModal(true)
    }
  }
  const onCommit = (event: NativeSyntheticEvent<NativeCollectionCommitData>) => {
    event.persist()
    record({ kind: "native-commit", phase: phase.current, eventToken: token(event), actual: event.nativeEvent })
    if (stopped.current || pending.current) return
    try {
      if (!matches(phase.current, event.nativeEvent)) return
      pending.current = true
      packet.current = event.nativeEvent
      // The native query itself validates every identity and the exact current native sequence.
      setRequest(inspectionRequest(event.nativeEvent, `${phase.current}:current`))
    } catch (error) {
      fail(error)
    }
  }
  const onInspection = (event: NativeSyntheticEvent<NativeCollectionInspectionData>) => {
    event.persist()
    record({ kind: "native-inspection", phase: phase.current, eventToken: token(event), actual: event.nativeEvent })
    if (stopped.current) return
    const actual = event.nativeEvent
    const invalidCollection = phase.current === "duplicate" || phase.current === "owner-mismatch"
    if (actual.requestId === `${phase.current}:current`) {
      if (actual.accepted === invalidCollection) {
        fail("Unexpected native inspection admission")
        return
      }
      if (
        !invalidCollection &&
        previous.current &&
        packet.current &&
        inspectionRequest(previous.current, "compare") !== inspectionRequest(packet.current, "compare")
      ) {
        setRequest(inspectionRequest(previous.current, `${phase.current}:stale`))
        return
      }
    } else if (actual.requestId === `${phase.current}:stale`) {
      if (actual.accepted) {
        fail("Stale native inspection was admitted")
        return
      }
    } else return
    setTimeout(() => next.current(), 0)
  }
  const ownerId = `collection-gate:${id}:${generation}`
  const rootId = `collection-gate-root:${id}:${generation}`
  const tree = (
    <NativeCollectionMetadataRoot
      key={generation}
      ownerId={ownerId}
      rootId={rootId}
      rootRevision={`root:${generation}`}
      inspectionRequest={request}
      onNativeCollectionCommit={onCommit}
      onNativeCollectionInspection={onInspection}
    >
      <Context value={context}>
        <Opaque {...{ ownerId, rootId, controls, controller, record }} />
      </Context>
    </NativeCollectionMetadataRoot>
  )
  return (
    <View style={{ flex: 1, backgroundColor: "white", padding: 24 }}>
      <Text>Native collection metadata gate</Text>
      <Text>Original native callbacks are recorded. This screen contains no editor.</Text>
      <Button onPress={(event) => record({ kind: "witness-press", actual: event.nativeEvent })}>Visible witness</Button>
      {modal ? (
        <Modal
          visible
          onShow={() => {
            modalShown.current = true
            record({ kind: "native-modal-show" })
            if (awaitingModalShow.current) next.current()
          }}
          onRequestClose={() => {}}
        >
          <View style={{ flex: 1, backgroundColor: "white", padding: 24 }}>
            <Text>Native modal metadata gate</Text>
            {tree}
          </View>
        </Modal>
      ) : (
        tree
      )}
    </View>
  )
}

export default () => (
  <NativeThemeProvider>
    <Gate />
  </NativeThemeProvider>
)
