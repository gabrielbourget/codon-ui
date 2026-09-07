import classNames from "classnames"
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  type CSSProperties,
  type Dispatch,
  type FocusEvent,
  type ForwardedRef,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react"
import type { ComboBoxProps, ComboBoxRenderProps, Key } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"
import ListBoxItem from "../ListBoxItem/ListBoxItem"

import styles from "./CompactTypeaheadSearchStyles.module.css"
import CompactTypeaheadSearchDefaultLoadingIndicator from "./DefaultLoadingIndicator"
import CompactTypeaheadSearchDefaultSearchIcon from "./DefaultSearchIcon"
import { resolveCompactTypeaheadSearchLabels, type TPartialCompactTypeaheadSearchLabels } from "./labels"

const {
  ["inputButtonGroup--applyFocusStyle"]: inputButtonGroupApplyFocusStyle,
  ["inputButtonGroup--errorState"]: inputButtonGroupErrorState,
  ["inputButtonGroup--noFocusStyle"]: inputButtonGroupNoFocusStyle,
  ["inputButtonGroup--offsetFocusRing"]: inputButtonGroupOffsetFocusRing,
  ["inputButtonGroup--round"]: inputButtonGroupRound,
  ["inputButtonGroup--rounded"]: inputButtonGroupRounded,
  ["inputButtonGroup--rtl"]: inputButtonGroupRtl,
  ["inputButtonGroup--successState"]: inputButtonGroupSuccessState,
  ["inputButtonGroup--warningState"]: inputButtonGroupWarningState,
} = styles

export const TYPE_AHEAD_SEARCH_SIZE__SM = "small"
export const TYPE_AHEAD_SEARCH_SIZE__MD = "medium"
export const TYPE_AHEAD_SEARCH_SIZE__LG = "large"

export const AVAILABLE_TYPE_AHEAD_SEARCH_SIZES = [
  TYPE_AHEAD_SEARCH_SIZE__SM,
  TYPE_AHEAD_SEARCH_SIZE__MD,
  TYPE_AHEAD_SEARCH_SIZE__LG,
] as const
export type TAvailableCompactTypeaheadSearchSizes = (typeof AVAILABLE_TYPE_AHEAD_SEARCH_SIZES)[number]

export type TCompactTypeaheadSearchRenderItemArgs = {
  query: string
  textValue: string
  itemKey: Key
}

export type TCompactTypeaheadSearchState = {
  internalInputValue: string
  isOpen: boolean
  suppressMinimumQueryState: boolean
}

type TCompactTypeaheadSearchSharedProps<T extends object> = Omit<
  ComboBoxProps<T>,
  | "children"
  | "defaultInputValue"
  | "inputValue"
  | "items"
  | "onInputChange"
  | "selectedKey"
  | "defaultSelectedKey"
  | "onSelectionChange"
> & {
  "data-testid"?: string
  items?: Iterable<T>
  isLoading?: boolean
  isOpen?: boolean
  placeholder?: string
  inputValue?: string
  defaultInputValue?: string
  onInputChange?: (value: string) => void
  height?: string | number
  width?: string | number
  color?: string
  geometry?: TCornerGeometry
  textSize?: TAvailableCompactTypeaheadSearchSizes
  placement?: TAvailablePopoverPlacementPositions
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  emptyListMessage?: string
  loadingMessage?: string
  minimumInputLength?: number
  minimumInputLengthMessage?: string
  labels?: TPartialCompactTypeaheadSearchLabels
  shouldFocusWrap?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  rtl?: boolean
  SearchIcon?: ReactNode
  LoadingIndicator?: ReactNode
  getItemKey?: (item: T) => Key
  getItemTextValue?: (item: T) => string
  renderItem?: (item: T, args: TCompactTypeaheadSearchRenderItemArgs) => ReactNode
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
  customInputButtonGroupStyles?: CSSProperties
  customOptionsListStyles?: CSSProperties
  customStyles?: CSSProperties
}

export type TCompactTypeaheadSearchProps<T extends object> = TCompactTypeaheadSearchSharedProps<T>

type TCompactTypeaheadSearchClassNameRenderProps = ComboBoxRenderProps & {
  defaultClassName: string | undefined
}

type TCompactTypeaheadSearchStyleRenderProps = ComboBoxRenderProps & {
  defaultStyle: CSSProperties
}

const mergeCompactTypeaheadSearchClassNames = <T extends object>(
  computedClassName: string,
  classNameProp: ComboBoxProps<T>["className"],
): ComboBoxProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TCompactTypeaheadSearchClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeCompactTypeaheadSearchStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeCompactTypeaheadSearchStyle = <T extends object>(
  computedStyles: CSSProperties,
  styleProp: ComboBoxProps<T>["style"],
): ComboBoxProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TCompactTypeaheadSearchStyleRenderProps) =>
      mergeCompactTypeaheadSearchStyles(computedStyles, styleProp(styleProps))
  }

  return mergeCompactTypeaheadSearchStyles(computedStyles, styleProp)
}

const computeGeometryStyle = <T extends object>(props: TCompactTypeaheadSearchProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return inputButtonGroupRounded
    case ROUND:
      return inputButtonGroupRound
    default:
      return undefined
  }
}

const computeCompactTypeaheadSearchBorderStyle = <T extends object>(props: TCompactTypeaheadSearchProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle: string | undefined = undefined

  if (errorState) {
    borderStyle = inputButtonGroupErrorState
    return borderStyle
  }

  if (warningState) {
    borderStyle = inputButtonGroupWarningState
    return borderStyle
  }

  if (successState) {
    borderStyle = inputButtonGroupSuccessState
    return borderStyle
  }

  return borderStyle
}

type TCalibrateCompactTypeaheadSearchArgs<T extends object> = {
  props: TCompactTypeaheadSearchProps<T>
  forwardedRef: ForwardedRef<HTMLDivElement>
  state: TCompactTypeaheadSearchState
  setState: Dispatch<SetStateAction<TCompactTypeaheadSearchState>>
  comboBoxRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  restoreInputFocusTimeoutRef: RefObject<number | null>
}

/** Derives combobox visuals and coordinates controlled queries, selection and focus while the component owns its state and refs. */
export const useCalibratedComponent = <T extends object>({
  props,
  forwardedRef,
  state,
  setState,
  comboBoxRef,
  inputRef,
  restoreInputFocusTimeoutRef,
}: TCalibrateCompactTypeaheadSearchArgs<T>) => {
  const {
    inputValue,
    isLoading = false,
    isOpen,
    items,
    labels,
    emptyListMessage,
    loadingMessage,
    minimumInputLength = 0,
    minimumInputLengthMessage,
    onChange,
    onInputChange,
    onOpenChange,
    getItemKey,
    getItemTextValue,
    renderItem,
    rtl = false,
  } = props
  const { typeAheadSearch, popover, optionsList, inputButtonGroup, typeAheadSearch__iconColor } = styles
  const {
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    height,
    width,
    color,
    className,
    customStyles: customStyles__props,
    customInputStyles: customInputStyles__props,
    customInputButtonGroupStyles: customInputButtonGroupStyles__props,
    customButtonStyles: customButtonStyles__props,
    style,
  } = props
  let { SearchIcon, LoadingIndicator } = props

  if (!SearchIcon)
    SearchIcon = createElement(CompactTypeaheadSearchDefaultSearchIcon, {
      size: 15,
      customClassName: typeAheadSearch__iconColor,
      "data-testid": "type-ahead-search-default-search-icon",
    })
  if (!LoadingIndicator) {
    LoadingIndicator = createElement(CompactTypeaheadSearchDefaultLoadingIndicator, {
      size: 18,
      spinnerTrackWidth: 2.5,
      spinnerTrackIsTransparent: true,
      testID: "type-ahead-search-default-loading-indicator",
    })
  }

  const geometryStyle = computeGeometryStyle(props)
  const typeAheadSearchBorderStyle = computeCompactTypeaheadSearchBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? inputButtonGroupNoFocusStyle
      : inputButtonGroupApplyFocusStyle
  const offsetFocusRingStyle = offsetFocusRing__props === true ? inputButtonGroupOffsetFocusRing : undefined
  const rtlStyle = rtl ? inputButtonGroupRtl : undefined

  const computedTypeAheadSearchStyles = classNames(typeAheadSearch)
  const optionsListStyles = classNames(optionsList)
  const popoverStyles = classNames(popover)
  const inputButtonGroupStyles = classNames(
    inputButtonGroup,
    typeAheadSearchBorderStyle,
    geometryStyle,
    focusStyle,
    offsetFocusRingStyle,
    rtlStyle,
  )

  const customStyles = Object.assign({ height, width: width ?? "100%", color }, { ...customStyles__props })
  const typeAheadSearchStyles = mergeCompactTypeaheadSearchClassNames(computedTypeAheadSearchStyles, className)
  const typeAheadSearchStyle = computeCompactTypeaheadSearchStyle(customStyles, style)

  const customInputButtonGroupStyles = Object.assign(
    { height, width: width ?? "100%", color },
    { ...customInputButtonGroupStyles__props },
  )

  const customInputStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color },
    { ...customInputStyles__props },
  )

  const customButtonStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color, height: "100%" },
    { ...customButtonStyles__props },
  )

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
    [comboBoxRef, forwardedRef],
  )

  useEffect(() => {
    return () => {
      if (restoreInputFocusTimeoutRef.current !== null) {
        window.clearTimeout(restoreInputFocusTimeoutRef.current)
      }
    }
  }, [restoreInputFocusTimeoutRef])

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
  }, [inputRef, isOpenControlled, onOpenChange, restoreInputFocusTimeoutRef, setState])
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
  }
}
