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
  type RefObject,
} from "react"
import { findNodeHandle, type View } from "react-native"

import { getNativeFocusedTarget } from "../input/focus"
import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"

import { NativeFormRegistryContext, NativeFormOwnerContext } from "./context"
import { NativeFormMountReceipt } from "./mount"
import { NativeFieldMetadata } from "./NativeFormMetadata"
import { NativeFieldSemanticSession } from "./semanticSession"
import {
  nativeSimpleComboBoxFieldData,
  type TNativeSimpleComboBoxFieldOptions,
  type TNativeSimpleComboBoxFormState,
} from "./simpleComboBox"

type TOriginal = Readonly<{ trigger: View; target: number; root: View; rootTarget: number }>
type TMetadata = Readonly<{ node: View; target: number }>
const tag = (view: View | null) => {
  const value = view && findNodeHandle(view)
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : 0
}
let nextRevision = 0

export const useNativeSimpleComboBoxField = (
  props: TNativeSimpleComboBoxFieldOptions,
  state: TNativeSimpleComboBoxFormState,
  root: RefObject<View | null>,
  trigger: RefObject<View | null>,
  semanticBinding: string,
) => {
  const registry = useContext(NativeFormRegistryContext)
  const formOwnerId = useContext(NativeFormOwnerContext)
  const participating =
    formOwnerId !== null || props.form !== undefined || props.formFieldId !== undefined || props.name !== undefined
  const ownerId = useId()
  const descriptorId = `${ownerId}:combobox-trigger`
  const [original, setOriginal] = useState<TOriginal | null>(null)
  const metadata = useRef<View | null>(null)
  const [metadataMount, setMetadataMount] = useState<TMetadata | null>(null)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const semantics = useRef<NativeFieldSemanticSession | null>(null)
  const active = useRef(false)
  const data = nativeSimpleComboBoxFieldData(props, state)
  const ownedControlBinding = original
    ? JSON.stringify({ kind: "combo-box-trigger", rootTarget: original.rootTarget })
    : ""
  const signature = JSON.stringify([
    data,
    props.form,
    props.formFieldId,
    formOwnerId,
    original?.target,
    ownedControlBinding,
  ])
  const descriptorRevision = useMemo(
    () => `${ownerId}:combobox-trigger:${++nextRevision}`,
    [ownerId, signature, original?.root, original?.trigger, metadataMount?.node],
  )
  const current = useRef({ state, original, metadataMount, descriptorRevision, root, trigger, semanticBinding })
  useInsertionEffect(() => {
    current.current = { state, original, metadataMount, descriptorRevision, root, trigger, semanticBinding }
  })
  const currentTrigger = useCallback(() => {
    const owner = current.current,
      expected = owner.original
    return expected && owner.root.current === expected.root && owner.trigger.current === expected.trigger
      ? expected.trigger
      : null
  }, [])
  useLayoutEffect(() => {
    if (!participating) return
    const control = trigger.current,
      owner = root.current,
      target = tag(control),
      rootTarget = tag(owner)
    if (!control || !owner || !target || !rootTarget) return
    setOriginal((previous) =>
      previous?.trigger === control &&
      previous.root === owner &&
      previous.target === target &&
      previous.rootTarget === rootTarget
        ? previous
        : { trigger: control, target, root: owner, rootTarget },
    )
  })
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const bindMetadata = useCallback((node: View | null) => {
    if (metadata.current !== node) {
      semantics.current?.retire()
      semantics.current = null
      receipt.current?.retire()
      receipt.current = null
    }
    metadata.current = node
    const target = tag(node)
    if (node && target)
      setMetadataMount((previous) =>
        previous?.node === node && previous.target === target ? previous : { node, target },
      )
  }, [])
  const receive = useCallback(
    (packet: NativeFormCommitData) => {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) return
      const owner = current.current,
        control = currentTrigger(),
        host = metadata.current
      if (
        !host ||
        !control ||
        host !== owner.metadataMount?.node ||
        packet.ownerId !== ownerId ||
        packet.descriptorId !== descriptorId ||
        packet.descriptorRevision !== owner.descriptorRevision ||
        packet.target !== owner.metadataMount.target ||
        packet.originalTarget !== owner.original?.target
      )
        return
      const previous = receipt.current
      if (previous && previous.scope.descriptorRevision !== owner.descriptorRevision) previous.retire()
      if (!previous || previous.isRetired || previous.scope.descriptorRevision !== owner.descriptorRevision)
        receipt.current = new NativeFormMountReceipt(packet, {
          metadata: host,
          original: control,
          current: () => ({ metadata: metadata.current, original: currentTrigger() }),
        })
      if (!receipt.current!.receive(packet)) return
      if (semantics.current?.receipt !== receipt.current) {
        semantics.current?.retire()
        semantics.current = new NativeFieldSemanticSession(receipt.current!)
      }
      semantics.current.observe(owner.semanticBinding)
      return true
    },
    [ownerId, descriptorId, currentTrigger],
  )
  useInsertionEffect(() => {
    if (!participating || !original || !metadataMount) return
    let retained = true
    const currentOriginal = () => (retained && metadata.current === metadataMount.node ? currentTrigger() : null)
    const release = registry.commitField({
      descriptor: {
        ownerId,
        descriptorId,
        descriptorRevision,
        metadataTarget: metadataMount.target,
        target: original.target,
        formId: props.form ?? "",
        hasFormAssociation: props.form !== undefined,
        ownedControlBinding,
      },
      fieldId: props.formFieldId,
      formOwnerId,
      data,
      editor: currentOriginal,
      mount: () => (retained && currentOriginal() ? receipt.current : null),
      isFocusObserved: () => !!currentOriginal() && getNativeFocusedTarget() === currentOriginal(),
      commitValidation: () => {
        if (retained && active.current && currentOriginal() && !current.current.state.displayValidation.isInvalid)
          current.current.state.commitValidation()
      },
      reset: (origin) => {
        if (!retained || !active.current || !currentOriginal()) return
        current.current.state.resetInput()
        if (!retained || !active.current || !currentOriginal()) return
        if (origin === "native") current.current.state.resetValidation()
        if (retained && active.current && currentOriginal()) current.current.state.resetKey()
      },
    })
    return () => {
      retained = false
      release()
      semantics.current?.retire()
      semantics.current = null
      receipt.current?.retire()
      receipt.current = null
    }
  }, [
    registry,
    participating,
    ownerId,
    descriptorId,
    descriptorRevision,
    original,
    metadataMount,
    ownedControlBinding,
    currentTrigger,
  ])
  return {
    participating,
    metadata: participating ? (
      <NativeFieldMetadata
        metadataRef={bindMetadata}
        ownerId={ownerId}
        descriptorId={descriptorId}
        descriptorRevision={descriptorRevision}
        editorTarget={original?.target ?? 0}
        hasFormAssociation={props.form !== undefined}
        formId={props.form ?? ""}
        ownedControlBinding={ownedControlBinding}
        semanticBinding={semanticBinding}
        onNativeFormCommit={(event) => {
          receive(event.nativeEvent)
        }}
      />
    ) : null,
  }
}
