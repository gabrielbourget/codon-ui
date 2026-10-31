import { Activity, createContext, useContext, useId, useLayoutEffect, useRef, useState } from "react"
import { Button, Text, View, type NativeSyntheticEvent } from "react-native"

import {
  NativeCollectionMetadataNode,
  NativeCollectionMetadataRoot,
} from "../../../../packages/react-native/src/collection/NativeCollectionMetadata"
import type { NativeCollectionCommitData } from "../../../../packages/react-native/src/input/specs/CUICollectionRootNativeComponent"

type TLocalController = { rotate: () => void }
type TAuthoringProps = {
  ownerId: string
  rootId: string
  order: readonly string[]
  controller: { current: TLocalController | null }
  hidden: boolean
  duplicate: boolean
}
const DescriptorContext = createContext("first")

const OpaqueAuthoring = ({ ownerId, rootId, order, controller, hidden, duplicate }: TAuthoringProps) => {
  const [localOrder, setLocalOrder] = useState<readonly string[] | null>(null)
  const context = useContext(DescriptorContext)
  useLayoutEffect(() => {
    const current = { rotate: () => setLocalOrder((value) => [...(value ?? order).slice(1), (value ?? order)[0]]) }
    controller.current = current
    return () => {
      if (controller.current === current) controller.current = null
    }
  }, [controller, order])
  return (
    <>
      {(localOrder ?? order).map((id) => (
        <Activity key={id} mode={hidden && id === "b" ? "hidden" : "visible"}>
          <NativeCollectionMetadataNode
            ownerId={ownerId}
            rootId={rootId}
            descriptorId={id}
            descriptorRevision={`${id}:${context}`}
          >
            {id === "a" && (
              <NativeCollectionMetadataNode
                ownerId={ownerId}
                rootId={rootId}
                descriptorId="nested"
                descriptorRevision={`nested:${context}`}
              />
            )}
          </NativeCollectionMetadataNode>
        </Activity>
      ))}
      {duplicate && (
        <NativeCollectionMetadataNode
          ownerId={ownerId}
          rootId={rootId}
          descriptorId="a"
          descriptorRevision="duplicate"
        />
      )}
    </>
  )
}

// Native callbacks are forwarded unchanged. This scene does not synthesize a receipt or declare native acceptance.
export const NativeCollectionMetadataProbeScene = ({
  onCommit,
}: {
  onCommit: (event: NativeSyntheticEvent<NativeCollectionCommitData>) => void
}) => {
  const id = useId()
  const ownerId = `metadata-probe:${id}`
  const rootId = `metadata-root:${id}`
  const controller = useRef<TLocalController | null>(null)
  const [order, setOrder] = useState<readonly string[]>(["a", "b", "c"])
  const [hidden, setHidden] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [context, setContext] = useState("first")
  return (
    <View>
      <Text>Native committed metadata probe</Text>
      <Text>Visible buttons remain independent of the zero-sized metadata subtree.</Text>
      <Button title="Parent reorder" onPress={() => setOrder((value) => [...value.slice(1), value[0]])} />
      <Button title="Opaque local reorder" onPress={() => controller.current?.rotate()} />
      <Button title="Toggle hidden member" onPress={() => setHidden((value) => !value)} />
      <Button
        title="Replace ancestor context"
        onPress={() => setContext((value) => (value === "first" ? "second" : "first"))}
      />
      <Button title="Toggle duplicate rejection" onPress={() => setDuplicate((value) => !value)} />
      <Button title="Toggle root lifetime" onPress={() => setMounted((value) => !value)} />
      {mounted && (
        <DescriptorContext value={context}>
          <NativeCollectionMetadataRoot
            ownerId={ownerId}
            rootId={rootId}
            rootRevision="probe:1"
            onNativeCollectionCommit={onCommit}
          >
            <OpaqueAuthoring {...{ ownerId, rootId, order, controller, hidden, duplicate }} />
          </NativeCollectionMetadataRoot>
        </DescriptorContext>
      )}
    </View>
  )
}
