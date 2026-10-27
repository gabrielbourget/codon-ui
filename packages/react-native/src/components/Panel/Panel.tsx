import { forwardRef, useContext, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { Modal as NativeModal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { NativeBackdropSourceContext } from "../../overlays/backdrop/context"
import { NativeBackdropEffect } from "../../overlays/backdrop/NativeBackdropEffect"
import { NativeBackdropWindow } from "../../overlays/backdrop/NativeBackdropWindow"
import {
  NativeFloatingWindowHost,
  type TNativeFloatingWindowDismiss,
} from "../../overlays/floating/NativeFloatingLayerHost"
import { OverlayParentContext } from "../../overlays/NativeOverlayProvider"
import { useOverlay } from "../../overlays/useOverlay"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext } from "../NativeContentContext"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"

import { useNativePanelAppearance } from "./appearance"
import { useNativePanelReturnFocus } from "./focus"
import { useNativePanelMotion } from "./motion"
import { NativePanelSurface } from "./PanelSurface"
import { getNativePanelStyles } from "./styles"
import type { TNativePanelProps } from "./types"

// Private until the complete inherited contract and real backdrop renderer have passed acceptance.
export const Panel = forwardRef<View, TNativePanelProps>((props, ref) => {
  const theme = useNativeTheme()
  const window = useWindowDimensions()
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const source = useContext(NativeBackdropSourceContext)
  const open = props.isOpen ?? false
  const returnFocus = useNativePanelReturnFocus(open, props.restoreFocusRef)
  const motion = useNativePanelMotion(open, width)
  const overlay = useOverlay(motion.present, true)
  useLayoutEffect(() => returnFocus(overlay.mounted))
  const dismiss = useRef<TNativeFloatingWindowDismiss | null>(null)
  const styles = getNativePanelStyles(props, theme, viewport?.width ?? window.width)
  const {
    opacity: overlayOpacity,
    transform: overlayTransform,
    transformOrigin: overlayTransformOrigin,
    filter: overlayFilter,
    mixBlendMode: overlayBlendMode,
    isolation: overlayIsolation,
    zIndex: overlayStackingOrder,
    ...overlayPaint
  } = styles.overlay
  const appearance = useNativePanelAppearance(
    styles.view,
    styles.text,
    motion.reduced !== false || !motion.present,
    viewport ?? window,
    {
      color: theme.colors.foreground,
      fontSize: theme.typography.fontSizes.b10,
      fontWeight: theme.typography.fontWeights.regular,
      lineHeight: theme.typography.lineHeight,
    },
  )
  const identity = props.testID ?? props["data-testid"] ?? "panel"
  const label = props.accessibilityLabel ?? props["aria-label"]
  const current = useRef({ props, open, live: true })
  useInsertionEffect(() => {
    current.current = { props, open, live: true }
  }, [props, open])
  useInsertionEffect(
    () => () => {
      current.current.live = false
    },
    [],
  )
  if (typeof label !== "string" || !label.trim())
    throw new TypeError("Panel: a nonempty native accessible name is required")
  const isActive = () => current.current.live && current.current.open && overlay.isActive()
  const close = () => {
    if (isActive()) current.current.props.onOpenChange?.(false)
  }
  const systemClose = () => {
    if (dismiss.current?.("keyboard")) return
    if (!current.current.props.isKeyboardDismissDisabled) close()
  }
  return (
    <NativeModal
      testID={`${identity}-window`}
      visible={overlay.visible}
      transparent
      presentationStyle="overFullScreen"
      animationType="none"
      allowSwipeDismissal={false}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
      onShow={overlay.shown}
      onDismiss={overlay.dismissed}
      onRequestClose={systemClose}
    >
      {overlay.mounted && (
        <OverlayParentContext.Provider value={overlay.id}>
          <SafeAreaProvider style={{ flex: 1 }}>
            <NativeBackdropWindow testID={`${identity}-backdrop-target`}>
              <NativeFloatingWindowHost
                testID={`${identity}-floating-host`}
                isWindowActive={() => open && isActive()}
                dismissRef={dismiss}
                style={{ flex: 1 }}
                accessibilityViewIsModal
                onAccessibilityEscape={systemClose}
                onLayout={({ nativeEvent }) => {
                  if (
                    current.current.live &&
                    current.current.props === props &&
                    Number.isFinite(nativeEvent.layout.width) &&
                    nativeEvent.layout.width >= 0 &&
                    Number.isFinite(nativeEvent.layout.height) &&
                    nativeEvent.layout.height >= 0
                  )
                    setViewport({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
                }}
              >
                {/* Portal layers stay outside the authored overlay's common compositing group. */}
                <View
                  testID={`${identity}-overlay-composite`}
                  collapsable={false}
                  accessible={false}
                  focusable={false}
                  pointerEvents="box-none"
                  needsOffscreenAlphaCompositing
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: overlayOpacity,
                      transform: overlayTransform,
                      transformOrigin: overlayTransformOrigin,
                      filter: overlayFilter,
                      mixBlendMode: overlayBlendMode,
                      isolation: overlayIsolation,
                      zIndex: overlayStackingOrder,
                    },
                  ]}
                >
                  {props.overlayBlur && <NativeBackdropEffect source={source} />}
                  <Pressable
                    testID={`${identity}-backdrop`}
                    accessible={false}
                    focusable={false}
                    importantForAccessibility="no"
                    style={[StyleSheet.absoluteFill, overlayPaint]}
                    onPress={() => {
                      if (current.current.props.isDismissable !== false) close()
                    }}
                  />
                  <NativePanelSurface
                    ref={ref}
                    open={open}
                    ready={width !== null && overlay.active}
                    isActive={isActive}
                    systemClose={systemClose}
                    keyboardDisabled={props.isKeyboardDismissDisabled ?? false}
                    initialFocusRef={props.initialFocusRef}
                    testID={identity}
                    collapsable={false}
                    accessible={false}
                    accessibilityLabel={label}
                    accessibilityElementsHidden={overlay.covered || !open}
                    importantForAccessibility={overlay.covered || !open ? "no-hide-descendants" : "auto"}
                    pointerEvents={open && overlay.active ? "auto" : "none"}
                    onLayout={({ nativeEvent }) => {
                      const next = nativeEvent.layout.width
                      if (current.current.live && current.current.props === props && Number.isFinite(next) && next >= 0)
                        setWidth(next)
                    }}
                    style={[
                      appearance.view,
                      {
                        transform: [
                          {
                            translateX: motion.progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [
                                0,
                                (styles.side === "left" ? -1 : 1) * (width ?? viewport?.width ?? window.width),
                              ],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <NativeContentContext.Provider
                      value={{ foregroundColor: appearance.text.color ?? theme.colors.foreground, isButton: false }}
                    >
                      <NativeTextStyleProvider style={appearance.text}>
                        {getNativeButtonContent(props.children, appearance.text)}
                      </NativeTextStyleProvider>
                    </NativeContentContext.Provider>
                  </NativePanelSurface>
                </View>
              </NativeFloatingWindowHost>
            </NativeBackdropWindow>
          </SafeAreaProvider>
        </OverlayParentContext.Provider>
      )}
    </NativeModal>
  )
})
Panel.displayName = "Panel"
