import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import type {
  DraggableCollectionStartEvent,
  DroppableCollectionInsertDropEvent,
  DroppableCollectionReorderEvent,
} from "react-aria-components"

import type { TPanelProps } from "../Panel/helpers"
import {
  appendQueryFilterClauseDraftToGroup,
  createQueryFilterGroupDraftFromCriteria,
  normalizeDraftToQueryFilterGroups,
  type TModifyFilterClauseArgs,
  type TQueryFilterGroupDraft,
} from "../Table/filterDraft"
import type {
  TAvailableBooleanArgumentComponents,
  TAvailableFilterCriteria,
  TAvailableListItem,
  TAvailableSortCriteria,
} from "../Table/filterMetadata"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableFilterGroup,
  type TTableFilterJoinOperator,
  type TTableSortInstruction,
} from "../Table/queryTypes"

import { resolveSortAndFilterPanelLabels, type TPartialSortAndFilterPanelLabels } from "./labels"

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

const getFilterArgumentValue = (item: TAvailableListItem) => item.argumentValue ?? item.name

const inferFilterArgumentSelectedKey = (
  availableFilterArguments: TAvailableListItem[] | undefined,
  argument: TSortAndFilterPanelFilterGroup["clauses"][number]["argument"],
) => {
  if (!availableFilterArguments?.length) return null

  const matchedArgument = availableFilterArguments.find((item) => getFilterArgumentValue(item) === argument)

  return matchedArgument?.id ?? null
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
          filterArgumentSelectedKey: inferFilterArgumentSelectedKey(
            matchingCriteria.availableCriteriaArguments,
            clause.argument,
          ),
        })),
      },
    ]
  })
}

export const rebaseFilterGroupDrafts = (
  filterGroups: TQueryFilterGroupDraft[],
  possibleFilterCriteria: TAvailableFilterCriteria[],
): TQueryFilterGroupDraft[] => {
  let changed = false
  const groups = filterGroups.map((group) => {
    const criteria = possibleFilterCriteria.find((item) => item.id === group.criteriaID)
    if (!criteria) return group
    const metadata = {
      criteriaName: criteria.name,
      queryKey: criteria.queryKey,
      dataType: criteria.dataType,
      usesTypeAheadInput: criteria.usesTypeAheadInput,
      typeAheadInputOnChange: criteria.typeAheadInputOnChange,
      usesSelectInput: criteria.usesSelectInput,
      usesComboBoxInput: criteria.usesComboBoxInput,
      availableFilterArguments: criteria.availableCriteriaArguments,
    }
    let clausesChanged = false
    const clauses = group.clauses.map((clause) => {
      const selectedKey = inferFilterArgumentSelectedKey(criteria.availableCriteriaArguments, clause.argument)
      if (clause.filterArgumentSelectedKey === selectedKey) return clause
      clausesChanged = true
      return { ...clause, filterArgumentSelectedKey: selectedKey }
    })
    if (
      !clausesChanged &&
      (Object.keys(metadata) as (keyof typeof metadata)[]).every((key) => group[key] === metadata[key])
    )
      return group
    changed = true
    return { ...group, ...metadata, clauses: clausesChanged ? clauses : group.clauses }
  })
  return changed ? groups : filterGroups
}

const DEFAULT_ACTIVE_SORTS: NonNullable<TSortAndFilterPanelProps["activeSorts"]> = []
const DEFAULT_ACTIVE_FILTERS: NonNullable<TSortAndFilterPanelProps["activeFilters"]> = []

type TClosePanel = () => void

const removeEmptyFilterGroups = (filterGroupDrafts: TQueryFilterGroupDraft[]) =>
  filterGroupDrafts.filter((group) => group.clauses.length > 0)

/**
 * Coordinates the visible panel draft and focus refs with applied snapshots and generic query commands.
 * Callers retain persisted query ownership; rendering props and simple styles stay in the component.
 */
export const useCalibratedComponent = ({
  props,
  state,
  setState,
  selectNewSortCriteriaRef,
  selectNewFilterCriteriaRef,
}: {
  props: TSortAndFilterPanelProps
  state: TSortAndFilterPanelState
  setState: Dispatch<SetStateAction<TSortAndFilterPanelState>>
  selectNewSortCriteriaRef: RefObject<HTMLDivElement | null>
  selectNewFilterCriteriaRef: RefObject<HTMLDivElement | null>
}) => {
  const {
    isOpen,
    possibleSortCriteria,
    possibleFilterCriteria,
    activeSorts = DEFAULT_ACTIVE_SORTS,
    activeFilters = DEFAULT_ACTIVE_FILTERS,
    initialFocusTarget = SORT_AND_FILTER_PANEL_FOCUS_TARGET__SORT,
    applyPendingSortAndFilterChanges,
    labels,
  } = props
  const synchronizedOwner = useRef<{
    activeSorts: typeof activeSorts
    activeFilters: typeof activeFilters
    open: boolean
  } | null>(null)

  useEffect(() => {
    const previous = synchronizedOwner.current
    synchronizedOwner.current = { activeSorts, activeFilters, open: isOpen }
    if (!isOpen) return
    const nextFilterGroupDrafts = buildFilterGroupDraftsFromQueryFilterGroups(activeFilters, possibleFilterCriteria)
    const ownerChanged =
      !previous?.open || previous.activeSorts !== activeSorts || previous.activeFilters !== activeFilters
    setState((previousState) => ({
      ...previousState,
      sortParameterList: ownerChanged ? activeSorts : previousState.sortParameterList,
      previouslyAppliedSortParameterList: activeSorts,
      filterGroupDrafts: ownerChanged
        ? nextFilterGroupDrafts
        : rebaseFilterGroupDrafts(previousState.filterGroupDrafts, possibleFilterCriteria),
      previouslyAppliedFilterGroupDrafts: nextFilterGroupDrafts,
      sortCriteriaSelectedKey: null,
      filterCriteriaSelectedKey: null,
    }))
  }, [activeFilters, activeSorts, possibleFilterCriteria, isOpen, setState])

  useEffect(() => {
    setState((previousState) => ({
      ...previousState,
      sortCriteriaSelectedKey: null,
      filterCriteriaSelectedKey: null,
    }))
  }, [state.sortParameterList, state.filterGroupDrafts, setState])

  useEffect(() => {
    if (!isOpen) return

    const animationFrameID = requestAnimationFrame(() => {
      const targetRef =
        initialFocusTarget === SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER
          ? selectNewFilterCriteriaRef
          : selectNewSortCriteriaRef

      targetRef.current?.querySelector<HTMLButtonElement>("[data-triggerbtn]")?.focus()
    })

    return () => cancelAnimationFrame(animationFrameID)
  }, [initialFocusTarget, isOpen, selectNewFilterCriteriaRef, selectNewSortCriteriaRef])

  const onSortParameterDrop = (event: DroppableCollectionReorderEvent | DroppableCollectionInsertDropEvent) => {
    setState((previousState) => {
      const { sortParameterList, draggedID } = previousState
      const targetID = event.target.key
      if (draggedID === targetID || (event.target.dropPosition !== "before" && event.target.dropPosition !== "after"))
        return previousState
      const draggedIndex = sortParameterList.findIndex((item) => item.id === draggedID)
      if (draggedIndex < 0 || !sortParameterList.some((item) => item.id === targetID)) return previousState
      const updatedSortItems = [...sortParameterList]
      const [movedItem] = updatedSortItems.splice(draggedIndex, 1)
      const targetIndex = updatedSortItems.findIndex((item) => item.id === targetID)
      updatedSortItems.splice(targetIndex + (event.target.dropPosition === "after" ? 1 : 0), 0, movedItem)
      return { ...previousState, sortParameterList: updatedSortItems }
    })
  }

  const onSortParameterDragStart = (event: DraggableCollectionStartEvent) => {
    setState((previousState) => ({ ...previousState, draggedID: Array.from(event.keys)[0] as string }))
  }

  const onAddSortParameter = (targetSortCriteriaID: string) => {
    const { sortParameterList } = state
    if (sortParameterList.some((sortParameter) => sortParameter.criteriaID === targetSortCriteriaID)) return

    const selectedSortCriteria = possibleSortCriteria.find((item) => item.id === targetSortCriteriaID)
    if (!selectedSortCriteria) return

    const newSortParameter: TTableSortInstruction = {
      id: selectedSortCriteria.id,
      criteriaID: selectedSortCriteria.id,
      criteriaName: selectedSortCriteria.name,
      queryKey: selectedSortCriteria.queryKey,
      sortDirection: selectedSortCriteria.defaultDirection ?? TABLE_SORT_DIRECTION__ASCENDING,
    }

    setState((previousState) => ({
      ...previousState,
      sortParameterList: [...sortParameterList, newSortParameter],
    }))
  }

  const onModifySortParameter = ({ sortCriteriaID, listItemID }: { sortCriteriaID: string; listItemID: string }) => {
    const { sortParameterList } = state
    const targetListItem = sortParameterList.find((item) => item.id === listItemID)
    const targetListItemIndex = sortParameterList.findIndex((item) => item.id === listItemID)
    const selectedSortCriteria = possibleSortCriteria.find((item) => item.id === sortCriteriaID)
    if (!targetListItem || !selectedSortCriteria) return

    const criteriaAlreadyUsed = sortParameterList.some(
      (item) => item.id !== listItemID && item.criteriaID === selectedSortCriteria.id,
    )
    if (criteriaAlreadyUsed) return

    const updatedList = [...sortParameterList]
    updatedList.splice(targetListItemIndex, 1, {
      ...targetListItem,
      id: selectedSortCriteria.id,
      criteriaID: selectedSortCriteria.id,
      criteriaName: selectedSortCriteria.name,
      queryKey: selectedSortCriteria.queryKey,
    })

    setState((previousState) => ({
      ...previousState,
      sortParameterList: updatedList,
      sortCriteriaSelectedKey: null,
    }))
  }

  const onDeleteSortParameter = (listItemID: string) => {
    setState((previousState) => ({
      ...previousState,
      sortParameterList: previousState.sortParameterList.filter((item) => item.id !== listItemID),
      sortCriteriaSelectedKey: null,
    }))
  }

  const onChangeSortDirection = (listItemID: string, sortDirection: TTableSortInstruction["sortDirection"]) => {
    setState((previousState) => ({
      ...previousState,
      sortParameterList: previousState.sortParameterList.map((sortParameter) => {
        if (sortParameter.id !== listItemID || sortParameter.sortDirection === sortDirection) return sortParameter

        return {
          ...sortParameter,
          sortDirection,
        }
      }),
    }))
  }

  const onSortAscending = (listItemID: string) => {
    onChangeSortDirection(listItemID, TABLE_SORT_DIRECTION__ASCENDING)
  }

  const onSortDescending = (listItemID: string) => {
    onChangeSortDirection(listItemID, TABLE_SORT_DIRECTION__DESCENDING)
  }

  const onAddFilterParameter = (targetFilterCriteriaID: string) => {
    setState((previousState) => ({
      ...previousState,
      filterGroupDrafts: (() => {
        const selectedFilterCriteria = possibleFilterCriteria.find((item) => item.id === targetFilterCriteriaID)
        if (!selectedFilterCriteria) return previousState.filterGroupDrafts

        const existingGroup = previousState.filterGroupDrafts.find(
          (group) => group.criteriaID === selectedFilterCriteria.id,
        )

        if (existingGroup) {
          return previousState.filterGroupDrafts.map((group) => {
            if (group.id !== existingGroup.id) return group

            return appendQueryFilterClauseDraftToGroup(group, {
              allowDuplicateOperationCodes: true,
              allowedOperationCodes: selectedFilterCriteria.allowedOperationCodes,
            })
          })
        }

        return [...previousState.filterGroupDrafts, createQueryFilterGroupDraftFromCriteria(selectedFilterCriteria)]
      })(),
    }))
  }

  const onModifyFilterClause = ({ updatedClause, newCriteriaID }: TModifyFilterClauseArgs) => {
    setState((previousState) => ({
      ...previousState,
      filterGroupDrafts: (() => {
        const sourceGroup = previousState.filterGroupDrafts.find((group) =>
          group.clauses.some((clause) => clause.id === updatedClause.id),
        )
        const selectedCriteria = possibleFilterCriteria.find((criteria) => criteria.id === newCriteriaID)
        if (!sourceGroup || !selectedCriteria) return previousState.filterGroupDrafts
        if (sourceGroup.criteriaID === newCriteriaID)
          return previousState.filterGroupDrafts.map((group) =>
            group === sourceGroup
              ? {
                  ...group,
                  clauses: group.clauses.map((clause) => (clause.id === updatedClause.id ? updatedClause : clause)),
                }
              : group,
          )
        const groupsWithoutClause = removeEmptyFilterGroups(
          previousState.filterGroupDrafts.map((group) => ({
            ...group,
            clauses: group.clauses.filter((clause) => clause.id !== updatedClause.id),
          })),
        )
        const targetGroup = groupsWithoutClause.find((group) => group.criteriaID === newCriteriaID)

        if (targetGroup) {
          return groupsWithoutClause.map((group) => {
            if (group.id !== targetGroup.id) return group
            return { ...group, clauses: [...group.clauses, updatedClause] }
          })
        }

        return [
          ...groupsWithoutClause,
          {
            ...createQueryFilterGroupDraftFromCriteria(selectedCriteria, { clauseID: updatedClause.id }),
            clauses: [updatedClause],
          },
        ]
      })(),
      filterCriteriaSelectedKey: null,
    }))
  }

  const onDeleteFilterParameter = (listItemID: string) => {
    setState((previousState) => ({
      ...previousState,
      filterGroupDrafts: removeEmptyFilterGroups(
        previousState.filterGroupDrafts.map((group) => ({
          ...group,
          clauses: group.clauses.filter((clause) => clause.id !== listItemID),
        })),
      ),
      filterCriteriaSelectedKey: null,
    }))
  }

  const onChangeFilterGroupJoinOperator = (criteriaID: string, joinOperator: TTableFilterJoinOperator) => {
    setState((previousState) => ({
      ...previousState,
      filterGroupDrafts: previousState.filterGroupDrafts.map((group) => {
        if (group.criteriaID !== criteriaID) return group

        return {
          ...group,
          joinOperator,
        }
      }),
    }))
  }

  const onClearAllSortAndFilterParameters = () => {
    setState((previousState) => ({
      ...previousState,
      filterGroupDrafts: [],
      sortParameterList: [],
    }))
  }

  const onCancelPendingChanges = (closePanel: TClosePanel) => {
    const confirmedFilters = buildFilterGroupDraftsFromQueryFilterGroups(activeFilters, possibleFilterCriteria)
    setState((previousState) => ({
      ...previousState,
      sortParameterList: activeSorts,
      filterGroupDrafts: confirmedFilters,
      previouslyAppliedSortParameterList: activeSorts,
      previouslyAppliedFilterGroupDrafts: confirmedFilters,
    }))
    closePanel()
  }

  const onApplyPendingChanges = (closePanel: TClosePanel) => {
    const { sortParameterList, filterGroupDrafts } = state

    applyPendingSortAndFilterChanges({
      sortInstructions: sortParameterList,
      filterGroups: normalizeDraftToQueryFilterGroups(filterGroupDrafts),
    })
    closePanel()
  }

  const { sortParameterList } = state
  const availableSortCriteria = useMemo(() => {
    const activeSortCriteriaIDs = new Set(sortParameterList.map((item) => item.criteriaID))

    return possibleSortCriteria.filter((criteria) => !activeSortCriteriaIDs.has(criteria.id))
  }, [possibleSortCriteria, sortParameterList])
  const resolvedLabels = useMemo(() => resolveSortAndFilterPanelLabels(labels), [labels])

  return {
    availableSortCriteria,
    resolvedLabels,
    onSortParameterDrop,
    onSortParameterDragStart,
    onAddSortParameter,
    onModifySortParameter,
    onDeleteSortParameter,
    onSortAscending,
    onSortDescending,
    onAddFilterParameter,
    onModifyFilterClause,
    onDeleteFilterParameter,
    onChangeFilterGroupJoinOperator,
    onClearAllSortAndFilterParameters,
    onCancelPendingChanges,
    onApplyPendingChanges,
  }
}
