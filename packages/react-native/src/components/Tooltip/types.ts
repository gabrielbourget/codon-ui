import type { View } from "react-native"

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
>
export type TNativeHoverPopoverProps = TNativeTooltipProps
export type TNativeHoverPopoverRef = TNativeTooltipRef
