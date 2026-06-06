import classNames from "classnames"
import { createElement, type CSSProperties, type ReactNode } from "react"
import type { Key } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../../tokens/geometry"

import TypeaheadSearchDefaultLoadingIndicator from "./DefaultLoadingIndicator"
import TypeaheadSearchDefaultSearchIcon from "./DefaultSearchIcon"
import type { TPartialTypeaheadSearchLabels } from "./labels"
import type { TTypeaheadSearchStatus } from "./status"
import styles from "./TypeaheadSearchStyles.module.css"

export type TTypeaheadSearchRenderItemArgs = {
  query: string
  textValue: string
  itemKey: Key
}

export type TTypeaheadSearchProps<T extends object> = {
  items?: Iterable<T>
  inputValue: string
  onInputChange: (value: string) => void
  status?: TTypeaheadSearchStatus
  isDisabled?: boolean
  placeholder?: string
  "aria-label"?: string
  "data-testid"?: string
  searchButtonAriaLabel?: string
  minimumInputLength?: number
  idleMessage?: string
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
  errorMessage?: string
  labels?: TPartialTypeaheadSearchLabels
  shouldAutoFocusInput?: boolean
  shouldFocusWrap?: boolean
  geometry?: TCornerGeometry
  SearchIcon?: ReactNode
  LoadingIndicator?: ReactNode
  getItemKey?: (item: T) => Key
  getItemTextValue?: (item: T) => string
  renderItem?: (item: T, args: TTypeaheadSearchRenderItemArgs) => ReactNode
  onSelectionChange?: (key: Key | null) => void
  onSubmitQuery?: (query: string) => void
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
  customInputRowStyles?: CSSProperties
  customInputStyles?: CSSProperties
  customSearchButtonStyles?: CSSProperties
  customResultsContainerStyles?: CSSProperties
  customResultsListStyles?: CSSProperties
}

type TTypeaheadSearchCalibration = {
  typeaheadSearchStyles: string
  typeaheadSearchStyle: CSSProperties
  inputRowStyles: string
  inputStyles: string
  searchButtonStyles: string
  resultsContainerStyles: string
  resultsListStyles: string
  statusStyles: string
  customStyles: CSSProperties | undefined
  customInputRowStyles: CSSProperties | undefined
  customInputStyles: CSSProperties | undefined
  customSearchButtonStyles: CSSProperties | undefined
  customResultsContainerStyles: CSSProperties | undefined
  customResultsListStyles: CSSProperties | undefined
  SearchIcon: ReactNode
  LoadingIndicator: ReactNode
}

const computeGeometryStyle = <T extends object>(props: TTypeaheadSearchProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["typeaheadSearch__inputRow--rounded"]
    case ROUND:
      return styles["typeaheadSearch__inputRow--round"]
    default:
      return undefined
  }
}

export const calibrateComponent = <T extends object>(props: TTypeaheadSearchProps<T>): TTypeaheadSearchCalibration => {
  const {
    customStyles,
    className,
    style,
    customClassName,
    customInputRowStyles,
    customInputStyles,
    customSearchButtonStyles,
    customResultsContainerStyles,
    customResultsListStyles,
  } = props
  let { SearchIcon, LoadingIndicator } = props

  if (!SearchIcon)
    SearchIcon = createElement(TypeaheadSearchDefaultSearchIcon, {
      size: 18,
      "data-testid": "typeahead-search-default-search-icon",
    })

  if (!LoadingIndicator) {
    LoadingIndicator = createElement(TypeaheadSearchDefaultLoadingIndicator, {
      size: 18,
      spinnerTrackWidth: 2.5,
      spinnerTrackIsTransparent: true,
      testID: "typeahead-search-default-loading-indicator",
    })
  }

  return {
    typeaheadSearchStyles: classNames(styles.typeaheadSearch, customClassName, className),
    typeaheadSearchStyle: {
      ...customStyles,
      ...style,
    },
    inputRowStyles: classNames(styles.typeaheadSearch__inputRow, computeGeometryStyle(props)),
    inputStyles: styles.typeaheadSearch__input,
    searchButtonStyles: styles.typeaheadSearch__searchButton,
    resultsContainerStyles: styles.typeaheadSearch__resultsContainer,
    resultsListStyles: styles.typeaheadSearch__resultsList,
    statusStyles: styles.typeaheadSearch__status,
    customStyles,
    customInputRowStyles,
    customInputStyles,
    customSearchButtonStyles,
    customResultsContainerStyles,
    customResultsListStyles,
    SearchIcon,
    LoadingIndicator,
  }
}
