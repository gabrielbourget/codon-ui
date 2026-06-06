"use client"

import {
  type FocusEvent,
  type ForwardedRef,
  type ReactElement,
  type RefAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ListBoxRenderProps } from "react-aria-components"
import { type Key, ComboBox as AdobeComboBox, Group, ListBox, Popover } from "react-aria-components"

import { POPOVER_PLACEMENT__BOTTOM_START } from "../../tokens/placement"
import Button from "../Button/Button"
import Input from "../Input/Input"
import ListBoxItem from "../ListBoxItem/ListBoxItem"
import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"

import styles from "./CompactTypeaheadSearchStyles.module.css"
import {
  type TCompactTypeaheadSearchProps,
  type TCompactTypeaheadSearchRenderItemArgs,
  type TCompactTypeaheadSearchState,
  calibrateComponent,
} from "./helpers"
import { resolveCompactTypeaheadSearchLabels } from "./labels"

const { typeAheadSearch__status, inputButtonGroup__button } = styles

const CompactTypeaheadSearch = forwardRef(function CompactTypeaheadSearchInner<T extends object>(
  props: TCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "data-testid": dataTestID,
    className,
    color,
    customButtonStyles: customButtonStyles__props,
    customInputButtonGroupStyles: customInputButtonGroupStyles__props,
    customInputStyles: customInputStyles__props,
    customOptionsListStyles,
    customStyles: customStyles__props,
    defaultInputValue = "",
    emptyListMessage,
    enableFocusStyle,
    errorState,
    geometry,
    getItemKey,
    getItemTextValue,
    height,
    inputValue,
    isDisabled,
    isLoading = false,
    isOpen,
    items,
    labels,
    LoadingIndicator: LoadingIndicator__props,
    loadingMessage,
    minimumInputLength = 0,
    minimumInputLengthMessage,
    offsetFocusRing,
    onChange,
    onInputChange,
    onOpenChange,
    placement = POPOVER_PLACEMENT__BOTTOM_START,
    placeholder,
    SearchIcon: SearchIcon__props,
    renderItem,
    rtl = false,
    shouldFocusWrap = true,
    style,
    successState,
    textSize,
    warningState,
    width,
    ...rest
  } = props
  const comboBoxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const restoreInputFocusTimeoutRef = useRef<number | null>(null)

  const [state, setState] = useState<TCompactTypeaheadSearchState>({
    internalInputValue: defaultInputValue,
    isOpen: false,
    suppressMinimumQueryState: false,
  })

  // Controlled props win when present, otherwise the component falls back to its internal state.
  const resolvedInputValue = inputValue !== undefined ? inputValue : state.internalInputValue
  const trimmedInputValue = resolvedInputValue.trim()
  const shouldRequestResults = trimmedInputValue.length >= minimumInputLength
  const resolvedLabels = resolveCompactTypeaheadSearchLabels({
    labels,
    minimumInputLengthMessage,
    loadingMessage,
    emptyListMessage,
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
  } = calibrateComponent({
    ...props,
    SearchIcon: SearchIcon__props,
    LoadingIndicator: LoadingIndicator__props,
    rtl,
  })

  const resolvedItems = useMemo(() => {
    if (!shouldRequestResults) return []

    // Parents and wrappers fully curate the result collection before passing it in.
    return Array.from(items ?? [])
  }, [items, shouldRequestResults])

  const shouldKeepControlledQueryOpen = inputValue !== undefined && trimmedInputValue.length > 0
  const resolvedOpen = isOpen ?? (state.isOpen || shouldKeepControlledQueryOpen)
  const isOpenControlled = isOpen !== undefined
  const resolvedIsDisabled = isDisabled

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

  const shouldShowMinimumQueryState = !shouldRequestResults && minimumInputLength > 0
  const shouldShowLoadingState = isLoading
  const shouldShowMinimumQueryStateResolved = shouldShowMinimumQueryState && !state.suppressMinimumQueryState
  const shouldShowStatusState = shouldShowMinimumQueryStateResolved || shouldShowLoadingState

  const setCompactTypeaheadSearchRef = useCallback(
    (node: HTMLDivElement | null) => {
      comboBoxRef.current = node

      if (typeof forwardedRef === "function") {
        forwardedRef(node)
        return
      }

      if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef],
  )

  useEffect(() => {
    return () => {
      if (restoreInputFocusTimeoutRef.current !== null) {
        window.clearTimeout(restoreInputFocusTimeoutRef.current)
      }
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    const activeElement = typeof document !== "undefined" ? document.activeElement : null
    const isFocusStillWithin = activeElement instanceof Node && comboBoxRef.current?.contains(activeElement) === true
    const shouldIgnoreControlledClose =
      shouldShowStatusState &&
      inputValue !== undefined &&
      trimmedInputValue.length > 0 &&
      !nextOpen &&
      isFocusStillWithin

    if (shouldIgnoreControlledClose) return

    if (!isOpenControlled) {
      setState((prevState) => ({
        ...prevState,
        isOpen: nextOpen,
      }))
    }
    onOpenChange?.(nextOpen)
  }

  const handleInputChange = (value: string) => {
    setState((prevState) => ({
      ...prevState,
      // Uncontrolled usage stores the current query locally, but controlled usage delegates that to the parent.
      ...(inputValue === undefined ? { internalInputValue: value } : {}),
      // Typing reopens the popover in uncontrolled mode so new states or results are visible right away.
      ...(!isOpenControlled ? { isOpen: true } : {}),
    }))
    onInputChange?.(value)
  }

  const clearMinimumQueryStateSuppression = () => {
    setState((prevState) => ({
      ...prevState,
      suppressMinimumQueryState: false,
    }))
  }

  const closePopoverAndRestoreInputFocus = useCallback(() => {
    if (restoreInputFocusTimeoutRef.current !== null) {
      window.clearTimeout(restoreInputFocusTimeoutRef.current)
    }

    restoreInputFocusTimeoutRef.current = window.setTimeout(() => {
      if (!isOpenControlled) {
        setState((prevState) => ({
          ...prevState,
          isOpen: false,
        }))
      }

      onOpenChange?.(false)
      inputRef.current?.focus()
      restoreInputFocusTimeoutRef.current = null
    }, 0)
  }, [isOpenControlled, onOpenChange])

  const handleSelectionChange = (key: Key | null) => {
    if (key !== null) {
      setState((prevState) => ({
        ...prevState,
        suppressMinimumQueryState: true,
        ...(!isOpenControlled ? { isOpen: false } : {}),
      }))
    }

    onChange?.(key)

    if (key !== null) {
      closePopoverAndRestoreInputFocus()
    }
  }

  const handleStatusStateBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Status-only popovers have no actionable list items, so leaving the input/button group should collapse them.
    if (!shouldShowStatusState) return

    const nextFocusedElement = event.relatedTarget
    if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) return

    handleOpenChange(false)
  }

  const renderListBoxItem = useCallback(
    (item: T) => {
      const itemIndex = resolvedItems.indexOf(item)
      const resolvedItemIndex = itemIndex >= 0 ? itemIndex : 0
      const itemKey = getResolvedItemKey(item, resolvedItemIndex)
      const textValue = getResolvedItemTextValue(item)
      const renderItemArgs: TCompactTypeaheadSearchRenderItemArgs = {
        query: resolvedInputValue,
        textValue,
        itemKey,
      }

      return (
        <ListBoxItem id={itemKey} textValue={textValue}>
          {renderItem ? renderItem(item, renderItemArgs) : textValue}
        </ListBoxItem>
      )
    },
    [resolvedItems, getResolvedItemKey, getResolvedItemTextValue, resolvedInputValue, renderItem],
  )

  return (
    <AdobeComboBox
      ref={setCompactTypeaheadSearchRef}
      allowsEmptyCollection
      {...rest}
      items={resolvedItems}
      isDisabled={resolvedIsDisabled}
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
              customStyles={{ ...customButtonStyles }}
              isDisabled={resolvedIsDisabled}
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
              {shouldShowLoadingState ? (
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
