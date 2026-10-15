import { useRef, type ReactNode, type Ref } from "react"
import {
  KeyboardAvoidingView,
  Modal as NativeModal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type ViewStyle,
} from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import { resolveNativeStyle, validateNativeColor } from "../components/colors"
import type { TNativeModalProps, TNativeModalRef } from "../components/Modal/types"
import { NativeContentContext } from "../components/NativeContentContext"
import { useNativeTheme } from "../theme"

import { OverlayParentContext } from "./NativeOverlayProvider"
import { useOverlay } from "./useOverlay"

export const OverlayFrame = ({
  props,
  open,
  requestClose,
  panelRef,
  children,
  initialFocusRef,
  radiusMultiplier = 1,
}: {
  props: TNativeModalProps
  open: boolean
  requestClose: () => void
  panelRef: Ref<TNativeModalRef>
  children: ReactNode | ((close: () => void) => ReactNode)
  initialFocusRef?: TNativeModalProps["initialFocusRef"]
  radiusMultiplier?: number
}) => {
  const theme = useNativeTheme()
  const overlay = useOverlay(open, true, false, props.restoreFocusRef)
  const scroll = useRef<ScrollView>(null)
  const scrollOffset = useRef(0)
  const measurement = useRef(0)
  const label = props.accessibilityLabel ?? props["aria-label"]
  if (typeof label !== "string" || !label.trim())
    throw new TypeError("Modal: a nonempty native accessible name is required")
  if (props.overlayBlur !== undefined && props.overlayBlur !== false)
    throw new TypeError("Modal: overlayBlur supports only false on native")
  validateNativeColor(props.color, "Modal", "color")
  for (const [name, value] of [
    ["width", props.width],
    ["height", props.height],
  ] as const) {
    if (
      value !== undefined &&
      value !== "auto" &&
      !(
        (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
        (typeof value === "string" && /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(value))
      )
    )
      throw new TypeError(`Modal: ${name} must be a finite nonnegative native dimension`)
  }
  const panel = resolveNativeStyle(
    [
      {
        width: props.width ?? 400,
        height: props.height,
        maxWidth: "100%",
        maxHeight: "100%",
        flexShrink: 1,
        backgroundColor: props.color ?? (props.order ? theme.actions[props.order].background : theme.colors.background),
        color:
          props.order && props.color === undefined ? theme.actions[props.order].foreground : theme.colors.foreground,
        borderRadius: props.geometry === "orthogonal" ? 0 : theme.radius.rounded * radiusMultiplier,
        ...(props.raised === false
          ? {}
          : {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.24,
              shadowRadius: 3,
              elevation: 2,
            }),
      },
      resolveNativeStyle(props.customStyles, "Modal", "customStyles"),
      resolveNativeStyle(props.style, "Modal", "style"),
    ],
    "Modal",
    "panel",
  )
  const { color: foreground, ...panelStyle } = panel
  validateNativeColor(theme.colors.overlayBackdrop, "Modal", "overlayBackdrop")
  const backdrop = resolveNativeStyle(props.customOverlayStyles, "Modal", "customOverlayStyles")
  const dialog = resolveNativeStyle(props.customDialogStyles, "Modal", "customDialogStyles")
  const identity = props.testID ?? props["data-testid"] ?? "modal"
  const close = () => {
    if (overlay.isActive()) requestClose()
  }
  const systemClose = () => {
    if (!props.isKeyboardDismissDisabled) close()
  }
  const revealFocusedInput = () => {
    const epoch = ++measurement.current
    const input = TextInput.State.currentlyFocusedInput()
    if (!input) return
    scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (epoch !== measurement.current || !overlay.isActive() || TextInput.State.currentlyFocusedInput() !== input)
          return
        const gap = theme.spacing.unit * 2
        const above = inputTop - top - gap
        const below = inputTop + inputHeight + gap - top - height
        const delta = above < 0 ? above : below > 0 ? below : 0
        if (delta) scroll.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: false })
      })
    })
  }
  const content = (
    <View
      testID={`${identity}-dialog`}
      style={[{ flexShrink: 1, padding: theme.spacing.unit * 4, gap: theme.spacing.unit * 2 }, dialog]}
    >
      {typeof children === "function" ? children(close) : children}
    </View>
  )
  return (
    <NativeModal
      testID={`${identity}-window`}
      visible={overlay.visible}
      transparent
      presentationStyle="overFullScreen"
      animationType="none"
      allowSwipeDismissal={false}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
      onRequestClose={systemClose}
      onShow={() => {
        overlay.shown()
        if (initialFocusRef) overlay.focus(initialFocusRef)
      }}
      onDismiss={overlay.dismissed}
    >
      {overlay.mounted && (
        <OverlayParentContext.Provider value={overlay.id}>
          <SafeAreaProvider style={{ flex: 1 }}>
            <View style={{ flex: 1 }} accessibilityViewIsModal onAccessibilityEscape={systemClose}>
              <Pressable
                testID={`${identity}-backdrop`}
                accessible={false}
                importantForAccessibility="no"
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: theme.colors.overlayBackdrop,
                  },
                  backdrop,
                ]}
                onPress={() => {
                  if (props.isDismissable !== false) close()
                }}
              />
              <SafeAreaView pointerEvents="box-none" style={{ flex: 1 }}>
                <KeyboardAvoidingView
                  pointerEvents="box-none"
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={{ flex: 1 }}
                >
                  <View
                    pointerEvents="box-none"
                    onLayout={revealFocusedInput}
                    style={{ flex: 1, padding: theme.spacing.unit * 4, justifyContent: "center", alignItems: "center" }}
                  >
                    <View
                      ref={panelRef}
                      collapsable={false}
                      testID={identity}
                      accessibilityLabel={label}
                      accessible={false}
                      accessibilityElementsHidden={overlay.covered}
                      importantForAccessibility={overlay.covered ? "no-hide-descendants" : "auto"}
                      pointerEvents={overlay.active ? "auto" : "none"}
                      style={panelStyle as ViewStyle}
                    >
                      <NativeContentContext.Provider
                        value={{ foregroundColor: foreground ?? theme.colors.foreground, isButton: false }}
                      >
                        {props.isScrollable === false ? (
                          content
                        ) : (
                          <ScrollView
                            ref={scroll}
                            testID={`${identity}-scroll`}
                            style={{ flexShrink: 1 }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            onLayout={revealFocusedInput}
                            onContentSizeChange={revealFocusedInput}
                            onScroll={({ nativeEvent }) => {
                              scrollOffset.current = nativeEvent.contentOffset.y
                            }}
                            scrollEventThrottle={16}
                          >
                            {content}
                          </ScrollView>
                        )}
                      </NativeContentContext.Provider>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </SafeAreaView>
            </View>
          </SafeAreaProvider>
        </OverlayParentContext.Provider>
      )}
    </NativeModal>
  )
}
