import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { findNodeHandle, View } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps } from "../collection/context"
import { FormValidationContext } from "../components/ComboBox/state/useFormValidationState"

import { NativeFormBehaviorContext, NativeFormContext, NativeFormRegistryContext } from "./context"
import { NativeFormMetadata } from "./NativeFormMetadata"
import { nativeFormRevision } from "./registry"
import type { TNativeFormProps } from "./types"

const EMPTY_ERRORS = {}

export const NativeForm = forwardRef<View, TNativeFormProps>((received, forwardedRef) => {
  const [props, contextRef] = useNativeContextProps(received, forwardedRef, NativeFormContext)
  const {
    children,
    id,
    nativeID,
    slot: _slot,
    validationBehavior = "native",
    validationErrors = EMPTY_ERRORS,
    onSubmit: _onSubmit,
    onReset: _onReset,
    ...viewProps
  } = props
  const registry = useContext(NativeFormRegistryContext)
  const fieldRevision = useSyncExternalStore(registry.subscribe, registry.getRevision, registry.getRevision)
  const ownerId = useId()
  const descriptorId = `${ownerId}:form`
  const original = useRef<View | null>(null)
  const metadata = useRef<View | null>(null)
  const [committedOriginal, setCommittedOriginal] = useState<Readonly<{ view: View; target: number }> | null>(null)
  const [metadataTarget, setMetadataTarget] = useState(0)
  const current = useRef(props)
  useInsertionEffect(() => {
    current.current = props
  })
  const bindOriginal = useCallback((view: View | null) => {
    original.current = view
    if (view) {
      const target = findNodeHandle(view) ?? 0
      setCommittedOriginal((previous) =>
        previous?.view === view && previous.target === target ? previous : { view, target },
      )
    }
  }, [])
  const bindMetadata = useCallback((view: View | null) => {
    metadata.current = view
    if (view) setMetadataTarget(findNodeHandle(view) ?? 0)
  }, [])
  const ref = useNativeCollectionRefs(contextRef, bindOriginal)
  const target = committedOriginal?.target ?? 0
  const descriptorRevision = nativeFormRevision(ownerId, target, fieldRevision)
  useInsertionEffect(() => {
    const view = committedOriginal?.view
    if (!view || !target || !metadataTarget) return
    return registry.commitForm({
      descriptor: { ownerId, descriptorId, descriptorRevision, target, metadataTarget, formId: id ?? "" },
      fieldRevision,
      original: view,
      current: () => original.current,
      props: () => current.current,
    })
  }, [
    registry,
    ownerId,
    descriptorId,
    descriptorRevision,
    target,
    metadataTarget,
    id,
    fieldRevision,
    committedOriginal,
  ])
  return (
    <FormValidationContext.Provider value={validationErrors}>
      <NativeFormBehaviorContext.Provider value={validationBehavior}>
        <View {...viewProps} ref={ref} nativeID={nativeID ?? id} collapsable={false}>
          <NativeFormMetadata
            metadataRef={bindMetadata}
            ownerId={ownerId}
            descriptorId={descriptorId}
            descriptorRevision={descriptorRevision}
            formTarget={target}
            formId={id ?? ""}
          />
          {children}
        </View>
      </NativeFormBehaviorContext.Provider>
    </FormValidationContext.Provider>
  )
})
NativeForm.displayName = "NativeForm"
