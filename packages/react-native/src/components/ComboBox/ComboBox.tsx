import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref,
  type RefAttributes,
} from "react"
import { AccessibilityInfo, Modal, Platform, Pressable, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { useOverlay } from "../../overlays/useOverlay"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { useNativeSelectionInteraction } from "../selection"
import { Text } from "../Text/Text"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { ComboBoxOptions } from "./ComboBoxOptions"
import { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxProps, TNativeComboBoxRef, TNativeComboBoxRenderState } from "./types"
import { useComboBoxState } from "./useComboBoxState"

const ComboBoxInner = <T,>(props: TNativeComboBoxProps<T>, ref: Ref<TNativeComboBoxRef>) => {
  const label = props.accessibilityLabel ?? props["aria-label"]
  for (const [field, name] of [
    ["accessibilityLabel or aria-label", label],
    ["inputLabel", props.inputLabel],
    ["closeLabel", props.closeLabel],
  ] as const)
    if (typeof name !== "string" || !name.trim()) throw new TypeError(`ComboBox: ${field} must not be empty`)
  for (const [field, dimension] of [
    ["width", props.width],
    ["height", props.height],
  ] as const)
    if (
      (typeof dimension === "number" && !Number.isFinite(dimension)) ||
      (typeof dimension === "string" && dimension !== "auto" && !/^-?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(dimension))
    )
      throw new TypeError(`ComboBox: ${field} must be a native dimension`)
  const theme = useNativeTheme()
  validateNativeColor(theme.colors.controlPlaceholder, "ComboBox", "placeholderColor")
  validateNativeColor(theme.colors.background, "ComboBox", "windowBackground")
  const model = useComboBoxState(props)
  const trigger = useRef<View>(null)
  const overlay = useOverlay(model.open, false, true, trigger)
  const mounted = useRef(true)
  const open = useRef(model.open)
  const previousOpen = useRef(model.open)
  const epoch = useRef(0)
  const frames = useRef(new Set<ReturnType<typeof requestAnimationFrame>>())
  const [queryFocused, setQueryFocused] = useState(false)
  const restoreFocus = useCallback(() => {
    const generation = epoch.current
    const first = requestAnimationFrame(() => {
      frames.current.delete(first)
      if (!mounted.current || open.current || generation !== epoch.current) return
      const second = requestAnimationFrame(() => {
        frames.current.delete(second)
        if (mounted.current && !open.current && generation === epoch.current && trigger.current)
          AccessibilityInfo.sendAccessibilityEvent(trigger.current, "focus")
      })
      frames.current.add(second)
    })
    frames.current.add(first)
  }, [])
  useLayoutEffect(() => {
    open.current = model.open
    epoch.current++
    setQueryFocused(false)
    if (!overlay.managed && previousOpen.current && !model.open && Platform.OS === "android") restoreFocus()
    previousOpen.current = model.open
  }, [model.open, overlay.managed, restoreFocus])
  useEffect(() => {
    mounted.current = true
    const scheduled = frames.current
    return () => {
      mounted.current = false
      for (const frame of scheduled) cancelAnimationFrame(frame)
      scheduled.clear()
    }
  }, [])
  const { flags, handlers } = useNativeSelectionInteraction({}, !!props.isDisabled, false, () =>
    model.requestOpen(true),
  )
  const state: TNativeComboBoxRenderState = {
    isOpen: model.open,
    isDisabled: !!props.isDisabled,
    isReadOnly: !!props.isReadOnly,
    isInvalid: !!props.errorState,
  }
  const styles = getNativeComboBoxStyles(
    theme,
    props,
    state,
    queryFocused || flags.isFocused,
    flags.isPressed,
    flags.isHovered,
  )
  const identity = props.testID ?? props["data-testid"] ?? "combo-box"
  const close = () => {
    if (overlay.isActive()) model.requestOpen(false)
  }
  return (
    <View
      ref={ref}
      testID={identity}
      nativeID={props.nativeID}
      id={props.id}
      onLayout={props.onLayout}
      pointerEvents={props.pointerEvents}
      collapsable={props.collapsable}
      accessible={false}
      style={styles.root}
    >
      <View
        testID={`${identity}-group`}
        style={[{ width: "100%", height: styles.root.height != null ? "100%" : undefined }, styles.group]}
      >
        <NativeContentContext.Provider
          value={{ foregroundColor: styles.button.color ?? styles.foreground, isButton: true }}
        >
          <Pressable
            {...handlers}
            ref={trigger}
            accessible
            role="button"
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={props.accessibilityHint}
            accessibilityValue={{ text: model.query || props.placeholder || "" }}
            accessibilityState={{ disabled: !!props.isDisabled, expanded: model.open }}
            disabled={props.isDisabled}
            focusable={!props.isDisabled}
            testID={`${identity}-trigger`}
            style={styles.button}
          >
            {model.query ? (
              <Text
                variant={props.textSize === "small" ? "b11" : props.textSize === "large" ? "b9" : "b10"}
                style={{ flex: 1 }}
              >
                {model.query}
              </Text>
            ) : (
              <PlaceholderText style={{ flex: 1 }}>{props.placeholder ?? ""}</PlaceholderText>
            )}
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {props.ComponentIcon === undefined ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    margin: theme.spacing.unit,
                    borderBottomWidth: 1.5,
                    borderRightWidth: 1.5,
                    borderColor: styles.button.color ?? styles.foreground,
                    transform: [{ rotate: model.open ? "225deg" : "45deg" }],
                  }}
                />
              ) : (
                getNativeButtonContent(props.ComponentIcon)
              )}
            </View>
          </Pressable>
        </NativeContentContext.Provider>
      </View>
      <Modal
        testID={`${identity}-window`}
        visible={overlay.visible}
        transparent={false}
        animationType="none"
        presentationStyle="fullScreen"
        allowSwipeDismissal={false}
        supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
        onRequestClose={close}
        onShow={overlay.shown}
        onDismiss={() => {
          if (overlay.managed) overlay.dismissed()
          else if (!open.current) restoreFocus()
        }}
      >
        {overlay.mounted && (
          <SafeAreaProvider style={{ flex: 1 }}>
            <ComboBoxOptions
              props={props}
              entries={model.entries}
              selectedKey={model.selectedKey}
              disabledKeys={model.disabledKeys}
              identity={identity}
              query={model.query}
              styles={styles}
              active={overlay.isActive}
              focus={setQueryFocused}
              change={model.requestInput}
              close={close}
              activate={model.activate}
            />
          </SafeAreaProvider>
        )}
      </Modal>
    </View>
  )
}

export const ComboBox = forwardRef(ComboBoxInner) as <T>(
  props: TNativeComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>,
) => ReactElement | null
