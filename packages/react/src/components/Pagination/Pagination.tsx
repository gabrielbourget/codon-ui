"use client"

import { Fragment, type FC } from "react"

import LineSegment from "../LineSegment/LineSegment"

import type { TPaginationProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"

const Pagination: FC<TPaginationProps> = (props) => {
  const { composition, root, visibility } = useCalibratedComponent(props)

  return visibility.isVisible ? (
    <nav
      {...root.nativeProps}
      aria-label={root.ariaLabel}
      aria-labelledby={root.ariaLabelledBy}
      aria-describedby={root.ariaDescribedBy}
      aria-details={root.ariaDetails}
      className={root.className}
      style={root.style}
      data-disabled={root.isDisabled ? "true" : undefined}
      data-testid={root.dataTestID}
    >
      {composition.items.map(({ key, node }, index) => (
        <Fragment key={`pagination-render-fragment-${key}`}>
          {node}

          {index < composition.items.length - 1 ? (
            <LineSegment
              key={`line-segment-${index + 1}`}
              direction="vertical"
              color="var(--cui-border)"
              customClassName={composition.separator.className}
              customStyles={composition.separator.style}
            />
          ) : null}
        </Fragment>
      ))}
    </nav>
  ) : null
}

export default Pagination
