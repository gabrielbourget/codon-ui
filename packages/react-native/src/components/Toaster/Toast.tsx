import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, View, type PointerEvent } from "react-native"

import { NativeFocusHost } from "../../input/NativeFocusView"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import type { TNativeButtonProps } from "../Button/types"
import { resolveNativeStyle } from "../colors"
import { Text } from "../Text/Text"

import { computeToastDateTimeString, isNativeToastHotkey, resolveToastLabels } from "./model"
import { NativeToastIcon } from "./NativeToastIcon"
import { getNativeToastStyles } from "./styles"
import type { TNativeToastProps } from "./types"
import { useToastLifecycle } from "./useToastLifecycle"

const AnimatedFocusHost = Animated.createAnimatedComponent(NativeFocusHost)
const buttonSlot = (props?: Partial<TNativeButtonProps>, customStyles?: TNativeButtonProps["customStyles"]) => ({
  ...props,
  customStyles: [props?.customStyles, customStyles],
})

export const Toast = (props: TNativeToastProps) => {
  const { toast, index, maxVisibleToasts, onHeight, dismissalHotkey = ["Escape"] } = props
  const {
    titleText = "Placeholder Title Text",
    bodyText = "Placeholder body text",
    type = "info",
    dismissable = true,
    showButtons = true,
    showCancelAction = true,
  } = toast
  const theme = useNativeTheme()
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const lifecycle = useToastLifecycle(props)
  const styles = getNativeToastStyles(theme, props, lifecycle.removed)
  const labels = resolveToastLabels(toast, props.toastLabels)
  const important = toast.important ?? ["error", "danger", "delete"].includes(type)
  const visible = index < maxVisibleToasts
  const canAct = () => scope?.canAct() !== false && windowActive?.() !== false && lifecycle.live.current
  const [reduced, setReduced] = useState(true)
  const [entered, setEntered] = useState(false)
  const [phase] = useState(() => new Animated.Value(0))
  const [dragAmount] = useState(() => new Animated.Value(0))
  const measuredHeight = useRef(0)
  const drag = useRef<{ id: number; x: number; y: number; time: number; amount: number } | null>(null)
  useEffect(() => {
    let live = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true
      if (live) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (live && !changed) setReduced(value)
      },
      () => undefined,
    )
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    const toValue = entered && !lifecycle.removed ? 1 : 0
    if (reduced) {
      phase.setValue(toValue)
      return
    }
    const animation = Animated.timing(phase, {
      toValue,
      duration: lifecycle.removed ? 250 : 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
      isInteraction: false,
    })
    animation.start()
    return () => animation.stop()
  }, [entered, lifecycle.removed, reduced, phase])
  const cancelDrag = () => {
    drag.current = null
    dragAmount.setValue(0)
  }
  const pointerDown = (event: PointerEvent) => {
    if (!canAct() || !visible || !dismissable || lifecycle.removed || event.target !== event.currentTarget) return
    const { pointerId, pageX, pageY } = event.nativeEvent
    drag.current = { id: pointerId, x: pageX, y: pageY, time: Date.now(), amount: 0 }
  }
  const pointerMove = (event: PointerEvent) => {
    const current = drag.current
    if (!current || event.nativeEvent.pointerId !== current.id) return
    if (!canAct() || !dismissable || lifecycle.removed) {
      cancelDrag()
      return
    }
    const { pageX, pageY, pointerType } = event.nativeEvent
    const amount = pageY - current.y
    const threshold = pointerType === "touch" ? 15 : 2
    const away = styles.lift === 1 ? Math.min(0, amount) : Math.max(0, amount)
    if (Math.abs(away) > threshold) {
      current.amount = amount
      dragAmount.setValue(amount)
    } else if (Math.abs(pageX - current.x) > threshold) cancelDrag()
  }
  const pointerUp = (event: PointerEvent) => {
    const current = drag.current
    if (!current || event.nativeEvent.pointerId !== current.id) return
    const elapsed = Math.max(1, Date.now() - current.time)
    cancelDrag()
    if (canAct() && (Math.abs(current.amount) >= 30 || Math.abs(current.amount) / elapsed > 0.11))
      lifecycle.act("swipe")
  }
  const authored = resolveNativeStyle([toast.customStyles, toast.style], "Toaster", "toast.style")
  const motionStyle = {
    ...styles.root,
    opacity: authored.opacity ?? Animated.multiply(phase, visible ? 1 : 0),
    transform: authored.transform ?? [
      ...(styles.root.transform as { translateY: number }[]),
      {
        translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [-styles.lift * measuredHeight.current, 0] }),
      },
      { translateY: dragAmount },
    ],
  }
  return (
    <AnimatedFocusHost
      testID={`toast-${typeof toast.id}-${toast.id}`}
      accessible={false}
      focusable={visible && !lifecycle.removed}
      role={important ? "alert" : undefined}
      accessibilityLiveRegion={important ? "assertive" : "polite"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible && !lifecycle.removed ? "auto" : "none"}
      onKeyDown={(event) => {
        const data = event.nativeEvent
        if (canAct() && visible && !data.repeat && !data.cancelled && isNativeToastHotkey(data, dismissalHotkey))
          lifecycle.retire("programmatic")
      }}
      onLayout={(event) => {
        if (!lifecycle.live.current) return
        measuredHeight.current = event.nativeEvent.layout.height
        onHeight(toast.id, measuredHeight.current)
      }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cancelDrag}
      style={motionStyle}
    >
      <View testID="toast-ribbon" style={styles.ribbon}>
        <View testID="toast-ribbon-left" style={styles.left}>
          {toast.ToastIcon ?? <NativeToastIcon type={type} color={theme.colors.controlSelectedForeground} />}
          <Text
            elementType="h3"
            variant="b10"
            fontWeight="bold"
            color={theme.colors.controlSelectedForeground}
            customStyles={toast.customTitleStyles}
          >
            {titleText}
          </Text>
        </View>
        {dismissable ? (
          <Button
            {...buttonSlot(toast.customCloseButtonProps, toast.customCloseButtonStyles)}
            accessibilityLabel={labels.closeButtonAriaLabel}
            raised={false}
            onPress={() => {
              if (canAct()) lifecycle.act("close")
            }}
            customStyles={[{ padding: 0 }, toast.customCloseButtonProps?.customStyles, toast.customCloseButtonStyles]}
          >
            {toast.CloseIcon ?? <NativeToastIcon type="close" color={theme.colors.controlSelectedForeground} />}
          </Button>
        ) : null}
      </View>
      <View testID="toast-content" style={styles.content}>
        <Text
          variant="b11"
          {...toast.customBodyTextProps}
          customStyles={[toast.customBodyTextProps?.customStyles, toast.customBodyTextStyles]}
        >
          {bodyText}
        </Text>
        <View testID="toast-bottom" style={styles.bottom}>
          <Text
            variant="b13"
            color={theme.colors.controlPlaceholder}
            {...toast.customTimestampTextProps}
            customStyles={[toast.customTimestampTextProps?.customStyles, toast.customTimestampStyles]}
          >
            {computeToastDateTimeString()}
          </Text>
          <View testID="toast-buttons" style={styles.buttons}>
            {showButtons ? (
              <>
                {showCancelAction ? (
                  <Button
                    {...buttonSlot(toast.customCancelButtonProps, toast.customCancelButtonStyles)}
                    order="primary"
                    accessibilityLabel={labels.cancelActionButtonAriaLabel}
                    transparent
                    raised={false}
                    onPress={() => {
                      if (canAct()) lifecycle.act("cancel")
                    }}
                  >
                    <Text fontWeight="bold" color={styles.color} customStyles={{ textDecorationLine: "underline" }}>
                      {labels.cancelActionButton}
                    </Text>
                  </Button>
                ) : null}
                <Button
                  {...buttonSlot(toast.customConfirmButtonProps, toast.customConfirmButtonStyles)}
                  accessibilityLabel={labels.confirmActionButtonAriaLabel}
                  raised={false}
                  color={styles.color}
                  onPress={() => {
                    if (canAct()) lifecycle.act("confirm")
                  }}
                >
                  <Text fontWeight="bold" color={theme.colors.controlSelectedForeground}>
                    {labels.confirmActionButton}
                  </Text>
                </Button>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </AnimatedFocusHost>
  )
}
