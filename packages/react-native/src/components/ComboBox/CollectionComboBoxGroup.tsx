/* Native counterpart of pinned RAC Group; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  forwardRef,
  useCallback,
  useEffect,
  useInsertionEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, type StyleProp, type TextStyle, type View, type ViewProps } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps, type TNativeSlotProps } from "../../collection/context"
import { readNativeFocusWithin, type TNativeFocusWithinEvent } from "../../input/focusWithin"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { NativeFocusWithinData } from "../../input/specs/CUIFocusViewNativeComponent"
import type { TNativeFocusEvent, TNativeFocusViewProps } from "../../input/types"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeComboBoxGroupContext } from "./collectionContext"

export type TNativeComboBoxGroupRenderState = Readonly<{
  isHovered: boolean
  isFocusWithin: boolean
  isFocusVisible: boolean
  isDisabled: boolean
  isInvalid: boolean
}>
type TFocusEvent = TNativeFocusEvent | Parameters<NonNullable<ViewProps["onFocus"]>>[0]
type THostProps = ComponentProps<typeof NativeFocusHost> & RefAttributes<View>
export type TNativeComboBoxGroupProps = Omit<TNativeFocusViewProps, "children" | "style" | "onFocus" | "onBlur"> &
  TNativeSlotProps & {
    isDisabled?: boolean
    isInvalid?: boolean
    isReadOnly?: boolean
    onFocus?: (event: TFocusEvent) => void
    onBlur?: (event: TFocusEvent) => void
    onHoverStart?: ViewProps["onPointerEnter"]
    onHoverEnd?: ViewProps["onPointerLeave"]
    onHoverChange?: (hovered: boolean) => void
    children?: ReactNode | ((state: TNativeComboBoxGroupRenderState & { defaultChildren: undefined }) => ReactNode)
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeComboBoxGroupRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (props: THostProps, state: TNativeComboBoxGroupRenderState) => ReactElement
  }

const KeyboardObservation = ({
  target,
  current,
  visible,
}: {
  target: number
  current: () => Readonly<NativeFocusWithinData> | null
  visible: () => void
}) => {
  useNativeKeyboardObservation({
    targetTag: target,
    isEnabled: target > 0,
    lifetimeKey: `group-within:${target}`,
    canAct: () => !!current()?.within,
    onKeyDown: (event) => {
      const frame = current(),
        data = event.nativeEvent
      if (!frame?.within || data.cancelled || data.isComposing || data.focusedTarget !== frame.focusedTarget) return
      if (!frame.textInputFocused || data.key === "Tab" || data.key === "Escape") visible()
    },
  })
  return null
}

export const NativeComboBoxGroup = forwardRef<View, TNativeComboBoxGroupProps>((authored, forwardedRef) => {
  const [props, inheritedRef] = useNativeContextProps(authored, forwardedRef, NativeComboBoxGroupContext)
  const {
    children,
    style,
    render,
    slot: _slot,
    isDisabled = false,
    isInvalid = false,
    isReadOnly: _readOnly,
    onFocus: _focus,
    onBlur: _blur,
    onHoverStart: _hoverStart,
    onHoverEnd: _hoverEnd,
    onHoverChange: _hoverChange,
    ...native
  } = props
  const scope = useNativeKeyScope()
  const current = useRef(props),
    original = useRef<View | null>(null),
    live = useRef(false)
  const observed = useRef<Readonly<NativeFocusWithinData> | null>(null)
  const [frame, setFrame] = useState<Readonly<NativeFocusWithinData> | null>(null)
  const [target, setTarget] = useState(0),
    [hovered, setHovered] = useState(false),
    [visible, setVisible] = useState(false)
  const pointerOrigin = useRef(false)
  const hoverEvent = useRef<Parameters<NonNullable<ViewProps["onPointerLeave"]>>[0] | null>(null)
  useInsertionEffect(() => {
    current.current = props
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      observed.current = null
    }
  }, [])
  const retire = useCallback(() => {
    observed.current = null
    if (live.current) {
      setFrame(null)
      setVisible(false)
    }
  }, [])
  const bind = useCallback(
    (view: View | null) => {
      original.current = view
      if (live.current) setTarget(view ? (findNodeHandle(view) ?? 0) : 0)
      if (!view) retire()
    },
    [retire],
  )
  const ref = useNativeCollectionRefs(inheritedRef, bind)
  const liveTarget = () => live.current && original.current !== null
  const active = () => liveTarget() && scope?.isWindowActive() !== false
  const receive = (event: TNativeFocusWithinEvent) => {
    const next = readNativeFocusWithin(event.nativeEvent)
    if (!live.current || !next) return
    const previous = observed.current
    observed.current = next
    setFrame(next)
    if (!next.within) setVisible(false)
    else if (!previous?.within)
      setVisible((scope?.lastInput()?.origin ?? (pointerOrigin.current ? "pointer" : next.origin)) !== "pointer")
  }
  const finishHover = () => {
    const event = hoverEvent.current
    if (!event) return
    hoverEvent.current = null
    setHovered(false)
    current.current.onHoverEnd?.(event)
    current.current.onHoverChange?.(false)
  }
  useEffect(() => {
    if (isDisabled) finishHover()
  })
  useEffect(
    () =>
      scope?.subscribe(() => {
        if (scope.isWindowActive() === false) {
          finishHover()
          retire()
        } else if (scope.lastInput()?.origin === "pointer") {
          pointerOrigin.current = true
          setVisible(false)
        }
      }),
    [scope, retire],
  )
  const state: TNativeComboBoxGroupRenderState = {
    isHovered: hovered && !isDisabled,
    isFocusWithin: !!frame?.within && scope?.isWindowActive() !== false,
    isFocusVisible: !!frame?.within && visible && scope?.isWindowActive() !== false,
    isDisabled,
    isInvalid,
  }
  const resolved = typeof style === "function" ? style({ ...state, defaultStyle: {} }) : style
  const styles = splitNativeTextStyle(resolveNativeStyle(resolved, "ComboBoxGroup", "style"))
  const content = typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : children
  const host: THostProps = {
    ...native,
    ref,
    role: native.role ?? "group",
    accessible: native.accessible ?? false,
    focusable: native.focusable ?? false,
    accessibilityState: { ...native.accessibilityState, disabled: isDisabled },
    style: styles.view,
    nativeFocusWithinObservation: true,
    nativeOnFocusWithin: receive,
    nativeOnFocusWithinRetired: retire,
    onFocus: (event) => {
      if (liveTarget()) current.current.onFocus?.(event)
    },
    onBlur: (event) => {
      if (liveTarget()) current.current.onBlur?.(event)
    },
    onBubbledFocus: (event) => {
      if (liveTarget()) current.current.onFocus?.(event)
    },
    onBubbledBlur: (event) => {
      if (liveTarget()) current.current.onBlur?.(event)
    },
    onPointerEnter: (event) => {
      if (!active()) return
      current.current.onPointerEnter?.(event)
      if (!active() || current.current.isDisabled || event.nativeEvent.pointerType === "touch" || hoverEvent.current)
        return
      event.persist?.()
      hoverEvent.current = event
      setHovered(true)
      current.current.onHoverStart?.(event)
      current.current.onHoverChange?.(true)
    },
    onPointerLeave: (event) => {
      if (active()) {
        current.current.onPointerLeave?.(event)
        if (hoverEvent.current) {
          hoverEvent.current = event
          finishHover()
        }
      }
    },
    onPointerDown: (event) => {
      if (active()) {
        pointerOrigin.current = true
        setVisible(false)
        current.current.onPointerDown?.(event)
      }
    },
    children: (
      <>
        {getNativeButtonContent(content, styles.text)}
        {scope && (
          <KeyboardObservation
            target={target}
            current={() => observed.current}
            visible={() => {
              if (active()) setVisible(true)
            }}
          />
        )}
      </>
    ),
  }
  return render ? render(host, state) : <NativeFocusHost {...host} />
})
NativeComboBoxGroup.displayName = "NativeComboBoxGroup"
