import {
  createContext,
  type ComponentPropsWithoutRef,
  type Context,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import type { OverlayTriggerState } from "../ComboBox/state/useOverlayTriggerState"

import type { TNativeFloatingRenderState } from "./ClickPopover"
import type { TNativeClickPopoverProps } from "./types"

export type TNativePopoverContextProps = Omit<
  Partial<TNativeClickPopoverProps>,
  | "children"
  | "style"
  | "childIsDialog"
  | "showOverlayArrow"
  | "raised"
  | "geometry"
  | "color"
  | "order"
  | "width"
  | "height"
  | "customStyles"
  | "customOverlayArrowStyles"
  | "customDialogStyles"
> & {
  style?:
    | StyleProp<TextStyle>
    | ((state: TNativeFloatingRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  clearContexts?: readonly TNativeClearContext[]
}
export type TNativeClearContext = Pick<Context<never>, "Provider">
export type TNativeDialogContextProps = Omit<Partial<TNativeFocusViewProps>, "children" | "style" | "role"> & {
  onTouchStartCapture?: TNativeFocusViewProps["onTouchStart"]
  onTouchMoveCapture?: TNativeFocusViewProps["onTouchMove"]
  onTouchCancelCapture?: TNativeFocusViewProps["onTouchCancel"]
  "aria-describedby"?: string
  "aria-details"?: string
  descriptionLabel?: string
  detailsLabel?: string
  slot?: string | null
  role?: "dialog" | "alertdialog"
  style?: StyleProp<TextStyle>
  children?: ReactNode | ((state: { close: () => void }) => ReactNode)
  render?: (
    props: ComponentPropsWithoutRef<typeof NativeFocusHost> & RefAttributes<View>,
    state: undefined,
  ) => ReactElement
}
export const NativePopoverContext = createContext<TNativeContextValue<TNativePopoverContextProps, View>>(null)
export const NativeDialogContext = createContext<TNativeContextValue<TNativeDialogContextProps, View>>(null)
export const NativeOverlayTriggerStateContext = createContext<OverlayTriggerState | null>(null)
