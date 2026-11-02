import type { ReactNode } from "react"
import type {
  ColorValue,
  NativeSyntheticEvent,
  PointerEvent,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from "react-native"

import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeButtonProps } from "../Button/types"
import type { TNativeTextProps } from "../Text/types"

export const AVAILABLE_TOAST_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
] as const
export type TNativeToastPosition = (typeof AVAILABLE_TOAST_POSITIONS)[number]
export const TOAST_POSITION__TOP_LEFT = AVAILABLE_TOAST_POSITIONS[0]
export const TOAST_POSITION__TOP_CENTER = AVAILABLE_TOAST_POSITIONS[1]
export const TOAST_POSITION__TOP_RIGHT = AVAILABLE_TOAST_POSITIONS[2]
export const TOAST_POSITION__BOTTOM_RIGHT = AVAILABLE_TOAST_POSITIONS[3]
export const TOAST_POSITION__BOTTOM_CENTER = AVAILABLE_TOAST_POSITIONS[4]
export const TOAST_POSITION__BOTTOM_LEFT = AVAILABLE_TOAST_POSITIONS[5]
export const AVAILABLE_TOAST_TYPES = ["info", "warning", "error", "danger", "delete", "success"] as const
export type TNativeToastType = (typeof AVAILABLE_TOAST_TYPES)[number]
export const TOAST_TYPE__INFO = AVAILABLE_TOAST_TYPES[0]
export const TOAST_TYPE__WARNING = AVAILABLE_TOAST_TYPES[1]
export const TOAST_TYPE__ERROR = AVAILABLE_TOAST_TYPES[2]
export const TOAST_TYPE__DANGER = AVAILABLE_TOAST_TYPES[3]
export const TOAST_TYPE__DELETE = AVAILABLE_TOAST_TYPES[4]
export const TOAST_TYPE__SUCCESS = AVAILABLE_TOAST_TYPES[5]
export type TNativeToastID = number | string
export const DEFAULT_TOAST_DURATION = 4000
export const DEFAULT_TOAST_WIDTH = 325
export const DEFAULT_VIEWPORT_OFFSET = 15
export const DEFAULT_MAX_VISIBLE_TOASTS = 5
export const DEFAULT_TOAST_GAP = 15
export const DEFAULT_TOAST_POSITION = "top-right"
export const DURATION_BEFORE_UNMOUNT = 250
export type TNativeToastRootStyle = ViewStyle & { color?: ColorValue }

export type TNativeToastLabels = {
  cancelActionButton: string
  cancelActionButtonAriaLabel: string
  closeButtonAriaLabel: string
  confirmActionButton: string
  confirmActionButtonAriaLabel: string
}
export type TNativePartialToastLabels = Partial<TNativeToastLabels>
export type TNativeToast = {
  id: TNativeToastID
  height?: ViewStyle["height"]
  width?: ViewStyle["width"]
  style?: StyleProp<TNativeToastRootStyle>
  position?: TNativeToastPosition
  type?: TNativeToastType
  geometry?: "orthogonal" | "rounded"
  raised?: boolean
  dismissable?: boolean
  duration?: number | "persistent"
  deletingToast?: boolean
  important?: boolean
  cancelAction?: () => unknown
  confirmAction?: () => unknown
  cancelActionBtnText?: string
  confirmActionBtnText?: string
  labels?: Partial<TNativeToastLabels>
  showCancelAction?: boolean
  showButtons?: boolean
  titleText?: string
  bodyText?: string
  ToastIcon?: ReactNode
  CloseIcon?: ReactNode
  onDismiss?: (toast: TNativeToast) => void
  onAutoClose?: (toast: TNativeToast) => void
  customStyles?: StyleProp<TNativeToastRootStyle>
  customTopRibbonStyles?: StyleProp<ViewStyle>
  customTopRibbonLeftContentStyles?: StyleProp<ViewStyle>
  customTitleStyles?: StyleProp<TextStyle>
  customContentStyles?: StyleProp<ViewStyle>
  customBodyTextStyles?: StyleProp<TextStyle>
  customBodyTextProps?: Partial<TNativeTextProps>
  customBottomRowStyles?: StyleProp<ViewStyle>
  customTimestampStyles?: StyleProp<TextStyle>
  customTimestampTextProps?: Partial<TNativeTextProps>
  customButtonRowStyles?: StyleProp<ViewStyle>
  customCloseButtonStyles?: StyleProp<TextStyle>
  customCloseButtonProps?: Partial<TNativeButtonProps>
  customCancelButtonStyles?: StyleProp<TextStyle>
  customCancelButtonProps?: Partial<TNativeButtonProps>
  customConfirmButtonStyles?: StyleProp<TextStyle>
  customConfirmButtonProps?: Partial<TNativeButtonProps>
}
export type TNativeExternalToast = Omit<TNativeToast, "id"> & { id?: TNativeToastID }
export type TNativeToastPublication = TNativeToast | { id: TNativeToastID; dismiss: true }
export type TNativeToastHeight = { id: TNativeToastID; height: number; position: TNativeToastPosition }

type TNativeToasterUnsupportedRootProps = {
  translate?: never
  inert?: never
  onAuxClick?: never
  onAuxClickCapture?: never
  onContextMenu?: never
  onContextMenuCapture?: never
  onDoubleClick?: never
  onDoubleClickCapture?: never
  onWheel?: never
  onWheelCapture?: never
  onScroll?: never
  onScrollCapture?: never
  onScrollEnd?: never
  onScrollEndCapture?: never
  defaultChecked?: never
  defaultValue?: never
  autoCapitalize?: never
  contentEditable?: never
  enterKeyHint?: never
  spellCheck?: never
  autoCorrect?: never
  unselectable?: never
  inputMode?: never
  onCopy?: never
  onCopyCapture?: never
  onCut?: never
  onCutCapture?: never
  onPaste?: never
  onPasteCapture?: never
  onCompositionEnd?: never
  onCompositionEndCapture?: never
  onCompositionStart?: never
  onCompositionStartCapture?: never
  onCompositionUpdate?: never
  onCompositionUpdateCapture?: never
  onChange?: never
  onChangeCapture?: never
  onBeforeInput?: never
  onBeforeInputCapture?: never
  onInput?: never
  onInputCapture?: never
  onReset?: never
  onResetCapture?: never
  onSubmit?: never
  onSubmitCapture?: never
  onInvalid?: never
  onInvalidCapture?: never
  onLoad?: never
  onLoadCapture?: never
  onError?: never
  onErrorCapture?: never
  onAbort?: never
  onAbortCapture?: never
  onCanPlay?: never
  onCanPlayCapture?: never
  onCanPlayThrough?: never
  onCanPlayThroughCapture?: never
  onDurationChange?: never
  onDurationChangeCapture?: never
  onEmptied?: never
  onEmptiedCapture?: never
  onEncrypted?: never
  onEncryptedCapture?: never
  onEnded?: never
  onEndedCapture?: never
  onLoadedData?: never
  onLoadedDataCapture?: never
  onLoadedMetadata?: never
  onLoadedMetadataCapture?: never
  onLoadStart?: never
  onLoadStartCapture?: never
  onPause?: never
  onPauseCapture?: never
  onPlay?: never
  onPlayCapture?: never
  onPlaying?: never
  onPlayingCapture?: never
  onProgress?: never
  onProgressCapture?: never
  onRateChange?: never
  onRateChangeCapture?: never
  onSeeked?: never
  onSeekedCapture?: never
  onSeeking?: never
  onSeekingCapture?: never
  onStalled?: never
  onStalledCapture?: never
  onSuspend?: never
  onSuspendCapture?: never
  onTimeUpdate?: never
  onTimeUpdateCapture?: never
  onVolumeChange?: never
  onVolumeChangeCapture?: never
  onWaiting?: never
  onWaitingCapture?: never
  onSelect?: never
  onSelectCapture?: never
  "aria-activedescendant"?: never
  "aria-atomic"?: never
  "aria-autocomplete"?: never
  "aria-braillelabel"?: never
  "aria-brailleroledescription"?: never
  "aria-colcount"?: never
  "aria-colindex"?: never
  "aria-colindextext"?: never
  "aria-colspan"?: never
  "aria-controls"?: never
  "aria-current"?: never
  "aria-description"?: never
  "aria-errormessage"?: never
  "aria-flowto"?: never
  "aria-haspopup"?: never
  "aria-invalid"?: never
  "aria-keyshortcuts"?: never
  "aria-level"?: never
  "aria-multiline"?: never
  "aria-multiselectable"?: never
  "aria-orientation"?: never
  "aria-owns"?: never
  "aria-placeholder"?: never
  "aria-posinset"?: never
  "aria-pressed"?: never
  "aria-readonly"?: never
  "aria-relevant"?: never
  "aria-required"?: never
  "aria-roledescription"?: never
  "aria-rowcount"?: never
  "aria-rowindex"?: never
  "aria-rowindextext"?: never
  "aria-rowspan"?: never
  "aria-setsize"?: never
  "aria-sort"?: never
  contextMenu?: never
  popover?: never
  popoverTargetAction?: never
  popoverTarget?: never
  onAnimationStart?: never
  onAnimationStartCapture?: never
  onAnimationEnd?: never
  onAnimationEndCapture?: never
  onAnimationIteration?: never
  onAnimationIterationCapture?: never
  onToggle?: never
  onBeforeToggle?: never
  onTransitionCancel?: never
  onTransitionCancelCapture?: never
  onTransitionEnd?: never
  onTransitionEndCapture?: never
  onTransitionRun?: never
  onTransitionRunCapture?: never
  onTransitionStart?: never
  onTransitionStartCapture?: never
  suppressContentEditableWarning?: never
  suppressHydrationWarning?: never
  nonce?: never
  slot?: never
  radioGroup?: never
  about?: never
  content?: never
  datatype?: never
  inlist?: never
  prefix?: never
  property?: never
  rel?: never
  resource?: never
  rev?: never
  typeof?: never
  vocab?: never
  autoSave?: never
  color?: never
  itemProp?: never
  itemScope?: never
  itemType?: never
  itemID?: never
  itemRef?: never
  results?: never
  security?: never
  is?: never
  exportparts?: never
  part?: never
  dir?: never
  hidden?: never
  lang?: never
  title?: never
  accessKey?: never
  autoFocus?: never
  onKeyPress?: never
  onKeyPressCapture?: never
  draggable?: never
  "aria-dropeffect"?: never
  "aria-grabbed"?: never
  onDrag?: never
  onDragCapture?: never
  onDragEnd?: never
  onDragEndCapture?: never
  onDragEnter?: never
  onDragEnterCapture?: never
  onDragExit?: never
  onDragExitCapture?: never
  onDragLeave?: never
  onDragLeaveCapture?: never
  onDragOver?: never
  onDragOverCapture?: never
  onDragStart?: never
  onDragStartCapture?: never
  onDrop?: never
  onDropCapture?: never
  dangerouslySetInnerHTML?: never
}

export type TNativeToasterProps = TNativeToasterUnsupportedRootProps &
  Omit<TNativeFocusViewProps, "children" | "style" | "onFocus" | "onBlur"> & {
    onKeyDownCapture?: TNativeFocusViewProps["onKeyDown"]
    onKeyUpCapture?: TNativeFocusViewProps["onKeyUp"]
    onFocus?: ViewProps["onFocus"]
    onBlur?: ViewProps["onBlur"]
    onFocusCapture?: ViewProps["onFocus"]
    onBlurCapture?: ViewProps["onBlur"]
    onTouchStartCapture?: ViewProps["onTouchStart"]
    onTouchMoveCapture?: ViewProps["onTouchMove"]
    onTouchCancelCapture?: ViewProps["onTouchCancel"]
    onClick?: (event: PointerEvent | NativeSyntheticEvent<Record<never, never>>) => void
    onClickCapture?: (event: PointerEvent | NativeSyntheticEvent<Record<never, never>>) => void
    onPointerOver?: ViewProps["onPointerEnter"]
    onPointerOverCapture?: ViewProps["onPointerEnter"]
    onPointerOut?: ViewProps["onPointerLeave"]
    onPointerOutCapture?: ViewProps["onPointerLeave"]
    onGotPointerCapture?: ViewProps["onPointerDown"]
    onGotPointerCaptureCapture?: ViewProps["onPointerDown"]
    onLostPointerCapture?: ViewProps["onPointerDown"]
    onLostPointerCaptureCapture?: ViewProps["onPointerDown"]
    duration?: number | "persistent"
    pauseWhenPageIsHidden?: boolean
    expandToggleHotkey?: readonly string[]
    dismissalHotkey?: readonly string[]
    position?: TNativeToastPosition
    toastGap?: number
    offset?: number
    expandByDefault?: boolean
    maxVisibleToasts?: number
    toastLabels?: Partial<TNativeToastLabels>
    customRootStyles?: StyleProp<ViewStyle>
    customStyles?: StyleProp<ViewStyle>
    customStackStyles?: StyleProp<ViewStyle>
    customToastBridgeStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle>
    "data-testid"?: string
    "aria-label"?: string
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
    ariaDetails?: string
    "aria-describedby"?: string
    "aria-details"?: string
    labels?: { descriptionLabel?: string; detailsLabel?: string; regionRoleDescription?: string }
  }

export type TNativeToastProps = {
  toast: TNativeToast
  index: number
  numToasts: number
  position: TNativeToastPosition
  offset: number
  firstHeight: number
  maxVisibleToasts: number
  toasterExpanded: boolean
  expandByDefault?: boolean
  interacting: boolean
  pauseWhenPageIsHidden?: boolean
  duration?: number | "persistent"
  dismissalHotkey?: readonly string[]
  toastLabels?: Partial<TNativeToastLabels>
  toastGap?: number
  removeToast: (toast: TNativeToast) => void
  onHeight: (id: TNativeToastID, height: number) => void
}
