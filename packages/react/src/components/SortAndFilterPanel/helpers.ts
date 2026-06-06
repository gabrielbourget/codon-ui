import classNames from "classnames"
import type { CSSProperties } from "react"

import type { TPanelProps } from "../Panel/helpers"
import type { TQueryFilterGroupDraft } from "../Table/filterDraft"
import type {
  TAvailableBooleanArgumentComponents,
  TAvailableFilterCriteria,
  TAvailableListItem,
  TAvailableSortCriteria,
} from "../Table/filterMetadata"
import type { TTableFilterGroup, TTableSortInstruction } from "../Table/queryTypes"

import type { TPartialSortAndFilterPanelLabels } from "./labels"
import styles from "./SortAndFilterPanelStyles.module.css"

export type {
  TAvailableBooleanArgumentComponents,
  TAvailableFilterCriteria,
  TAvailableListItem,
  TAvailableSortCriteria,
}
export type TSortAndFilterPanelFilterGroup = TTableFilterGroup
export type TSortAndFilterPanelSortInstruction = TTableSortInstruction

export const SORT_AND_FILTER_PANEL_FOCUS_TARGET__SORT = "sort"
export const SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER = "filter"
export const AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS = [
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__SORT,
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER,
] as const

export type TSortAndFilterPanelFocusTarget = (typeof AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS)[number]

export type TSortAndFilterPanelProps = {
  title?: string
  height?: string | number
  width?: string | number
  horizontalGap?: number
  position?: TPanelProps["position"]
  panelGeometry?: TPanelProps["panelGeometry"]
  raised?: boolean
  overlayBlur?: boolean
  booleanArgumentComponent?: TAvailableBooleanArgumentComponents
  possibleSortCriteria: TAvailableSortCriteria[]
  possibleFilterCriteria: TAvailableFilterCriteria[]
  activeSorts?: TSortAndFilterPanelSortInstruction[]
  activeFilters?: TSortAndFilterPanelFilterGroup[]
  initialFocusTarget?: TSortAndFilterPanelFocusTarget
  labels?: TPartialSortAndFilterPanelLabels
  applyPendingSortAndFilterChanges: (args: TApplySortAndFilterParametersArgs) => void
  isDismissable?: boolean
  isKeyboardDismissDisabled?: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customModalStyles?: CSSProperties
  customDialogStyles?: CSSProperties
  customOverlayStyles?: CSSProperties
}

export type TSortAndFilterPanelState = {
  sortParameterList: TSortAndFilterPanelSortInstruction[]
  previouslyAppliedSortParameterList: TSortAndFilterPanelSortInstruction[]
  filterGroupDrafts: TQueryFilterGroupDraft[]
  previouslyAppliedFilterGroupDrafts: TQueryFilterGroupDraft[]
  draggedID: string
  sortCriteriaSelectedKey: string | null
  filterCriteriaSelectedKey: string | null
}

export const initState: TSortAndFilterPanelState = {
  sortParameterList: [],
  previouslyAppliedSortParameterList: [],
  filterGroupDrafts: [],
  previouslyAppliedFilterGroupDrafts: [],
  draggedID: "",
  sortCriteriaSelectedKey: null,
  filterCriteriaSelectedKey: null,
}

export type TApplySortAndFilterParametersArgs = {
  sortInstructions: TSortAndFilterPanelSortInstruction[]
  filterGroups: TSortAndFilterPanelFilterGroup[]
}

export const buildFilterGroupDraftsFromQueryFilterGroups = (
  filterGroups: TSortAndFilterPanelFilterGroup[],
  possibleFilterCriteria: TAvailableFilterCriteria[],
): TQueryFilterGroupDraft[] => {
  return filterGroups.flatMap((filterGroup) => {
    const matchingCriteria = possibleFilterCriteria.find((criteria) => criteria.id === filterGroup.criteriaID)

    if (!matchingCriteria) return []

    return [
      {
        id: filterGroup.id,
        criteriaID: matchingCriteria.id,
        criteriaName: matchingCriteria.name,
        queryKey: matchingCriteria.queryKey,
        dataType: matchingCriteria.dataType,
        joinOperator: filterGroup.joinOperator,
        usesTypeAheadInput: matchingCriteria.usesTypeAheadInput,
        typeAheadInputOnChange: matchingCriteria.typeAheadInputOnChange,
        usesSelectInput: matchingCriteria.usesSelectInput,
        usesComboBoxInput: matchingCriteria.usesComboBoxInput,
        availableFilterArguments: matchingCriteria.availableCriteriaArguments,
        clauses: filterGroup.clauses.map((clause) => ({
          id: clause.id,
          operationCode: clause.operationCode,
          argument: clause.argument,
          filterArgumentSelectedKey: null,
        })),
      },
    ]
  })
}

export const calibrateComponent = () => {
  const { sortAndFilterPanel__content } = styles
  const dialogStyles = classNames(sortAndFilterPanel__content)

  return { dialogStyles }
}
