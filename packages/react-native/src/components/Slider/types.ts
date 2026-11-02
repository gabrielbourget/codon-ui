import type { ReactElement, RefAttributes } from "react"
import type { ColorValue, StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeSlotProps } from "../../collection/context"
import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

export const NATIVE_SLIDER_ORIENTATIONS = ["horizontal", "vertical"] as const
export const NATIVE_SLIDER_DIRECTIONS = ["ltr", "rtl"] as const
export type TNativeSliderOrientation = (typeof NATIVE_SLIDER_ORIENTATIONS)[number]
export type TNativeSliderDirection = (typeof NATIVE_SLIDER_DIRECTIONS)[number]
export type TNativeSliderRef = View
export type TNativeSliderValue = number | readonly number[]
export type TNativeSliderState = Readonly<{
  values: readonly number[]
  defaultValues: readonly number[]
  focusedThumb: number | undefined
  step: number
  pageSize: number
  orientation: TNativeSliderOrientation
  isDisabled: boolean
  getThumbValue: (index: number) => number
  setThumbValue: (index: number, value: number) => void
  setThumbPercent: (index: number, percent: number) => void
  isThumbDragging: (index: number) => boolean
  setThumbDragging: (index: number, dragging: boolean) => void
  setFocusedThumb: (index: number | undefined) => void
  getThumbPercent: (index: number) => number
  getValuePercent: (value: number) => number
  getThumbValueLabel: (index: number) => string
  getFormattedValue: (value: number) => string
  getThumbMinValue: (index: number) => number
  getThumbMaxValue: (index: number) => number
  getPercentValue: (percent: number) => number
  isThumbEditable: (index: number) => boolean
  setThumbEditable: (index: number, editable: boolean) => void
  incrementThumb: (index: number, stepSize?: number) => void
  decrementThumb: (index: number, stepSize?: number) => void
}>
export type TNativeSliderRenderState = Readonly<{
  orientation: TNativeSliderOrientation
  isDisabled: boolean
  state: TNativeSliderState
}>
export type TNativeSliderStyleState = TNativeSliderRenderState & { defaultStyle: ViewStyle }
export type TNativeSliderRootRender = (
  props: ViewProps & RefAttributes<TNativeSliderRef>,
  state: TNativeSliderRenderState,
) => ReactElement

type TSliderValueProps<T extends TNativeSliderValue> = {
  value?: T
  defaultValue?: T
  onChange?: (value: T extends number ? number : number[]) => void
  onChangeEnd?: (value: T extends number ? number : number[]) => void
}
type TNamedSlider =
  | { accessibilityLabel: string; "aria-label"?: string; label?: string }
  | { accessibilityLabel?: string; "aria-label": string; label?: string }
  | { accessibilityLabel?: string; "aria-label"?: string; label: string }
  | { slot: string; accessibilityLabel?: string; "aria-label"?: string; label?: string }
  | { labelID: string; accessibilityLabel?: string; "aria-label"?: string; label?: string }
  | {
      accessibilityLabelledBy: NonNullable<ViewProps["accessibilityLabelledBy"]>
      accessibilityLabel?: string
      "aria-label"?: string
      label?: string
    }
  | { "aria-labelledby": string; accessibilityLabel?: string; "aria-label"?: string; label?: string }
type TNativeSliderUnsupportedRootProps = {
  [TKey in
    | "translate"
    | "inert"
    | "defaultChecked"
    | "autoCapitalize"
    | "contentEditable"
    | "enterKeyHint"
    | "spellCheck"
    | "autoCorrect"
    | "unselectable"
    | "inputMode"
    | "onChangeCapture"
    | "aria-activedescendant"
    | "aria-atomic"
    | "aria-autocomplete"
    | "aria-braillelabel"
    | "aria-brailleroledescription"
    | "aria-colcount"
    | "aria-colindex"
    | "aria-colindextext"
    | "aria-colspan"
    | "aria-controls"
    | "aria-current"
    | "aria-description"
    | "aria-errormessage"
    | "aria-flowto"
    | "aria-haspopup"
    | "aria-invalid"
    | "aria-keyshortcuts"
    | "aria-level"
    | "aria-multiline"
    | "aria-multiselectable"
    | "aria-orientation"
    | "aria-owns"
    | "aria-placeholder"
    | "aria-posinset"
    | "aria-pressed"
    | "aria-readonly"
    | "aria-relevant"
    | "aria-required"
    | "aria-roledescription"
    | "aria-rowcount"
    | "aria-rowindex"
    | "aria-rowindextext"
    | "aria-rowspan"
    | "aria-setsize"
    | "aria-sort"
    | "contextMenu"
    | "popover"
    | "popoverTargetAction"
    | "popoverTarget"
    | "onToggle"
    | "onBeforeToggle"
    | "suppressContentEditableWarning"
    | "suppressHydrationWarning"
    | "nonce"
    | "radioGroup"
    | "about"
    | "content"
    | "datatype"
    | "inlist"
    | "prefix"
    | "property"
    | "rel"
    | "resource"
    | "rev"
    | "typeof"
    | "vocab"
    | "autoSave"
    | "color"
    | "itemProp"
    | "itemScope"
    | "itemType"
    | "itemID"
    | "itemRef"
    | "results"
    | "security"
    | "is"
    | "exportparts"
    | "part"
    | "dir"
    | "hidden"
    | "lang"
    | "title"
    | "accessKey"
    | "autoFocus"
    | "dangerouslySetInnerHTML"
    | `on${
        | "AuxClick"
        | "ContextMenu"
        | "DoubleClick"
        | "Wheel"
        | "Scroll"
        | "ScrollEnd"
        | "Copy"
        | "Cut"
        | "Paste"
        | "CompositionEnd"
        | "CompositionStart"
        | "CompositionUpdate"
        | "BeforeInput"
        | "Input"
        | "Reset"
        | "Submit"
        | "Invalid"
        | "Load"
        | "Error"
        | "Abort"
        | "CanPlay"
        | "CanPlayThrough"
        | "DurationChange"
        | "Emptied"
        | "Encrypted"
        | "Ended"
        | "LoadedData"
        | "LoadedMetadata"
        | "LoadStart"
        | "Pause"
        | "Play"
        | "Playing"
        | "Progress"
        | "RateChange"
        | "Seeked"
        | "Seeking"
        | "Stalled"
        | "Suspend"
        | "TimeUpdate"
        | "VolumeChange"
        | "Waiting"
        | "Select"
        | "AnimationStart"
        | "AnimationEnd"
        | "AnimationIteration"
        | "TransitionCancel"
        | "TransitionEnd"
        | "TransitionRun"
        | "TransitionStart"
        | "KeyPress"}${"" | "Capture"}`]?: never
}

export type TNativeSliderProps<T extends TNativeSliderValue = TNativeSliderValue> = Omit<
  ViewProps,
  | "children"
  | "style"
  | "role"
  | "accessibilityRole"
  | "accessible"
  | "accessibilityLabel"
  | "aria-label"
  | "accessibilityValue"
  | "accessibilityState"
  | "accessibilityActions"
  | "onAccessibilityAction"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "aria-disabled"
> &
  TNativeSliderUnsupportedRootProps &
  TNamedSlider &
  TNativeSlotProps &
  TSliderValueProps<T> & {
    render?: TNativeSliderRootRender
    minValue?: number
    maxValue?: number
    step?: number
    isDisabled?: boolean
    orientation?: TNativeSliderOrientation
    direction?: TNativeSliderDirection
    locale?: string
    formatOptions?: Intl.NumberFormatOptions
    labelID?: string
    "aria-describedby"?: string
    "aria-details"?: string
    thumbAriaLabels?: readonly string[]
    form?: string
    formFieldId?: string
    thumbNames?: readonly string[]
    thumbColor?: ColorValue
    trackColor?: ColorValue
    geometry?: TCornerGeometry
    order?: TThemingOrderCode
    raised?: boolean
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    height?: TNativeDisplayDimension
    width?: TNativeDisplayDimension
    maxWidth?: TNativeDisplayDimension
    customStyles?: StyleProp<ViewStyle>
    customLabelStyles?: StyleProp<TextStyle>
    customOutputStyles?: StyleProp<TextStyle>
    customTrackStyles?: StyleProp<ViewStyle>
    customThumbStyles?: StyleProp<ViewStyle>
    customOutputFormatter?: (values: number[]) => string
    style?: StyleProp<ViewStyle> | ((state: TNativeSliderStyleState) => StyleProp<ViewStyle>)
    "data-testid"?: string
  }
