"use client"

import { type ForwardedRef, type ReactElement, type RefAttributes, forwardRef } from "react"
import type { ListBoxRenderProps } from "react-aria-components"
import { ComboBox as AdobeComboBox, Group, ListBox, Popover } from "react-aria-components"

import Button from "../Button/Button"
import Input from "../Input/Input"
import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"

import type { TCompactTypeaheadSearchProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"

const CompactTypeaheadSearch = forwardRef(function CompactTypeaheadSearchInner<T extends object>(
  props: TCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const { input, popover, results, root, status } = useCalibratedComponent(props, forwardedRef)

  return (
    <AdobeComboBox
      ref={root.ref}
      allowsEmptyCollection
      {...root.nativeProps}
      items={root.items}
      isDisabled={root.isDisabled}
      onOpenChange={root.onOpenChange}
      onChange={root.onChange}
      onInputChange={root.onInputChange}
      inputValue={root.inputValue}
      className={root.className}
      style={root.style}
      data-testid={root.dataTestID}
      dir={root.direction}
    >
      {() => (
        <>
          {/* The combobox shell stays stable across states; only the popover body swaps between status views and results. */}
          <Group
            className={input.group.className}
            style={input.group.style}
            aria-label={input.group.ariaLabel}
            onBlur={input.group.onBlur}
          >
            <Input
              ref={input.control.ref}
              textSize={input.control.textSize}
              customStyles={input.control.style}
              enableFocusStyle={false}
              placeholder={input.control.placeholder}
              onKeyDown={input.control.onKeyDown}
              onPaste={input.control.onPaste}
              data-testid="type-ahead-search-input"
            />
            <Button
              aria-label={input.button.ariaLabel}
              aria-haspopup="listbox"
              geometry="rounded"
              raised={false}
              customClassName={input.button.className}
              customStyles={input.button.style}
              isDisabled={input.button.isDisabled}
              data-testid="type-ahead-search-button"
            >
              {input.button.icon}
            </Button>
          </Group>
          {status.isVisible ? (
            <Popover
              className={popover.className}
              style={popover.style}
              offset={5}
              isOpen={popover.isOpen}
              placement={popover.placement}
            >
              {/* Minimum-query guidance prevents premature searching and makes the threshold visible to the user. */}
              {status.shouldShowMinimumQuery ? (
                <div className={results.className} style={results.style} role="listbox" aria-label={status.ariaLabel}>
                  <div
                    className={status.className}
                    data-testid="type-ahead-search-minimum-query-state"
                    aria-live="polite"
                  >
                    <PlaceholderText align="center">{status.minimumInputLengthMessage}</PlaceholderText>
                  </div>
                </div>
              ) : null}

              {/* Loading is parent-driven now, but the shell still owns the visual loading state. */}
              {status.isLoading ? (
                <div className={results.className} style={results.style} role="listbox" aria-label={status.ariaLabel}>
                  <div className={status.className} data-testid="type-ahead-search-loading-state" aria-live="polite">
                    {status.loadingIndicator}
                    <PlaceholderText align="center">{status.loadingMessage}</PlaceholderText>
                  </div>
                </div>
              ) : null}
            </Popover>
          ) : (
            <Popover
              className={popover.className}
              style={popover.style}
              offset={5}
              isOpen={popover.isOpen}
              placement={popover.placement}
            >
              <ListBox
                key={results.key}
                items={results.items}
                shouldFocusWrap={results.shouldFocusWrap}
                className={results.className}
                style={results.style}
                aria-label={results.ariaLabel}
                renderEmptyState={({ isEmpty }: ListBoxRenderProps) =>
                  isEmpty ? (
                    <div className={status.className} data-testid="type-ahead-search-empty-state" aria-live="polite">
                      <PlaceholderText align="center">{results.emptyListMessage}</PlaceholderText>
                    </div>
                  ) : null
                }
              >
                {results.renderItem}
              </ListBox>
            </Popover>
          )}
        </>
      )}
    </AdobeComboBox>
  )
})

export type TCompactTypeaheadSearchComponent = <T extends object = object>(
  props: TCompactTypeaheadSearchProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export default CompactTypeaheadSearch as unknown as TCompactTypeaheadSearchComponent
