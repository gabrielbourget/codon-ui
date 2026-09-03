"use client"

import { type ForwardedRef, type ReactElement, type RefAttributes, forwardRef } from "react"
import { ListBox } from "react-aria-components"

import Button from "../../Button/Button"
import Input from "../../Input/Input"
import PlaceholderText from "../../Text/variants/PlaceholderText/PlaceholderText"

import type { TTypeaheadSearchProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"

const TypeaheadSearch = forwardRef(function TypeaheadSearchInner<T extends object>(
  props: TTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const { input, results, root, status } = useCalibratedComponent(props, forwardedRef)

  return (
    <div
      ref={root.ref}
      className={root.className}
      style={root.style}
      data-disabled={root.dataDisabled}
      data-testid={root.dataTestID}
    >
      <div className={input.row.className} style={input.row.style}>
        <Input
          aria-label={input.control.ariaLabel}
          data-testid="typeahead-search-input"
          value={input.control.value}
          placeholder={input.control.placeholder}
          isDisabled={input.control.isDisabled}
          autoFocus={input.control.shouldAutoFocus}
          enableFocusStyle={false}
          customStyles={input.control.style}
          className={input.control.className}
          onChange={input.control.onChange}
          onKeyDown={input.control.onKeyDown}
        />
        <Button
          aria-label={input.button.ariaLabel}
          customClassName={input.button.className}
          customStyles={input.button.style}
          isDisabled={input.button.isDisabled}
          geometry="rounded"
          raised={false}
          onPress={input.button.onPress}
          data-testid="typeahead-search-button"
        >
          {input.button.icon}
        </Button>
      </div>

      <div className={results.containerClassName} style={results.containerStyle}>
        {results.isVisible ? (
          <ListBox
            items={results.items}
            shouldFocusWrap={results.shouldFocusWrap}
            selectionMode="single"
            className={results.className}
            style={results.style}
            onSelectionChange={results.onSelectionChange}
            aria-label={results.ariaLabel}
          >
            {results.renderItem}
          </ListBox>
        ) : (
          <>
            {status.isIdle && (
              <div className={status.className} data-testid="typeahead-search-idle-state" aria-live="polite">
                <PlaceholderText align="center">{status.idleMessage}</PlaceholderText>
              </div>
            )}
            {status.isMinimumQuery && (
              <div className={status.className} data-testid="typeahead-search-minimum-query-state" aria-live="polite">
                <PlaceholderText align="center">{status.minimumInputLengthMessage}</PlaceholderText>
              </div>
            )}
            {status.isLoading && (
              <div className={status.className} data-testid="typeahead-search-loading-state" aria-live="polite">
                {status.loadingIndicator}
                <PlaceholderText align="center">{status.loadingMessage}</PlaceholderText>
              </div>
            )}
            {status.isError && (
              <div className={status.className} data-testid="typeahead-search-error-state" aria-live="polite">
                <PlaceholderText align="center">{status.errorMessage}</PlaceholderText>
              </div>
            )}
            {status.isEmpty && (
              <div className={status.className} data-testid="typeahead-search-empty-state" aria-live="polite">
                <PlaceholderText align="center">{status.emptyListMessage}</PlaceholderText>
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
