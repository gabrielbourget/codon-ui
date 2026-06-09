import type { FC } from "react"

import Counter from "../../../Counter/Counter"
import type { TCounterProps } from "../../../Counter/helpers"
import Text from "../../../Text/Text"
import {
  DEFAULT_PAGINATION_LABELS,
  PAGINATION_SUBCOMPONENT__PAGE_COUNTER,
  type TPaginationPageCounterLabels,
} from "../../helpers"

import styles from "./PageCounterStyles.module.css"

export type TPageCounterProps = {
  currentPage: number
  numberOfPages: number
  counterText?: string
  labels?: TPaginationPageCounterLabels
  customCounterClassName?: string
  customCounterStyles?: React.CSSProperties
  customPageCounterProps?: Partial<TCounterProps>
}

const PageCounter: FC<TPageCounterProps> = (props) => {
  const {
    currentPage,
    numberOfPages,
    customCounterClassName,
    customCounterStyles,
    counterText,
    labels,
    customPageCounterProps,
  } = props
  const {
    customClassName: customCounterPropsClassName,
    customStyles: customCounterPropsStyles,
    ...restCustomPageCounterProps
  } = customPageCounterProps ?? {}
  const resolvedLabels = {
    ...DEFAULT_PAGINATION_LABELS.pageCounter,
    counterText: counterText ? counterText : DEFAULT_PAGINATION_LABELS.pageCounter.counterText,
    ...labels,
  }

  return (
    <div className={styles.pageCounter} key="page-counter" data-testid={PAGINATION_SUBCOMPONENT__PAGE_COUNTER}>
      <Counter
        aria-label={resolvedLabels.ariaLabel}
        value={currentPage}
        maxValue={numberOfPages}
        showMaxValue
        {...restCustomPageCounterProps}
        customClassName={[customCounterPropsClassName, customCounterClassName].filter(Boolean).join(" ")}
        customStyles={{ ...customCounterPropsStyles, ...customCounterStyles }}
      >
        <Text>{resolvedLabels.counterText}</Text>
      </Counter>
    </div>
  )
}

export default PageCounter
