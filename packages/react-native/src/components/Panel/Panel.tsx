import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { Animated, Modal as NativeModal, Pressable, StyleSheet, useWindowDimensions, type View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import CUIOverlayHost from "../../input/specs/CUIOverlayHostNativeComponent"
import CUIOverlaySlot from "../../input/specs/CUIOverlaySlotNativeComponent"
import CUIOverlayViewport from "../../input/specs/CUIOverlayViewportNativeComponent"
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
import { serializeNativeTypographyStyle } from "../nativeTypographyStyle"

import { useNativePanelAppearance } from "./appearance"
import { useNativePanelReturnFocus } from "./focus"
import { useNativePanelMotion } from "./motion"
import { getNativePanelOverlayLayout } from "./overlayLayout"
import { NativePanelSurface } from "./PanelSurface"
import type { TPanelBorderBox } from "./radii"
import { getNativePanelStyles } from "./styles"
import type { TNativePanelProps } from "./types"

const AnimatedOverlayHost = Animated.createAnimatedComponent(CUIOverlayHost)
// Pinned AnimatedProps accepts every AnimatedNode; its custom-number type names only two subclasses.
type TOverlayPaintOpacity = ComponentProps<typeof AnimatedOverlayHost>["paintOpacity"]

// Private until the complete inherited contract and real backdrop renderer have passed acceptance.
export const Panel = forwardRef<View, TNativePanelProps>((props, ref) => {
  const theme = useNativeTheme()
  const window = useWindowDimensions()
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [contentBox, setContentBox] = useState<{ width: number; height: number } | null>(null)
  const appearanceHost = useRef<View>(null)
  const appearanceScope = useRef<(() => boolean) | null>(null)
  const [borderBox, setBorderBox] = useState<TPanelBorderBox | null>(null)
  const borderMeasured = useCallback((next: TPanelBorderBox | null) => {
    setBorderBox((previous) =>
      previous?.width === next?.width &&
      previous?.height === next?.height &&
      previous?.direction === next?.direction &&
      previous?.platform === next?.platform
        ? previous
        : next,
    )
  }, [])
  const contentMeasured = useCallback((next: { width: number; height: number } | null) => {
    setContentBox((previous) =>
      previous?.width === next?.width && previous?.height === next?.height ? previous : next,
    )
  }, [])
  const source = useContext(NativeBackdropSourceContext)
  const open = props.isOpen ?? false
  const returnFocus = useNativePanelReturnFocus(open, props.restoreFocusRef)
  const motion = useNativePanelMotion(open, width)
  const overlay = useOverlay(motion.present, true)
  useLayoutEffect(() => returnFocus(overlay.mounted))
  const dismiss = useRef<TNativeFloatingWindowDismiss | null>(null)
  const styles = getNativePanelStyles(props, theme, viewport?.width ?? window.width)
  const appearance = useNativePanelAppearance(
    styles.view,
    styles.text,
    motion.reduced !== false || !motion.present,
    { ...(viewport ?? window), content: contentBox, border: borderBox },
    {
      color: theme.colors.foreground,
      fontSize: theme.typography.fontSizes.b10,
      fontWeight: theme.typography.fontWeights.regular,
      lineHeight: theme.typography.lineHeight,
    },
    appearanceHost,
    () => appearanceScope.current?.() ?? false,
    styles.layout,
  )
  const overlayLayout = getNativePanelOverlayLayout(styles, appearance.view, props.overlayBlur ?? false)
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
                <CUIOverlayViewport
                  ownerId={overlay.id}
                  testID={`${identity}-overlay-viewport`}
                  collapsable={false}
                  accessible={false}
                  pointerEvents="box-none"
                  style={[StyleSheet.absoluteFill, { zIndex: overlayLayout.host.zIndex }]}
                >
                  <AnimatedOverlayHost
                    testID={`${identity}-overlay-composite`}
                    collapsable={false}
                    accessible={false}
                    focusable={false}
                    pointerEvents="box-none"
                    paintOpacity={overlayLayout.opacity as TOverlayPaintOpacity}
                    panelPosition={overlayLayout.panelPosition}
                    panelFlowFlexContainer={overlayLayout.panelFlowFlexContainer}
                    panelViewportHeight={overlayLayout.panelViewportHeight}
                    panelViewportWidth={overlayLayout.panelViewportWidth}
                    panelLayoutLengths={appearance.layoutLengths}
                    establishesContainingBlock={overlayLayout.establishesContainingBlock}
                    style={[StyleSheet.absoluteFill, overlayLayout.host]}
                  >
                    <CUIOverlaySlot
                      slotRole="underlay"
                      testID={`${identity}-overlay-underlay`}
                      collapsable={false}
                      accessible={false}
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                    >
                      {props.overlayBlur && <NativeBackdropEffect source={source} />}
                    </CUIOverlaySlot>
                    <CUIOverlaySlot
                      slotRole="paint"
                      testID={`${identity}-overlay-paint`}
                      collapsable={false}
                      accessible={false}
                      pointerEvents="box-none"
                      style={StyleSheet.absoluteFill}
                    >
                      <Pressable
                        testID={`${identity}-backdrop`}
                        accessible={false}
                        focusable={false}
                        importantForAccessibility="no"
                        style={[StyleSheet.absoluteFill, overlayLayout.paint]}
                        onPress={() => {
                          if (current.current.props.isDismissable !== false) close()
                        }}
                      />
                    </CUIOverlaySlot>
                    <CUIOverlaySlot
                      slotRole="body"
                      testID={`${identity}-overlay-body`}
                      collapsable={false}
                      accessible={false}
                      pointerEvents="box-none"
                      style={StyleSheet.absoluteFill}
                    >
                      <NativePanelSurface
                        ref={ref}
                        open={open}
                        ready={width !== null && overlay.active}
                        isActive={isActive}
                        systemClose={systemClose}
                        keyboardDisabled={props.isKeyboardDismissDisabled ?? false}
                        observeContentBox={appearance.needsContentObservation}
                        onContentBox={contentMeasured}
                        observeRadii={appearance.needsRadiusObservation}
                        onBorderBox={borderMeasured}
                        appearanceHost={appearanceHost}
                        appearanceScope={appearanceScope}
                        nativeMotionDrawingOwner
                        nativeForegroundComposition
                        nativeTypographyStyle={serializeNativeTypographyStyle(appearance.text)}
                        nativeMotionProjectionRadii={appearance.radii}
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
                          if (
                            current.current.live &&
                            current.current.props === props &&
                            Number.isFinite(next) &&
                            next >= 0
                          )
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
                    </CUIOverlaySlot>
                  </AnimatedOverlayHost>
                </CUIOverlayViewport>
              </NativeFloatingWindowHost>
            </NativeBackdropWindow>
          </SafeAreaProvider>
        </OverlayParentContext.Provider>
      )}
    </NativeModal>
  )
})
Panel.displayName = "Panel"
