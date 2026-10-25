import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type Ref,
} from "react"
import { findNodeHandle, type NativeSyntheticEvent } from "react-native"

import {
  NativeFieldInputContext,
  receiveNativeFieldOwnedInput,
  type TNativeFieldOwnedInputEvent,
} from "../../input/fieldInput"
import { observeNativeFocus, registerNativeFocusTarget } from "../../input/focus"
import { nativeViewProps, NativeViewContextBoundary } from "../../input/nativeViewProps"
import SegmentHost, {
  Commands,
  type NativeProps,
  type NativeDateSegmentData,
} from "../../input/specs/CUIDateSegmentNativeComponent"

import { createNativeDateSegmentLease } from "./lease"

export type TNativeDateSegmentRef = ComponentRef<typeof SegmentHost>
export type TNativeDateSegmentInput = NativeSyntheticEvent<NativeDateSegmentData>
export type TNativeDateSegmentProps = NativeProps

const assign = (ref: Ref<TNativeDateSegmentRef> | undefined, target: TNativeDateSegmentRef | null) => {
  if (typeof ref === "function") return ref(target)
  if (ref) ref.current = target
}

let segmentLeaseGenerations = 0

// Forward the actual owned SDK host; the focus binding never replaces host methods.
export const NativeDateSegment = forwardRef<TNativeDateSegmentRef, TNativeDateSegmentProps>((props, forwardedRef) => {
  const {
    ownerId,
    segmentId,
    bindingRevision,
    segmentDisabled,
    segmentReadOnly,
    segmentEditable,
    keyboardMode,
    onNativeSegmentInput,
    ...other
  } = props
  const wireRevision = useMemo(
    () => `${bindingRevision}:native-segment-lease:${++segmentLeaseGenerations}`,
    [bindingRevision, segmentDisabled, segmentReadOnly, segmentEditable, keyboardMode],
  )
  const fieldScope = useContext(NativeFieldInputContext)
  const committedScope = useRef(fieldScope)
  const current = useRef(props)
  const identity = useRef({ ownerId, segmentId, bindingRevision: wireRevision })
  const assignedIdentity = useRef<typeof identity.current | null>(null)
  const targetRef = useRef<TNativeDateSegmentRef | null>(null)
  const observedNativeFocus = useRef<TNativeDateSegmentRef | null>(null)
  const lease = useRef<ReturnType<typeof createNativeDateSegmentLease> | null>(null)
  const release = useRef<(() => void) | undefined>(undefined)
  const releaseForwarded = useRef<(() => void) | undefined>(undefined)
  const forwarded = useRef(forwardedRef)
  const assignedForwarded = useRef(forwardedRef)
  useInsertionEffect(() => {
    current.current = props
    committedScope.current = fieldScope
    forwarded.current = forwardedRef
    identity.current = { ownerId, segmentId, bindingRevision: wireRevision }
  })
  const attachForwarded = useCallback((target: TNativeDateSegmentRef | null) => {
    releaseForwarded.current?.()
    releaseForwarded.current = undefined
    assignedForwarded.current = forwarded.current
    if (target) {
      const receivingRef = forwarded.current
      const cleanup = assign(receivingRef, target)
      releaseForwarded.current =
        typeof cleanup === "function"
          ? cleanup
          : () => {
              assign(receivingRef, null)
            }
    }
  }, [])
  useLayoutEffect(() => {
    if (assignedForwarded.current !== forwardedRef) attachForwarded(targetRef.current)
  }, [forwardedRef, attachForwarded])
  const bind = useCallback((target: TNativeDateSegmentRef | null) => {
    lease.current?.retire()
    release.current?.()
    lease.current = null
    release.current = undefined
    assignedIdentity.current = identity.current
    if (!target) return
    const tag = findNodeHandle(target)
    if (tag == null) return
    const committed = identity.current
    const binding = createNativeDateSegmentLease({ ...committed, target: tag })
    lease.current = binding
    const canFocus = () =>
      targetRef.current === target &&
      lease.current === binding &&
      !!binding.frame() &&
      !current.current.segmentDisabled &&
      current.current.segmentEditable
    const command = (action: "focus" | "blur") => {
      const frame = binding.frame()
      if (!frame || targetRef.current !== target || lease.current !== binding) return
      const dispatch = action === "focus" ? Commands.requestSegmentFocus : Commands.requestSegmentBlur
      dispatch(target, committed.ownerId, committed.segmentId, committed.bindingRevision, frame.windowId, frame.epoch)
    }
    release.current = registerNativeFocusTarget(target, {
      canFocus,
      canObserveFocus: () => targetRef.current === target && lease.current === binding && !!binding.frame(),
      window: () => binding.frame()?.windowId ?? "",
      focus: () => command("focus"),
      blur: () => command("blur"),
    })
  }, [])
  const ref = useCallback(
    (target: TNativeDateSegmentRef | null) => {
      targetRef.current = target
      bind(target)
      attachForwarded(target)
    },
    [bind, attachForwarded],
  )
  useLayoutEffect(() => {
    const previous = assignedIdentity.current
    if (
      !previous ||
      previous.ownerId !== ownerId ||
      previous.segmentId !== segmentId ||
      previous.bindingRevision !== wireRevision
    )
      bind(targetRef.current)
  }, [ownerId, segmentId, wireRevision, bind])

  useLayoutEffect(
    () => () => {
      lease.current?.retire()
      release.current?.()
      releaseForwarded.current?.()
      targetRef.current = null
      observedNativeFocus.current = null
      lease.current = null
      release.current = undefined
      releaseForwarded.current = undefined
    },
    [],
  )
  const handleInput = useCallback((event: TNativeDateSegmentInput) => {
    const target = targetRef.current
    const binding = lease.current
    if (!target || !binding || !binding.accept(event.nativeEvent)) return
    const data = event.nativeEvent
    if (data.kind === "status") {
      if (!data.active || !data.focused) {
        observedNativeFocus.current = null
        observeNativeFocus(target, false)
      } else if (observedNativeFocus.current === target) {
        observeNativeFocus(target, true)
      }
    } else if (data.kind === "focus" || data.kind === "blur") {
      observedNativeFocus.current = data.focused ? target : null
      observeNativeFocus(target, data.focused)
    } else if (
      ["insert", "delete", "marked", "unmark"].includes(data.kind) &&
      (current.current.segmentDisabled || current.current.segmentReadOnly || !current.current.segmentEditable)
    )
      return
    const scope = committedScope.current
    if (
      scope &&
      ["insert", "delete", "marked", "unmark"].includes(data.kind) &&
      (!scope.current() || !("fieldDispatch" in data))
    )
      return
    if ("fieldDispatch" in data) {
      if (!scope) return
      receiveNativeFieldOwnedInput(scope, event as unknown as TNativeFieldOwnedInputEvent, () =>
        current.current.onNativeSegmentInput?.(event),
      )
    } else current.current.onNativeSegmentInput?.(event)
  }, [])
  void onNativeSegmentInput
  return (
    <NativeViewContextBoundary>
      <SegmentHost
        {...nativeViewProps(other)}
        ref={ref}
        ownerId={ownerId}
        segmentId={segmentId}
        bindingRevision={wireRevision}
        segmentDisabled={segmentDisabled}
        segmentReadOnly={segmentReadOnly}
        segmentEditable={segmentEditable}
        keyboardMode={keyboardMode}
        onNativeSegmentInput={handleInput}
        collapsable={false}
      />
    </NativeViewContextBoundary>
  )
})
NativeDateSegment.displayName = "NativeDateSegment"
