import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useInsertionEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref,
  type RefAttributes,
} from "react"
import { AccessibilityInfo, Modal, Platform, View, type TextStyle } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { useNativeCollectionRefs } from "../../collection/context"
import { nativeFieldAccessibilityProps } from "../../form/semantics"
import { useNativeFieldSemantics } from "../../form/useFieldSemantics"
import { useNativeSimpleComboBoxField } from "../../form/useSimpleComboBoxField"
import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost, type TNativeLocalKeyEvent } from "../../input/NativeFocusView"
import { NativeTargetKeyPolicy } from "../../input/NativeTargetKeyPolicy"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeMotionValue } from "../../motion/animation/hooks"
import { NativeMotionOwnerHost } from "../../motion/owner/NativeMotionOwnerHost"
import {
  NativeFloatingWindowHost,
  type TNativeFloatingWindowDismiss,
} from "../../overlays/floating/NativeFloatingLayerHost"
import { OverlayParentContext } from "../../overlays/NativeOverlayProvider"
import { useOverlay } from "../../overlays/useOverlay"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { validateNativeColor } from "../colors"
import { useNativeInputBorder } from "../Input/motion"
import { NativeContentContext } from "../NativeContentContext"
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
  const root = useRef<View>(null)
  const rootRef = useNativeCollectionRefs(ref, root)
  const floatingDismiss = useRef<TNativeFloatingWindowDismiss | null>(null)
  const restoreKeyboard = useRef(true)
  const rotateX = useNativeMotionValue<unknown>(0)
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
      if (!mounted.current || open.current || generation !== epoch.current || !restoreKeyboard.current) return
      const second = requestAnimationFrame(() => {
        frames.current.delete(second)
        if (mounted.current && !open.current && generation === epoch.current && trigger.current)
          if (focusNativeTarget(trigger.current)) AccessibilityInfo.sendAccessibilityEvent(trigger.current, "focus")
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
  const [triggerFocused, setTriggerFocused] = useState(false)
  const state: TNativeComboBoxRenderState = {
    isOpen: model.open,
    isDisabled: !!props.isDisabled,
    isReadOnly: !!props.isReadOnly,
    isInvalid: !!props.errorState || model.displayValidation.isInvalid,
  }
  const styles = getNativeComboBoxStyles(
    theme,
    { ...props, errorState: state.isInvalid },
    state,
    queryFocused || triggerFocused,
    false,
    false,
  )
  const groupStyle = useNativeInputBorder(styles.group)
  const triggerForeground: TextStyle = { color: styles.button.color ?? styles.foreground }
  const current = useRef({ model, props })
  useInsertionEffect(() => {
    current.current = { model, props }
  })
  const triggerKeys = ["ArrowDown", "ArrowUp"].flatMap(nativeKeyTokens)
  const triggerKey = (event: TNativeKeyboardEvent | TNativeLocalKeyEvent) => {
    const data = event.nativeEvent
    if (
      !mounted.current ||
      current.current.props.isDisabled ||
      data.cancelled ||
      data.repeat ||
      data.phase !== "down" ||
      !data.nativeDefaultHandled
    )
      return
    if (data.key === "ArrowDown" || data.key === "ArrowUp") {
      event.preventDefault()
      restoreKeyboard.current = true
      current.current.model.requestOpen(true, data.key === "ArrowDown" ? "first" : "last")
    }
  }
  const identity = props.testID ?? props["data-testid"] ?? "combo-box"
  const groupLabel =
    props.labels && "inputButtonGroupAriaLabel" in props.labels
      ? props.labels.inputButtonGroupAriaLabel
      : "ComboBox Input Button Group"
  const semantics = useNativeFieldSemantics({
    text: { label, errorMessage: model.displayValidation.validationErrors.join(" ") },
    flags: {
      disabled: !!props.isDisabled,
      readOnly: !!props.isReadOnly,
      required: !!props.isRequired,
      invalid: state.isInvalid,
      expanded: model.open,
    },
    activeDescendant: null,
  })
  const field = useNativeSimpleComboBoxField(props, model, root, trigger, semantics)
  const fieldAccessibility = field.participating
    ? nativeFieldAccessibilityProps(semantics, label, props.accessibilityHint)
    : {
        accessibilityLabel: label,
        accessibilityHint: props.accessibilityHint,
        accessibilityState: { expanded: model.open },
      }
  const close = () => {
    if (overlay.isActive() && !floatingDismiss.current?.("keyboard")) model.requestOpen(false)
  }
  return (
    <View
      ref={rootRef}
      testID={identity}
      nativeID={props.nativeID}
      id={props.id}
      onLayout={props.onLayout}
      pointerEvents={props.pointerEvents}
      collapsable={field.participating ? false : props.collapsable}
      accessible={false}
      style={styles.root}
    >
      <View
        testID={`${identity}-group`}
        accessible={false}
        role="group"
        accessibilityLabel={groupLabel}
        style={[{ width: "100%", height: styles.root.height != null ? "100%" : undefined }, groupStyle]}
      >
        <NativeContentContext.Provider
          value={{ foregroundColor: styles.button.color ?? styles.foreground, isButton: true }}
        >
          <NativeButton
            onPress={() => {
              restoreKeyboard.current = true
              model.requestOpen(true)
            }}
            onFocus={() => setTriggerFocused(true)}
            onBlur={() => setTriggerFocused(false)}
            raised={false}
            enableFocusStyle={false}
            customStyles={{ borderWidth: 0, padding: 0 }}
            nativeRender={(native) => (
              <NativeFocusHost
                {...native}
                style={[native.style, triggerForeground]}
                capturedKeys={[...triggerKeys, ...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")]}
                nativeKeyPolicy={{
                  tokens: triggerKeys,
                  isEnabled: !props.isDisabled,
                  lifetimeKey: "combo-trigger",
                  canAct: () => mounted.current && !current.current.props.isDisabled,
                  onKey: triggerKey,
                  onRetire: () => {},
                }}
              >
                {native.children}
                {field.metadata}
              </NativeFocusHost>
            )}
            onKeyDown={triggerKey}
            ref={trigger}
            accessibilityLabel={fieldAccessibility.accessibilityLabel}
            accessibilityHint={fieldAccessibility.accessibilityHint}
            accessibilityValue={{ text: model.query || props.placeholder || "" }}
            accessibilityState={fieldAccessibility.accessibilityState}
            isDisabled={props.isDisabled}
            testID={`${identity}-trigger`}
            style={(button) => styles.buttonForState(button.isPressed, button.isHovered)}
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
            <NativeMotionOwnerHost
              testID={`${identity}-icon`}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              focusable={false}
              computedStyles={{ alignItems: "center", justifyContent: "center" }}
              values={{ rotateX }}
              motion={{ animate: { rotateX: model.open ? 180 : 0 }, transition: { ease: "easeInOut", duration: 0.4 } }}
            >
              {props.ComponentIcon === undefined ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    margin: theme.spacing.unit,
                    borderBottomWidth: 1.5,
                    borderRightWidth: 1.5,
                    borderColor: styles.button.color ?? styles.foreground,
                    transform: [{ rotate: "45deg" }],
                  }}
                />
              ) : (
                getNativeButtonContent(props.ComponentIcon)
              )}
            </NativeMotionOwnerHost>
            <NativeTargetKeyPolicy
              target={trigger}
              tokens={triggerKeys}
              isEnabled={!props.isDisabled}
              lifetimeKey="combo-trigger"
              excludeEditable
              excludeComposing
              canAct={() => mounted.current && !current.current.props.isDisabled}
              onKey={triggerKey}
            />
          </NativeButton>
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
          if (overlay.managed) {
            overlay.dismissed()
            restoreFocus()
          } else if (!open.current) restoreFocus()
        }}
      >
        {overlay.mounted && (
          <OverlayParentContext.Provider value={overlay.id}>
            <SafeAreaProvider style={{ flex: 1 }}>
              <NativeFloatingWindowHost
                isWindowActive={() => model.open && overlay.isActive()}
                dismissRef={floatingDismiss}
                testID={`${identity}-floating-host`}
                style={{ flex: 1 }}
              >
                <ComboBoxOptions
                  props={props}
                  entries={model.entries}
                  selectedKey={model.selectedKey}
                  disabledKeys={model.disabledKeys}
                  identity={identity}
                  query={model.query}
                  styles={styles}
                  strategy={model.focusStrategy.current}
                  revert={model.revert}
                  closeFromTab={(requestClose) => {
                    restoreKeyboard.current = false
                    if (requestClose) model.requestOpen(false)
                  }}
                  active={overlay.isActive}
                  focus={setQueryFocused}
                  change={model.requestInput}
                  close={close}
                  activate={model.activate}
                />
              </NativeFloatingWindowHost>
            </SafeAreaProvider>
          </OverlayParentContext.Provider>
        )}
      </Modal>
    </View>
  )
}

export const ComboBox = forwardRef(ComboBoxInner) as <T>(
  props: TNativeComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>,
) => ReactElement | null
