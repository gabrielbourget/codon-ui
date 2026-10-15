import classNames from "classnames"
import {
  createElement,
  useCallback,
  useMemo,
  type ChangeEventHandler,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
} from "react"
import type { Key, Selection } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../../tokens/geometry"
import ListBoxItem from "../../ListBoxItem/ListBoxItem"

import TypeaheadSearchDefaultLoadingIndicator from "./DefaultLoadingIndicator"
import TypeaheadSearchDefaultSearchIcon from "./DefaultSearchIcon"
import { resolveTypeaheadSearchLabels, type TPartialTypeaheadSearchLabels, type TTypeaheadSearchLabels } from "./labels"
import type { TTypeaheadSearchStatus } from "./status"
import styles from "./TypeaheadSearchStyles.module.css"

const {
  typeaheadSearch,
  typeaheadSearch__inputRow,
  ["typeaheadSearch__inputRow--round"]: typeaheadSearch__inputRowRound,
  ["typeaheadSearch__inputRow--rounded"]: typeaheadSearch__inputRowRounded,
} = styles

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

type TCalibratedTypeaheadSearch<T extends object> = {
  typeaheadSearchStyles: string
  typeaheadSearchStyle: CSSProperties
  inputRowStyles: string
  SearchIcon: ReactNode
  LoadingIndicator: ReactNode
  resolvedLabels: TTypeaheadSearchLabels
  resolvedItems: T[]
  submitQuery: () => void
  handleInputChange: ChangeEventHandler<HTMLInputElement>
  handleInputKeyDown: KeyboardEventHandler<HTMLInputElement>
  handleSelectionChange: (selection: Selection) => void
  renderListBoxItem: (item: T) => ReactElement
}

const computeGeometryStyle = <T extends object>(props: TTypeaheadSearchProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return typeaheadSearch__inputRowRounded
    case ROUND:
      return typeaheadSearch__inputRowRound
    default:
      return undefined
  }
}

/** Derives search presentation and memoized collection callbacks while the parent owns query state and result curation. */
export const useCalibratedComponent = <T extends object>(
  props: TTypeaheadSearchProps<T>,
): TCalibratedTypeaheadSearch<T> => {
  const {
    customStyles,
    className,
    style,
    customClassName,
    emptyListMessage,
    errorMessage,
    getItemKey,
    getItemTextValue,
    idleMessage,
    inputValue,
    items,
    labels,
    loadingMessage,
    minimumInputLength = 0,
    minimumInputLengthMessage,
    onInputChange,
    onSelectionChange,
    onSubmitQuery,
    renderItem,
    searchButtonAriaLabel,
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

  const resolvedLabels = resolveTypeaheadSearchLabels({
    labels,
    minimumInputLength,
    idleMessage,
    minimumInputLengthMessage,
    loadingMessage,
    emptyListMessage,
    errorMessage,
    searchButtonAriaLabel,
  })
  const resolvedItems = useMemo(() => Array.from(items ?? []), [items])

  const getResolvedItemKey = useCallback(
    (item: T, index: number): Key => {
      if (getItemKey) return getItemKey(item)
      if ("id" in item) return String(item.id)
      if ("ID" in item) return String(item.ID)

      return `${index}`
    },
    [getItemKey],
  )
  const getResolvedItemTextValue = useCallback(
    (item: T): string => {
      if (getItemTextValue) return getItemTextValue(item)
      if ("name" in item && typeof item.name === "string") return item.name
      if ("label" in item && typeof item.label === "string") return item.label

      return ""
    },
    [getItemTextValue],
  )
  const submitQuery = useCallback(() => {
    onSubmitQuery?.(inputValue.trim())
  }, [inputValue, onSubmitQuery])
  const handleInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => onInputChange(event.target.value),
    [onInputChange],
  )
  const handleInputKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.key !== "Enter") return

      event.preventDefault()
      submitQuery()
    },
    [submitQuery],
  )
  const handleSelectionChange = useCallback(
    (selection: Selection) => {
      if (selection === "all") return

      const selectedKey = Array.from(selection)[0] ?? null

      onSelectionChange?.(selectedKey)
    },
    [onSelectionChange],
  )
  const renderListBoxItem = useCallback(
    (item: T) => {
      const itemIndex = resolvedItems.indexOf(item)
      const resolvedItemIndex = itemIndex >= 0 ? itemIndex : 0
      const itemKey = getResolvedItemKey(item, resolvedItemIndex)
      const textValue = getResolvedItemTextValue(item)
      const renderItemArgs: TTypeaheadSearchRenderItemArgs = {
        query: inputValue,
        textValue,
        itemKey,
      }

      return (
        <ListBoxItem id={itemKey} textValue={textValue}>
          {renderItem ? renderItem(item, renderItemArgs) : textValue}
        </ListBoxItem>
      )
    },
    [getResolvedItemKey, getResolvedItemTextValue, inputValue, renderItem, resolvedItems],
  )

  return {
    typeaheadSearchStyles: classNames(typeaheadSearch, customClassName, className),
    typeaheadSearchStyle: { ...customStyles, ...style },
    inputRowStyles: classNames(typeaheadSearch__inputRow, computeGeometryStyle(props)),
    SearchIcon,
    LoadingIndicator,
    resolvedLabels,
    resolvedItems,
    submitQuery,
    handleInputChange,
    handleInputKeyDown,
    handleSelectionChange,
    renderListBoxItem,
  }
}
