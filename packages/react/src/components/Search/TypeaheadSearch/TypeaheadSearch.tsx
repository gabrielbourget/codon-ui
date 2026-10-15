"use client"

import { type ForwardedRef, type ReactElement, type RefAttributes, forwardRef } from "react"
import { ListBox } from "react-aria-components"

import Button from "../../Button/Button"
import Input from "../../Input/Input"
import PlaceholderText from "../../Text/variants/PlaceholderText/PlaceholderText"

import { useCalibratedComponent, type TTypeaheadSearchProps } from "./helpers"
import {
  TYPEAHEAD_SEARCH_STATUS__EMPTY,
  TYPEAHEAD_SEARCH_STATUS__ERROR,
  TYPEAHEAD_SEARCH_STATUS__IDLE,
  TYPEAHEAD_SEARCH_STATUS__LOADING,
  TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY,
  TYPEAHEAD_SEARCH_STATUS__RESULTS,
} from "./status"
import styles from "./TypeaheadSearchStyles.module.css"

const {
  typeaheadSearch__input,
  typeaheadSearch__resultsContainer,
  typeaheadSearch__resultsList,
  typeaheadSearch__searchButton,
  typeaheadSearch__status,
} = styles

const TypeaheadSearch = forwardRef(function TypeaheadSearchInner<T extends object>(
  props: TTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "aria-label": inputAriaLabel,
    "data-testid": dataTestID,
    customInputRowStyles,
    customInputStyles,
    customSearchButtonStyles,
    customResultsContainerStyles,
    customResultsListStyles,
    inputValue,
    isDisabled,
    minimumInputLength = 0,
    placeholder,
    shouldAutoFocusInput,
    shouldFocusWrap = true,
    status = TYPEAHEAD_SEARCH_STATUS__RESULTS,
  } = props
  const {
    typeaheadSearchStyles,
    typeaheadSearchStyle,
    inputRowStyles,
    SearchIcon,
    LoadingIndicator,
    resolvedLabels,
    resolvedItems,
    submitQuery,
    handleInputChange,
    handleInputKeyDown,
    handleSelectionChange,
    renderListBoxItem,
  } = useCalibratedComponent(props)

  return (
    <div
      ref={forwardedRef}
      className={typeaheadSearchStyles}
      style={typeaheadSearchStyle}
      data-disabled={isDisabled || undefined}
      data-testid={dataTestID ?? "typeahead-search"}
    >
      <div className={inputRowStyles} style={customInputRowStyles}>
        <Input
          aria-label={inputAriaLabel}
          data-testid="typeahead-search-input"
          value={inputValue}
          placeholder={placeholder}
          isDisabled={isDisabled}
          autoFocus={shouldAutoFocusInput}
          enableFocusStyle={false}
          customStyles={customInputStyles}
          className={typeaheadSearch__input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
        />
        <Button
          aria-label={resolvedLabels.searchButtonAriaLabel}
          customClassName={typeaheadSearch__searchButton}
          customStyles={customSearchButtonStyles}
          isDisabled={isDisabled}
          geometry="rounded"
          raised={false}
          onPress={submitQuery}
          data-testid="typeahead-search-button"
        >
          {SearchIcon}
        </Button>
      </div>

      <div className={typeaheadSearch__resultsContainer} style={customResultsContainerStyles}>
        {status === TYPEAHEAD_SEARCH_STATUS__RESULTS ? (
          <ListBox
            items={resolvedItems}
            shouldFocusWrap={shouldFocusWrap}
            selectionMode="single"
            className={typeaheadSearch__resultsList}
            style={customResultsListStyles}
            onSelectionChange={handleSelectionChange}
            aria-label={resolvedLabels.resultsListAriaLabel}
          >
            {renderListBoxItem}
          </ListBox>
        ) : (
          <>
            {status === TYPEAHEAD_SEARCH_STATUS__IDLE && (
              <div className={typeaheadSearch__status} data-testid="typeahead-search-idle-state" aria-live="polite">
                <PlaceholderText align="center">{resolvedLabels.status.idleMessage}</PlaceholderText>
              </div>
            )}
            {status === TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY && (
              <div
                className={typeaheadSearch__status}
                data-testid="typeahead-search-minimum-query-state"
                aria-live="polite"
              >
                <PlaceholderText align="center">
                  {resolvedLabels.status.minimumInputLengthMessage({ minimumInputLength })}
                </PlaceholderText>
              </div>
            )}
            {status === TYPEAHEAD_SEARCH_STATUS__LOADING && (
              <div className={typeaheadSearch__status} data-testid="typeahead-search-loading-state" aria-live="polite">
                {LoadingIndicator}
                <PlaceholderText align="center">{resolvedLabels.status.loadingMessage}</PlaceholderText>
              </div>
            )}
            {status === TYPEAHEAD_SEARCH_STATUS__ERROR && (
              <div className={typeaheadSearch__status} data-testid="typeahead-search-error-state" aria-live="polite">
                <PlaceholderText align="center">{resolvedLabels.status.errorMessage}</PlaceholderText>
              </div>
            )}
            {status === TYPEAHEAD_SEARCH_STATUS__EMPTY && (
              <div className={typeaheadSearch__status} data-testid="typeahead-search-empty-state" aria-live="polite">
                <PlaceholderText align="center">{resolvedLabels.status.emptyListMessage}</PlaceholderText>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

export type TTypeaheadSearchComponent = <T extends object = object>(
  props: TTypeaheadSearchProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export default TypeaheadSearch as unknown as TTypeaheadSearchComponent
