import classNames from "classnames"
import type { CSSProperties, HTMLAttributes, PropsWithChildren, ReactNode } from "react"

import { type TAriaLabelingProps } from "../../tokens/a11y"

import styles from "./FormFieldStyles.module.css"

type TFormFieldNativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children">

export type TFormFieldProps = PropsWithChildren<
  TFormFieldNativeProps &
    TAriaLabelingProps & {
      "data-testid"?: string
      label?: string
      required?: boolean
      labelID?: string
      labelFor?: string
      topRightContent?: ReactNode
      bottomRightContent?: ReactNode
      errorMessages?: string[]
      warningMessages?: string[]
      successMessages?: string[]
      description?: string
      raised?: boolean
      customClassName?: string
      customStyles?: CSSProperties
      customTopRowClassName?: string
      customTopRowStyles?: CSSProperties
      customLabelClassName?: string
      customLabelStyles?: CSSProperties
      customTopRightClassName?: string
      customTopRightStyles?: CSSProperties
      customBottomRowClassName?: string
      customBottomRowStyles?: CSSProperties
      customBottomRightClassName?: string
      customBottomRightStyles?: CSSProperties
      customValidationMessageClassName?: string
      customValidationMessageStyles?: CSSProperties
      customDescriptionClassName?: string
      customDescriptionStyles?: CSSProperties
    }
>

type TFormFieldCalibration = {
  formFieldStyles: string
  formFieldStyle: CSSProperties
  topRowStyles: string
  bottomRowStyles: string
  validationMessageStyles: string
  customLabelStyles: CSSProperties
  customDescriptionClassName: string | undefined
  customLabelClassName: string | undefined
  customValidationMessageClassName: string | undefined
  errorOrDangerColor: string
  warningColor: string
  successColor: string
}

const VALIDATION_COLOR_ERROR = "var(--aui-validation-error-foreground, var(--aui-state-danger))"
const VALIDATION_COLOR_WARNING = "var(--aui-validation-warning-foreground, var(--aui-state-warning))"
const VALIDATION_COLOR_SUCCESS = "var(--aui-validation-success-foreground, var(--aui-state-success))"

export const calibrateComponent = (props: TFormFieldProps): TFormFieldCalibration => {
  const {
    className,
    customBottomRowClassName,
    customClassName,
    customDescriptionClassName,
    customLabelClassName,
    raised = false,
    customLabelStyles: customLabelStyles__props,
    customStyles: customStyles__props,
    customTopRowClassName,
    customValidationMessageClassName,
    label,
    warningMessages,
    errorMessages,
    style,
    successMessages,
  } = props
  const { formField, formField__topRow, formField__bottomRow, formField__validationMessages } = styles

  const topRowJustifyContentStyle = label ? undefined : styles["formField__topRow--noLeftContent"]
  const bottomRowJustifyContentStyle =
    warningMessages || errorMessages || successMessages ? undefined : styles["formField__bottomRow--noLeftContent"]
  const raisedStyle = raised ? styles["formField--raised"] : undefined

  const formFieldStyles = classNames(formField, raisedStyle, customClassName, className)
  const topRowStyles = classNames(formField__topRow, topRowJustifyContentStyle, customTopRowClassName)
  const bottomRowStyles = classNames(formField__bottomRow, bottomRowJustifyContentStyle, customBottomRowClassName)
  const validationMessageStyles = classNames(formField__validationMessages, customValidationMessageClassName)

  const warningColor = VALIDATION_COLOR_WARNING
  const errorOrDangerColor = VALIDATION_COLOR_ERROR
  const successColor = VALIDATION_COLOR_SUCCESS

  const customLabelStyles = Object.assign({}, { ...customLabelStyles__props })
  const formFieldStyle = { ...customStyles__props, ...style }

  return {
    formFieldStyles,
    formFieldStyle,
    topRowStyles,
    bottomRowStyles,
    validationMessageStyles,
    customLabelStyles,
    customDescriptionClassName,
    customLabelClassName,
    customValidationMessageClassName,
    errorOrDangerColor,
    warningColor,
    successColor,
  }
}
