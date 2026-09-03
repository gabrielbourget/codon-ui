"use client"

import {
  type ChangeEventHandler,
  type CSSProperties,
  type ForwardedRef,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
} from "react"
import { type Key, type Selection } from "react-aria-components"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"

import { calibrateComponent, type TTypeaheadSearchProps, type TTypeaheadSearchRenderItemArgs } from "./helpers"
import { resolveTypeaheadSearchLabels } from "./labels"
import {
  TYPEAHEAD_SEARCH_STATUS__EMPTY,
  TYPEAHEAD_SEARCH_STATUS__ERROR,
  TYPEAHEAD_SEARCH_STATUS__IDLE,
  TYPEAHEAD_SEARCH_STATUS__LOADING,
  TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY,
  TYPEAHEAD_SEARCH_STATUS__RESULTS,
} from "./status"

type TCalibratedTypeaheadSearchComponent<T extends object> = {
  input: {
    button: {
      ariaLabel: string
      className: string
      icon: ReactNode
      isDisabled: boolean | undefined
      onPress: () => void
      style: CSSProperties | undefined
    }
    control: {
      ariaLabel: string | undefined
      className: string
      isDisabled: boolean | undefined
      onChange: ChangeEventHandler<HTMLInputElement>
      onKeyDown: KeyboardEventHandler<HTMLInputElement>
      placeholder: string | undefined
      shouldAutoFocus: boolean | undefined
      style: CSSProperties | undefined
      value: string
    }
    row: {
      className: string
      style: CSSProperties | undefined
    }
  }
  results: {
    ariaLabel: string
    className: string
    containerClassName: string
    containerStyle: CSSProperties | undefined
    isVisible: boolean
    items: T[]
    onSelectionChange: (selection: Selection) => void
    renderItem: (item: T) => ReactElement
    shouldFocusWrap: boolean
    style: CSSProperties | undefined
  }
  root: {
    className: string
    dataDisabled: true | undefined
    dataTestID: string
    ref: ForwardedRef<HTMLDivElement>
    style: CSSProperties
  }
  status: {
    className: string
    emptyListMessage: string
    errorMessage: string
    idleMessage: string
    isEmpty: boolean
    isError: boolean
    isIdle: boolean
    isLoading: boolean
    isMinimumQuery: boolean
    loadingIndicator: ReactNode
    loadingMessage: string
    minimumInputLengthMessage: string
  }
}

/**
 * Owns Typeahead Search's memoized collection, callbacks, labels, and presentation resources while callers retain query,
 * result-curation, and selection-side-effect ownership.
 */
export const useCalibratedComponent = <T extends object>(
  props: TTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
): TCalibratedTypeaheadSearchComponent<T> => {
  const {
    "aria-label": inputAriaLabel,
    "data-testid": dataTestID,
    emptyListMessage,
    errorMessage,
    getItemKey,
    getItemTextValue,
    idleMessage,
    inputValue,
    isDisabled,
    items,
    labels,
    loadingMessage,
    minimumInputLength = 0,
    minimumInputLengthMessage,
    onInputChange,
    onSelectionChange,
    onSubmitQuery,
    placeholder,
    renderItem,
    searchButtonAriaLabel,
    shouldAutoFocusInput,
    shouldFocusWrap = true,
    status = TYPEAHEAD_SEARCH_STATUS__RESULTS,
  } = props
  const {
    customInputRowStyles,
    customInputStyles,
    customResultsContainerStyles,
    customResultsListStyles,
    customSearchButtonStyles,
    inputRowStyles,
    inputStyles,
    LoadingIndicator,
    resultsContainerStyles,
    resultsListStyles,
    SearchIcon,
    searchButtonStyles,
    statusStyles,
    typeaheadSearchStyle,
    typeaheadSearchStyles,
  } = calibrateComponent(props)
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
    input: {
      button: {
        ariaLabel: resolvedLabels.searchButtonAriaLabel,
        className: searchButtonStyles,
        icon: SearchIcon,
        isDisabled,
        onPress: submitQuery,
        style: customSearchButtonStyles,
      },
      control: {
        ariaLabel: inputAriaLabel,
        className: inputStyles,
        isDisabled,
        onChange: handleInputChange,
        onKeyDown: handleInputKeyDown,
        placeholder,
        shouldAutoFocus: shouldAutoFocusInput,
        style: customInputStyles,
        value: inputValue,
      },
      row: {
        className: inputRowStyles,
        style: customInputRowStyles,
      },
    },
    results: {
      ariaLabel: resolvedLabels.resultsListAriaLabel,
      className: resultsListStyles,
      containerClassName: resultsContainerStyles,
      containerStyle: customResultsContainerStyles,
      isVisible: status === TYPEAHEAD_SEARCH_STATUS__RESULTS,
      items: resolvedItems,
      onSelectionChange: handleSelectionChange,
      renderItem: renderListBoxItem,
      shouldFocusWrap,
      style: customResultsListStyles,
    },
    root: {
      className: typeaheadSearchStyles,
      dataDisabled: isDisabled || undefined,
      dataTestID: dataTestID ?? "typeahead-search",
      ref: forwardedRef,
      style: typeaheadSearchStyle,
    },
    status: {
      className: statusStyles,
      emptyListMessage: resolvedLabels.status.emptyListMessage,
      errorMessage: resolvedLabels.status.errorMessage,
      idleMessage: resolvedLabels.status.idleMessage,
      isEmpty: status === TYPEAHEAD_SEARCH_STATUS__EMPTY,
      isError: status === TYPEAHEAD_SEARCH_STATUS__ERROR,
      isIdle: status === TYPEAHEAD_SEARCH_STATUS__IDLE,
      isLoading: status === TYPEAHEAD_SEARCH_STATUS__LOADING,
      isMinimumQuery: status === TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY,
      loadingIndicator: LoadingIndicator,
      loadingMessage: resolvedLabels.status.loadingMessage,
      minimumInputLengthMessage: resolvedLabels.status.minimumInputLengthMessage({ minimumInputLength }),
    },
  }
}
