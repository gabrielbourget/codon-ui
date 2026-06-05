import classNames from "classnames"
import type { FC } from "react"

import { ROUND, ROUNDED } from "../../../../../tokens/geometry"
import Checkbox from "../../../../Checkbox/Checkbox"
import FormField from "../../../../FormField/FormField"
import Switch from "../../../../Switch/Switch"
import {
  BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX,
  BOOLEAN_ARGUMENT_COMPONENT__TOGGLE,
} from "../../../../Table/filterMetadata"
import Text from "../../../../Text/Text"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

import styles from "./BooleanTypeFilterArgumentStyles.module.css"

const { booleanTypeFilterArgument } = styles

export type TBooleanTypeFilterArgumentProps = TFilterArgumentInputContext

const BooleanTypeFilterArgument: FC<TBooleanTypeFilterArgumentProps> = (props) => {
  const {
    argument,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    customRowClassName,
    customRowStyles,
    onArgumentChange,
    booleanArgumentComponent,
    labels,
  } = props
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput
  let ComputedFilterArgumentInput: React.ReactElement | undefined = undefined

  if (booleanArgumentComponent === BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX) {
    ComputedFilterArgumentInput = (
      <div className={classNames(booleanTypeFilterArgument, customRowClassName)} style={customRowStyles}>
        <FormField
          label={resolvedLabels.booleanLabel}
          labelID="boolean-type-filter-argument"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <Checkbox
            aria-labelledby="boolean-type-filter-argument"
            className={customInputClassName}
            isSelected={argument as boolean}
            geometry={ROUNDED}
            customStyles={customInputStyles}
            onChange={(value) => {
              onArgumentChange({ argument: value })
            }}
          />
          <Text elementType="span" variant="b11">
            {argument}
          </Text>
        </FormField>
      </div>
    )
  } else if (booleanArgumentComponent === BOOLEAN_ARGUMENT_COMPONENT__TOGGLE) {
    ComputedFilterArgumentInput = (
      <div className={classNames(booleanTypeFilterArgument, customRowClassName)} style={customRowStyles}>
        <FormField
          label={resolvedLabels.booleanLabel}
          labelID="boolean-type-filter-argument"
          customClassName={customFieldClassName}
          customStyles={{ display: "flex", alignItems: "center", gap: 5, ...customFieldStyles }}
        >
          <Switch
            aria-labelledby="boolean-type-filter-argument"
            className={customInputClassName}
            order="primary"
            customStyles={{ padding: "5px", ...customInputStyles }}
            geometry={ROUND}
            isSelected={argument as boolean}
            onChange={(value) => {
              onArgumentChange({ argument: value })
            }}
          />
          <Text elementType="span" variant="b11">
            {argument}
          </Text>
        </FormField>
      </div>
    )
  }

  return ComputedFilterArgumentInput
}

export default BooleanTypeFilterArgument
