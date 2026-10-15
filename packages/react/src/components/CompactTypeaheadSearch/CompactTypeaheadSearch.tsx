"use client"

import { type ForwardedRef, type ReactElement, type RefAttributes, forwardRef, useRef, useState } from "react"
import { ComboBox as AdobeComboBox, Group, ListBox, Popover, type ListBoxRenderProps } from "react-aria-components"

import { POPOVER_PLACEMENT__BOTTOM_START } from "../../tokens/placement"
import Button from "../Button/Button"
import Input from "../Input/Input"
import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"

import styles from "./CompactTypeaheadSearchStyles.module.css"
import { useCalibratedComponent, type TCompactTypeaheadSearchProps, type TCompactTypeaheadSearchState } from "./helpers"

const { typeAheadSearch__status, inputButtonGroup__button } = styles

const CompactTypeaheadSearch = forwardRef(function CompactTypeaheadSearchInner<T extends object>(
  props: TCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "data-testid": dataTestID,
    className: _className,
    color: _color,
    customButtonStyles: customButtonStyles__props,
    customInputButtonGroupStyles: customInputButtonGroupStyles__props,
    customInputStyles: customInputStyles__props,
    customOptionsListStyles,
    customStyles: customStyles__props,
    defaultInputValue = "",
    emptyListMessage: _emptyListMessage,
    enableFocusStyle: _enableFocusStyle,
    errorState: _errorState,
    geometry: _geometry,
    getItemKey: _getItemKey,
    getItemTextValue: _getItemTextValue,
    height: _height,
    inputValue: _inputValue,
    isDisabled,
    isLoading = false,
    isOpen: _isOpen,
    items: _items,
    labels: _labels,
    LoadingIndicator: LoadingIndicator__props,
    loadingMessage: _loadingMessage,
    minimumInputLength = 0,
    minimumInputLengthMessage: _minimumInputLengthMessage,
    offsetFocusRing: _offsetFocusRing,
    onChange: _onChange,
    onInputChange: _onInputChange,
    onOpenChange: _onOpenChange,
    placement = POPOVER_PLACEMENT__BOTTOM_START,
    placeholder,
    SearchIcon: SearchIcon__props,
    renderItem: _renderItem,
    rtl = false,
    shouldFocusWrap = true,
    style: _style,
    successState: _successState,
    textSize,
    warningState: _warningState,
    width: _width,
    ...nativeProps
  } = props
  const comboBoxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const restoreInputFocusTimeoutRef = useRef<number | null>(null)
  const [state, setState] = useState<TCompactTypeaheadSearchState>({
    internalInputValue: defaultInputValue,
    isOpen: false,
    suppressMinimumQueryState: false,
  })

  const {
    typeAheadSearchStyles,
    typeAheadSearchStyle,
    inputButtonGroupStyles,
    optionsListStyles,
    popoverStyles,
    customInputButtonGroupStyles,
    customButtonStyles,
    customInputStyles,
    SearchIcon,
    LoadingIndicator,
    resolvedInputValue,
    resolvedItems,
    resolvedOpen,
    resolvedLabels,
    shouldShowMinimumQueryStateResolved,
    shouldShowStatusState,
    setCompactTypeaheadSearchRef,
    handleOpenChange,
    handleInputChange,
    clearMinimumQueryStateSuppression,
    handleSelectionChange,
    handleStatusStateBlur,
    renderListBoxItem,
  } = useCalibratedComponent({
    props,
    forwardedRef,
    state,
    setState,
    comboBoxRef,
    inputRef,
    restoreInputFocusTimeoutRef,
  })

  return (
    <AdobeComboBox
      ref={setCompactTypeaheadSearchRef}
      allowsEmptyCollection
      {...nativeProps}
      items={resolvedItems}
      isDisabled={isDisabled}
      onOpenChange={handleOpenChange}
      onChange={handleSelectionChange}
      onInputChange={handleInputChange}
      inputValue={resolvedInputValue}
      className={typeAheadSearchStyles}
      style={typeAheadSearchStyle}
      data-testid={dataTestID ?? "type-ahead-search"}
      dir={rtl ? "rtl" : "ltr"}
    >
      {() => (
        <>
          {/* The combobox shell stays stable across states; only the popover body swaps between status views and results. */}
          <Group
            className={inputButtonGroupStyles}
            style={{ ...customInputButtonGroupStyles }}
            aria-label={resolvedLabels.inputButtonGroupAriaLabel}
            onBlur={handleStatusStateBlur}
          >
            <Input
              ref={inputRef}
              textSize={textSize}
              customStyles={{ width: "100%", ...customInputStyles }}
              enableFocusStyle={false}
              placeholder={placeholder}
              onKeyDown={clearMinimumQueryStateSuppression}
              onPaste={clearMinimumQueryStateSuppression}
              data-testid="type-ahead-search-input"
            />
            <Button
              aria-label={resolvedLabels.searchButtonAriaLabel}
              aria-haspopup="listbox"
              geometry="rounded"
              raised={false}
              customClassName={inputButtonGroup__button}
              customStyles={customButtonStyles}
              isDisabled={isDisabled}
              data-testid="type-ahead-search-button"
            >
              {SearchIcon}
            </Button>
          </Group>
          {shouldShowStatusState ? (
            <Popover
              className={popoverStyles}
              style={{ ...customOptionsListStyles }}
              offset={5}
              isOpen={resolvedOpen}
              placement={placement}
            >
              {/* Minimum-query guidance prevents premature searching and makes the threshold visible to the user. */}
              {shouldShowMinimumQueryStateResolved ? (
                <div
                  className={optionsListStyles}
                  style={{ ...customOptionsListStyles }}
                  role="listbox"
                  aria-label={resolvedLabels.suggestionsListAriaLabel}
                >
                  <div
                    className={typeAheadSearch__status}
                    data-testid="type-ahead-search-minimum-query-state"
                    aria-live="polite"
                  >
                    <PlaceholderText align="center">
                      {resolvedLabels.status.minimumInputLengthMessage({ minimumInputLength })}
                    </PlaceholderText>
                  </div>
                </div>
              ) : null}

              {/* Loading is parent-driven now, but the shell still owns the visual loading state. */}
              {isLoading ? (
                <div
                  className={optionsListStyles}
                  style={{ ...customOptionsListStyles }}
                  role="listbox"
                  aria-label={resolvedLabels.suggestionsListAriaLabel}
                >
                  <div
                    className={typeAheadSearch__status}
                    data-testid="type-ahead-search-loading-state"
                    aria-live="polite"
                  >
                    {LoadingIndicator}
                    <PlaceholderText align="center">{resolvedLabels.status.loadingMessage}</PlaceholderText>
                  </div>
                </div>
              ) : null}
            </Popover>
          ) : (
            <Popover
              className={popoverStyles}
              style={{ ...customOptionsListStyles }}
              offset={5}
              isOpen={resolvedOpen}
              placement={placement}
            >
              <ListBox
                key={resolvedInputValue}
                items={resolvedItems}
                shouldFocusWrap={shouldFocusWrap}
                className={optionsListStyles}
                style={{ ...customOptionsListStyles }}
                aria-label={resolvedLabels.suggestionsListAriaLabel}
                renderEmptyState={({ isEmpty }: ListBoxRenderProps) =>
                  isEmpty ? (
                    <div
                      className={typeAheadSearch__status}
                      data-testid="type-ahead-search-empty-state"
                      aria-live="polite"
                    >
                      <PlaceholderText align="center">{resolvedLabels.status.emptyListMessage}</PlaceholderText>
                    </div>
                  ) : null
                }
              >
                {renderListBoxItem}
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
