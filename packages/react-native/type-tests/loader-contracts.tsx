import { createRef } from "react"
import { PlatformColor, type View } from "react-native"

import { CircleLoader, LaggingLinesLoader, type CircleLoaderProps, type LaggingLinesLoaderProps } from "../src"

export const circleProps: CircleLoaderProps = {
  duration: "0.85s",
  size: 25,
  spinnerTrackWidth: 0,
  spinnerTrackIsTransparent: false,
  spinnerColor: PlatformColor("systemBlueColor"),
  customStyles: { color: "orange" },
  style: (state) => [state.defaultStyle, { opacity: state.isMotionEnabled ? 1 : 0.5 }],
}
export const ValidCircle = <CircleLoader {...circleProps} ref={createRef<View>()} />
export const lineProps: LaggingLinesLoaderProps = {
  width: "100%",
  duration: 3000,
  customStyles: [{ animationDuration: "500ms", borderRadius: 5, color: "green" }],
  style: (state) => [state.defaultStyle, { color: state.duration === 500 ? "red" : "blue" }],
}
export const ValidLines = <LaggingLinesLoader {...lineProps} ref={createRef<View>()} />
// @ts-expect-error CSS length units use native logical dimensions.
export const InvalidCircleSize = <CircleLoader size="2rem" />
// @ts-expect-error Border thickness is numeric.
export const InvalidTrackWidth = <CircleLoader spinnerTrackWidth="0.25rem" />
// @ts-expect-error CSS variable durations have no native time meaning.
export const InvalidCircleDuration = <CircleLoader duration="var(--time)" />
// @ts-expect-error Loading semantics are owned.
export const InvalidCircleRole = <CircleLoader role="button" />
// @ts-expect-error The loader is indeterminate, with no caller numeric value.
export const InvalidCircleValue = <CircleLoader aria-valuenow={5} />
// @ts-expect-error Busy state cannot be replaced.
export const InvalidBusy = <LaggingLinesLoader aria-busy={false} />
// @ts-expect-error Arbitrary CSS width strings use native dimensions.
export const InvalidLineWidth = <LaggingLinesLoader width="12rem" />
// @ts-expect-error Unsupported time strings reject at the public boundary.
export const InvalidSlideDuration = <LaggingLinesLoader customStyles={{ animationDuration: "fast" }} />
// @ts-expect-error These wrappers own their graphic children.
export const InvalidChildren = <CircleLoader>Content</CircleLoader>
// @ts-expect-error Browser classes are not a native API.
export const InvalidClass = <LaggingLinesLoader className="web" />
// @ts-expect-error The native root ref is a View.
export const InvalidRef = <CircleLoader ref={createRef<{ tagName: string }>()} />
