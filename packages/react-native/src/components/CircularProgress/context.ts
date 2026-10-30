import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type Ref,
} from "react"
import type { StyleProp, TextProps, TextStyle, View } from "react-native"

import type { TNativeContextValue, TNativeSlotProps } from "../../collection/context"
import type { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

import type {
  TNativeCircularProgressRenderState,
  TNativeCircularProgressRootStyle,
  TNativeCircularProgressStyleState,
} from "./types"

export type TNativeCircularProgressRootRender = (
  props: ComponentPropsWithoutRef<typeof NativeFocusHost> & RefAttributes<View>,
  state: TNativeCircularProgressRenderState,
) => ReactElement

export type TNativeCircularProgressContextProps = Omit<
  Partial<TNativeFocusViewProps>,
  | "children"
  | "style"
  | "role"
  | "accessibilityRole"
  | "accessibilityValue"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
> &
  TNativeSlotProps & {
    value?: number
    minValue?: number
    maxValue?: number
    valueLabel?: ReactNode
    isIndeterminate?: boolean
    locale?: string
    formatOptions?: Intl.NumberFormatOptions
    style?:
      | StyleProp<TNativeCircularProgressRootStyle>
      | ((state: TNativeCircularProgressStyleState) => StyleProp<TNativeCircularProgressRootStyle>)
    render?: TNativeCircularProgressRootRender
    children?: ReactNode | ((state: TNativeCircularProgressRenderState) => ReactNode)
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
    ariaDetails?: string
    "aria-describedby"?: string
    "aria-details"?: string
    labels?: { descriptionLabel?: string; detailsLabel?: string }
  }

export const NativeCircularProgressContext =
  createContext<TNativeContextValue<TNativeCircularProgressContextProps, View>>(null)

export type TNativeCircularProgressLabelProps = Omit<TNativeTextProps, "elementType" | "style"> & {
  style?: StyleProp<TextStyle>
  render?: (props: TextProps & RefAttributes<TNativeTextRef>, state: undefined) => ReactElement
}

export const NativeCircularProgressLabelContext = createContext<
  TNativeContextValue<TNativeCircularProgressLabelProps, TNativeTextRef>
>({})

type TNativeCircularProgressLabelBinding = {
  ref: Ref<TNativeTextRef>
  bindID: (id: string | undefined) => () => void
}

export const NativeCircularProgressLabelBindingContext = createContext<TNativeCircularProgressLabelBinding | null>(null)
