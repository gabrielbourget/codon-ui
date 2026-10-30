import { createContext } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeTooltipProps, TNativeTooltipRenderState, TNativeTooltipState } from "./types"

export type TNativeTooltipContextStyle =
  | StyleProp<TextStyle>
  | ((state: TNativeTooltipRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)

type TContextProps = Omit<
  Partial<TNativeTooltipProps>,
  | "children"
  | "color"
  | "order"
  | "geometry"
  | "raised"
  | "width"
  | "height"
  | "customStyles"
  | "customOverlayArrowStyles"
  | "showOverlayArrow"
  | "style"
> & { style?: TNativeTooltipContextStyle }
export const NativeTooltipContext = createContext<TNativeContextValue<TContextProps, View>>(null)
export const NativeTooltipTriggerStateContext = createContext<TNativeTooltipState | null>(null)
