"use client"

import { type FocusEvent, type ForwardedRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Key } from "react-aria-components"

import { POPOVER_PLACEMENT__BOTTOM_START } from "../../tokens/placement"
import ListBoxItem from "../ListBoxItem/ListBoxItem"

import styles from "./CompactTypeaheadSearchStyles.module.css"
import {
  type TCompactTypeaheadSearchProps,
  type TCompactTypeaheadSearchRenderItemArgs,
  type TCompactTypeaheadSearchState,
  calibrateComponent,
} from "./helpers"
import { resolveCompactTypeaheadSearchLabels } from "./labels"

const { typeAheadSearch__status, inputButtonGroup__button } = styles

/**
 * Owns the compact combobox draft, focus lifecycle, callbacks, and presentation resources while callers retain result
 * curation and controlled query ownership.
 */
export const useCalibratedComponent = <T extends object>(
  props: TCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) => {
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
    emptyListMessage,
    enableFocusStyle: _enableFocusStyle,
    errorState: _errorState,
    geometry: _geometry,
    getItemKey,
    getItemTextValue,
    height: _height,
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
    offsetFocusRing: _offsetFocusRing,
    onChange,
    onInputChange,
    onOpenChange,
    placement = POPOVER_PLACEMENT__BOTTOM_START,
    placeholder,
    SearchIcon: SearchIcon__props,
    renderItem,
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

  // -> Controlled props win when present, otherwise the component falls back to its internal state.
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

    // -> Parents and wrappers fully curate the result collection before passing it in.
    return Array.from(items ?? [])
  }, [items, shouldRequestResults])
  const shouldKeepControlledQueryOpen = inputValue !== undefined && trimmedInputValue.length > 0
  const resolvedOpen = isOpen ?? (state.isOpen || shouldKeepControlledQueryOpen)
  const isOpenControlled = isOpen !== undefined
  const shouldShowMinimumQueryState = !shouldRequestResults && minimumInputLength > 0
  const shouldShowLoadingState = isLoading
  const shouldShowMinimumQueryStateResolved = shouldShowMinimumQueryState && !state.suppressMinimumQueryState
  const shouldShowStatusState = shouldShowMinimumQueryStateResolved || shouldShowLoadingState

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
  const setCompactTypeaheadSearchRef = useCallback(
    (node: HTMLDivElement | null) => {
      comboBoxRef.current = node

      if (typeof forwardedRef === "function") {
        forwardedRef(node)
        return
      }

      if (forwardedRef) forwardedRef.current = node
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
      setState((previousState) => ({
        ...previousState,
        isOpen: nextOpen,
      }))
    }
    onOpenChange?.(nextOpen)
  }
  const handleInputChange = (value: string) => {
    setState((previousState) => ({
      ...previousState,
      // -> Uncontrolled usage stores the current query locally, but controlled usage delegates that to the parent.
      ...(inputValue === undefined ? { internalInputValue: value } : {}),
      // -> Typing reopens the popover in uncontrolled mode so new states or results are visible right away.
      ...(!isOpenControlled ? { isOpen: true } : {}),
    }))
    onInputChange?.(value)
  }
  const clearMinimumQueryStateSuppression = () => {
    setState((previousState) => ({
      ...previousState,
      suppressMinimumQueryState: false,
    }))
  }
  const closePopoverAndRestoreInputFocus = useCallback(() => {
    if (restoreInputFocusTimeoutRef.current !== null) {
      window.clearTimeout(restoreInputFocusTimeoutRef.current)
    }

    restoreInputFocusTimeoutRef.current = window.setTimeout(() => {
      if (!isOpenControlled) {
        setState((previousState) => ({
          ...previousState,
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
      setState((previousState) => ({
        ...previousState,
        suppressMinimumQueryState: true,
        ...(!isOpenControlled ? { isOpen: false } : {}),
      }))
    }

    onChange?.(key)

    if (key !== null) closePopoverAndRestoreInputFocus()
  }
  const handleStatusStateBlur = (event: FocusEvent<HTMLDivElement>) => {
    // -> Status-only popovers have no actionable list items, so leaving the input/button group should collapse them.
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

  return {
    input: {
      button: {
        ariaLabel: resolvedLabels.searchButtonAriaLabel,
        className: inputButtonGroup__button,
        icon: SearchIcon,
        isDisabled,
        style: customButtonStyles,
      },
      control: {
        onKeyDown: clearMinimumQueryStateSuppression,
        onPaste: clearMinimumQueryStateSuppression,
        placeholder,
        ref: inputRef,
        style: { width: "100%", ...customInputStyles },
        textSize,
      },
      group: {
        ariaLabel: resolvedLabels.inputButtonGroupAriaLabel,
        className: inputButtonGroupStyles,
        onBlur: handleStatusStateBlur,
        style: { ...customInputButtonGroupStyles },
      },
    },
    popover: {
      className: popoverStyles,
      isOpen: resolvedOpen,
      placement,
      style: { ...customOptionsListStyles },
    },
    results: {
      ariaLabel: resolvedLabels.suggestionsListAriaLabel,
      className: optionsListStyles,
      emptyListMessage: resolvedLabels.status.emptyListMessage,
      items: resolvedItems,
      key: resolvedInputValue,
      renderItem: renderListBoxItem,
      shouldFocusWrap,
      style: { ...customOptionsListStyles },
    },
    root: {
      className: typeAheadSearchStyles,
      dataTestID: dataTestID ?? "type-ahead-search",
      direction: rtl ? "rtl" : "ltr",
      inputValue: resolvedInputValue,
      isDisabled,
      items: resolvedItems,
      nativeProps,
      onChange: handleSelectionChange,
      onInputChange: handleInputChange,
      onOpenChange: handleOpenChange,
      ref: setCompactTypeaheadSearchRef,
      style: typeAheadSearchStyle,
    },
    status: {
      ariaLabel: resolvedLabels.suggestionsListAriaLabel,
      className: typeAheadSearch__status,
      isLoading: shouldShowLoadingState,
      isVisible: shouldShowStatusState,
      loadingIndicator: LoadingIndicator,
      loadingMessage: resolvedLabels.status.loadingMessage,
      minimumInputLengthMessage: resolvedLabels.status.minimumInputLengthMessage({ minimumInputLength }),
      shouldShowMinimumQuery: shouldShowMinimumQueryStateResolved,
    },
  }
}
