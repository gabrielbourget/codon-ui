import type { ReactNode } from "react"
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native"

export const RADIO_GROUP_ORIENTATIONS = ["horizontal", "vertical"] as const
export type TNativeRadioGroupOrientation = (typeof RADIO_GROUP_ORIENTATIONS)[number]
export type TNativeRadioGroupRef = View
export type TNativeRadioGroupRenderState = Readonly<{
  value: string | null
  isDisabled: boolean
  isReadOnly: boolean
}>
export type TNativeRadioGroupStyleState = TNativeRadioGroupRenderState & { defaultStyle: ViewStyle }
type TNativeRadioGroupLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeRadioGroupProps = Omit<
  ViewProps,
  | "children"
  | "style"
  | "accessible"
  | "accessibilityLabel"
  | "aria-label"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-disabled"
  | "aria-checked"
  | "aria-selected"
> &
  TNativeRadioGroupLabel & {
    children?: ReactNode
    value?: string | null
    defaultValue?: string | null
    onChange?: (value: string) => void
    isDisabled?: boolean
    isReadOnly?: boolean
    orientation?: TNativeRadioGroupOrientation
    customStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle> | ((state: TNativeRadioGroupStyleState) => StyleProp<ViewStyle>)
    accessibilityState?: Omit<NonNullable<ViewProps["accessibilityState"]>, "disabled" | "checked" | "selected">
    "data-testid"?: string
  }
