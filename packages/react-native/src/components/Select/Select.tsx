import { forwardRef, useCallback, useRef, useState, type Ref, type ReactElement, type RefAttributes } from "react"
import { View, type TextStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonRenderState } from "../Button/types"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
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
const maximumOptionsWidth = 250
const maximumOptionsHeight = 150
const optionsSurfaceStyle = { margin: 0, padding: 0 }

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
  if (closeLabel !== undefined && (typeof closeLabel !== "string" || !closeLabel.trim()))
    throw new TypeError("Select: closeLabel must not be empty")
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
  const selection = useSelectState(props)
  const reducedMotion = useNativeTagReducedMotion()
  const iconRotation = useNativeTagNumberValue(selection.open ? 180 : 0, iconTiming, reducedMotion)
  const trigger = useRef<TNativeSelectRef>(null)
  const [triggerWidth, setTriggerWidth] = useState<number>()
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
  // Validate list styles even while the popup is closed.
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
          onPress={() => selection.requestOpen(!selection.open)}
          onLayout={({ nativeEvent: { layout } }) => setTriggerWidth(layout.width)}
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
              textStyle: { textAlign: "left" },
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
      <NativeFloatingSurface
        testID={`${identity}-popover`}
        isOpen={selection.open}
        onOpenChange={selection.requestOpen}
        triggerRef={trigger}
        restoreFocusRef={trigger}
        placement="bottom start"
        offset={theme.spacing.unit}
        shouldFlip
        width={Math.min(triggerWidth ?? maximumOptionsWidth, maximumOptionsWidth)}
        maxHeight={maximumOptionsHeight}
        customStyles={optionsSurfaceStyle}
        accessibilityLabel={label}
        childIsDialog={false}
        nativeRootRole={null}
        nativeConstrainToViewport
        nativeRestoreAccessibilityFocus
        nativeChildren={({ placement }) => (
          <SelectOptions
            entries={selection.entries}
            selectedKey={selection.selectedKey}
            disabledKeys={selection.disabledKeys}
            identity={identity}
            label={label}
            ready={placement !== null}
            close={() => selection.requestOpen(false)}
            activate={selection.activate}
            props={props}
          />
        )}
      />
    </View>
  )
  return render ? render(element.props, state) : element
}

export const Select = forwardRef(SelectInner) as <T>(
  props: TNativeSelectProps<T> & RefAttributes<TNativeSelectRef>,
) => ReactElement | null
