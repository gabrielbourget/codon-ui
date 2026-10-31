import { createRef } from "react"
import { Animated, PlatformColor, type View } from "react-native"

import { Indicator, LineSegment, type IndicatorProps, type LineSegmentProps } from "../src"

export const indicatorProps: IndicatorProps = {
  isActive: false,
  size: "50%",
  color: PlatformColor("systemBlueColor"),
  borderWidth: 0,
  shape: "square",
  style: (state) => [state.defaultStyle, { opacity: state.isActive ? 1 : 0.5 }],
}
export const ValidIndicator = <Indicator {...indicatorProps} ref={createRef<View>()} />
export const lineProps: LineSegmentProps = {
  width: "80%",
  height: "auto",
  size: 0,
  direction: "vertical",
  accessible: true,
  accessibilityLabel: "Boundary",
  onLayout: (event) => event.nativeEvent.layout.width,
  style: (state) => [state.defaultStyle, { opacity: state.direction === "vertical" ? 1 : 0 }],
}
export const ValidLineSegment = <LineSegment {...lineProps} ref={createRef<View>()} />
// @ts-expect-error Native dimensions replace CSS length strings.
export const InvalidIndicatorSize = <Indicator size="1rem" />
// @ts-expect-error Border thickness is a native numeric unit.
export const InvalidIndicatorBorder = <Indicator borderWidth="2px" />
// @ts-expect-error Indicator is a controlled visual value, not an uncontrolled input.
export const InvalidIndicatorDefault = <Indicator defaultActive />
// @ts-expect-error Supported shapes are explicit.
export const InvalidIndicatorShape = <Indicator shape="triangle" />
// @ts-expect-error Browser class plumbing has native style equivalents.
export const InvalidIndicatorClass = <Indicator className="web" />
// @ts-expect-error Neither display component owns children.
export const InvalidIndicatorChildren = <Indicator>Content</Indicator>
// @ts-expect-error Native dimensions replace CSS units.
export const InvalidLineHeight = <LineSegment height="20px" />
// @ts-expect-error Native dimensions support percentages but not CSS calculations.
export const InvalidLineWidth = <LineSegment width="calc(100% - 5px)" />
// @ts-expect-error Static top-level dimension props do not accept Animated nodes.
export const InvalidLineAnimation = <LineSegment size={new Animated.Value(5)} />
// @ts-expect-error Direction is restricted to canonical tokens.
export const InvalidLineDirection = <LineSegment direction="diagonal" />
// @ts-expect-error Browser classes map to native styles.
export const InvalidLineClass = <LineSegment customClassName="web" />
// @ts-expect-error No browser click event is exposed.
export const InvalidLineClick = <LineSegment onClick={() => undefined} />
// @ts-expect-error Root refs are actual native View instances.
export const InvalidLineRef = <LineSegment ref={createRef<{ tagName: string }>()} />
