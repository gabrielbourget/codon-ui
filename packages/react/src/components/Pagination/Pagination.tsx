"use client"

import classNames from "classnames"
import { Fragment, useCallback, useState, type FC } from "react"

import LineSegment from "../LineSegment/LineSegment"

import { initState, useCalibratedComponent, type TPaginationProps, type TPaginationState } from "./helpers"
import styles from "./PaginationStyles.module.css"

const Pagination: FC<TPaginationProps> = (props) => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className,
    customClassName,
    customComponentStyles,
    customSeparatorClassName,
    customSeparatorStyles,
    isDisabled = false,
    itemsPerPage,
    numberOfItems,
    rtl = false,
    showWithOnePage = false,
    style,
  } = props
  const [state, setState] = useState<TPaginationState>({ ...initState, itemsPerPage })
  const onPageNumberInputChange = useCallback(
    (value: number) => setState((previousState) => ({ ...previousState, pageNumInput: value })),
    [],
  )
  const { items, navigationAriaLabel, nativeProps } = useCalibratedComponent({
    props,
    state,
    setState,
    onPageNumberInputChange,
  })
  const isVisible = numberOfItems > (state.itemsPerPage as number) || showWithOnePage

  return isVisible ? (
    <nav
      {...nativeProps}
      aria-label={navigationAriaLabel}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      className={classNames(styles.pagination, rtl ? styles["pagination--rtl"] : null, customClassName, className)}
      style={{ ...customComponentStyles, ...style }}
      data-disabled={isDisabled ? "true" : undefined}
      data-testid={dataTestID ?? "pagination"}
    >
      {items.map(({ key, node }, index) => (
        <Fragment key={`pagination-render-fragment-${key}`}>
          {node}

          {index < items.length - 1 ? (
            <LineSegment
              key={`line-segment-${index + 1}`}
              direction="vertical"
              color="var(--cui-border)"
              customClassName={customSeparatorClassName}
              customStyles={{ height: "100%", width: 0.75, ...customSeparatorStyles }}
            />
          ) : null}
        </Fragment>
      ))}
    </nav>
  ) : null
}

export default Pagination
