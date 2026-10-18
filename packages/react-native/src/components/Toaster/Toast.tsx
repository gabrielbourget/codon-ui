import { useContext, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { Animated, View, type PointerEvent } from "react-native"

import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import type { TNativeButtonProps } from "../Button/types"
import { NativeContentContext } from "../NativeContentContext"
import { Text } from "../Text/Text"

import { createNativeToastGesture } from "./gesture"
import { computeToastDateTimeString, isNativeToastHotkey, resolveToastLabels } from "./model"
import { useNativeToastMotion } from "./motion"
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
  const keyScope = useNativeKeyScope()
  const current = useRef({ scope, windowActive, keyScope, lifecycle, visible, dismissable, props })
  useInsertionEffect(() => {
    current.current = { scope, windowActive, keyScope, lifecycle, visible, dismissable, props }
  })
  const canAct = () => {
    const value = current.current
    return (
      value.scope?.canAct() !== false &&
      value.windowActive?.() !== false &&
      value.keyScope?.isWindowActive() !== false &&
      value.lifecycle.live.current &&
      !value.lifecycle.inactive &&
      !value.lifecycle.removed &&
      value.visible
    )
  }
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [swiped, setSwiped] = useState(false)
  const [dragAmount] = useState(() => new Animated.Value(0))
  const [gesture] = useState(() =>
    createNativeToastGesture({
      canAct: () => canAct() && current.current.dismissable,
      isTop: () => current.current.props.position.startsWith("top"),
      lifetime: () => {
        const scope = current.current.keyScope
        const session = scope?.acknowledgedSession()
        return `${session?.windowId ?? ""}:${session?.epoch ?? 0}:${scope?.policyRevision() ?? 0}`
      },
      onAmount: (value) => dragAmount.setValue(value),
      onDragging: setDragging,
      onDismiss: () => {
        setSwiped(true)
        current.current.lifecycle.act("swipe")
      },
    }),
  )
  useInsertionEffect(() => () => gesture.dispose(), [gesture])
  useLayoutEffect(() => {
    if (!canAct() || !dismissable) gesture.cancel()
  }, [lifecycle.removed, lifecycle.inactive, visible, dismissable, scope, windowActive, keyScope, gesture])
  useLayoutEffect(() => {
    gesture.cancel()
  }, [props.position, gesture])
  const motionStyle = useNativeToastMotion(
    props,
    styles.root,
    styles.authored,
    naturalHeight,
    lifecycle.removed,
    dragging,
    swiped,
    dragAmount,
  )
  const excludeGesture = (slot: "close" | "cancel" | "confirm", event: PointerEvent) => {
    if (!canAct()) return
    gesture.exclude(event)
    const toast = current.current.props.toast
    const slotProps =
      slot === "close"
        ? toast.customCloseButtonProps
        : slot === "cancel"
          ? toast.customCancelButtonProps
          : toast.customConfirmButtonProps
    slotProps?.onPointerDown?.(event)
  }
  return (
    <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
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
        onPointerDown={gesture.down}
        onPointerMove={gesture.move}
        onPointerUp={gesture.up}
        onPointerCancel={gesture.pointerCancel}
        style={motionStyle}
      >
        <View
          testID="toast-natural-content"
          style={{ gap: theme.spacing.unit }}
          onLayout={(event) => {
            if (!lifecycle.live.current) return
            const height = event.nativeEvent.layout.height
            if (!Number.isFinite(height) || height < 0) return
            setNaturalHeight(height)
            onHeight(toast.id, height)
          }}
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
                onPointerDown={(event) => excludeGesture("close", event)}
                accessibilityLabel={labels.closeButtonAriaLabel}
                raised={false}
                onPress={() => {
                  if (canAct()) lifecycle.act("close")
                }}
                customStyles={[
                  { padding: 0 },
                  toast.customCloseButtonProps?.customStyles,
                  toast.customCloseButtonStyles,
                ]}
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
                        onPointerDown={(event) => excludeGesture("cancel", event)}
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
                      onPointerDown={(event) => excludeGesture("confirm", event)}
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
        </View>
      </AnimatedFocusHost>
    </NativeContentContext.Provider>
  )
}
