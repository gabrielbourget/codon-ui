import { forwardRef } from "react"

import Text from "../Text/Text"

import styles from "./FormFieldStyles.module.css"
import { calibrateComponent, type TFormFieldProps } from "./helpers"

const FormField = forwardRef<HTMLDivElement, TFormFieldProps>((props, forwardedRef) => {
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
    label,
    labelID,
    description,
    children,
    className,
    customBottomRightClassName,
    customBottomRightStyles,
    customBottomRowClassName,
    customBottomRowStyles,
    customClassName,
    customDescriptionClassName,
    customDescriptionStyles,
    customLabelClassName,
    customLabelStyles: customLabelStyles__props,
    customStyles: customStyles__props,
    customTopRightClassName,
    customTopRightStyles,
    customTopRowClassName,
    customTopRowStyles,
    customValidationMessageClassName,
    customValidationMessageStyles,
    topRightContent,
    bottomRightContent,
    warningMessages,
    errorMessages,
    raised,
    style,
    successMessages,
    required = false,
    labelFor,
    ...rest
  } = props

  const {
    formFieldStyles,
    formFieldStyle,
    topRowStyles,
    bottomRowStyles,
    validationMessageStyles,
    customLabelStyles,
    customDescriptionClassName: descriptionClassName,
    customLabelClassName: labelClassName,
    customValidationMessageClassName: validationMessageClassName,
    warningColor,
    errorOrDangerColor,
    successColor,
  } = calibrateComponent(props)

  return (
    <div
      {...rest}
      ref={forwardedRef}
      aria-label={ariaLabel ?? ariaLabelAlias}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      className={formFieldStyles}
      style={formFieldStyle}
      data-testid={dataTestID ?? "form-field"}
    >
      <div className={topRowStyles} style={customTopRowStyles} data-testid="form-field-top-row">
        {label ? (
          <Text
            elementType="label"
            variant="b11"
            id={labelID}
            htmlFor={labelFor}
            customClassName={labelClassName}
            customStyles={customLabelStyles}
            data-formfieldlabel
            data-testid="form-field-label"
          >
            <div className={styles.formField__labelContainer}>
              {label} <span className={styles.formfield__requiredIndicator}>{required ? "*" : undefined}</span>
            </div>
          </Text>
        ) : null}
        <div
          className={customTopRightClassName}
          data-toprightcontentcradle
          style={customTopRightStyles}
          data-testid="form-field-top-right-content"
        >
          {topRightContent}
        </div>
      </div>

      {children}

      {warningMessages || errorMessages || successMessages || bottomRightContent ? (
        <div className={bottomRowStyles} style={customBottomRowStyles} data-testid="form-field-bottom-row">
          <div
            className={validationMessageStyles}
            style={customValidationMessageStyles}
            data-testid="form-field-validation-messages"
          >
            {errorMessages?.map((errorMessage: string, i) => (
              <Text
                key={i}
                elementType="p"
                variant="b11"
                color={errorOrDangerColor}
                customClassName={validationMessageClassName}
                customStyles={customValidationMessageStyles}
                data-testid="form-field-error-messages"
              >
                {errorMessage}
              </Text>
            ))}
            {warningMessages?.map((warningMessage: string, i) => (
              <Text
                key={i}
                elementType="p"
                variant="b11"
                color={warningColor}
                customClassName={validationMessageClassName}
                customStyles={customValidationMessageStyles}
                data-warningmessage
                data-testid="form-field-warning-messages"
              >
                {warningMessage}
              </Text>
            ))}
            {successMessages?.map((successMessage: string, i) => (
              <Text
                key={i}
                elementType="p"
                variant="b11"
                color={successColor}
                customClassName={validationMessageClassName}
                customStyles={customValidationMessageStyles}
                data-successmessage
                data-testid="form-field-success-messages"
              >
                {successMessage}
              </Text>
            ))}
          </div>
          <div
            className={customBottomRightClassName}
            data-bottomrightcontentcradle
            style={customBottomRightStyles}
            data-testid="form-field-bottom-right-content"
          >
            {bottomRightContent}
          </div>
        </div>
      ) : null}

      {description ? (
        <Text
          elementType="p"
          variant="b11"
          fontStyle="italic"
          customClassName={descriptionClassName}
          customStyles={customDescriptionStyles}
          data-description
          data-testid="form-field-description"
        >
          {description}
        </Text>
      ) : null}
    </div>
  )
})

FormField.displayName = "FormField"

export default FormField
