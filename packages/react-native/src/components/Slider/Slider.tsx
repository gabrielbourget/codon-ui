import {
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefAttributes,
} from "react"
import { View, type ViewStyle } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import { nativeAccessibilityIDs, nativeCompositeLabelProps } from "../../input/accessibilityReferences"
import { focusNativeTarget } from "../../input/focus"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius, nativeControlTarget } from "../selection"
import { Text } from "../Text/Text"

import { NativeSliderContext, NativeSliderStateContext } from "./context"
import { sliderInset, useNativeSliderGesture } from "./gesture"
import { getSliderKeyCommand, SLIDER_KEY_TOKENS } from "./keyboard"
import { useNativeSliderState } from "./state"
import { getSliderThumbStyles } from "./styles"
import { NativeSliderThumbForm } from "./thumbForm"
import { NativeSliderThumbPaint } from "./thumbPaint"
import type { TNativeSliderProps, TNativeSliderRef, TNativeSliderValue } from "./types"
import { useNativeSliderHosts } from "./useNativeSliderHosts"

type TSize = { width: number; height: number }
const SliderRoot = forwardRef<TNativeSliderRef, TNativeSliderProps>((ownProps, forwardedRef) => {
  const [props, ref] = useNativeContextProps(ownProps, forwardedRef, NativeSliderContext)
  const {
    slot: _slot,
    render,
    value: _value,
    defaultValue: _defaultValue,
    onChange: _onChange,
    onChangeEnd: _onChangeEnd,
    minValue: _minValue,
    maxValue: _maxValue,
    step: _step,
    isDisabled = false,
    orientation = "horizontal",
    direction: explicitDirection,
    locale: _locale,
    formatOptions: _formatOptions,
    label,
    labelID,
    thumbAriaLabels,
    thumbNames,
    form,
    formFieldId,
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
    accessibilityLabelledBy,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": aliasLabel,
    testID,
    "data-testid": aliasID,
    ...rest
  } = props
  const explicitName = accessibilityLabel ?? aliasLabel
  const name = explicitName ?? label
  const labelledBy = nativeAccessibilityIDs(labelID ?? accessibilityLabelledBy ?? ariaLabelledBy)?.filter((id) =>
    id.trim(),
  )
  const describedBy = nativeAccessibilityIDs(ariaDescribedBy)
  const detailsBy = nativeAccessibilityIDs(ariaDetails)
  const relationshipID = useId()
  if (
    (name !== undefined && typeof name !== "string") ||
    (!(typeof name === "string" && name.trim()) && !labelledBy?.length)
  )
    throw new TypeError("Slider: a nonempty native name or label is required")
  for (const [key, dimension] of Object.entries({ width, height, maxWidth }))
    validateNativeDisplayDimension(dimension, "Slider", key)
  if (thumbNames !== undefined && (!Array.isArray(thumbNames) || thumbNames.some((name) => typeof name !== "string")))
    throw new TypeError("Slider: thumbNames must be an array of strings")
  validateNativeColor(trackColor, "Slider", "trackColor")
  const theme = useNativeTheme()
  const inheritedLocale = useNativeLocale()
  const direction = explicitDirection ?? inheritedLocale.direction
  const numeric = useNativeSliderState({ ...props, locale: props.locale ?? inheritedLocale.locale })
  const state = numeric.state
  const rootNode = useRef<View>(null)
  const lastRoot = useRef<View>(null)
  const [rootRevision, setRootRevision] = useState(0)
  const bindRoot = useCallback((node: View | null) => {
    rootNode.current = node
    if (node && lastRoot.current !== node) {
      lastRoot.current = node
      setRootRevision((revision) => revision + 1)
    }
  }, [])
  const rootRef = useNativeCollectionRefs(ref, bindRoot)
  const keyboardAction = useRef<{ index: number } | null>(null)
  const [keyboardRevision, setKeyboardRevision] = useState(0)
  const observedNumericRevision = useRef(numeric.revision.current)
  useLayoutEffect(() => {
    if (observedNumericRevision.current !== numeric.revision.current) {
      observedNumericRevision.current = numeric.revision.current
      setKeyboardRevision((revision) => revision + 1)
    }
  })
  useLayoutEffect(() => {
    if (__DEV__ && render && !rootNode.current)
      console.warn("Slider: custom render must forward its ref and props to the actual native root View.")
  }, [render])
  const target = nativeControlTarget()
  const track = useRef<View>(null)
  const trackLifetime: { target: View | null } = { target: null }
  const { targetRefs, bodyRefs, lifetimeFor, bindTarget, bindBody } = useNativeSliderHosts()
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
    trackLifetime,
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
    if (state.focusedThumb !== undefined && !isDisabled)
      focusNativeTarget(targetRefs.current.get(state.focusedThumb) ?? null)
  }, [state.focusedThumb, isDisabled, rootRevision])
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
  const content = (
    <>
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
        ref={(node) => {
          if (node) {
            trackLifetime.target = node
            track.current = node
          } else {
            const original = trackLifetime.target
            trackLifetime.target = null
            if (track.current === original) track.current = null
          }
        }}
        testID={`${identity}-track`}
        accessible={false}
        collapsable={false}
        style={trackStyle}
        {...gesture.handlers}
        onLayout={({ nativeEvent: { layout } }) =>
          trackLifetime.target &&
          trackLifetime.target === track.current &&
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
          const lifetime = lifetimeFor(index)
          const enabled = state.isThumbEditable(index)
          const numericRevision = numeric.revision.current
          const thumbRevision = numeric.thumbRevisions.current.get(index) ?? 0
          const canUseKey = () =>
            !!rootNode.current &&
            !!lifetime.target &&
            lifetime.target === targetRefs.current.get(index) &&
            numeric.revision.current === numericRevision &&
            (numeric.thumbRevisions.current.get(index) ?? 0) === thumbRevision &&
            index < state.values.length &&
            state.isThumbEditable(index)
          const thumbName = thumbAriaLabels?.[index] || `Slider Thumb ${index + 1}`
          const thumbLabel = labelledBy?.length
            ? explicitName
              ? `${explicitName}, ${thumbName}`
              : thumbName
            : `${name}, ${thumbName}`
          const thumbIdentity = nativeCompositeLabelProps(
            {
              nativeID: `${relationshipID}:thumb:${index}`,
              accessibilityLabel: thumbLabel,
              nativeLabelledBy: labelledBy,
            },
            `${relationshipID}:thumb:${index}`,
          )
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
            <NativeFocusHost
              key={index}
              ref={bindTarget(index)}
              testID={`${identity}-thumb-${index + 1}-target`}
              accessible
              accessibilityRole="adjustable"
              focusable={enabled}
              {...thumbIdentity}
              accessibilityLabel={thumbLabel}
              nativeDescribedBy={describedBy}
              nativeDetailsBy={detailsBy}
              accessibilityHint={accessibilityHint}
              accessibilityState={{ disabled: !enabled }}
              accessibilityValue={{ min: lower, max: upper, now: current, text: state.getThumbValueLabel(index) }}
              accessibilityActions={actions}
              nativeKeyPolicy={{
                tokens: SLIDER_KEY_TOKENS,
                isEnabled: enabled,
                lifetimeKey: JSON.stringify([
                  rootRevision,
                  keyboardRevision,
                  numericRevision,
                  thumbRevision,
                  numeric.model.key,
                  state.values.length,
                  index,
                  orientation,
                  direction,
                ]),
                canAct: canUseKey,
                onKey: (event, frame) => {
                  if (!frame.admitted || event.nativeEvent.phase !== "down" || !canUseKey()) return
                  const command = getSliderKeyCommand(event.nativeEvent, state, index, direction)
                  if (!command) return
                  const action = { index }
                  keyboardAction.current = action
                  state.setThumbDragging(index, true)
                  try {
                    command()
                  } catch (error) {
                    if (keyboardAction.current === action) {
                      keyboardAction.current = null
                      numeric.cancelThumb(index)
                    }
                    throw error
                  }
                  if (keyboardAction.current === action) {
                    keyboardAction.current = null
                    state.setThumbDragging(index, false)
                  }
                },
                onRetire: () => {
                  if (keyboardAction.current?.index !== index) return
                  keyboardAction.current = null
                  numeric.cancelThumb(index)
                },
              }}
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
              <NativeSliderThumbPaint
                ref={bindBody(index)}
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
              <NativeSliderThumbForm
                index={index}
                form={form}
                formFieldId={formFieldId}
                name={thumbNames?.[index]}
                state={state}
                root={rootNode}
                thumbs={targetRefs}
              />
            </NativeFocusHost>
          )
        })}
      </View>
    </>
  )
  const rootProps = {
    ...rest,
    ref: rootRef,
    testID: identity,
    accessible: false,
    accessibilityLabelledBy,
    "aria-labelledby": ariaLabelledBy,
    collapsable: false,
    style: rootStyle,
    children: content,
  }
  const root = render ? render(rootProps, { orientation, isDisabled, state }) : <View {...rootProps} />
  return <NativeSliderStateContext.Provider value={state}>{root}</NativeSliderStateContext.Provider>
})
SliderRoot.displayName = "Slider"

export const Slider = SliderRoot as {
  <T extends TNativeSliderValue = readonly number[]>(
    props: TNativeSliderProps<T> & { slot: null } & RefAttributes<TNativeSliderRef>,
  ): ReactElement | null
  <T extends TNativeSliderValue = TNativeSliderValue>(
    props: TNativeSliderProps<T> & RefAttributes<TNativeSliderRef>,
  ): ReactElement | null
}
