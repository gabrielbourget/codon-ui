import classNames from "classnames"
import type { FC } from "react"

import type { TCornerGeometry } from "../../../../tokens/geometry"
import type { TThemingOrderCode } from "../../../../tokens/theme-order"
import Button from "../../../Button/Button"
import type { TAvailableColorModes, TButtonProps } from "../../../Button/helpers"
import FormField from "../../../FormField/FormField"
import type { TFormFieldProps } from "../../../FormField/helpers"
import type { TNumberInputProps } from "../../../NumberInput/helpers"
import NumberInput from "../../../NumberInput/NumberInput"
import Text from "../../../Text/Text"
import {
  DEFAULT_PAGINATION_LABELS,
  PAGINATION_SUBCOMPONENT__PAGE_INPUT,
  type TPaginationPageInputLabels,
} from "../../helpers"

import styles from "./PageInputStyles.module.css"

export type TPageInputProps = {
  pageNumInput: string | number
  numberOfPages: number
  color?: string
  order?: TThemingOrderCode
  geometry?: TCornerGeometry
  buttonColorMode?: TAvailableColorModes
  disabled?: boolean
  pageInputLabel?: string
  pageInputSelectionButtonText?: string
  labels?: TPaginationPageInputLabels
  onPageNumberInputChange: (value: number) => void
  onPageNumButtonClick: (pageNum: number) => void
  customGeneralButtonProps?: Partial<TButtonProps>
  customPageNumberInputFormFieldProps?: Partial<TFormFieldProps>
  customPageNumberInputFormFieldClassName?: string
  customPageNumberInputFormFieldStyles?: React.CSSProperties
  customPageNumberInputProps?: Partial<TNumberInputProps>
  customPageNumberInputStyles?: React.CSSProperties
  customPageNumberInputNavigationButtonClassName?: string
  customPageNumberInputNavigationButtonStyles?: React.CSSProperties
}

const PageInput: FC<TPageInputProps> = (props) => {
  const {
    numberOfPages,
    pageNumInput,
    disabled,
    onPageNumberInputChange,
    order,
    color,
    buttonColorMode,
    geometry,
    onPageNumButtonClick,
    pageInputLabel,
    pageInputSelectionButtonText,
    labels,
    customGeneralButtonProps = {},
    customPageNumberInputFormFieldProps = {},
    customPageNumberInputFormFieldClassName,
    customPageNumberInputFormFieldStyles,
    customPageNumberInputStyles,
    customPageNumberInputNavigationButtonClassName,
    customPageNumberInputNavigationButtonStyles,
    customPageNumberInputProps = {},
  } = props
  const {
    customClassName: customPageNumberInputFormFieldPropsClassName,
    customStyles: customPageNumberInputFormFieldPropsStyles,
    ...restCustomPageNumberInputFormFieldProps
  } = customPageNumberInputFormFieldProps
  const {
    customInputStyles: customPageNumberInputPropsInputStyles,
    customStyles: customPageNumberInputPropsStyles,
    ...restCustomPageNumberInputProps
  } = customPageNumberInputProps
  const {
    className: customGeneralButtonNativeClassNameProp,
    customClassName: customGeneralButtonPropsClassName,
    customStyles: customGeneralButtonStyles,
    ...restCustomGeneralButtonProps
  } = customGeneralButtonProps
  const customGeneralButtonNativeClassName =
    typeof customGeneralButtonNativeClassNameProp === "string" ? customGeneralButtonNativeClassNameProp : undefined
  const resolvedLabels = {
    ...DEFAULT_PAGINATION_LABELS.pageInput,
    label: pageInputLabel ?? DEFAULT_PAGINATION_LABELS.pageInput.label,
    submitButtonText: pageInputSelectionButtonText ?? DEFAULT_PAGINATION_LABELS.pageInput.submitButtonText,
    ...labels,
  }

  return (
    <div className={styles.pageInput} data-testid={PAGINATION_SUBCOMPONENT__PAGE_INPUT}>
      <FormField
        {...restCustomPageNumberInputFormFieldProps}
        label={resolvedLabels.label}
        labelID="page-input-label-id"
        customClassName={classNames(
          customPageNumberInputFormFieldPropsClassName,
          customPageNumberInputFormFieldClassName,
        )}
        customStyles={{ ...customPageNumberInputFormFieldPropsStyles, ...customPageNumberInputFormFieldStyles }}
      >
        <NumberInput
          {...restCustomPageNumberInputProps}
          placeholder={resolvedLabels.placeholder}
          value={pageNumInput as number}
          height={30}
          isDisabled={disabled}
          geometry={geometry}
          onChange={(value: number) => onPageNumberInputChange(value)}
          aria-labelledby="page-input-label-id"
          labels={resolvedLabels.numberInput}
          customInputStyles={{ width: 43, ...customPageNumberInputPropsInputStyles }}
          minValue={1}
          maxValue={numberOfPages}
          customStyles={{ ...customPageNumberInputPropsStyles, ...customPageNumberInputStyles }}
        />
      </FormField>
      <Button
        {...restCustomGeneralButtonProps}
        color={color}
        order={order}
        geometry={geometry}
        colorMode={buttonColorMode}
        raised={true}
        aria-label={resolvedLabels.submitButtonAriaLabel}
        isDisabled={disabled}
        onPress={() => {
          if (typeof pageNumInput === "number") onPageNumButtonClick(pageNumInput)
        }}
        customClassName={classNames(
          customGeneralButtonPropsClassName,
          customGeneralButtonNativeClassName,
          customPageNumberInputNavigationButtonClassName,
        )}
        customStyles={{
          height: 30,
          ...customGeneralButtonStyles,
          ...customPageNumberInputNavigationButtonStyles,
        }}
      >
        <Text>{resolvedLabels.submitButtonText}</Text>
      </Button>
    </div>
  )
}

export default PageInput
