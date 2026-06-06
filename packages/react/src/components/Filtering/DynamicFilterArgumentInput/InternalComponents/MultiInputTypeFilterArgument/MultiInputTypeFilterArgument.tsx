import classNames from "classnames"
import type { FC } from "react"

import { ROUND } from "../../../../../tokens/geometry"
import { THEME_ORDER_CODE__PRIMARY } from "../../../../../tokens/theme-order"
import Button from "../../../../Button/Button"
import FormField from "../../../../FormField/FormField"
import Input from "../../../../Input/Input"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

import {
  MultiInputTypeFilterArgumentDefaultAddIcon,
  MultiInputTypeFilterArgumentDefaultDeleteIcon,
} from "./DefaultMultiInputTypeFilterArgumentIcons"
import styles from "./MultiInputTypeFilterArgumentStyles.module.css"

const { multiInputTypeFilterArgument__iconColor, multiInputTypeFilterArgument__inputRow } = styles

export type TMultiInputTypeFilterArgumentProps = TFilterArgumentInputContext

const MultiInputTypeFilterArgument: FC<TMultiInputTypeFilterArgumentProps> = (props) => {
  const {
    argument: rawArgument,
    customActionButtonClassName,
    customActionButtonStyles,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    customRowClassName,
    customRowStyles,
    labels,
    onArgumentChange,
  } = props
  const argument = rawArgument as string[]
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput

  return (
    <FormField
      label={resolvedLabels.label}
      labelID="input-type-filter-argument"
      customClassName={customFieldClassName}
      customStyles={customFieldStyles}
      topRightContent={
        <Button
          aria-label={resolvedLabels.addMultiInputItemButtonAriaLabel}
          geometry={ROUND}
          order={THEME_ORDER_CODE__PRIMARY}
          raised={false}
          customClassName={customActionButtonClassName}
          customStyles={{ padding: 3, ...customActionButtonStyles }}
          onPress={() =>
            onArgumentChange({
              argument: [...argument, ""],
            })
          }
        >
          <MultiInputTypeFilterArgumentDefaultAddIcon
            size={15}
            customClassName={multiInputTypeFilterArgument__iconColor}
            data-testid="multi-input-filter-argument-default-add-icon"
          />
        </Button>
      }
    >
      {argument.map((item, index) => (
        <div
          className={classNames(multiInputTypeFilterArgument__inputRow, customRowClassName)}
          style={customRowStyles}
          key={index}
        >
          <Input
            key={index}
            aria-label={resolvedLabels.multiInputItemAriaLabel({ index })}
            className={customInputClassName}
            value={item}
            placeholder={resolvedLabels.multiInputItemPlaceholder({ position: index + 1 })}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(event) => {
              onArgumentChange({
                argument: [...argument.slice(0, index), event.target.value, ...argument.slice(index + 1)],
              })
            }}
          />
          <Button
            aria-label={resolvedLabels.deleteMultiInputItemButtonAriaLabel}
            geometry={ROUND}
            order={THEME_ORDER_CODE__PRIMARY}
            raised={false}
            transparent
            isDisabled={index === 0 ? true : false}
            customClassName={customActionButtonClassName}
            customStyles={{ paddingRight: 0, ...customActionButtonStyles }}
            onPress={() =>
              onArgumentChange({
                argument: [...argument.slice(0, index), ...argument.slice(index + 1)],
              })
            }
          >
            <MultiInputTypeFilterArgumentDefaultDeleteIcon
              size={15}
              customClassName={multiInputTypeFilterArgument__iconColor}
              data-testid="multi-input-filter-argument-default-delete-icon"
            />
          </Button>
        </div>
      )) || (
        <div
          className={classNames(multiInputTypeFilterArgument__inputRow, customRowClassName)}
          style={customRowStyles}
          key={0}
        >
          <Input
            key={0}
            aria-label={resolvedLabels.multiInputItemAriaLabel({ index: 1 })}
            className={customInputClassName}
            value={argument[0]}
            placeholder={resolvedLabels.multiInputFallbackPlaceholder({ position: 1 })}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(event) => {
              onArgumentChange({ argument: [event.target.value] })
            }}
          />
          <Button
            aria-label={resolvedLabels.deleteMultiInputItemButtonAriaLabel}
            geometry={ROUND}
            order={THEME_ORDER_CODE__PRIMARY}
            raised={false}
            transparent
            isDisabled={true}
            customClassName={customActionButtonClassName}
            customStyles={{ paddingRight: 0, ...customActionButtonStyles }}
            onPress={() => onArgumentChange({ argument: [] })}
          >
            <MultiInputTypeFilterArgumentDefaultDeleteIcon
              size={15}
              customClassName={multiInputTypeFilterArgument__iconColor}
              data-testid="multi-input-filter-argument-default-delete-icon"
            />
          </Button>
        </div>
      )}
    </FormField>
  )
}

export default MultiInputTypeFilterArgument
