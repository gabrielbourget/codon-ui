"use client"

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react"
import type {
  DraggableCollectionStartEvent,
  DroppableCollectionInsertDropEvent,
  DroppableCollectionReorderEvent,
} from "react-aria-components"

import ListBoxItem from "../ListBoxItem/ListBoxItem"
import {
  appendQueryFilterClauseDraftToGroup,
  createQueryFilterGroupDraftFromCriteria,
  normalizeDraftToQueryFilterGroups,
  type TModifyFilterClauseArgs,
  type TQueryFilterGroupDraft,
} from "../Table/filterDraft"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableFilterJoinOperator,
  type TTableSortInstruction,
} from "../Table/queryTypes"

import {
  type TAvailableListItem,
  type TAvailableSortCriteria,
  type TSortAndFilterPanelProps,
  type TSortAndFilterPanelState,
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER,
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__SORT,
  buildFilterGroupDraftsFromQueryFilterGroups,
  calibrateComponent,
  initState,
} from "./helpers"
import type { TActiveFiltersProps } from "./InternalComponents/ActiveFilters/helpers"
import type { TActiveSortsProps } from "./InternalComponents/ActiveSorts/helpers"
import { resolveSortAndFilterPanelLabels } from "./labels"

const DEFAULT_ACTIVE_SORTS: NonNullable<TSortAndFilterPanelProps["activeSorts"]> = []
const DEFAULT_ACTIVE_FILTERS: NonNullable<TSortAndFilterPanelProps["activeFilters"]> = []
const SORT_AND_FILTER_PANEL_POSITION__RIGHT = "right"
const SORT_AND_FILTER_PANEL_BACKGROUND_COLOR = "var(--cui-background)"
const SORT_AND_FILTER_PANEL_DIVIDER_COLOR = "var(--cui-border-muted)"
const SORT_AND_FILTER_PANEL_SELECT_STYLES: CSSProperties = { width: "100%" }

type TClosePanel = () => void

type TCalibratedCriteriaField<TItem extends object> = {
  fieldProps: {
    label: string
    labelID: string
  }
  renderItem: (item: object) => ReactNode
  selectProps: {
    "aria-labelledby": string
    customStyles: CSSProperties
    items: TItem[]
    onChange: (id: string | number | null) => void
    placeholder: string
    ref: RefObject<HTMLDivElement | null>
    value: string | null
  }
}

type TCalibratedSortAndFilterPanel = {
  panel: {
    dialogProps: {
      "aria-label": string
      className: string
      role: "dialog"
      style: CSSProperties | undefined
    }
    dividerProps: {
      color: string
      height: number
      size: string
    }
    headerProps: {
      labels: ReturnType<typeof resolveSortAndFilterPanelLabels>["header"]
      title: string
    }
    rootProps: {
      backgroundColor: string
      customOverlayStyles: CSSProperties | undefined
      customStyles: CSSProperties | undefined
      height: string | number
      horizontalGap: number | undefined
      isDismissable: boolean
      isKeyboardDismissDisabled: boolean
      isOpen: boolean
      onOpenChange: TSortAndFilterPanelProps["onOpenChange"]
      overlayBlur: boolean
      panelGeometry: TSortAndFilterPanelProps["panelGeometry"]
      position: NonNullable<TSortAndFilterPanelProps["position"]>
      raised: boolean
      width: string | number
    }
  }
  form: {
    filterCriteria: TCalibratedCriteriaField<TAvailableListItem>
    sortCriteria: TCalibratedCriteriaField<TAvailableSortCriteria>
  }
  sorts: TActiveSortsProps
  filters: TActiveFiltersProps
  footer: {
    labels: ReturnType<typeof resolveSortAndFilterPanelLabels>["footer"]
    onApplyPendingChanges: (closePanel: TClosePanel) => void
    onCancelPendingChanges: (closePanel: TClosePanel) => void
    onClearAllSortAndFilterParameters: () => void
  }
}

const removeEmptyFilterGroups = (filterGroupDrafts: TQueryFilterGroupDraft[]) =>
  filterGroupDrafts.filter((group) => group.clauses.length > 0)

/**
 * Owns the panel-local draft, focus lifecycle, and child-ready resources while leaving persisted query state with the
 * caller. Grouping the result keeps the public rendering surface declarative without hiding its important commands.
 */
export const useCalibratedComponent = (props: TSortAndFilterPanelProps): TCalibratedSortAndFilterPanel => {
  const {
    isOpen,
    onOpenChange,
    possibleSortCriteria,
    possibleFilterCriteria,
    activeSorts = DEFAULT_ACTIVE_SORTS,
    activeFilters = DEFAULT_ACTIVE_FILTERS,
    initialFocusTarget = SORT_AND_FILTER_PANEL_FOCUS_TARGET__SORT,
    title = "Sort and Filter Panel",
    height = "100vh",
    width = 350,
    horizontalGap,
    position = SORT_AND_FILTER_PANEL_POSITION__RIGHT,
    panelGeometry,
    raised = true,
    overlayBlur = true,
    applyPendingSortAndFilterChanges,
    booleanArgumentComponent = "Checkbox",
    labels,
    customOverlayStyles,
    customModalStyles,
    customDialogStyles,
    isDismissable = true,
    isKeyboardDismissDisabled = false,
  } = props
  const selectNewSortCriteriaRef = useRef<HTMLDivElement | null>(null)
  const selectNewFilterCriteriaRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<TSortAndFilterPanelState>(initState)
  const { dialogStyles } = calibrateComponent()

  useEffect(() => {
    if (!isOpen) return

    const nextFilterGroupDrafts = buildFilterGroupDraftsFromQueryFilterGroups(activeFilters, possibleFilterCriteria)

    setState((previousState) => ({
      ...previousState,
      sortParameterList: activeSorts,
      previouslyAppliedSortParameterList: activeSorts,
      filterGroupDrafts: nextFilterGroupDrafts,
      previouslyAppliedFilterGroupDrafts: nextFilterGroupDrafts,
      sortCriteriaSelectedKey: null,
      filterCriteriaSelectedKey: null,
    }))
  }, [activeFilters, activeSorts, possibleFilterCriteria, isOpen])

  useEffect(() => {
    setState((previousState) => ({
      ...previousState,
      sortCriteriaSelectedKey: null,
      filterCriteriaSelectedKey: null,
    }))
  }, [state.sortParameterList, state.filterGroupDrafts])

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
  }, [initialFocusTarget, isOpen])

  const onSortParameterDrop = (event: DroppableCollectionReorderEvent | DroppableCollectionInsertDropEvent) => {
    const { sortParameterList, draggedID } = state
    const targetID = event.target.key

    if (draggedID === targetID) return

    const draggedIndex = sortParameterList.findIndex((item) => item.id === draggedID)
    const targetIndex = sortParameterList.findIndex((item) => item.id === targetID)
    const updatedSortItems = [...sortParameterList]
    const [movedItem] = updatedSortItems.splice(draggedIndex, 1)

    if (event.target.dropPosition === "before") {
      updatedSortItems.splice(targetIndex === 0 ? 0 : targetIndex, 0, movedItem)
    } else if (event.target.dropPosition === "after") {
      updatedSortItems.splice(targetIndex, 0, movedItem)
    }

    setState((previousState) => ({ ...previousState, sortParameterList: updatedSortItems }))
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

        const selectedCriteria = possibleFilterCriteria.find((criteria) => criteria.id === newCriteriaID)
        if (!selectedCriteria) return previousState.filterGroupDrafts

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
    setState((previousState) => ({
      ...previousState,
      sortParameterList: previousState.previouslyAppliedSortParameterList,
      filterGroupDrafts: previousState.previouslyAppliedFilterGroupDrafts,
    }))
    closePanel()
  }

  const onApplyPendingChanges = (closePanel: TClosePanel) => {
    const { sortParameterList, filterGroupDrafts } = state

    applyPendingSortAndFilterChanges({
      sortInstructions: sortParameterList,
      filterGroups: normalizeDraftToQueryFilterGroups(filterGroupDrafts),
    })
    setState((previousState) => ({
      ...previousState,
      previouslyAppliedSortParameterList: sortParameterList,
      previouslyAppliedFilterGroupDrafts: filterGroupDrafts,
    }))
    closePanel()
  }

  const { sortParameterList, sortCriteriaSelectedKey, filterCriteriaSelectedKey, filterGroupDrafts } = state
  const availableSortCriteria = useMemo(() => {
    const activeSortCriteriaIDs = new Set(sortParameterList.map((item) => item.criteriaID))

    return possibleSortCriteria.filter((criteria) => !activeSortCriteriaIDs.has(criteria.id))
  }, [possibleSortCriteria, sortParameterList])
  const resolvedLabels = useMemo(() => resolveSortAndFilterPanelLabels(labels), [labels])

  return {
    panel: {
      rootProps: {
        backgroundColor: SORT_AND_FILTER_PANEL_BACKGROUND_COLOR,
        customOverlayStyles,
        customStyles: customModalStyles,
        height,
        horizontalGap,
        isDismissable,
        isKeyboardDismissDisabled,
        isOpen,
        onOpenChange,
        overlayBlur,
        panelGeometry,
        position,
        raised,
        width,
      },
      dialogProps: {
        "aria-label": title,
        className: dialogStyles,
        role: "dialog",
        style: customDialogStyles,
      },
      dividerProps: {
        color: SORT_AND_FILTER_PANEL_DIVIDER_COLOR,
        height: 1,
        size: "100%",
      },
      headerProps: {
        labels: resolvedLabels.header,
        title,
      },
    },
    form: {
      sortCriteria: {
        fieldProps: {
          label: resolvedLabels.form.addSortCriteriaLabel,
          labelID: "sort-criteria-select-id",
        },
        selectProps: {
          "aria-labelledby": "sort-criteria-select-id",
          customStyles: SORT_AND_FILTER_PANEL_SELECT_STYLES,
          items: availableSortCriteria,
          onChange: (id) => onAddSortParameter(id as string),
          placeholder: resolvedLabels.form.addSortCriteriaPlaceholder,
          ref: selectNewSortCriteriaRef,
          value: sortCriteriaSelectedKey,
        },
        renderItem: (item) => {
          const listItem = item as TAvailableSortCriteria

          return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
        },
      },
      filterCriteria: {
        fieldProps: {
          label: resolvedLabels.form.addFilterCriteriaLabel,
          labelID: "filter-criteria-select-id",
        },
        selectProps: {
          "aria-labelledby": "filter-criteria-select-id",
          customStyles: SORT_AND_FILTER_PANEL_SELECT_STYLES,
          items: possibleFilterCriteria,
          onChange: (id) => onAddFilterParameter(id as string),
          placeholder: resolvedLabels.form.addFilterCriteriaPlaceholder,
          ref: selectNewFilterCriteriaRef,
          value: filterCriteriaSelectedKey,
        },
        renderItem: (item) => {
          const listItem = item as TAvailableListItem

          return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
        },
      },
    },
    sorts: {
      availableSortCriteria,
      labels: {
        activeSorts: resolvedLabels.activeSorts,
        sortEntry: resolvedLabels.sortEntry,
        sortParameterList: resolvedLabels.sortParameterList,
      },
      onDeleteSortParameter,
      onModifySortParameter,
      onSortAscending,
      onSortDescending,
      onSortParameterDragStart,
      onSortParameterDrop,
      sortParameterList,
    },
    filters: {
      availableFilterCriteria: possibleFilterCriteria,
      booleanArgumentComponent,
      filterGroupDrafts,
      labels: {
        activeFilters: resolvedLabels.activeFilters,
        filtering: resolvedLabels.filtering,
      },
      onAddFilterParameter,
      onChangeFilterGroupJoinOperator,
      onDeleteFilterParameter,
      onModifyFilterClause,
    },
    footer: {
      labels: resolvedLabels.footer,
      onApplyPendingChanges,
      onCancelPendingChanges,
      onClearAllSortAndFilterParameters,
    },
  }
}
