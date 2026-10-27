import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react"
import { findNodeHandle, View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import NativeCUIMotionSnapshot from "../../input/specs/NativeCUIMotionSnapshot"

import { createNativeBackdropRenderer } from "./renderer"
import type { TNativeBackdropAdapter, TNativeBackdropEffectProps } from "./types"

const Target: TNativeBackdropAdapter["Target"] = forwardRef((props, ref) => <View {...props} ref={ref} />)
Target.displayName = "DefaultNativeBackdropTarget"

const Effect = (props: TNativeBackdropEffectProps) => {
  const receiver = useRef<View>(null)
  const input = useNativeKeyScope()
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<Error | null>(null)
  const renderer = useMemo(
    () =>
      createNativeBackdropRenderer(props.lease.ownerId, {
        request: (encoded) => {
          if (!NativeCUIMotionSnapshot) throw new Error("Native backdrop: native renderer unavailable")
          return NativeCUIMotionSnapshot.backdropFrame(encoded)
        },
        frame: requestAnimationFrame,
        cancel: cancelAnimationFrame,
        failed: setFailure,
      }),
    [props.lease.ownerId],
  )
  useLayoutEffect(() => {
    const target = props.targetRef.current
    const output = receiver.current
    const session = input?.acknowledgedSession()
    if (props.isPaused || !ready || !target || !output || !input || !session || !props.lease.isCurrent()) {
      renderer.update(null)
      return
    }
    const targetTag = findNodeHandle(target)
    const receiverTag = findNodeHandle(output)
    if (!targetTag || !receiverTag) throw new Error("Native backdrop: actual target and receiver required")
    renderer.update({
      target,
      receiver: output,
      targetTag,
      receiverTag,
      radius: props.radius,
      lease: props.lease,
      scopeOwnerId: input.ownerId,
      windowId: session.windowId,
      epoch: session.epoch,
    })
    return renderer.pause
  }, [
    props.targetRef,
    props.radius,
    props.isPaused,
    props.lease.ownerId,
    props.lease.generation,
    props.lease.isCurrent,
    input,
    ready,
    renderer,
  ])
  useLayoutEffect(() => renderer.close, [renderer])
  if (failure) throw failure
  return (
    <View
      ref={receiver}
      collapsable={false}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={props.style}
      onLayout={({ nativeEvent }) => setReady(nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0)}
    />
  )
}

/** Opt-in renderer. NativeOverlayProvider keeps its existing omitted/null behavior. */
export const DefaultNativeBackdropAdapter: TNativeBackdropAdapter = { Target, Effect }
