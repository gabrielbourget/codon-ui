import type { ReactElement, ReactNode, RefAttributes, RefObject } from "react"
import type {
  ColorValue,
  NativeSyntheticEvent,
  PointerEvent,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

import type { TNativeFloatingOutsideInteraction } from "../../overlays/floating/interaction"
import type { TThemingOrderCode } from "../../tokens/theme-order"

type TName =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }
type TStaticDimension = number | "auto" | `${number}%`
type TNativeModalClickEvent = PointerEvent | NativeSyntheticEvent<Record<never, never>>
export type TNativeModalRef = View
export type TNativeModalRootStyle = ViewStyle & Pick<TextStyle, "color">
export type TNativeModalViewportProps = ViewProps &
  RefAttributes<View> & {
    // Stock View Flow/configs register these native callbacks, although RN's public ViewProps omits them.
    onClick?: (event: TNativeModalClickEvent) => void
    onClickCapture?: (event: TNativeModalClickEvent) => void
    onPointerOver?: ViewProps["onPointerEnter"]
    onPointerOverCapture?: ViewProps["onPointerEnter"]
    onPointerOut?: ViewProps["onPointerLeave"]
    onPointerOutCapture?: ViewProps["onPointerLeave"]
    // Capture lifecycle delivery also requires a configured native pointer stream and platform registration.
    onGotPointerCapture?: ViewProps["onPointerDown"]
    onGotPointerCaptureCapture?: ViewProps["onPointerDown"]
    onLostPointerCapture?: ViewProps["onPointerDown"]
    onLostPointerCaptureCapture?: ViewProps["onPointerDown"]
    onTouchStartCapture?: ViewProps["onTouchStart"]
    onTouchMoveCapture?: ViewProps["onTouchMove"]
    onTouchCancelCapture?: ViewProps["onTouchCancel"]
  }
export type TNativeModalState = Readonly<{
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  setOpen: (isOpen: boolean) => void
}>
export type TNativeModalRenderState = Readonly<{
  isEntering: false
  isExiting: false
  state: TNativeModalState
}>
export type TNativeModalProps = TName & {
  render?: (props: TNativeModalViewportProps, state: TNativeModalRenderState) => ReactElement
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  isDismissable?: boolean
  shouldCloseOnInteractOutside?: (interaction: TNativeFloatingOutsideInteraction) => boolean
  isKeyboardDismissDisabled?: boolean
  children?: ReactNode
  titleText?: ReactNode
  closeButtonText?: ReactNode
  closeLabel?: string
  color?: ColorValue
  order?: TThemingOrderCode
  geometry?: "rounded" | "orthogonal"
  raised?: boolean
  /** Requires a configured backdrop adapter and a parent-window NativeBackdropHost when true. */
  overlayBlur?: boolean
  width?: TStaticDimension
  height?: TStaticDimension
  isScrollable?: boolean
  onScroll?: ScrollViewProps["onScroll"]
  customStyles?: StyleProp<TNativeModalRootStyle>
  style?: StyleProp<TNativeModalRootStyle>
  customOverlayStyles?: StyleProp<ViewStyle>
  customDialogStyles?: StyleProp<ViewStyle>
  initialFocusRef?: RefObject<View | null>
  restoreFocusRef?: RefObject<View | null>
  testID?: string
  "data-testid"?: string
}
