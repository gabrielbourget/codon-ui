import { forwardRef, useLayoutEffect, useRef, useState, type ReactElement, type RefAttributes } from "react"
import { I18nManager, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius, nativeControlTarget } from "../selection"
import { Text } from "../Text/Text"

import { sliderInset, useNativeSliderGesture } from "./gesture"
import { useNativeSliderState } from "./state"
import { getSliderThumbStyles } from "./styles"
import type { TNativeSliderProps, TNativeSliderRef, TNativeSliderValue } from "./types"

type TSize = { width: number; height: number }
const SliderRoot = forwardRef<TNativeSliderRef, TNativeSliderProps>((props, ref) => {
  const {
    value: _value,
    defaultValue: _defaultValue,
    onChange: _onChange,
    onChangeEnd: _onChangeEnd,
    minValue: _minValue,
    maxValue: _maxValue,
    step: _step,
    isDisabled = false,
    orientation = "horizontal",
    direction = I18nManager.isRTL ? "rtl" : "ltr",
    locale: _locale,
    formatOptions: _formatOptions,
    label,
    labelID,
    thumbAriaLabels,
    thumbColor: _thumbColor,
    trackColor,
    geometry = "round",
    order: _order,
    raised: _raised,
    enableFocusStyle: _enableFocusStyle,
    offsetFocusRing: _offsetFocusRing,
    height,
    width,
    maxWidth = 300,
    customStyles,
    customLabelStyles,
    customOutputStyles,
    customTrackStyles,
    customThumbStyles: _customThumbStyles,
    customOutputFormatter,
    style,
    accessibilityLabel,
    accessibilityHint,
    "aria-label": aliasLabel,
    testID,
    "data-testid": aliasID,
    ...rest
  } = props
  const name = accessibilityLabel ?? aliasLabel ?? label
  if (typeof name !== "string" || !name.trim())
    throw new TypeError("Slider: a nonempty native name or label is required")
  for (const [key, dimension] of Object.entries({ width, height, maxWidth }))
    validateNativeDisplayDimension(dimension, "Slider", key)
  validateNativeColor(trackColor, "Slider", "trackColor")
  const theme = useNativeTheme()
  const numeric = useNativeSliderState(props)
  const state = numeric.state
  const target = nativeControlTarget()
  const track = useRef<View>(null)
  const targetRefs = useRef(new Map<number, View>())
  const bodyRefs = useRef(new Map<number, View>())
  const [bodySizes, setBodySizes] = useState<Record<number, TSize>>({})
  const [targetSizes, setTargetSizes] = useState<Record<number, TSize>>({})
  const [trackSize, setTrackSize] = useState<TSize>({ width: 0, height: 0 })
  const vertical = orientation === "vertical"
  const maxTarget = Math.max(
    target,
    ...state.values.map((_, index) => targetSizes[index]?.[vertical ? "height" : "width"] ?? target),
  )
  const crossTarget = Math.max(
    target,
    ...state.values.map((_, index) => targetSizes[index]?.[vertical ? "width" : "height"] ?? target),
  )
  const gesture = useNativeSliderGesture(
    numeric,
    track,
    targetRefs,
    bodyRefs,
    orientation,
    direction,
    maxTarget,
    `${trackSize.width}:${trackSize.height}`,
  )
  const identity = testID ?? aliasID ?? "slider"
  const base: ViewStyle = { width: width ?? 300, height, maxWidth }
  const baseline = { ...base, ...resolveNativeStyle(customStyles, "Slider", "customStyles") }
  const rootStyle = resolveNativeStyle(
    [baseline, typeof style === "function" ? style({ orientation, isDisabled, state, defaultStyle: baseline }) : style],
    "Slider",
    "style",
  )
  const boundedHeight = rootStyle.height !== undefined && rootStyle.height !== null && rootStyle.height !== "auto"
  const trackStyle = resolveNativeStyle(
    [
      {
        position: "relative",
        cursor: "pointer",
        width: "100%",
        height: vertical ? (boundedHeight ? undefined : 150) : crossTarget,
        ...(vertical && boundedHeight ? { flex: 1, minHeight: 0 } : {}),
        ...(trackColor === undefined ? {} : { backgroundColor: trackColor }),
      },
      customTrackStyles,
    ],
    "Slider",
    "customTrackStyles",
  )
  const output = customOutputFormatter
    ? customOutputFormatter([...state.values])
    : state.values.map((_, index) => state.getThumbValueLabel(index)).join(" – ")
  if (typeof output !== "string") throw new TypeError("Slider: customOutputFormatter must return a string")
  useLayoutEffect(() => {
    if (state.focusedThumb !== undefined && !isDisabled) targetRefs.current.get(state.focusedThumb)?.focus()
  }, [state.focusedThumb, isDisabled])
  const remember = (setter: typeof setBodySizes, index: number, size: TSize) =>
    setter((old) => {
      if (
        Math.abs((old[index]?.width ?? -1) - size.width) < 0.0001 &&
        Math.abs((old[index]?.height ?? -1) - size.height) < 0.0001
      )
        return old
      return { ...old, [index]: size }
    })
  useLayoutEffect(() => {
    const keep = (old: Record<number, TSize>) => {
      const entries = Object.entries(old).filter(([index]) => Number(index) < state.values.length)
      return entries.length === Object.keys(old).length ? old : Object.fromEntries(entries)
    }
    setBodySizes(keep)
    setTargetSizes(keep)
  }, [state.values.length])
  const extent = vertical ? trackSize.height : trackSize.width
  const inset = sliderInset(extent, maxTarget)
  return (
    <View {...rest} ref={ref} testID={identity} accessible={false} style={rootStyle}>
      <View
        accessible={false}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <Text
          testID={`${identity}-label`}
          nativeID={labelID}
          elementType="label"
          variant="b11"
          customStyles={[{ flexShrink: 1 }, customLabelStyles]}
          onPress={() => {
            if (!isDisabled && state.values.length) state.setFocusedThumb(0)
          }}
        >
          {label}
        </Text>
        <Text
          testID={`${identity}-output`}
          variant="b11"
          fontWeight="bold"
          customStyles={customOutputStyles}
          accessibilityLiveRegion="none"
        >
          {output}
        </Text>
      </View>
      <View
        ref={track}
        testID={`${identity}-track`}
        accessible={false}
        collapsable={false}
        style={trackStyle}
        {...gesture.handlers}
        onLayout={({ nativeEvent: { layout } }) =>
          track.current &&
          [layout.width, layout.height].every((value) => Number.isFinite(value) && value >= 0) &&
          setTrackSize((old) =>
            old.width === layout.width && old.height === layout.height
              ? old
              : { width: layout.width, height: layout.height },
          )
        }
      >
        <View
          testID={`${identity}-rail`}
          accessible={false}
          pointerEvents="none"
          style={{
            position: "absolute",
            backgroundColor: theme.colors.controlBorder,
            borderRadius: getNativeControlRadius(theme, geometry),
            ...(vertical
              ? { width: 3, top: inset, bottom: inset, left: "50%", transform: [{ translateX: -1.5 }] }
              : { height: 3, left: inset, right: inset, top: "50%", transform: [{ translateY: -1.5 }] }),
          }}
        />
        {state.values.map((current, index) => {
          const lifetime: { target: View | null; body: View | null } = { target: null, body: null }
          const enabled = state.isThumbEditable(index)
          const thumb = getSliderThumbStyles(
            theme,
            props,
            state.isThumbDragging(index),
            state.focusedThumb === index && enabled,
            target,
            bodySizes[index] ?? { width: 18, height: 18 },
          )
          const fraction = state.getThumbPercent(index)
          const position = inset + (vertical || direction === "rtl" ? 1 - fraction : fraction) * (extent - 2 * inset)
          const lower = state.getThumbMinValue(index),
            upper = state.getThumbMaxValue(index)
          const actions = enabled
            ? [...(current < upper ? [{ name: "increment" }] : []), ...(current > lower ? [{ name: "decrement" }] : [])]
            : []
          return (
            <View
              key={index}
              ref={(node) => {
                if (node) {
                  lifetime.target = node
                  targetRefs.current.set(index, node)
                } else {
                  const old = lifetime.target
                  lifetime.target = null
                  if (targetRefs.current.get(index) === old) targetRefs.current.delete(index)
                }
              }}
              testID={`${identity}-thumb-${index + 1}-target`}
              accessible
              accessibilityRole="adjustable"
              focusable={enabled}
              accessibilityLabel={`${name}, ${thumbAriaLabels?.[index] || `Slider Thumb ${index + 1}`}`}
              accessibilityHint={accessibilityHint}
              accessibilityState={{ disabled: !enabled }}
              accessibilityValue={{ min: lower, max: upper, now: current, text: state.getThumbValueLabel(index) }}
              accessibilityActions={actions}
              onAccessibilityAction={({ nativeEvent: { actionName } }) => {
                if (
                  !lifetime.target ||
                  index >= state.values.length ||
                  !state.isThumbEditable(index) ||
                  !actions.some((action) => action.name === actionName)
                )
                  return
                state.setThumbDragging(index, true)
                try {
                  if (actionName === "increment") state.incrementThumb(index, state.step)
                  else state.decrementThumb(index, state.step)
                } catch (error) {
                  numeric.cancel()
                  throw error
                }
                state.setThumbDragging(index, false)
              }}
              onFocus={() => {
                if (lifetime.target && index < state.values.length && state.isThumbEditable(index))
                  state.setFocusedThumb(index)
              }}
              onBlur={() => {
                if (lifetime.target && state.focusedThumb === index) state.setFocusedThumb(undefined)
              }}
              style={[
                {
                  position: "absolute",
                  left: vertical ? "50%" : position,
                  top: vertical ? position : "50%",
                  transform: [{ translateX: "-50%" }, { translateY: "-50%" }],
                },
                thumb.layout,
              ]}
              onLayout={({ nativeEvent: { layout } }) =>
                lifetime.target &&
                [layout.width, layout.height].every((value) => Number.isFinite(value) && value >= 0) &&
                remember(setTargetSizes, index, { width: layout.width, height: layout.height })
              }
            >
              <View
                ref={(node) => {
                  if (node) {
                    lifetime.body = node
                    bodyRefs.current.set(index, node)
                  } else {
                    const old = lifetime.body
                    lifetime.body = null
                    if (bodyRefs.current.get(index) === old) bodyRefs.current.delete(index)
                  }
                }}
                testID={`${identity}-thumb-${index + 1}`}
                accessible={false}
                pointerEvents="none"
                style={thumb.paint}
                onLayout={({ nativeEvent: { layout } }) =>
                  lifetime.body &&
                  [layout.width, layout.height].every((value) => Number.isFinite(value) && value >= 0) &&
                  remember(setBodySizes, index, { width: layout.width, height: layout.height })
                }
              />
            </View>
          )
        })}
      </View>
    </View>
  )
})
SliderRoot.displayName = "Slider"

export const Slider = SliderRoot as <T extends TNativeSliderValue = readonly number[]>(
  props: TNativeSliderProps<T> & RefAttributes<TNativeSliderRef>,
) => ReactElement | null
