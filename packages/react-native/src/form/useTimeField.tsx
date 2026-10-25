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
import { findNodeHandle, type View } from "react-native"

import type { TimeFieldState } from "../date/state/useTimeFieldState"
import type { TNativeFieldInputMetadata } from "../input/fieldInputBinding"
import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"

import { NativeFormRegistryContext } from "./context"
import {
  encodeNativeDateFieldBinding,
  sameNativeDateFieldTargets,
  type TNativeDateSegmentFormTarget,
} from "./dateSegments"
import { NativeFormMountReceipt } from "./mount"
import { NativeFieldMetadata } from "./NativeFormMetadata"
import { NativeFieldSemanticSession } from "./semanticSession"
import { nativeTimeFieldData, type TNativeTimeFieldFormOptions } from "./timeField"

type TOriginalDateField = Readonly<{
  root: View
  rootTarget: number
  segments: readonly TNativeDateSegmentFormTarget[]
}>
let nextRevision = 0

// The registry contains one logical field. Physical authority requires the
// current root and the complete ordered set of original segment objects.
export const useNativeTimeFieldForm = (
  props: TNativeTimeFieldFormOptions,
  state: TimeFieldState,
  original: TOriginalDateField | null,
  currentOriginal: () => TOriginalDateField | null,
  isFocusObserved: () => boolean,
  semanticBinding = "",
  fieldInput?: TNativeFieldInputMetadata,
) => {
  const registry = useContext(NativeFormRegistryContext)
  const ownerId = useId()
  const descriptorId = `${ownerId}:time-field`
  const data = nativeTimeFieldData(props, state)
  const ownedEditorBinding = original ? encodeNativeDateFieldBinding(original.rootTarget, original.segments) : ""
  const signature = JSON.stringify([data, props.form, ownedEditorBinding])
  const descriptorRevision = useMemo(
    () => `${ownerId}:time-field:${++nextRevision}`,
    [ownerId, signature, original?.root],
  )
  const metadata = useRef<View | null>(null)
  const [metadataTarget, setMetadataTarget] = useState(0)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const semantics = useRef<NativeFieldSemanticSession | null>(null)
  const current = useRef({
    state,
    original,
    currentOriginal,
    isFocusObserved,
    descriptorRevision,
    metadataTarget,
    semanticBinding,
  })
  const resetActive = useRef(false)
  useInsertionEffect(() => {
    current.current = {
      state,
      original,
      currentOriginal,
      isFocusObserved,
      descriptorRevision,
      metadataTarget,
      semanticBinding,
    }
  })
  const currentPrimary = useCallback(() => {
    const expected = current.current.original,
      actual = current.current.currentOriginal()
    return expected &&
      actual &&
      expected.root === actual.root &&
      expected.rootTarget === actual.rootTarget &&
      sameNativeDateFieldTargets(expected.segments, actual.segments)
      ? actual.segments[0].original
      : null
  }, [])
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
      semantics.current?.retire()
      semantics.current = null
      receipt.current?.retire()
      receipt.current = null
    }
    metadata.current = view
    if (view) setMetadataTarget(findNodeHandle(view) ?? 0)
  }, [])
  const receive = useCallback(
    (packet: NativeFormCommitData) => {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) return false
      const owner = current.current,
        primary = currentPrimary(),
        host = metadata.current
      if (
        !host ||
        !primary ||
        packet.ownerId !== ownerId ||
        packet.descriptorId !== descriptorId ||
        packet.descriptorRevision !== owner.descriptorRevision ||
        packet.target !== owner.metadataTarget ||
        packet.originalTarget !== owner.original?.segments[0].identity.target ||
        (packet.complete &&
          (packet.surfaceId !== owner.original.segments[0].identity.surfaceId ||
            packet.windowId !== owner.original.segments[0].identity.windowId))
      )
        return false
      const previous = receipt.current
      if (previous && previous.scope.descriptorRevision !== owner.descriptorRevision) previous.retire()
      if (!previous || previous.isRetired || previous.scope.descriptorRevision !== owner.descriptorRevision)
        receipt.current = new NativeFormMountReceipt(packet, {
          metadata: host,
          original: primary,
          current: () => ({ metadata: metadata.current, original: currentPrimary() }),
        })
      if (!receipt.current!.receive(packet)) return false
      if (semantics.current?.receipt !== receipt.current) {
        semantics.current?.retire()
        semantics.current = new NativeFieldSemanticSession(receipt.current!)
      }
      semantics.current.observe(owner.semanticBinding)
      return true
    },
    [ownerId, descriptorId, currentPrimary],
  )
  useInsertionEffect(() => {
    if (!original || !metadataTarget) return
    const release = registry.commitField({
      descriptor: {
        ownerId,
        descriptorId,
        descriptorRevision,
        metadataTarget,
        target: original.segments[0].identity.target,
        formId: props.form ?? "",
        hasFormAssociation: props.form !== undefined,
        ownedEditorBinding,
      },
      data,
      editor: currentPrimary,
      mount: () => receipt.current,
      isFocusObserved: () => !!currentPrimary() && current.current.isFocusObserved(),
      commitValidation: () => {
        const state = current.current.state
        if (resetActive.current && !state.displayValidation.isInvalid) state.commitValidation()
      },
      reset: (origin) => {
        if (!resetActive.current) return
        current.current.state.setValue(current.current.state.defaultValue)
        if (resetActive.current && origin === "native") current.current.state.resetValidation()
      },
    })
    return () => {
      release()
      semantics.current?.retire()
      semantics.current = null
      receipt.current?.retire()
      receipt.current = null
    }
    // Revision includes the entire logical value and original segment frame.
  }, [registry, ownerId, descriptorId, descriptorRevision, metadataTarget, ownedEditorBinding, currentPrimary])
  return (
    <NativeFieldMetadata
      metadataRef={bindMetadata}
      ownerId={ownerId}
      descriptorId={descriptorId}
      descriptorRevision={descriptorRevision}
      editorTarget={original?.segments[0].identity.target ?? 0}
      hasFormAssociation={props.form !== undefined}
      formId={props.form ?? ""}
      ownedEditorBinding={ownedEditorBinding}
      semanticBinding={semanticBinding}
      fieldGroupBinding={fieldInput?.binding(ownerId)}
      onNativeFieldInputRecord={fieldInput?.record}
      onNativeFormCommit={(event) => {
        if (receive(event.nativeEvent)) fieldInput?.commit(receipt.current?.getSnapshot() ?? event.nativeEvent)
      }}
    />
  )
}
