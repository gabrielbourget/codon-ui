import type { ReactNode, RefAttributes, RefObject } from "react"
import type { ColorValue, StyleProp, TextInput, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeButtonProps, TNativeButtonColorMode } from "../Button/types"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"
import type { TNativeCounterProps } from "../Counter/types"
import type { TNativeFormFieldProps } from "../FormField/types"
import type { TNativeNumberInputProps } from "../NumberInput/types"
import type { TNativeSelectProps } from "../Select/types"

import type { TNativePartialPaginationLabels } from "./labels"
import type {
  TNativePaginationConsolidationSide,
  TNativePaginationNumbers,
  TNativePaginationSubcomponent,
} from "./model"

export type TNativePaginationRef = View
export type TNativePaginationPageSizeOption = Readonly<{ id: string; name: string; value: number }>
export type TNativePaginationButtonProps = Partial<Omit<TNativeButtonProps, "children">>
export type TNativePaginationFieldProps = Partial<
  Omit<TNativeFormFieldProps, "children" | "label" | "labelID" | "labelFor">
>
export type TNativePaginationProps = Omit<ViewProps, "children" | "style" | "role" | "accessibilityRole"> &
  TNativePaginationNumbers & {
    setCurrentPage: (page: number) => void
    setItemsPerPage: (size: number) => void
    chosenPaginationSubcomponents?: readonly TNativePaginationSubcomponent[]
    itemsPerPageOptions?: readonly number[]
    maxVisiblePages?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
    consolidationPlacement?: TNativePaginationConsolidationSide
    color?: ColorValue
    order?: TThemingOrderCode
    geometry?: TCornerGeometry
    buttonColorMode?: TNativeButtonColorMode
    rtl?: boolean
    isDisabled?: boolean
    labels?: TNativePartialPaginationLabels
    firstPageLabel?: string
    prevPageLabel?: string
    nextPageLabel?: string
    lastPageLabel?: string
    counterText?: string
    pageInputLabel?: string
    pageInputSelectionButtonText?: string
    itemsPerPageLabel?: string
    itemsPerPageSelectPlaceholder?: string
    incrementAllDownIcon?: ReactNode
    incrementDownIcon?: ReactNode
    incrementUpIcon?: ReactNode
    incrementAllUpIcon?: ReactNode
    overflowItemsButtonIcon?: ReactNode
    showWithOnePage?: boolean
    showIncrementButtons?: boolean
    showIncrementButtonsWithOnePage?: boolean
    showFirstPageButton?: boolean
    showFirstPageButtonIcon?: boolean
    showFirstPageButtonLabel?: boolean
    showFirstPageButtonOnFirstPage?: boolean
    showPrevPageButton?: boolean
    showPrevPageButtonIcon?: boolean
    showPrevPageButtonLabel?: boolean
    showPrevPageButtonOnFirstPage?: boolean
    showNextPageButton?: boolean
    showNextPageButtonIcon?: boolean
    showNextPageButtonLabel?: boolean
    showNextPageButtonOnLastPage?: boolean
    showLastPageButton?: boolean
    showLastPageButtonIcon?: boolean
    showLastPageButtonLabel?: boolean
    showLastPageButtonOnLastPage?: boolean
    customComponentStyles?: StyleProp<TextStyle>
    style?: StyleProp<TextStyle>
    customSeparatorStyles?: StyleProp<ViewStyle>
    customGeneralButtonProps?: TNativePaginationButtonProps
    customFirstPageButtonStyles?: StyleProp<TextStyle>
    customPrevButtonStyles?: StyleProp<TextStyle>
    customNextButtonStyles?: StyleProp<TextStyle>
    customLastPageButtonStyles?: StyleProp<TextStyle>
    customPageNumberButtonStyles?: StyleProp<TextStyle>
    customPageCounterStyles?: TNativeCounterProps["customStyles"]
    customPageCounterProps?: Partial<Omit<TNativeCounterProps, "value" | "maxValue" | "children">>
    customPageNumberInputFormFieldProps?: TNativePaginationFieldProps
    customPageNumberInputFormFieldStyles?: StyleProp<TextStyle>
    customPageNumberInputProps?: Partial<
      Omit<
        TNativeNumberInputProps,
        "value" | "defaultValue" | "onChange" | "minValue" | "maxValue" | "isDisabled" | "geometry"
      >
    >
    customPageNumberInputStyles?: TNativeNumberInputProps["customStyles"]
    customPageNumberInputNavigationButtonStyles?: StyleProp<TextStyle>
    pageInputRef?: RefObject<TextInput | null>
    customItemsPerPageFormFieldProps?: TNativePaginationFieldProps
    customItemsPerPageFormFieldStyles?: StyleProp<TextStyle>
    customItemsPerPageSelectProps?: Partial<
      Omit<
        TNativeSelectProps<TNativePaginationPageSizeOption>,
        | "items"
        | "getKey"
        | "getTextValue"
        | "renderItem"
        | "value"
        | "defaultValue"
        | "onChange"
        | "isDisabled"
        | "geometry"
      >
    >
    customItemsPerPageSelectStyles?: TNativeSelectProps<TNativePaginationPageSizeOption>["customStyles"]
    customOptionsListStyles?: StyleProp<TextStyle>
    customClickPopoverProps?: Partial<TNativeClickPopoverProps> & Pick<RefAttributes<View>, "ref">
    customClickPopoverTriggerButtonStyles?: StyleProp<TextStyle>
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
    ariaDetails?: string
    "aria-describedby"?: string
    "aria-details"?: string
    "data-testid"?: string
  }
