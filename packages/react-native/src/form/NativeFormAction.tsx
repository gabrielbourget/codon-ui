import { forwardRef, useCallback, useContext, useId, useInsertionEffect, useMemo, useRef, useState } from "react"
import { findNodeHandle, type View } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps } from "../collection/context"
import { NativeButton } from "../components/Button/Button"
import { NativeButtonContext } from "../components/Button/context"
import type { TNativeButtonProps } from "../components/Button/types"
import type { TNativePressEvent } from "../input/types"

import { admitNativeFormAction } from "./actionAdmission"
import { NativeFormActionLease } from "./actionLease"
import { nativeFormControllerFor } from "./actions"
import { NativeFormRegistryContext } from "./context"
import type { TNativeFormAction, TNativeFormResult } from "./types"

export type TNativeFormActionProps = Omit<TNativeButtonProps, "render"> & {
  action?: TNativeFormAction
  form?: string
  onActionResult?: (result: TNativeFormResult) => void
}
let nextActionRevision = 0

export const NativeFormAction = forwardRef<View, TNativeFormActionProps>((received, forwardedRef) => {
  const [props, inheritedRef] = useNativeContextProps(received, forwardedRef, NativeButtonContext)
  const { action = "submit", form, onActionResult: _onActionResult, slot: _slot, onPress: _onPress, ...button } = props
  const registry = useContext(NativeFormRegistryContext)
  const ownerId = useId()
  const view = useRef<View | null>(null)
  const attachment = useRef(0)
  const live = useRef(false)
  const receiver = useRef<NativeFormActionLease | null>(null)
  const [original, setOriginal] = useState<Readonly<{ view: View; target: number; attachment: number }> | null>(null)
  const enabled = !props.isDisabled && !props.isPending
  const descriptorRevision = useMemo(
    () => `${ownerId}:action:${++nextActionRevision}`,
    [ownerId, action, form, enabled, original],
  )
  const lease = useMemo(
    () =>
      original?.target
        ? new NativeFormActionLease(
            { ownerId, descriptorRevision, target: original.target },
            original.view,
            () => view.current,
          )
        : null,
    [ownerId, descriptorRevision, original],
  )
  const current = useRef({ props, descriptorRevision, lease, registry })
  useInsertionEffect(() => {
    current.current = { props, descriptorRevision, lease, registry }
    receiver.current = lease
  })
  useInsertionEffect(() => () => lease?.retire(), [lease])
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      receiver.current?.retire()
    }
  }, [])
  const bind = useCallback((target: View | null) => {
    receiver.current?.retire()
    view.current = target
    if (target) setOriginal({ view: target, target: findNodeHandle(target) ?? 0, attachment: ++attachment.current })
  }, [])
  const ref = useNativeCollectionRefs(inheritedRef, bind)
  const press = useCallback((event: TNativePressEvent) => {
    const owner = current.current,
      original = view.current
    const lease = owner.lease?.getSnapshot()
    owner.props.onPress?.(event)
    if (
      !live.current ||
      !original ||
      current.current.descriptorRevision !== owner.descriptorRevision ||
      current.current.registry !== owner.registry ||
      view.current !== original
    )
      return
    event.persist?.()
    const isCurrent = () =>
      !!lease &&
      live.current &&
      view.current === original &&
      current.current.descriptorRevision === owner.descriptorRevision &&
      current.current.registry === owner.registry &&
      owner.lease?.getSnapshot() === lease
    void nativeFormControllerFor(owner.registry)
      .request(owner.props.action ?? "submit", {
        origin: "native",
        sourceEvent: event,
        target: lease?.target ?? 0,
        formId: owner.props.form,
        isCurrent,
        actionLease: lease,
        admit: (document, form) => (lease ? admitNativeFormAction(lease, document, form) : Promise.resolve(false)),
      })
      .then((result) => {
        if (
          live.current &&
          view.current === original &&
          current.current.descriptorRevision === owner.descriptorRevision
        )
          current.current.props.onActionResult?.(result)
      })
  }, [])
  return (
    <NativeButton
      {...button}
      ref={ref}
      onPress={press}
      nativeFormActionBinding={JSON.stringify({ ownerId, descriptorRevision, enabled })}
      onNativeFormActionStatus={(event) => receiver.current?.receive(event.nativeEvent)}
    />
  )
})
NativeFormAction.displayName = "NativeFormAction"
