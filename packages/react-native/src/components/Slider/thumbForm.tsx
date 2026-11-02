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

import { NativeFormRegistryContext, NativeFormOwnerContext } from "../../form/context"
import { NativeFormMountReceipt } from "../../form/mount"
import { NativeFieldMetadata } from "../../form/NativeFormMetadata"
import type { TNativeFormFieldData } from "../../form/registry"
import { getNativeFocusedTarget } from "../../input/focus"
import type { NativeFormCommitData } from "../../input/specs/CUIFormRootNativeComponent"
import { DEFAULT_VALIDATION_RESULT } from "../ComboBox/state/useFormValidationState"

import type { TNativeSliderState } from "./types"

type TOriginalThumb = Readonly<{ thumb: View; target: number; root: View; rootTarget: number }>
type TMetadata = Readonly<{ node: View; target: number }>
type TProps = Readonly<{
  index: number
  formFieldId?: string
  form?: string
  name?: string
  state: TNativeSliderState
  root: { current: View | null }
  thumbs: { current: Map<number, View> }
}>
const tag = (view: View | null) => {
  const value = view && findNodeHandle(view)
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : 0
}
let revision = 0

export const NativeSliderThumbForm = ({ index, name, formFieldId, form, state, root, thumbs }: TProps) => {
  const registry = useContext(NativeFormRegistryContext)
  const formOwnerId = useContext(NativeFormOwnerContext)
  const ownerId = useId()
  const descriptorId = `${ownerId}:range-thumb`
  const [original, setOriginal] = useState<TOriginalThumb | null>(null)
  const metadata = useRef<View | null>(null)
  const [metadataMount, setMetadataMount] = useState<TMetadata | null>(null)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const active = useRef(false)
  const data: TNativeFormFieldData = {
    entries: name ? [[name, String(state.getThumbValue(index))]] : [],
    isDisabled: !state.isThumbEditable(index),
    isReadOnly: false,
    validationBehavior: "native",
    validation: DEFAULT_VALIDATION_RESULT,
  }
  const ownedControlBinding = original ? JSON.stringify({ kind: "range-thumb", rootTarget: original.rootTarget }) : ""
  const signature = JSON.stringify([
    index,
    form,
    formFieldId,
    formOwnerId,
    data,
    state.defaultValues[index],
    ownedControlBinding,
    original?.target,
  ])
  const descriptorRevision = useMemo(
    () => `${ownerId}:range-thumb:${++revision}`,
    [ownerId, signature, original?.root, original?.thumb, metadataMount?.node],
  )
  const current = useRef({ state, index, original, metadataMount, descriptorRevision, root, thumbs })
  useInsertionEffect(() => {
    current.current = { state, index, original, metadataMount, descriptorRevision, root, thumbs }
  })
  const currentThumb = useCallback(() => {
    const owner = current.current
    const expected = owner.original
    return expected &&
      owner.index < owner.state.values.length &&
      owner.root.current === expected.root &&
      owner.thumbs.current.get(owner.index) === expected.thumb
      ? expected.thumb
      : null
  }, [])
  useLayoutEffect(() => {
    const thumb = thumbs.current.get(index) ?? null
    const owner = root.current
    const target = tag(thumb),
      rootTarget = tag(owner)
    if (!thumb || !owner || !target || !rootTarget) return
    setOriginal((previous) =>
      previous?.thumb === thumb &&
      previous.root === owner &&
      previous.target === target &&
      previous.rootTarget === rootTarget
        ? previous
        : { thumb, target, root: owner, rootTarget },
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
        thumb = currentThumb(),
        host = metadata.current
      if (
        !host ||
        !thumb ||
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
          original: thumb,
          current: () => ({ metadata: metadata.current, original: currentThumb() }),
        })
      receipt.current!.receive(packet)
    },
    [ownerId, descriptorId, currentThumb],
  )
  useInsertionEffect(() => {
    if (!original || !metadataMount) return
    let retained = true
    const currentOriginal = () => (retained && metadata.current === metadataMount.node ? currentThumb() : null)
    const release = registry.commitField({
      descriptor: {
        ownerId,
        descriptorId,
        descriptorRevision,
        metadataTarget: metadataMount.target,
        target: original.target,
        formId: form ?? "",
        hasFormAssociation: form !== undefined,
        ownedControlBinding,
      },
      fieldId: formFieldId,
      fieldIndex: index,
      formOwnerId,
      data,
      editor: currentOriginal,
      mount: () => (retained ? receipt.current : null),
      isFocusObserved: () => !!currentOriginal() && getNativeFocusedTarget() === currentOriginal(),
      commitValidation: () => undefined,
      reset: () => {
        if (!retained || !active.current || !currentOriginal()) return
        const owner = current.current
        const initialValue = owner.state.defaultValues[owner.index]
        if (initialValue === undefined) return
        owner.state.setThumbValue(owner.index, initialValue)
      },
    })
    return () => {
      retained = false
      release()
      receipt.current?.retire()
      receipt.current = null
    }
  }, [registry, ownerId, descriptorId, descriptorRevision, original, metadataMount, ownedControlBinding, currentThumb])
  return (
    <NativeFieldMetadata
      metadataRef={bindMetadata}
      ownerId={ownerId}
      descriptorId={descriptorId}
      descriptorRevision={descriptorRevision}
      editorTarget={original?.target ?? 0}
      hasFormAssociation={form !== undefined}
      formId={form ?? ""}
      ownedControlBinding={ownedControlBinding}
      onNativeFormCommit={(event) => receive(event.nativeEvent)}
    />
  )
}
