import { forwardRef, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { nativeAccessibilityIDs, nativeCompositeLabelProps } from "../../input/accessibilityReferences"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"
import type { TNativeTextRef } from "../Text/types"

import {
  NativeCircularProgressContext,
  NativeCircularProgressLabelBindingContext,
  NativeCircularProgressLabelContext,
  type TNativeCircularProgressContextProps,
} from "./context"
import type { TNativeCircularProgressRenderState, TNativeCircularProgressRootStyle } from "./types"

export const NativeCircularProgressRoot = forwardRef<
  View,
  Omit<TNativeCircularProgressContextProps, "children"> & { value: number; children: ReactNode }
>((authored, ref) => {
  const [props, mergedRef] = useNativeContextProps(authored, ref, NativeCircularProgressContext)
  const {
    value = 0,
    minValue = 0,
    maxValue = 100,
    valueLabel,
    isIndeterminate = false,
    locale,
    formatOptions = { style: "percent" },
    style,
    render,
    children,
    slot: _slot,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-label": aliasLabel,
    "aria-labelledby": aliasLabelledBy,
    "aria-describedby": describedBy,
    "aria-details": detailsBy,
    labels,
    accessibilityLabel,
    accessibilityLabelledBy,
    ...native
  } = props
  const inheritedLocale = useNativeLocale()
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  const bounded = Math.min(Math.max(value, minValue), maxValue)
  const percentage = isIndeterminate ? undefined : ((bounded - minValue) / (maxValue - minValue)) * 100
  const valueText = isIndeterminate
    ? undefined
    : valueLabel ||
      new Intl.NumberFormat(locale ?? inheritedLocale.locale, formatOptions).format(
        formatOptions.style === "percent" ? percentage! / 100 : bounded,
      )
  const state: TNativeCircularProgressRenderState = { percentage, valueText, isIndeterminate }
  const defaults: TNativeCircularProgressRootStyle = { width: 100, height: 100 }
  const resolvedStyle = resolveNativeStyle<TNativeCircularProgressRootStyle>(
    [defaults, typeof style === "function" ? style({ ...state, defaultStyle: defaults }) : style],
    "CircularProgress",
    "root context",
  )
  const { color, ...viewStyle } = resolvedStyle
  validateNativeColor(color, "CircularProgress", "root context color")
  const rootID = useId()
  const labelID = useId()
  const [hasLabel, setHasLabel] = useState(false)
  const [boundLabelID, setBoundLabelID] = useState<string>()
  const labelBinding = useRef<symbol | undefined>(undefined)
  const bindID = useCallback((id: string | undefined) => {
    const token = Symbol()
    labelBinding.current = token
    setBoundLabelID(id)
    return () => {
      if (labelBinding.current === token) {
        labelBinding.current = undefined
        setBoundLabelID(undefined)
      }
    }
  }, [])
  const labelRef = useRef(false)
  const bindLabel = useCallback((node: TNativeTextRef | null) => {
    labelRef.current = !!node
    setHasLabel(!!node)
  }, [])
  useLayoutEffect(() => {
    if (!labelRef.current) setHasLabel(false)
  }, [])
  const labelContext = useMemo(
    () => ({ id: boundLabelID ?? labelID, ref: bindLabel }),
    [labelID, boundLabelID, bindLabel],
  )
  const labelBindingContext = useMemo(() => ({ ref: bindLabel, bindID }), [bindLabel, bindID])
  const label = accessibilityLabel ?? aliasLabel ?? ariaLabel
  const authoredReferences = nativeAccessibilityIDs(accessibilityLabelledBy ?? aliasLabelledBy ?? ariaLabelledBy)
  const references = hasLabel ? [boundLabelID ?? labelID, ...(authoredReferences ?? [])] : authoredReferences
  const identity = nativeCompositeLabelProps(
    { id: props.id, nativeID: props.nativeID, accessibilityLabel: label, nativeLabelledBy: references },
    rootID,
  )
  const validRange = [minValue, maxValue, bounded].every(Number.isFinite) && maxValue > minValue
  const semanticText = valueText === undefined ? undefined : String(valueText)
  const host = {
    ...native,
    ...identity,
    ref: mergedRef,
    accessible: true,
    focusable: props.focusable ?? props.tabIndex === 0,
    role: "progressbar" as const,
    accessibilityRole: "progressbar" as const,
    accessibilityLabel: label,
    accessibilityLabelledBy: undefined,
    nativeDescribedBy: nativeAccessibilityIDs(describedBy ?? ariaDescribedBy),
    nativeDetailsBy: nativeAccessibilityIDs(detailsBy ?? ariaDetails),
    nativeDescriptionLabel: labels?.descriptionLabel,
    nativeDetailsLabel: labels?.detailsLabel,
    accessibilityValue: {
      ...(validRange ? { min: minValue, max: maxValue } : {}),
      ...(!isIndeterminate && validRange ? { now: bounded } : {}),
      text: semanticText,
    },
    "aria-valuemin": validRange ? minValue : undefined,
    "aria-valuemax": validRange ? maxValue : undefined,
    "aria-valuenow": !isIndeterminate && validRange ? bounded : undefined,
    "aria-valuetext": semanticText,
    style: viewStyle,
    children: (
      <NativeCircularProgressLabelContext.Provider value={labelContext}>
        {children}
      </NativeCircularProgressLabelContext.Provider>
    ),
  }
  const foreground = color ?? content?.foregroundColor ?? theme.colors.foreground
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: false }}>
      <NativeTextStyleProvider style={{ color: foreground }}>
        <NativeCircularProgressLabelBindingContext.Provider value={labelBindingContext}>
          {render ? render(host, state) : <NativeFocusView {...host} />}
        </NativeCircularProgressLabelBindingContext.Provider>
      </NativeTextStyleProvider>
    </NativeContentContext.Provider>
  )
})
