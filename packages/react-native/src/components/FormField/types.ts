import type { ReactNode, RefObject } from "react"
import type { StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

export type TNativeFormFieldRef = View
export type TNativeFormFieldFocusTarget = { focus: () => void }
export type TNativeFormFieldProps = Omit<ViewProps, "children" | "style"> & {
  children?: ReactNode
  label?: string
  required?: boolean
  labelID?: string
  labelFor?: RefObject<TNativeFormFieldFocusTarget | null>
  topRightContent?: ReactNode
  bottomRightContent?: ReactNode
  errorMessages?: readonly string[]
  warningMessages?: readonly string[]
  successMessages?: readonly string[]
  description?: string
  raised?: boolean
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customTopRowStyles?: StyleProp<ViewStyle>
  customLabelStyles?: StyleProp<TextStyle>
  customTopRightStyles?: StyleProp<ViewStyle>
  customBottomRowStyles?: StyleProp<ViewStyle>
  customBottomRightStyles?: StyleProp<ViewStyle>
  customValidationMessageStyles?: StyleProp<TextStyle>
  customDescriptionStyles?: StyleProp<TextStyle>
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: never
  ariaDetails?: never
  "aria-describedby"?: never
  "aria-details"?: never
  "data-testid"?: string
}
