import { Fragment, forwardRef, useInsertionEffect, useRef, useState } from "react"
import type { ViewProps } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { LineSegment } from "../LineSegment/LineSegment"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"

import { NativePaginationCounter, NativePaginationInput, NativePaginationPageSize } from "./Fields"
import { resolveNativePaginationLabels } from "./labels"
import {
  getNativePaginationGroups,
  getNativePaginationPageCount,
  getNativePaginationPageForSize,
  getNativePaginationWindow,
} from "./model"
import { NativePaginationPrimary } from "./Primary"
import { getNativePaginationStyles } from "./styles"
import type { TNativePaginationPageSizeOption, TNativePaginationProps, TNativePaginationRef } from "./types"

const defaultSizes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
const wrapperKeys = new Set<string>([
  "setCurrentPage",
  "setItemsPerPage",
  "chosenPaginationSubcomponents",
  "itemsPerPageOptions",
  "maxVisiblePages",
  "consolidationPlacement",
  "color",
  "order",
  "geometry",
  "buttonColorMode",
  "rtl",
  "isDisabled",
  "labels",
  "firstPageLabel",
  "prevPageLabel",
  "nextPageLabel",
  "lastPageLabel",
  "counterText",
  "pageInputLabel",
  "pageInputSelectionButtonText",
  "itemsPerPageLabel",
  "itemsPerPageSelectPlaceholder",
  "incrementAllDownIcon",
  "incrementDownIcon",
  "incrementUpIcon",
  "incrementAllUpIcon",
  "overflowItemsButtonIcon",
  "showWithOnePage",
  "showIncrementButtons",
  "showIncrementButtonsWithOnePage",
  "showFirstPageButton",
  "showFirstPageButtonIcon",
  "showFirstPageButtonLabel",
  "showFirstPageButtonOnFirstPage",
  "showPrevPageButton",
  "showPrevPageButtonIcon",
  "showPrevPageButtonLabel",
  "showPrevPageButtonOnFirstPage",
  "showNextPageButton",
  "showNextPageButtonIcon",
  "showNextPageButtonLabel",
  "showNextPageButtonOnLastPage",
  "showLastPageButton",
  "showLastPageButtonIcon",
  "showLastPageButtonLabel",
  "showLastPageButtonOnLastPage",
  "customComponentStyles",
  "style",
  "customSeparatorStyles",
  "customGeneralButtonProps",
  "customFirstPageButtonStyles",
  "customPrevButtonStyles",
  "customNextButtonStyles",
  "customLastPageButtonStyles",
  "customPageNumberButtonStyles",
  "customPageCounterStyles",
  "customPageCounterProps",
  "customPageNumberInputFormFieldProps",
  "customPageNumberInputFormFieldStyles",
  "customPageNumberInputProps",
  "customPageNumberInputStyles",
  "customPageNumberInputNavigationButtonStyles",
  "pageInputRef",
  "customItemsPerPageFormFieldProps",
  "customItemsPerPageFormFieldStyles",
  "customItemsPerPageSelectProps",
  "customItemsPerPageSelectStyles",
  "customOptionsListStyles",
  "customClickPopoverProps",
  "customClickPopoverTriggerButtonStyles",
  "ariaLabel",
  "ariaLabelledBy",
  "ariaDescribedBy",
  "ariaDetails",
  "aria-describedby",
  "aria-details",
  "data-testid",
  "currentPage",
  "itemsPerPage",
  "numberOfItems",
  "accessibilityLabel",
  "accessibilityLabelledBy",
  "aria-label",
  "aria-labelledby",
])

// Private construction until the native semantics/inherited capability and public acceptance obligations close.
export const Pagination = forwardRef<TNativePaginationRef, TNativePaginationProps>((props, ref) => {
  const count = getNativePaginationPageCount(props),
    items = getNativePaginationWindow(props),
    groups = getNativePaginationGroups(props.chosenPaginationSubcomponents)
  if (typeof props.setCurrentPage !== "function" || typeof props.setItemsPerPage !== "function")
    throw new TypeError("Pagination: controlled page and size request callbacks are required")
  const options = props.itemsPerPageOptions ?? defaultSizes
  const sizes: TNativePaginationPageSizeOption[] = options.map((value) => {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new TypeError("Pagination: page-size options must be positive safe integers")
    return { id: String(value), name: String(value), value }
  })
  if (new Set(sizes.map((item) => item.id)).size !== sizes.length)
    throw new TypeError("Pagination: page-size options must be unique")
  const theme = useNativeTheme(),
    context = useNativeContentContext(),
    labels = resolveNativePaginationLabels(props),
    styles = getNativePaginationStyles(theme, props, context?.foregroundColor)
  const latest = useRef(props),
    live = useRef(false),
    draftValue = useRef<number | null>(1)
  const [draft, setDraft] = useState<number | null>(1)
  useInsertionEffect(() => {
    latest.current = props
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const admitted = () =>
    live.current &&
    !latest.current.isDisabled &&
    (latest.current.showWithOnePage || latest.current.numberOfItems > latest.current.itemsPerPage)
  const requestPage = (value: number) => {
    if (!admitted() || !Number.isSafeInteger(value)) return
    const owner = latest.current,
      next = Math.min(getNativePaginationPageCount(owner), Math.max(1, value))
    if (next !== owner.currentPage) owner.setCurrentPage(next)
  }
  const requestSize = (key: string | number | null) => {
    if (!admitted() || key === null) return
    const owner = latest.current,
      option = (owner.itemsPerPageOptions ?? defaultSizes).find((value) => String(value) === String(key))
    if (option === undefined || option === owner.itemsPerPage) return
    const next = getNativePaginationPageForSize(owner, option)
    owner.setItemsPerPage(option)
    if (admitted() && latest.current.numberOfItems === owner.numberOfItems) latest.current.setCurrentPage(next)
  }
  const setLocalDraft = (value: number | null) => {
    if (admitted()) {
      draftValue.current = value
      setDraft(value)
    }
  }
  const native = Object.fromEntries(Object.entries(props).filter(([key]) => !wrapperKeys.has(key))) as ViewProps
  const nodes = {
    "primary-controls": <NativePaginationPrimary {...{ props, count, items, labels, styles, requestPage }} />,
    "page-counter": <NativePaginationCounter {...{ props, count, labels, styles }} />,
    "page-input": (
      <NativePaginationInput
        {...{ props, count, labels, styles, draft }}
        onDraft={setLocalDraft}
        requestPage={() => {
          if (draftValue.current !== null) requestPage(draftValue.current)
        }}
      />
    ),
    "items-per-page": (
      <NativePaginationPageSize {...{ props, count, labels, styles }} items={sizes} requestSize={requestSize} />
    ),
  }
  if (!(props.numberOfItems > props.itemsPerPage || props.showWithOnePage)) return null
  return (
    <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
      <NativeFocusHost
        {...native}
        ref={ref}
        role="navigation"
        nativeNavigation
        nativeNavigationLabel={labels.root.navigationRoleDescription}
        accessible={false}
        focusable={props.focusable ?? false}
        onFocus={undefined}
        onBlur={undefined}
        onBubbledFocus={props.onFocus}
        onBubbledBlur={props.onBlur}
        accessibilityLabel={
          props.accessibilityLabel ?? props["aria-label"] ?? props.ariaLabel ?? labels.root.navigationAriaLabel
        }
        nativeLabelledBy={nativeAccessibilityIDs(
          props.accessibilityLabelledBy ?? props["aria-labelledby"] ?? props.ariaLabelledBy,
        )}
        nativeDescribedBy={nativeAccessibilityIDs(props["aria-describedby"] ?? props.ariaDescribedBy)}
        nativeDetailsBy={nativeAccessibilityIDs(props["aria-details"] ?? props.ariaDetails)}
        nativeDescriptionLabel={labels.root.descriptionLabel}
        nativeDetailsLabel={labels.root.detailsLabel}
        accessibilityState={{ ...props.accessibilityState, disabled: props.isDisabled ?? false }}
        style={styles.root.view}
        testID={props.testID ?? props["data-testid"] ?? "pagination"}
      >
        {groups.map((group, index) => (
          <Fragment key={group}>
            {nodes[group]}
            {index < groups.length - 1 && (
              <LineSegment
                direction="vertical"
                color={theme.colors.controlBorder}
                customStyles={styles.separator}
                testID={`pagination-separator-${index}`}
              />
            )}
          </Fragment>
        ))}
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
})
Pagination.displayName = "Pagination"
