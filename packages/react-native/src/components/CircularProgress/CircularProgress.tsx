import { forwardRef } from "react"
import { Animated } from "react-native"
import Svg, { Circle, Path, Text as SVGText } from "react-native-svg"

import { useNativeTheme } from "../../theme"
import { useNativeContentContext } from "../NativeContentContext"
import { useNativeInheritedTextStyle } from "../NativeTextStyleProvider"

import { getNativeCircularGeometry } from "./model"
import { useNativeCircularOffset } from "./motion"
import { NativeCircularProgressRoot } from "./NativeCircularProgressRoot"
import {
  getNativeCircularStyles,
  getNativeCircularRootStyle,
  nativeCircularPresentation,
  nativeCircularSVGPresentation,
} from "./styles"
import type { TNativeCircularProgressProps, TNativeCircularProgressRef } from "./types"

const AnimatedPath = Animated.createAnimatedComponent(Path)

export const CircularProgress = forwardRef<TNativeCircularProgressRef, TNativeCircularProgressProps>((props, ref) => {
  const {
    value,
    minValue,
    maxValue,
    valueLabel,
    isIndeterminate,
    locale,
    formatOptions,
    slot,
    render,
    height: _height,
    width: _width,
    backgroundColor: _backgroundColor,
    pathColor: _pathColor,
    trackColor: _trackColor,
    order: _order,
    circleRatio: _circleRatio,
    backgroundPadding: _backgroundPadding,
    strokeWidth = 6,
    strokeLineCap: _strokeLineCap,
    counterClockwise: _counterClockwise,
    text: _text,
    customStyles: _customStyles,
    style: _style,
    customSVGStyles: _svgStyles,
    customTrackStyles: _trackStyles,
    customPathStyles: _pathStyles,
    customTextStyles: _textStyles,
    customBackgroundStyles: _backgroundStyles,
    children: _children,
    accessibilityLabel,
    "aria-label": aliasLabel,
    ariaLabel,
    accessibilityLabelledBy,
    "aria-labelledby": aliasLabelledBy,
    ariaLabelledBy,
    "aria-valuemin": _ariaMin,
    "aria-valuemax": _ariaMax,
    "aria-valuenow": _ariaNow,
    "aria-valuetext": _ariaText,
    testID,
    "data-testid": aliasID,
    ...native
  } = props
  const theme = useNativeTheme()
  const geometry = getNativeCircularGeometry(props)
  const styles = getNativeCircularStyles(theme, props)
  const dashOffset = useNativeCircularOffset(geometry.canDrawPath ? geometry.pathOffset : undefined)
  const identity = testID ?? aliasID ?? "circular-progress"
  const hasStroke = Number.isFinite(strokeWidth) && strokeWidth >= 0
  return (
    <NativeCircularProgressRoot
      {...native}
      ref={ref}
      id={native.id ?? native.nativeID}
      nativeID={undefined}
      {...{ value, minValue, maxValue, valueLabel, isIndeterminate, locale, formatOptions, slot, render }}
      accessibilityLabel={accessibilityLabel ?? aliasLabel ?? ariaLabel}
      accessibilityLabelledBy={accessibilityLabelledBy ?? aliasLabelledBy ?? ariaLabelledBy}
      style={(state) => getNativeCircularRootStyle(props, state)}
      testID={identity}
    >
      <NativeCircularDrawing {...{ sourceProps: props, styles, geometry, dashOffset, identity, hasStroke }} />
    </NativeCircularProgressRoot>
  )
})
CircularProgress.displayName = "CircularProgress"

type TDrawingProps = {
  sourceProps: TNativeCircularProgressProps
  styles: ReturnType<typeof getNativeCircularStyles>
  geometry: ReturnType<typeof getNativeCircularGeometry>
  dashOffset: ReturnType<typeof useNativeCircularOffset>
  identity: string
  hasStroke: boolean
}
const NativeCircularDrawing = ({ sourceProps, styles, geometry, dashOffset, identity, hasStroke }: TDrawingProps) => {
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const inherited = useNativeInheritedTextStyle()
  const { backgroundColor, text, strokeWidth = 6 } = sourceProps
  return (
    <Svg
      color={context?.foregroundColor ?? theme.colors.foreground}
      {...nativeCircularSVGPresentation({
        ...styles.svg,
        fontFamily: styles.svg.fontFamily ?? inherited?.fontFamily,
        fontSize: styles.svg.fontSize ?? inherited?.fontSize,
        fontWeight: styles.svg.fontWeight ?? inherited?.fontWeight,
        fontStyle: styles.svg.fontStyle ?? inherited?.fontStyle,
        letterSpacing: styles.svg.letterSpacing ?? inherited?.letterSpacing,
      })}
      width={styles.svg.width ?? "100%"}
      height={styles.svg.height ?? "100%"}
      viewBox="0 0 100 100"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={`${identity}-svg`}
    >
      {backgroundColor ? (
        <Circle
          cx={50}
          cy={50}
          r={50}
          {...nativeCircularPresentation(styles.background)}
          testID={`${identity}-background`}
        />
      ) : null}
      {geometry.canDrawTrack && hasStroke ? (
        <Path
          fillOpacity={0}
          strokeWidth={strokeWidth}
          {...nativeCircularPresentation(styles.track)}
          d={geometry.description}
          strokeDasharray={[geometry.circumference, geometry.circumference]}
          strokeDashoffset={geometry.trackOffset}
          testID={`${identity}-track`}
        />
      ) : null}
      {geometry.canDrawPath && hasStroke ? (
        <AnimatedPath
          fillOpacity={0}
          strokeWidth={strokeWidth}
          {...nativeCircularPresentation(styles.path)}
          d={geometry.description}
          strokeDasharray={[geometry.circumference, geometry.circumference]}
          strokeDashoffset={dashOffset}
          testID={`${identity}-path`}
        />
      ) : null}
      {text ? (
        <SVGText x={50} y={50} {...nativeCircularPresentation(styles.text)} testID={`${identity}-text`}>
          {text}
        </SVGText>
      ) : null}
    </Svg>
  )
}
