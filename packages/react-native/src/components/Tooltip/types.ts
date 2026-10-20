import type { RefObject } from "react"
import type { TextInput, View } from "react-native"

import type { TNativeClickPopoverProps } from "../ClickPopover/types"

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
> & {
  triggerRef?: RefObject<View | TextInput | null>
  boundaryRef?: RefObject<View | TextInput | null>
  descriptionLabel?: string
  detailsLabel?: string
  "aria-describedby"?: string
  "aria-details"?: string
}
export type TNativeHoverPopoverProps = TNativeTooltipProps
export type TNativeHoverPopoverRef = TNativeTooltipRef
