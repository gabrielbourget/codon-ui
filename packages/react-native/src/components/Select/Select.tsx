import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type ReactElement,
  type RefAttributes,
} from "react"
import { AccessibilityInfo, Modal, Platform, View, type TextStyle } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import {
  NativeFloatingWindowHost,
  type TNativeFloatingWindowDismiss,
} from "../../overlays/floating/NativeFloatingLayerHost"
import { useOverlay } from "../../overlays/useOverlay"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonRenderState } from "../Button/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { getNativeControlRadius, getNativeControlRootStyle } from "../selection"
import { resolveNativeTagTransition, useNativeTagNumberValue, useNativeTagReducedMotion } from "../Tag/motion"

import { SelectOptions } from "./SelectOptions"
import type {
  TNativeSelectProps,
  TNativeSelectRef,
  TNativeSelectRenderState,
  TNativeSelectRootStyle,
  TNativeSelectValueRenderState,
} from "./types"
import { useSelectState } from "./useSelectState"

const iconTiming = resolveNativeTagTransition(400)

const SelectValueContent = <T,>({
  state,
  renderValue,
  placeholder,
  fontSize,
  textStyles,
}: {
  state: TNativeSelectValueRenderState<T>
  renderValue: TNativeSelectProps<T>["renderSelectedValue"]
  placeholder: string
  fontSize: number
  textStyles: TextStyle
}) =>
  getNativeButtonContent(renderValue ? renderValue(state) : state.selectedText || placeholder, {
    flexShrink: 1,
    fontSize,
    fontStyle: state.isPlaceholder ? "italic" : "normal",
    ...textStyles,
  })

const SelectInner = <T,>(props: TNativeSelectProps<T>, forwardedRef: Ref<TNativeSelectRef>) => {
  const floatingDismiss = useRef<TNativeFloatingWindowDismiss | null>(null)
  const {
    render,
    items,
    getKey,
    getTextValue,
    renderItem,
    value,
    defaultValue,
    onChange,
    disabledKeys,
    isOpen,
    defaultOpen,
    onOpenChange,
    isDisabled = false,
    isReadOnly = false,
    closeLabel,
    placeholder = "",
    emptyListMessage,
    width,
    height,
    textSize = "medium",
    geometry = "rounded",
    enableFocusStyle = true,
    offsetFocusRing = true,
    errorState = false,
    warningState = false,
    successState = false,
    ComponentIcon,
    renderSelectedValue,
    customStyles,
    style,
    customSelectedItemStyles,
    customSelectedItemTextStyles,
    customOptionsListStyles,
    onFocus,
    onBlur,
    accessibilityLabel,
    testID,
    "aria-label": aliasLabel,
    "data-testid": aliasTestID,
    ...rest
  } = props
  const label = accessibilityLabel ?? aliasLabel
  if (typeof label !== "string" || !label.trim())
    throw new TypeError("Select: a nonempty accessibilityLabel or aria-label is required")
  if (typeof closeLabel !== "string" || !closeLabel.trim()) throw new TypeError("Select: closeLabel must not be empty")
  for (const [field, dimension] of [
    ["width", width],
    ["height", height],
  ] as const) {
    if (
      (typeof dimension === "number" && !Number.isFinite(dimension)) ||
      (typeof dimension === "string" && dimension !== "auto" && !/^-?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(dimension))
    )
      throw new TypeError(`Select: ${field} must be a native dimension`)
  }
  const theme = useNativeTheme()
  validateNativeColor(theme.colors.controlForeground, "Select", "foreground")
  validateNativeColor(theme.colors.controlPlaceholder, "Select", "placeholderColor")
  validateNativeColor(theme.colors.background, "Select", "modalBackground")
  const selection = useSelectState(props)
  const reducedMotion = useNativeTagReducedMotion()
  const iconRotation = useNativeTagNumberValue(selection.open ? 180 : 0, iconTiming, reducedMotion)
  const trigger = useRef<TNativeSelectRef>(null)
  const overlay = useOverlay(selection.open, false, true, trigger)
  const mounted = useRef(true)
  const openRef = useRef(selection.open)
  const epoch = useRef(0)
  const previousOpen = useRef(selection.open)
  const frames = useRef(new Set<ReturnType<typeof requestAnimationFrame>>())
  const [shown, setShown] = useState(false)
  const restoreFocus = useCallback(() => {
    const generation = epoch.current
    const first = requestAnimationFrame(() => {
      frames.current.delete(first)
      if (!mounted.current || openRef.current || generation !== epoch.current) return
      const second = requestAnimationFrame(() => {
        frames.current.delete(second)
        if (mounted.current && !openRef.current && generation === epoch.current && trigger.current)
          AccessibilityInfo.sendAccessibilityEvent(trigger.current, "focus")
      })
      frames.current.add(second)
    })
    frames.current.add(first)
  }, [])
  useLayoutEffect(() => {
    openRef.current = selection.open
    epoch.current += 1
    setShown(false)
    if (!overlay.managed && previousOpen.current && !selection.open && Platform.OS === "android") restoreFocus()
    previousOpen.current = selection.open
  }, [selection.open, restoreFocus, overlay.managed])
  useEffect(() => {
    mounted.current = true
    const scheduled = frames.current
    return () => {
      mounted.current = false
      for (const frame of scheduled) cancelAnimationFrame(frame)
      scheduled.clear()
    }
  }, [])
  const setTrigger = useCallback(
    (node: TNativeSelectRef | null) => {
      trigger.current = node
      if (typeof forwardedRef === "function") {
        const cleanup = forwardedRef(node)
        if (typeof cleanup === "function")
          return () => {
            trigger.current = null
            cleanup()
          }
      } else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )
  const state: TNativeSelectRenderState = { isOpen: selection.open, isDisabled, isReadOnly, isInvalid: errorState }
  const rootStyle = getNativeControlRootStyle(
    "Select",
    {
      width: width ?? undefined,
      height: height ?? undefined,
      opacity: isDisabled ? theme.opacity.disabled : 1,
      backgroundColor: theme.colors.controlBackground,
      borderRadius: getNativeControlRadius(theme, geometry),
      color: theme.colors.controlForeground,
    } as TNativeSelectRootStyle,
    customStyles,
    style,
    state,
  )
  const { color: rootForeground = theme.colors.controlForeground, ...rootViewStyle } = rootStyle
  const triggerStyle = (flags: Pick<TNativeButtonRenderState, "isPressed" | "isHovered" | "isFocused">) =>
    getNativeControlRootStyle(
      "Select",
      {
        width: "100%",
        height: rootStyle.height != null ? "100%" : undefined,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing.unit,
        padding: theme.spacing.unit,
        color: rootForeground,
        borderWidth: 1,
        borderColor: errorState
          ? theme.colors.validationErrorBorder
          : warningState
            ? theme.colors.validationWarningBorder
            : successState
              ? theme.colors.validationSuccessBorder
              : theme.colors.controlBorder,
        borderRadius: getNativeControlRadius(theme, geometry),
        backgroundColor: flags.isPressed
          ? theme.colors.controlPressedBackground
          : flags.isHovered
            ? theme.colors.controlHoverBackground
            : theme.colors.controlBackground,
        ...(enableFocusStyle && flags.isFocused
          ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
          : {}),
      } as TNativeSelectRootStyle,
      customSelectedItemStyles,
      undefined,
      state,
    )
  const textStyles = resolveNativeStyle(customSelectedItemTextStyles, "Select", "customSelectedItemTextStyles")
  // Validate list styles even while the modal is closed.
  resolveNativeStyle(customOptionsListStyles, "Select", "customOptionsListStyles")
  const isPlaceholder = !selection.selectedEntry
  const selectedText = selection.selectedEntry?.text ?? ""
  const identity = testID ?? aliasTestID ?? "select"
  const element = (
    <View
      {...rest}
      accessible={false}
      role={undefined}
      accessibilityRole={undefined}
      accessibilityState={undefined}
      accessibilityValue={undefined}
      aria-disabled={undefined}
      aria-expanded={undefined}
      aria-checked={undefined}
      aria-selected={undefined}
      testID={identity}
      style={rootViewStyle}
    >
      <NativeContentContext.Provider
        value={{
          foregroundColor: isPlaceholder ? theme.colors.controlPlaceholder : rootForeground,
          isButton: true,
        }}
      >
        <NativeButton
          nativeAnimate
          onPress={() => selection.requestOpen(true)}
          onFocus={onFocus}
          onBlur={onBlur}
          nativeProgrammaticFocusable
          ref={setTrigger}
          nativeAccessible
          nativeRole="button"
          accessibilityLabel={label}
          accessibilityHint={props.accessibilityHint}
          accessibilityValue={{ text: selectedText || placeholder }}
          accessibilityState={{ expanded: selection.open }}
          aria-expanded={selection.open}
          isDisabled={isDisabled}
          focusable={!isDisabled}
          testID={`${identity}-trigger`}
          nativeStyle={(flags) => {
            const { color = rootForeground, ...viewStyle } = triggerStyle(flags)
            return {
              viewStyle,
              textStyle: {},
              foregroundColor: isPlaceholder ? theme.colors.controlPlaceholder : color,
              target: 0,
            }
          }}
        >
          <View style={{ flex: 1 }}>
            <SelectValueContent
              state={{ selectedItem: selection.selectedEntry?.item ?? null, selectedText, isPlaceholder }}
              renderValue={renderSelectedValue}
              placeholder={placeholder}
              fontSize={theme.typography.fontSizes[textSize === "small" ? "b11" : textSize === "large" ? "b9" : "b10"]}
              textStyles={textStyles}
            />
          </View>
          <View
            testID={`${identity}-icon-motion`}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ alignItems: "center", justifyContent: "center", transform: [{ rotateX: `${iconRotation}deg` }] }}
          >
            {ComponentIcon === undefined ? (
              <View
                testID={`${identity}-default-icon`}
                style={{
                  width: 8,
                  height: 8,
                  margin: theme.spacing.unit,
                  borderBottomWidth: 1.5,
                  borderRightWidth: 1.5,
                  borderColor: theme.colors.controlForeground,
                  transform: [{ rotate: "45deg" }],
                }}
              />
            ) : (
              getNativeButtonContent(ComponentIcon)
            )}
          </View>
        </NativeButton>
      </NativeContentContext.Provider>
      <Modal
        testID={`${identity}-window`}
        visible={overlay.visible}
        transparent={false}
        animationType="none"
        presentationStyle="fullScreen"
        allowSwipeDismissal={false}
        supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
        onRequestClose={() => {
          if (floatingDismiss.current?.("keyboard")) return
          if (overlay.isActive()) selection.requestOpen(false)
        }}
        onShow={() => {
          overlay.shown()
          if (openRef.current) setShown(true)
        }}
        onDismiss={() => {
          if (overlay.managed) overlay.dismissed()
          else if (!openRef.current) restoreFocus()
        }}
      >
        {overlay.mounted && (
          <SafeAreaProvider style={{ flex: 1 }}>
            <NativeFloatingWindowHost
              testID={`${identity}-floating-host`}
              isWindowActive={() => shown && overlay.isActive()}
              dismissRef={floatingDismiss}
            >
              <SelectOptions
                entries={selection.entries}
                selectedKey={selection.selectedKey}
                disabledKeys={selection.disabledKeys}
                identity={identity}
                label={label}
                ready={shown && overlay.active}
                close={() => {
                  if (overlay.isActive()) selection.requestOpen(false)
                }}
                activate={(key) => {
                  if (overlay.isActive()) selection.activate(key)
                }}
                props={props}
              />
            </NativeFloatingWindowHost>
          </SafeAreaProvider>
        )}
      </Modal>
    </View>
  )
  return render ? render(element.props, state) : element
}

export const Select = forwardRef(SelectInner) as <T>(
  props: TNativeSelectProps<T> & RefAttributes<TNativeSelectRef>,
) => ReactElement | null
