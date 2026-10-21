import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

import type { ComboBoxState } from "../components/ComboBox/state/types"
import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"

import { nativeComboBoxFieldData, type TNativeComboBoxFieldOptions } from "./comboBox"
import { NativeFormRegistryContext } from "./context"
import { NativeFormMountReceipt } from "./mount"
import { NativeFieldMetadata } from "./NativeFormMetadata"

let nextRevision = 0

export const useNativeComboBoxField = <T extends object>(
  props: TNativeComboBoxFieldOptions,
  state: ComboBoxState<T>,
  original: Readonly<{ editor: TextInput; target: number }> | null,
  currentEditor: () => TextInput | null,
  isFocusObserved: () => boolean,
) => {
  const registry = useContext(NativeFormRegistryContext)
  const ownerId = useId()
  const descriptorId = `${ownerId}:field`
  const data = nativeComboBoxFieldData(props, state)
  const signature = JSON.stringify([data, props.form, original?.target])
  // Allocation is opaque; aborted renders may consume an unused identity but
  // cannot register a field or place business values in native metadata.
  const descriptorRevision = useMemo(() => `${ownerId}:field:${++nextRevision}`, [ownerId, signature])
  const metadata = useRef<View | null>(null)
  const [metadataTarget, setMetadataTarget] = useState(0)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const current = useRef({ state, currentEditor, isFocusObserved, descriptorRevision, original, metadataTarget })
  const resetActive = useRef(false)
  useInsertionEffect(() => {
    current.current = { state, currentEditor, isFocusObserved, descriptorRevision, original, metadataTarget }
  })
  useEffect(() => {
    resetActive.current = true
    return () => {
      resetActive.current = false
    }
  }, [])
  useLayoutEffect(() => {
    if (data.validationBehavior === "native" && !data.isDisabled && !state.realtimeValidation.isInvalid)
      state.updateValidation({ ...data.validation, validationErrors: [...data.validation.validationErrors] })
  })
  const bindMetadata = useCallback((view: View | null) => {
    if (metadata.current !== view) {
      receipt.current?.retire()
      receipt.current = null
    }
    metadata.current = view
    if (view) setMetadataTarget(findNodeHandle(view) ?? 0)
  }, [])
  const receive = useCallback(
    (packet: NativeFormCommitData) => {
      const owner = current.current
      const editor = owner.currentEditor()
      const host = metadata.current
      if (
        !host ||
        !editor ||
        editor !== owner.original?.editor ||
        packet.ownerId !== ownerId ||
        packet.descriptorId !== descriptorId ||
        packet.descriptorRevision !== owner.descriptorRevision ||
        packet.target !== owner.metadataTarget ||
        packet.originalTarget !== owner.original.target
      )
        return
      const previous = receipt.current
      if (previous && previous.scope.descriptorRevision !== owner.descriptorRevision) previous.retire()
      if (!previous || previous.scope.descriptorRevision !== owner.descriptorRevision)
        receipt.current = new NativeFormMountReceipt(packet, {
          metadata: host,
          original: editor,
          current: () => ({ metadata: metadata.current, original: current.current.currentEditor() }),
        })
      receipt.current!.receive(packet)
    },
    [ownerId, descriptorId],
  )
  useInsertionEffect(() => {
    if (!original?.target || !metadataTarget) return
    const release = registry.commitField({
      descriptor: {
        ownerId,
        descriptorId,
        descriptorRevision,
        metadataTarget,
        target: original.target,
        formId: props.form ?? "",
        hasFormAssociation: props.form !== undefined,
      },
      data,
      editor: () => current.current.currentEditor(),
      mount: () => receipt.current,
      isFocusObserved: () => current.current.isFocusObserved(),
      commitValidation: () => {
        const state = current.current.state
        if (resetActive.current && !state.displayValidation.isInvalid) state.commitValidation()
      },
      reset: (origin) => {
        if (!resetActive.current) return
        const state = current.current.state
        state.setInputValue(state.defaultInputValue)
        if (!resetActive.current) return
        if (origin === "native") current.current.state.resetValidation()
        if (resetActive.current) current.current.state.setValue(current.current.state.defaultValue)
      },
    })
    return () => {
      release()
      receipt.current?.retire()
      receipt.current = null
    }
    // The opaque revision represents the complete owned field data snapshot.
    // Callback-only changes are read from current after React commits them.
  }, [registry, ownerId, descriptorId, descriptorRevision, metadataTarget, original])
  return {
    placement: props.allowsCustomValue || props.formValue === "text" ? "input" : "root",
    metadata: (
      <NativeFieldMetadata
        metadataRef={bindMetadata}
        ownerId={ownerId}
        descriptorId={descriptorId}
        descriptorRevision={descriptorRevision}
        editorTarget={original?.target ?? 0}
        hasFormAssociation={props.form !== undefined}
        formId={props.form ?? ""}
        onNativeFormCommit={(event) => receive(event.nativeEvent)}
      />
    ),
  } as const
}
