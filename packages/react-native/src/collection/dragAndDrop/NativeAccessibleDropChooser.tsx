import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import { AppState } from "react-native"
import type { View } from "react-native"

import { Button } from "../../components/Button/Button"
import { Modal } from "../../components/Modal/Modal"
import { Text } from "../../components/Text/Text"
import {
  OverlayParentContext,
  OverlayRegistryContext,
  NativeOverlayProvider,
} from "../../overlays/NativeOverlayProvider"
import { NativeCollectionItemBindingContext } from "../binding"
import { NativeCollectionSemanticsContext } from "../semantics"

import type { NativeCollectionDragBinding } from "./NativeCollectionDragBinding"
import { nativeVirtualDrag } from "./virtualDrag"
import type { TNativeAccessibleDropRequest } from "./virtualDrag"

const Chooser = ({ binding }: { binding: NativeCollectionDragBinding }) => {
  const revision = useSyncExternalStore(
    nativeVirtualDrag.subscribe,
    nativeVirtualDrag.snapshot,
    nativeVirtualDrag.snapshot,
  )
  const registry = useContext(OverlayRegistryContext)!
  const parent = useContext(OverlayParentContext)
  const overlayRevision = useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot)
  const pending = nativeVirtualDrag.pendingRequest()
  const current = pending?.source === binding ? pending : null
  const last = useRef<TNativeAccessibleDropRequest | null>(null)
  const restore = useRef<View | null>(null)
  const heading = useRef<View | null>(null)
  useLayoutEffect(() => {
    if (current) last.current = current
  }, [current])
  const displayed = current ?? last.current
  const requestId = current?.id
  const cancel = useCallback(() => {
    const pending = nativeVirtualDrag.pendingRequest()
    if (pending?.source === binding && pending.id === requestId)
      void nativeVirtualDrag.cancel().catch((error) => binding.fail(error))
  }, [binding, requestId])
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel()
    })
    return () => listener.remove()
  }, [cancel])
  useLayoutEffect(() => {
    if (current?.phase === "closing" && registry.canRestore(parent)) nativeVirtualDrag.dismissed(current.id)
  }, [current, revision, overlayRevision, registry, parent])
  useLayoutEffect(
    () => () => {
      if (nativeVirtualDrag.pendingRequest()?.source === binding)
        void nativeVirtualDrag.cancel().catch((error) => binding.fail(error))
    },
    [binding],
  )
  if (!displayed) return null
  const formatter = displayed.formatter
  restore.current =
    !current && displayed.outcome === "cancel" && displayed.sourceCurrent() ? displayed.sourceView : null
  return (
    <NativeCollectionItemBindingContext.Provider value="">
      <NativeCollectionSemanticsContext.Provider value="">
        <Modal
          testID="native-drop-chooser"
          accessibilityLabel={formatter.format("chooseDropTarget")}
          isOpen={current?.phase === "choosing"}
          onOpenChange={(open) => {
            if (!open) cancel()
          }}
          restoreFocusRef={restore}
          initialFocusRef={heading}
          isDismissable
        >
          <Text ref={heading} elementType="h2" fontWeight="bold">
            {formatter.format("chooseDropTarget")}
          </Text>
          {displayed.choices.map((choice) => (
            <Button
              key={choice.id}
              accessibilityState={{ selected: displayed.selected?.id === choice.id }}
              onPress={() => nativeVirtualDrag.choose(choice.root, choice.target, displayed.id)}
            >
              {choice.label}
            </Button>
          ))}
          <Button
            isDisabled={!displayed.selected}
            onPress={() => {
              void nativeVirtualDrag.drop(displayed.id).catch((error) => binding.fail(error))
            }}
          >
            {formatter.format("confirmDrop")}
          </Button>
          <Button onPress={cancel}>{formatter.format("cancelDrop")}</Button>
        </Modal>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}

export const NativeAccessibleDropChooser = ({ binding }: { binding: NativeCollectionDragBinding }) => {
  const registry = useContext(OverlayRegistryContext)
  return registry ? (
    <Chooser binding={binding} />
  ) : (
    <NativeOverlayProvider>
      <Chooser binding={binding} />
    </NativeOverlayProvider>
  )
}
