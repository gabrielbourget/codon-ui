import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native"

export const CHECKBOX_GROUP_ORIENTATIONS = ["horizontal", "vertical"] as const
export type TNativeCheckboxGroupOrientation = (typeof CHECKBOX_GROUP_ORIENTATIONS)[number]
export type TNativeCheckboxGroupRef = View
export type TNativeCheckboxGroupRenderState = Readonly<{
  value: readonly string[]
  isDisabled: boolean
  isReadOnly: boolean
}>
export type TNativeCheckboxGroupStyleState = TNativeCheckboxGroupRenderState & { defaultStyle: ViewStyle }
export type TNativeCheckboxGroupProps = Omit<ViewProps, "children" | "style" | "accessible" | "aria-label"> & {
  children?: ReactNode | ((state: TNativeCheckboxGroupRenderState & { defaultChildren: undefined }) => ReactNode)
  render?: (props: ViewProps & RefAttributes<View>, state: TNativeCheckboxGroupRenderState) => ReactElement
  value?: readonly string[]
  defaultValue?: readonly string[]
  onChange?: (value: string[]) => void
  isDisabled?: boolean
  isReadOnly?: boolean
  orientation?: TNativeCheckboxGroupOrientation
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeCheckboxGroupStyleState) => StyleProp<ViewStyle>)
  "data-testid"?: string
  "aria-label"?: string
}
