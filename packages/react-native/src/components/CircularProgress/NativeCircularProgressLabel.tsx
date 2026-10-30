import { forwardRef, useContext, useLayoutEffect } from "react"

import { useNativeContextProps, useNativeSlottedContext } from "../../collection/context"
import { NativeText } from "../Text/Text"
import type { TNativeTextRef } from "../Text/types"

import {
  NativeCircularProgressLabelBindingContext,
  NativeCircularProgressLabelContext,
  type TNativeCircularProgressLabelProps,
} from "./context"

export const NativeCircularProgressLabel = forwardRef<TNativeTextRef, TNativeCircularProgressLabelProps>(
  (authored, ref) => {
    const binding = useContext(NativeCircularProgressLabelBindingContext)
    const source = useNativeSlottedContext(NativeCircularProgressLabelContext, authored.slot)
    const [props, mergedRef] = useNativeContextProps(
      { ...authored, id: authored.id ?? authored.nativeID },
      ref,
      NativeCircularProgressLabelContext,
    )
    const { render, slot: _slot, id, nativeID, ...rest } = props
    useLayoutEffect(() => {
      if (binding && source?.ref === binding.ref) return binding.bindID(id ?? nativeID)
    }, [binding, source?.ref, id, nativeID])
    return (
      <NativeText
        {...rest}
        ref={mergedRef}
        nativeID={id ?? nativeID}
        elementType="span"
        nativeRender={render ? (native) => render(native, undefined) : undefined}
      />
    )
  },
)
