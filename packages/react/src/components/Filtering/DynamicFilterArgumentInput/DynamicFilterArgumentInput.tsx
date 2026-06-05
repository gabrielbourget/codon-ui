import type { FC } from "react"

import type { TDynamicFilterArgumentInputProps } from "./helpers"
import { calibrateComponent, splitDynamicFilterArgumentInputProps, useComputedFilterArgumentComponent } from "./helpers"

const DynamicFilterArgumentInput: FC<TDynamicFilterArgumentInputProps> = (props) => {
  const filterArgumentComponent = useComputedFilterArgumentComponent(props)
  if (!filterArgumentComponent) return null

  const { rootProps } = splitDynamicFilterArgumentInputProps(props)
  const { dynamicFilterArgumentInputStyles, dynamicFilterArgumentInputStyle } = calibrateComponent(props)

  return (
    <div
      {...rootProps.nativeRootProps}
      aria-label={rootProps.ariaLabel ?? rootProps.ariaLabelAlias}
      aria-labelledby={rootProps.ariaLabelledBy ?? rootProps.ariaLabelledByAlias}
      aria-describedby={rootProps.ariaDescribedBy ?? rootProps.ariaDescribedByAlias}
      aria-details={rootProps.ariaDetails ?? rootProps.ariaDetailsAlias}
      className={dynamicFilterArgumentInputStyles}
      data-testid={rootProps.dataTestID ?? "dynamic-filter-argument-input"}
      role={rootProps.role}
      style={dynamicFilterArgumentInputStyle}
    >
      {filterArgumentComponent}
    </div>
  )
}

export default DynamicFilterArgumentInput
