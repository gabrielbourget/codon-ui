"use client"

import { type ForwardedRef, type ReactElement, type RefAttributes, forwardRef, useCallback, useMemo } from "react"
import { type Key, ListBox, type Selection } from "react-aria-components"

import Button from "../../Button/Button"
import Input from "../../Input/Input"
import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import PlaceholderText from "../../Text/variants/PlaceholderText/PlaceholderText"

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

const TypeaheadSearch = forwardRef(function TypeaheadSearchInner<T extends object>(
  props: TTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "data-testid": dataTestID,
    items,
    inputValue,
    onInputChange,
    isDisabled,
    placeholder,
    status = TYPEAHEAD_SEARCH_STATUS__RESULTS,
    minimumInputLength = 0,
    idleMessage,
    minimumInputLengthMessage,
    loadingMessage,
    emptyListMessage,
    errorMessage,
    labels,
    shouldAutoFocusInput,
    shouldFocusWrap = true,
    getItemKey,
    getItemTextValue,
    renderItem,
    onSelectionChange,
    onSubmitQuery,
    searchButtonAriaLabel,
  } = props
  const {
    typeaheadSearchStyles,
    inputRowStyles,
    inputStyles,
    searchButtonStyles,
    resultsContainerStyles,
    resultsListStyles,
    statusStyles,
    typeaheadSearchStyle,
    customInputRowStyles,
    customInputStyles,
    customSearchButtonStyles,
    customResultsContainerStyles,
    customResultsListStyles,
    SearchIcon,
    LoadingIndicator,
  } = calibrateComponent(props)
  const resolvedIsDisabled = isDisabled
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

  const submitQuery = () => {
    onSubmitQuery?.(inputValue.trim())
  }

  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") return

    const selectedKey = Array.from(selection)[0] ?? null

    onSelectionChange?.(selectedKey)
  }

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

  const renderStatus = () => {
    switch (status) {
      case TYPEAHEAD_SEARCH_STATUS__IDLE:
        return (
          <div className={statusStyles} data-testid="typeahead-search-idle-state" aria-live="polite">
            <PlaceholderText align="center">{resolvedLabels.status.idleMessage}</PlaceholderText>
          </div>
        )
      case TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY:
        return (
          <div className={statusStyles} data-testid="typeahead-search-minimum-query-state" aria-live="polite">
            <PlaceholderText align="center">
              {resolvedLabels.status.minimumInputLengthMessage({ minimumInputLength })}
            </PlaceholderText>
          </div>
        )
      case TYPEAHEAD_SEARCH_STATUS__LOADING:
        return (
          <div className={statusStyles} data-testid="typeahead-search-loading-state" aria-live="polite">
            {LoadingIndicator}
            <PlaceholderText align="center">{resolvedLabels.status.loadingMessage}</PlaceholderText>
          </div>
        )
      case TYPEAHEAD_SEARCH_STATUS__ERROR:
        return (
          <div className={statusStyles} data-testid="typeahead-search-error-state" aria-live="polite">
            <PlaceholderText align="center">{resolvedLabels.status.errorMessage}</PlaceholderText>
          </div>
        )
      case TYPEAHEAD_SEARCH_STATUS__EMPTY:
        return (
          <div className={statusStyles} data-testid="typeahead-search-empty-state" aria-live="polite">
            <PlaceholderText align="center">{resolvedLabels.status.emptyListMessage}</PlaceholderText>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      ref={forwardedRef}
      className={typeaheadSearchStyles}
      style={typeaheadSearchStyle}
      data-disabled={resolvedIsDisabled || undefined}
      data-testid={dataTestID ?? "typeahead-search"}
    >
      <div className={inputRowStyles} style={customInputRowStyles}>
        <Input
          aria-label={props["aria-label"]}
          data-testid="typeahead-search-input"
          value={inputValue}
          placeholder={placeholder}
          isDisabled={resolvedIsDisabled}
          autoFocus={shouldAutoFocusInput}
          enableFocusStyle={false}
          customStyles={customInputStyles}
          className={inputStyles}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return

            event.preventDefault()
            submitQuery()
          }}
        />
        <Button
          aria-label={resolvedLabels.searchButtonAriaLabel}
          customClassName={searchButtonStyles}
          customStyles={customSearchButtonStyles}
          isDisabled={resolvedIsDisabled}
          geometry="rounded"
          raised={false}
          onPress={submitQuery}
          data-testid="typeahead-search-button"
        >
          {SearchIcon}
        </Button>
      </div>

      <div className={resultsContainerStyles} style={customResultsContainerStyles}>
        {status === TYPEAHEAD_SEARCH_STATUS__RESULTS ? (
          <ListBox
            items={resolvedItems}
            shouldFocusWrap={shouldFocusWrap}
            selectionMode="single"
            className={resultsListStyles}
            style={customResultsListStyles}
            onSelectionChange={handleSelectionChange}
            aria-label={resolvedLabels.resultsListAriaLabel}
          >
            {renderListBoxItem}
          </ListBox>
        ) : (
          renderStatus()
        )}
      </div>
    </div>
  )
})

export type TTypeaheadSearchComponent = <T extends object = object>(
  props: TTypeaheadSearchProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export default TypeaheadSearch as unknown as TTypeaheadSearchComponent
