import classNames from "classnames"
import type { FC } from "react"

import styles from "./DynamicFilterArgumentInputStyles.module.css"
import { renderFilterArgumentInput, type TDynamicFilterArgumentInputProps } from "./helpers"

const { dynamicFilterArgumentInput } = styles

const DynamicFilterArgumentInput: FC<TDynamicFilterArgumentInputProps> = (props) => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className,
    dataType,
    argument,
    availableFilterArguments,
    filterArgumentSelectedKey,
    filterArgumentAccessibleLabel,
    booleanArgumentComponent,
    labels,
    onArgumentChange,
    filterArgumentType,
    customClassName,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    customRowClassName,
    customRowStyles,
    customActionButtonClassName,
    customActionButtonStyles,
    customPlaceholderClassName,
    customPlaceholderStyles,
    customStyles,
    role,
    style,
    ...nativeRootProps
  } = props
  const filterArgumentComponent = renderFilterArgumentInput({
    dataType,
    argument,
    availableFilterArguments,
    filterArgumentSelectedKey,
    filterArgumentAccessibleLabel,
    booleanArgumentComponent,
    labels,
    onArgumentChange,
    filterArgumentType,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    customRowClassName,
    customRowStyles,
    customActionButtonClassName,
    customActionButtonStyles,
    customPlaceholderClassName,
    customPlaceholderStyles,
  })
  if (!filterArgumentComponent) return null

  const dynamicFilterArgumentInputStyles = classNames(dynamicFilterArgumentInput, customClassName, className)
  const dynamicFilterArgumentInputStyle = { ...customStyles, ...style }

  return (
    <div
      {...nativeRootProps}
      aria-label={ariaLabel ?? ariaLabelAlias}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      className={dynamicFilterArgumentInputStyles}
      data-testid={dataTestID ?? "dynamic-filter-argument-input"}
      role={role}
      style={dynamicFilterArgumentInputStyle}
    >
      {filterArgumentComponent}
    </div>
  )
}

export default DynamicFilterArgumentInput
