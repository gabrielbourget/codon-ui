import classNames from "classnames"
import { type CSSProperties, type FC, useCallback, useMemo } from "react"
import type { Selection } from "react-aria-components"
import { DialogTrigger, ListBox } from "react-aria-components"

import Button from "../../../Button/Button"
import { COLOR_MODE__FILL, COLOR_MODE__OUTLINE } from "../../../Button/helpers"
import ClickPopover from "../../../ClickPopover/ClickPopover"
import ListBoxItem from "../../../ListBoxItem/ListBoxItem"
import Text from "../../../Text/Text"
import {
  DEFAULT_PAGINATION_LABELS,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
  type TInternalPaginationItem,
} from "../../helpers"

import { calibrateComponent, type TPrimaryPaginationControlsProps, useMemoizedProperties } from "./helpers"

const PrimaryPaginationControls: FC<TPrimaryPaginationControlsProps> = (props) => {
  const {
    color,
    order,
    geometry,
    buttonColorMode,
    disabled,
    rtl,
    showFirstPageButtonIcon,
    showFirstPageButtonLabel,
    showPrevPageButtonIcon,
    showPrevPageButtonLabel,
    showNextPageButtonIcon,
    showNextPageButtonLabel,
    showLastPageButtonIcon,
    showLastPageButtonLabel,
    firstPageLabel,
    labels,
    showIncrementButtonsWithOnePage = true,
    prevPageLabel,
    nextPageLabel,
    lastPageLabel,
    onPageNumButtonClick,
    currentPage,
    numberOfItems,
    itemsPerPage,
    iconColor,
    computedPageButtonTextColor,
    internalPaginationItems,
    customFirstPageButtonClassName,
    customFirstPageButtonStyles,
    customPrevButtonClassName,
    customPrevButtonStyles,
    customNextButtonClassName,
    customNextButtonStyles,
    customLastPageButtonClassName,
    customLastPageButtonStyles,
    customPageNumberButtonClassName,
    customPageNumberButtonStyles,
    customGeneralButtonProps = {},
    customOptionsListClassName,
    customOptionsListStyles,
    customClickPopoverProps = {},
    customClickPopoverTriggerButtonClassName,
    customClickPopoverTriggerButtonStyles,
  } = props
  const {
    className: customGeneralButtonNativeClassNameProp,
    customClassName: customGeneralButtonClassName,
    customStyles: customGeneralButtonStyles,
    ...restCustomGeneralButtonProps
  } = customGeneralButtonProps
  const customGeneralButtonNativeClassName =
    typeof customGeneralButtonNativeClassNameProp === "string" ? customGeneralButtonNativeClassNameProp : undefined
  const {
    className: clickPopoverClassName,
    customClassName: clickPopoverCustomClassName,
    customDialogStyles: clickPopoverDialogStyles,
    customStyles: clickPopoverCustomStyles,
    placement: clickPopoverPlacement = "bottom right",
    raised: clickPopoverRaised = false,
    style: clickPopoverStyle,
    ...restCustomClickPopoverProps
  } = customClickPopoverProps

  const buildButtonProps = useCallback(
    (args: { customClassName?: string; customStyles?: CSSProperties; defaultStyles: CSSProperties }) => ({
      ...restCustomGeneralButtonProps,
      customClassName: classNames(
        customGeneralButtonClassName,
        customGeneralButtonNativeClassName,
        args.customClassName,
      ),
      customStyles: {
        ...args.defaultStyles,
        ...customGeneralButtonStyles,
        ...args.customStyles,
      },
    }),
    [
      customGeneralButtonClassName,
      customGeneralButtonNativeClassName,
      customGeneralButtonStyles,
      restCustomGeneralButtonProps,
    ],
  )

  const {
    computedFirstPageButtonIcon,
    computedPrevButtonIcon,
    computedNextButtonIcon,
    computedLastPageButtonIcon,
    popoverStyles,
    overflowItemsListStyles,
    buttonRowStyles,
    pageNumberButtonRowStyles,
    overflowItemsButtonIcon,
  } = calibrateComponent(props, { iconColor, computedPageButtonTextColor })

  const { showFirstPageButton, showPrevPageButton, showNextPageButton, showLastPageButton } =
    useMemoizedProperties(props)

  const resolvedLabels = useMemo(
    () => ({
      ...DEFAULT_PAGINATION_LABELS.primaryControls,
      firstPageButton: firstPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.firstPageButton,
      previousPageButton: prevPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.previousPageButton,
      nextPageButton: nextPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.nextPageButton,
      lastPageButton: lastPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.lastPageButton,
      ...labels,
    }),
    [firstPageLabel, labels, lastPageLabel, nextPageLabel, prevPageLabel],
  )

  const numberOfPages = Math.max(Math.ceil(numberOfItems / itemsPerPage), 1)

  // -> Left Increment Buttons
  const LeftButtonControls = useCallback(
    () =>
      showIncrementButtonsWithOnePage ? (
        rtl ? (
          <div className={buttonRowStyles} data-testid="left-increment-buttons">
            {showLastPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(numberOfPages)}
                isDisabled={disabled || currentPage === numberOfPages}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.lastPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customLastPageButtonClassName,
                  customStyles: customLastPageButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30 },
                })}
              >
                {showLastPageButtonIcon ? (
                  <span data-testid="last-page-btn-icon">{computedLastPageButtonIcon}</span>
                ) : null}
                {showLastPageButtonLabel ? <Text>{resolvedLabels.lastPageButton}</Text> : null}
              </Button>
            ) : null}
            {showNextPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(currentPage + 1)}
                isDisabled={disabled || currentPage === numberOfPages}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.nextPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customNextButtonClassName,
                  customStyles: customNextButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30, paddingLeft: 0 },
                })}
              >
                {showNextPageButtonIcon ? <span data-testid="next-page-btn-icon">{computedNextButtonIcon}</span> : null}
                {showNextPageButtonLabel ? <Text>{resolvedLabels.nextPageButton}</Text> : null}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={buttonRowStyles} key="left-increment-buttons">
            {showFirstPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(1)}
                isDisabled={disabled || currentPage === 1}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.firstPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customFirstPageButtonClassName,
                  customStyles: customFirstPageButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30 },
                })}
              >
                {showFirstPageButtonIcon ? (
                  <span data-testid="first-page-btn-icon">{computedFirstPageButtonIcon}</span>
                ) : null}
                {showFirstPageButtonLabel ? <Text>{resolvedLabels.firstPageButton}</Text> : null}
              </Button>
            ) : null}
            {showPrevPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(currentPage - 1)}
                isDisabled={disabled || currentPage === 1}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.previousPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customPrevButtonClassName,
                  customStyles: customPrevButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30, paddingLeft: 0 },
                })}
              >
                {showPrevPageButtonIcon ? <span data-testid="prev-page-btn-icon">{computedPrevButtonIcon}</span> : null}
                {showPrevPageButtonLabel ? <Text>{resolvedLabels.previousPageButton}</Text> : null}
              </Button>
            ) : null}
          </div>
        )
      ) : null,
    [
      buildButtonProps,
      buttonColorMode,
      color,
      computedFirstPageButtonIcon,
      computedLastPageButtonIcon,
      computedNextButtonIcon,
      computedPrevButtonIcon,
      currentPage,
      customFirstPageButtonClassName,
      customFirstPageButtonStyles,
      customLastPageButtonClassName,
      customLastPageButtonStyles,
      customNextButtonClassName,
      customNextButtonStyles,
      customPrevButtonClassName,
      customPrevButtonStyles,
      disabled,
      buttonRowStyles,
      geometry,
      numberOfPages,
      onPageNumButtonClick,
      order,
      resolvedLabels,
      rtl,
      showFirstPageButton,
      showFirstPageButtonIcon,
      showFirstPageButtonLabel,
      showLastPageButton,
      showLastPageButtonIcon,
      showLastPageButtonLabel,
      showNextPageButton,
      showNextPageButtonIcon,
      showNextPageButtonLabel,
      showPrevPageButton,
      showPrevPageButtonIcon,
      showPrevPageButtonLabel,
      showIncrementButtonsWithOnePage,
    ],
  )

  // -> Page Number Buttons
  const PageNumberControls = useCallback(
    () => (
      <div className={pageNumberButtonRowStyles} data-testid="page-number-controls">
        {internalPaginationItems.map((internalItem: TInternalPaginationItem, index: number) => {
          // console.log(`internal item -> ${internalItem}`);
          // console.log(`current page -> ${currentPage}`);
          // -> Consolidated pagination items (which overflowed the maximum visible allowed) arranged
          //    into an array to be shown in a click popover list.
          if (Array.isArray(internalItem)) {
            // -> If there are no items to display, return nothing.
            if (internalItem.length === 0) return null

            // -> If there's only one consolidated item in the list, don't bother with a dropdown list.
            //   -> Instead, treat the "overflow" button as a direct navigation affordance.
            if (internalItem.length === 1) {
              const targetPage = internalItem[0]

              return (
                <Button
                  key={index}
                  data-testid="pagination-overflow-trigger"
                  onPress={() => onPageNumButtonClick(targetPage)}
                  isDisabled={disabled}
                  colorMode="outline"
                  color={color}
                  raisedOnHover
                  order={order}
                  geometry={geometry}
                  raised={true}
                  aria-label={resolvedLabels.pageButtonAriaLabel(targetPage)}
                  {...buildButtonProps({
                    customClassName: customClickPopoverTriggerButtonClassName,
                    customStyles: customClickPopoverTriggerButtonStyles,
                    defaultStyles: { height: 30, width: 30 },
                  })}
                >
                  <span data-testid="overflow-items-btn-icon">{overflowItemsButtonIcon}</span>
                </Button>
              )
            }

            // -> <Listbox /> requires an iterable data structure with ids
            const listBoxItems = internalItem.map((item) => ({
              id: `pagination-overflow-${index}-page-${item}`,
              pageNum: item,
            }))

            return (
              <DialogTrigger key={index}>
                <Button
                  colorMode="outline"
                  color={color}
                  raisedOnHover
                  order={order}
                  aria-label={resolvedLabels.overflowButtonAriaLabel}
                  data-testid="pagination-overflow-trigger"
                  geometry={geometry}
                  raised={true}
                  {...buildButtonProps({
                    customClassName: customClickPopoverTriggerButtonClassName,
                    customStyles: customClickPopoverTriggerButtonStyles,
                    defaultStyles: { height: 30, width: 30 },
                  })}
                >
                  <span data-testid="overflow-items-btn-icon">{overflowItemsButtonIcon}</span>
                </Button>
                <ClickPopover
                  {...restCustomClickPopoverProps}
                  className={classNames(popoverStyles, clickPopoverClassName)}
                  customClassName={clickPopoverCustomClassName}
                  customStyles={clickPopoverCustomStyles}
                  placement={clickPopoverPlacement}
                  raised={clickPopoverRaised}
                  style={clickPopoverStyle}
                  customDialogStyles={{ outlineOffset: 2, ...clickPopoverDialogStyles }}
                >
                  <ListBox
                    aria-label={resolvedLabels.overflowListAriaLabel(index + 1)}
                    items={listBoxItems}
                    shouldFocusWrap={true}
                    className={classNames(overflowItemsListStyles, customOptionsListClassName)}
                    style={customOptionsListStyles}
                    selectionMode="single"
                    onSelectionChange={(selectedKeys: Selection) => {
                      const key = Array.from(selectedKeys)[0] as string
                      const selectedItem = listBoxItems.find((item) => item.id === key)

                      if (selectedItem) onPageNumButtonClick(selectedItem.pageNum)
                    }}
                  >
                    {(item) => (
                      <ListBoxItem
                        key={item.id}
                        id={item.id}
                        data-disabled={disabled ? "true" : undefined}
                        aria-label={resolvedLabels.pageButtonAriaLabel(item.pageNum)}
                        customStyles={{ cursor: "pointer" }}
                      >
                        <Text>{item.pageNum}</Text>
                      </ListBoxItem>
                    )}
                  </ListBox>
                </ClickPopover>
              </DialogTrigger>
            )
          }

          // -> Early return above guards against the item being an array of pagination items
          return (
            <Button
              key={index}
              onPress={() => onPageNumButtonClick(internalItem)}
              isDisabled={disabled}
              colorMode={currentPage === internalItem ? COLOR_MODE__FILL : COLOR_MODE__OUTLINE}
              aria-current={currentPage === internalItem ? "page" : undefined}
              color={color}
              order={order}
              geometry={geometry}
              data-disabled={disabled ? "true" : undefined}
              raised={true}
              aria-label={resolvedLabels.pageButtonAriaLabel(internalItem)}
              {...buildButtonProps({
                customClassName: customPageNumberButtonClassName,
                customStyles: customPageNumberButtonStyles,
                defaultStyles: { height: 30, minWidth: 30 },
              })}
            >
              <Text>{internalItem}</Text>
            </Button>
          )
        })}
      </div>
    ),
    [
      pageNumberButtonRowStyles,
      internalPaginationItems,
      buildButtonProps,
      clickPopoverClassName,
      clickPopoverCustomClassName,
      clickPopoverCustomStyles,
      clickPopoverDialogStyles,
      clickPopoverPlacement,
      clickPopoverRaised,
      clickPopoverStyle,
      disabled,
      currentPage,
      color,
      order,
      customClickPopoverTriggerButtonClassName,
      customPageNumberButtonStyles,
      customPageNumberButtonClassName,
      geometry,
      customClickPopoverTriggerButtonStyles,
      customOptionsListClassName,
      overflowItemsButtonIcon,
      popoverStyles,
      resolvedLabels,
      restCustomClickPopoverProps,
      overflowItemsListStyles,
      customOptionsListStyles,
      onPageNumButtonClick,
    ],
  )

  // -> Right Increment Buttons
  const RightButtonControls = useCallback(
    () =>
      showIncrementButtonsWithOnePage ? (
        rtl ? (
          <div className={buttonRowStyles} data-testid="right-increment-buttons">
            {showPrevPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(currentPage - 1)}
                isDisabled={disabled || currentPage === 1}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.previousPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customPrevButtonClassName,
                  customStyles: customPrevButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30, paddingRight: 0 },
                })}
              >
                {showPrevPageButtonLabel ? <Text>{resolvedLabels.previousPageButton}</Text> : null}
                {showPrevPageButtonIcon ? <span data-testid="prev-page-btn-icon">{computedPrevButtonIcon}</span> : null}
              </Button>
            ) : null}
            {showFirstPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(1)}
                isDisabled={disabled || currentPage === 1}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.firstPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customFirstPageButtonClassName,
                  customStyles: customFirstPageButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30 },
                })}
              >
                {showFirstPageButtonLabel ? <Text>{resolvedLabels.firstPageButton}</Text> : null}
                {showFirstPageButtonIcon ? (
                  <span data-testid="first-page-btn-icon">{computedFirstPageButtonIcon}</span>
                ) : null}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={buttonRowStyles} key="right-increment-buttons">
            {showNextPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(currentPage + 1)}
                isDisabled={disabled || currentPage === numberOfPages}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.nextPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customNextButtonClassName,
                  customStyles: customNextButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30, paddingRight: 0 },
                })}
              >
                {showNextPageButtonLabel ? <Text>{resolvedLabels.nextPageButton}</Text> : null}
                {showNextPageButtonIcon ? <span data-testid="next-page-btn-icon">{computedNextButtonIcon}</span> : null}
              </Button>
            ) : null}
            {showLastPageButton ? (
              <Button
                onPress={() => onPageNumButtonClick(numberOfPages)}
                isDisabled={disabled || currentPage === numberOfPages}
                colorMode={buttonColorMode}
                color={color}
                order={order}
                geometry={geometry}
                raised={true}
                data-disabled={disabled ? "true" : undefined}
                aria-label={resolvedLabels.lastPageButtonAriaLabel}
                {...buildButtonProps({
                  customClassName: customLastPageButtonClassName,
                  customStyles: customLastPageButtonStyles,
                  defaultStyles: { height: 30, minWidth: 30 },
                })}
              >
                {showLastPageButtonLabel ? <Text>{resolvedLabels.lastPageButton}</Text> : null}
                {showLastPageButtonIcon ? (
                  <span data-testid="last-page-btn-icon">{computedLastPageButtonIcon}</span>
                ) : null}
              </Button>
            ) : null}
          </div>
        )
      ) : null,
    [
      buildButtonProps,
      buttonColorMode,
      color,
      computedFirstPageButtonIcon,
      computedLastPageButtonIcon,
      computedNextButtonIcon,
      computedPrevButtonIcon,
      currentPage,
      customFirstPageButtonClassName,
      customFirstPageButtonStyles,
      customLastPageButtonClassName,
      customLastPageButtonStyles,
      customNextButtonClassName,
      customNextButtonStyles,
      customPrevButtonClassName,
      customPrevButtonStyles,
      disabled,
      buttonRowStyles,
      geometry,
      numberOfPages,
      onPageNumButtonClick,
      order,
      resolvedLabels,
      rtl,
      showFirstPageButton,
      showFirstPageButtonIcon,
      showFirstPageButtonLabel,
      showLastPageButton,
      showLastPageButtonIcon,
      showLastPageButtonLabel,
      showNextPageButton,
      showNextPageButtonIcon,
      showNextPageButtonLabel,
      showPrevPageButton,
      showPrevPageButtonIcon,
      showPrevPageButtonLabel,
      showIncrementButtonsWithOnePage,
    ],
  )

  return (
    <div
      style={{ display: "flex", flexDirection: "row", gap: 5 }}
      data-testid={PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS}
    >
      <LeftButtonControls />
      <PageNumberControls />
      <RightButtonControls />
    </div>
  )
}

export default PrimaryPaginationControls
