import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import { View, useWindowDimensions, type TextStyle, type ViewStyle } from "react-native"

import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonRenderState } from "../Button/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius, getNativeControlRootStyle, nativeControlTarget } from "../selection"

import { useNativeSwitcherLayout } from "./layout"
import {
  NativeSwitcherSurface,
  useNativeSwitcherMotion,
  useNativeSwitcherReducedMotion,
  type TNativeSwitcherFrame,
  type TNativeSwitcherMotion,
} from "./motion"
import { nativeSwitcherWeight, splitNativeSwitcherOptionStyle } from "./styles"
import type {
  TNativeToggleSwitcherItem,
  TNativeToggleSwitcherOptionStyle,
  TNativeToggleSwitcherProps,
  TNativeToggleSwitcherRef,
  TNativeToggleSwitcherRootStyle,
} from "./types"
import { useNativeSwitcherIntrinsicWidth } from "./useIntrinsicWidth"

const SwitcherOption = ({
  item,
  selected,
  disabled,
  readOnly,
  optionStyle,
  columnWidth,
  constrainedHeight,
  geometry,
  enableFocusStyle,
  offsetFocusRing,
  reduced,
  motion,
  frame,
  identity,
  onPress,
  onFrame,
  onLabel,
  onNaturalSize,
  onIntrinsicWidth,
  measurementSignature,
}: {
  item: TNativeToggleSwitcherItem
  selected: boolean
  disabled: boolean
  readOnly: boolean
  optionStyle: TNativeToggleSwitcherOptionStyle
  columnWidth: number | undefined
  constrainedHeight: boolean
  geometry: NonNullable<TNativeToggleSwitcherProps["geometry"]>
  enableFocusStyle: boolean
  offsetFocusRing: boolean
  reduced: boolean
  motion: TNativeSwitcherMotion
  frame: TNativeSwitcherFrame | undefined
  identity: string
  onPress: () => void
  onFrame: (frame: TNativeSwitcherFrame) => void
  onLabel: (size: { width: number; height: number }) => void
  onNaturalSize: (size: { width: number; height: number }) => void
  onIntrinsicWidth: (width: number) => void
  measurementSignature: object
}) => {
  const theme = useNativeTheme()
  const split = splitNativeSwitcherOptionStyle(optionStyle)
  const rootStyle = (flags: Omit<TNativeButtonRenderState, "foregroundColor">) =>
    getNativeControlRootStyle(
      "ToggleSwitcher",
      {
        width: columnWidth,
        height: constrainedHeight ? "100%" : undefined,
        minHeight: constrainedHeight ? undefined : nativeControlTarget(),
        flexShrink: 0,
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: theme.spacing.unit,
        paddingVertical: 2,
        overflow: "hidden",
        borderRadius: getNativeControlRadius(theme, geometry),
        backgroundColor: selected
          ? theme.colors.controlBackground
          : flags.isHovered
            ? theme.colors.controlHoverBackground
            : "transparent",
        ...(enableFocusStyle && flags.isFocused
          ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
          : {}),
      } as ViewStyle,
      split.view,
      undefined,
      { ...flags, isSelected: selected },
    )
  const foreground = split.text.color ?? theme.colors.controlForeground
  const optionRef = useRef<View>(null)
  const labelRef = useRef<View>(null)
  useNativeSwitcherIntrinsicWidth(
    optionRef,
    measurementSignature,
    split.view.width,
    split.view.width == null && split.view.minWidth === undefined ? nativeControlTarget() : undefined,
    onIntrinsicWidth,
  )
  useEffect(() => {
    let active = true
    const pending = requestAnimationFrame(() => {
      optionRef.current?.measure((_x, _y, width, height) => {
        if (active && (width > 0 || split.view.width === 0 || columnWidth === 0)) onNaturalSize({ width, height })
      })
      labelRef.current?.measure((_x, _y, width, height) => {
        if (active) onLabel({ width, height })
      })
    })
    return () => {
      active = false
      cancelAnimationFrame(pending)
    }
  }, [measurementSignature, columnWidth])
  return (
    <NativeButton
      ref={optionRef}
      slot={null}
      isDisabled={disabled}
      nativeInteraction={!readOnly}
      accessibilityLabel={item.accessibilityLabel}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      testID={identity + "-option"}
      onLayout={(event) => onFrame(event.nativeEvent.layout)}
      onPress={onPress}
      nativeRender={(props) => (
        <NativeFocusHost
          {...props}
          nativeMotionGeometryObservation
          nativeMotionGeometryObserveFrames={false}
          accessibilityState={{ checked: selected, disabled }}
          aria-busy={undefined}
        />
      )}
      nativeStyle={(flags) => ({
        viewStyle: rootStyle(flags),
        textStyle: split.text,
        foregroundColor: foreground,
        target: nativeControlTarget(),
      })}
    >
      {(flags) => {
        const root = rootStyle(flags)
        const surfaceStyle: ViewStyle = {
          backgroundColor: root.backgroundColor,
          borderRadius: root.borderRadius,
          borderTopLeftRadius: root.borderTopLeftRadius,
          borderTopRightRadius: root.borderTopRightRadius,
          borderBottomLeftRadius: root.borderBottomLeftRadius,
          borderBottomRightRadius: root.borderBottomRightRadius,
          experimental_backgroundImage: root.experimental_backgroundImage,
          experimental_backgroundSize: root.experimental_backgroundSize,
          experimental_backgroundPosition: root.experimental_backgroundPosition,
          experimental_backgroundRepeat: root.experimental_backgroundRepeat,
        }
        return (
          <>
            {selected ? (
              <NativeSwitcherSurface
                frame={frame}
                motion={motion}
                reduced={reduced}
                style={surfaceStyle}
                identity={identity}
              />
            ) : null}
            <View
              ref={labelRef}
              collapsable={false}
              testID={identity + "-label"}
              accessible={false}
              pointerEvents="none"
              onLayout={(event) => onLabel(event.nativeEvent.layout)}
              style={{ flexShrink: 1, zIndex: 1 }}
            >
              {getNativeButtonContent(item.label, split.text)}
            </View>
          </>
        )
      }}
    </NativeButton>
  )
}

export const ToggleSwitcher = forwardRef<TNativeToggleSwitcherRef, TNativeToggleSwitcherProps>((props, ref) => {
  const {
    items,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    isDisabled = false,
    isReadOnly = false,
    height,
    width,
    color,
    geometry = "rounded",
    order,
    raised = false,
    enableFocusStyle = true,
    offsetFocusRing = true,
    uppercase = false,
    fontSize = 12,
    optionFontWeight,
    selectedOptionFontWeight,
    customStyles,
    customOptionStyles,
    customSelectedOptionStyles,
    style,
    testID,
    "data-testid": aliasID,
    accessibilityLabel,
    "aria-label": aliasLabel,
    onLayout,
    ...rest
  } = props
  if (!Array.isArray(items)) throw new TypeError("ToggleSwitcher: items must be an array")
  const keys = items.map((item) => item.id)
  if (keys.some((key) => typeof key !== "string") || new Set(keys).size !== keys.length)
    throw new TypeError("ToggleSwitcher: item IDs must be unique strings")
  if ([selectedKey, defaultSelectedKey].some((key) => key !== undefined && typeof key !== "string"))
    throw new TypeError("ToggleSwitcher: selection keys must be strings")
  validateNativeDisplayDimension(width, "ToggleSwitcher", "width")
  validateNativeDisplayDimension(height, "ToggleSwitcher", "height")
  if (!Number.isFinite(fontSize) || fontSize < 0)
    throw new TypeError("ToggleSwitcher: fontSize must be finite and nonnegative")
  validateNativeColor(color, "ToggleSwitcher", "color")
  const theme = useNativeTheme()
  const dimensions = useWindowDimensions()
  const [localKey, setLocalKey] = useState(() => defaultSelectedKey ?? items.find((item) => !item.disabled)?.id ?? "")
  const selected = selectedKey ?? localKey
  const baseline = resolveNativeStyle<TNativeToggleSwitcherRootStyle>(
    [
      {
        width,
        height,
        alignSelf: "flex-start",
        maxWidth: "100%",
        padding: 2,
        borderWidth: 1,
        backgroundColor: theme.mode === "dark" ? "#202020" : "#f7f7f7",
        borderColor: theme.mode === "dark" ? "#3d3d3d" : "#c6c6c6",
        borderRadius: getNativeControlRadius(theme, geometry),
        opacity: isDisabled || isReadOnly ? theme.opacity.disabled : 1,
        ...(raised
          ? {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.24,
              shadowRadius: 3,
              elevation: 2,
            }
          : {}),
      } as ViewStyle,
      customStyles,
    ],
    "ToggleSwitcher",
    "customStyles",
  )
  const { color: rootForeground, ...resolved } = resolveNativeStyle<TNativeToggleSwitcherRootStyle>(
    [
      baseline,
      typeof style === "function"
        ? style({ selectedKey: selected, isDisabled, isReadOnly, defaultStyle: baseline })
        : style,
    ],
    "ToggleSwitcher",
    "style",
  )
  const {
    flexDirection = "row",
    flexWrap,
    gap = 2,
    columnGap,
    rowGap,
    justifyContent,
    alignItems = "stretch",
    alignContent,
    ...rootStyle
  } = resolved
  const common = resolveNativeStyle(customOptionStyles, "ToggleSwitcher", "customOptionStyles")
  const selectedStyles = resolveNativeStyle(customSelectedOptionStyles, "ToggleSwitcher", "customSelectedOptionStyles")
  const layoutItems = useRef(items.map(({ id, label }) => ({ id, label })))
  if (
    layoutItems.current.length !== items.length ||
    items.some(
      (item, index) => item.id !== layoutItems.current[index].id || item.label !== layoutItems.current[index].label,
    )
  )
    layoutItems.current = items.map(({ id, label }) => ({ id, label }))
  const signature = useMemo(
    () => ({}),
    [
      layoutItems.current,
      isDisabled,
      isReadOnly,
      width,
      height,
      selected,
      fontSize,
      optionFontWeight,
      selectedOptionFontWeight,
      geometry,
      customStyles,
      customOptionStyles,
      customSelectedOptionStyles,
      style,
      theme,
      dimensions.width,
      dimensions.height,
      dimensions.fontScale,
    ],
  )
  const layout = useNativeSwitcherLayout(
    signature,
    keys,
    rootStyle.width !== undefined,
    columnGap ?? gap,
    flexDirection === "column" || flexDirection === "column-reverse",
  )
  const reduced = useNativeSwitcherReducedMotion()
  const constrainedHeight = rootStyle.height !== undefined && rootStyle.height !== null && rootStyle.height !== "auto"
  const motion = useNativeSwitcherMotion()
  const identity = testID ?? aliasID ?? "toggle-switcher"
  return (
    <View
      {...rest}
      ref={ref}
      accessible={false}
      accessibilityLabel={accessibilityLabel ?? aliasLabel}
      accessibilityState={{ disabled: isDisabled }}
      aria-disabled={isDisabled}
      testID={identity}
      onLayout={(event) => {
        layout.root(event.nativeEvent.layout)
        onLayout?.(event)
      }}
      style={{
        ...rootStyle,
        width: rootStyle.width === undefined ? layout.desiredWidth : rootStyle.width,
        flexDirection: "column",
      }}
    >
      <View
        testID={identity + "-row"}
        onLayout={(event) => layout.row(event.nativeEvent.layout)}
        style={{
          flexDirection,
          flexWrap,
          gap,
          columnGap,
          rowGap,
          justifyContent,
          alignItems,
          alignContent,
          alignSelf: "stretch",
          flexGrow: constrainedHeight ? 1 : 0,
        }}
      >
        {items.map((item) => {
          const isSelected = item.id === selected
          const text: TextStyle = {
            fontSize,
            color: isSelected
              ? (color ?? (order ? theme.actions[order].background : theme.colors.controlSelectedBackground))
              : (rootForeground ?? theme.colors.controlForeground),
            fontWeight: nativeSwitcherWeight(
              theme,
              isSelected ? selectedOptionFontWeight : optionFontWeight,
              isSelected,
            ),
            textTransform: uppercase ? "uppercase" : "none",
          }
          return (
            <SwitcherOption
              key={item.id}
              item={item}
              selected={isSelected}
              disabled={isDisabled || !!item.disabled}
              readOnly={isReadOnly}
              columnWidth={layout.columnWidth}
              constrainedHeight={constrainedHeight}
              geometry={geometry}
              enableFocusStyle={enableFocusStyle}
              offsetFocusRing={offsetFocusRing}
              reduced={reduced}
              motion={motion}
              frame={layout.frames.get(item.id)}
              identity={identity}
              optionStyle={{ ...text, ...common, ...(isSelected ? selectedStyles : {}) }}
              onFrame={(frame) => {
                layout.option(item.id, frame)
                if ((isSelected ? (selectedStyles.width ?? common.width) : common.width) !== undefined)
                  layout.natural(item.id, frame, true)
              }}
              onLabel={(size) => layout.label(item.id, size)}
              onNaturalSize={(size) => layout.natural(item.id, size)}
              onIntrinsicWidth={(width) => layout.intrinsic(item.id, width)}
              measurementSignature={signature}
              onPress={() => {
                if (isDisabled || isReadOnly || item.disabled || item.id === selected) return
                if (selectedKey === undefined) setLocalKey(item.id)
                onSelectionChange?.(item.id)
              }}
            />
          )
        })}
      </View>
    </View>
  )
})
ToggleSwitcher.displayName = "ToggleSwitcher"
