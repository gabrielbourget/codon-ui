import type { ReactElement, RefObject } from "react"
import type { TextInput, View } from "react-native"

import type { TNativeFloatingHostRender } from "../ClickPopover/ClickPopover"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"

export type TNativeTooltipState = Readonly<{
  isOpen: boolean
  open: (immediate?: boolean) => void
  close: (immediate?: boolean) => void
}>
export type TNativeTooltipRenderState = Readonly<{
  placement: "top" | "bottom" | "left" | "right" | null
  isEntering: boolean
  isExiting: boolean
  state: TNativeTooltipState
}>

export type TNativeTooltipRef = View
export type TNativeTooltipProps = Omit<
  TNativeClickPopoverProps,
  | "childIsDialog"
  | "customDialogStyles"
  | "isNonModal"
  | "isKeyboardDismissDisabled"
  | "initialFocusRef"
  | "restoreFocusRef"
  | "scrollRef"
  | "shouldCloseOnInteractOutside"
  | "trigger"
  | "triggerRef"
  | "boundaryRef"
  | "focusable"
  | "tabIndex"
  | "collapsable"
  | "accessibilityViewIsModal"
> & {
  focusable?: false
  tabIndex?: -1
  collapsable?: false
  accessibilityViewIsModal?: false
  render?: (props: Parameters<TNativeFloatingHostRender>[0], state: TNativeTooltipRenderState) => ReactElement
  onTouchStartCapture?: TNativeClickPopoverProps["onTouchStart"]
  onTouchMoveCapture?: TNativeClickPopoverProps["onTouchMove"]
  onTouchCancelCapture?: TNativeClickPopoverProps["onTouchCancel"]
  triggerRef?: RefObject<View | TextInput | null>
  boundaryRef?: RefObject<View | TextInput | null>
  descriptionLabel?: string
  detailsLabel?: string
  "aria-describedby"?: string
  "aria-details"?: string
}
export type TNativeHoverPopoverProps = TNativeTooltipProps
export type TNativeHoverPopoverRef = TNativeTooltipRef
