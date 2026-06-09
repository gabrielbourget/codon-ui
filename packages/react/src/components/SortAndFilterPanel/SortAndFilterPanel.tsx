"use client"

import { type FC, type PropsWithChildren, useEffect, useMemo, useRef, useState } from "react"
import {
  type DraggableCollectionStartEvent,
  type DroppableCollectionInsertDropEvent,
  type DroppableCollectionReorderEvent,
  Dialog,
} from "react-aria-components"

import FormField from "../FormField/FormField"
import LineSegment from "../LineSegment/LineSegment"
import ListBoxItem from "../ListBoxItem/ListBoxItem"
import Panel from "../Panel/Panel"
import Select from "../Select/Select"
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
import ActiveFilters from "./InternalComponents/ActiveFilters/ActiveFilters"
import ActiveSorts from "./InternalComponents/ActiveSorts/ActiveSorts"
import PanelFooter from "./InternalComponents/PanelFooter/PanelFooter"
import PanelHeader from "./InternalComponents/PanelHeader/PanelHeader"
import { resolveSortAndFilterPanelLabels } from "./labels"

const DEFAULT_ACTIVE_SORTS: NonNullable<TSortAndFilterPanelProps["activeSorts"]> = []
const DEFAULT_ACTIVE_FILTERS: NonNullable<TSortAndFilterPanelProps["activeFilters"]> = []
const SORT_AND_FILTER_PANEL_POSITION__RIGHT = "right"
const SORT_AND_FILTER_PANEL_DIVIDER_COLOR = "var(--aui-border-muted)"

const SortAndFilterPanel: FC<PropsWithChildren<TSortAndFilterPanelProps>> = (props) => {
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

    setState((prevState) => ({
      ...prevState,
      sortParameterList: activeSorts,
      previouslyAppliedSortParameterList: activeSorts,
      filterGroupDrafts: nextFilterGroupDrafts,
      previouslyAppliedFilterGroupDrafts: nextFilterGroupDrafts,
      sortCriteriaSelectedKey: null,
      filterCriteriaSelectedKey: null,
    }))
  }, [activeFilters, activeSorts, possibleFilterCriteria, isOpen])

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
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

      targetRef.current?.focus()
    })

    return () => cancelAnimationFrame(animationFrameID)
  }, [initialFocusTarget, isOpen])

  const onSortParameterDrop = (e: DroppableCollectionReorderEvent | DroppableCollectionInsertDropEvent) => {
    const { sortParameterList, draggedID } = state
    const targetID = e.target.key

    if (draggedID !== targetID) {
      const draggedIndex = sortParameterList.findIndex((item) => item.id === draggedID)
      const targetIndex = sortParameterList.findIndex((item) => item.id === targetID)

      const updatedSortItems = [...sortParameterList]
      const [movedItem] = updatedSortItems.splice(draggedIndex, 1)

      if (e.target.dropPosition === "before") {
        updatedSortItems.splice(targetIndex === 0 ? 0 : targetIndex, 0, movedItem)
      } else if (e.target.dropPosition === "after") {
        updatedSortItems.splice(targetIndex, 0, movedItem)
      }

      setState((prevState) => ({ ...prevState, sortParameterList: updatedSortItems }))
    }
  }

  const onSortParameterDragStart = (e: DraggableCollectionStartEvent) => {
    setState((prevState) => ({ ...prevState, draggedID: Array.from(e.keys)[0] as string }))
  }

  const onAddSortParameter = (targetSortCriteriaID: string) => {
    const { sortParameterList } = state
    if (sortParameterList.some((sortParameter) => sortParameter.criteriaID === targetSortCriteriaID)) return

    const selectedSortCriteria = possibleSortCriteria.find((item) => item.id === targetSortCriteriaID)
    if (!selectedSortCriteria) return

    const updatedSortParameters = [...sortParameterList]
    const newSortParameter: TTableSortInstruction = {
      id: selectedSortCriteria.id,
      criteriaID: selectedSortCriteria.id,
      criteriaName: selectedSortCriteria.name,
      queryKey: selectedSortCriteria.queryKey,
      sortDirection: selectedSortCriteria.defaultDirection ?? TABLE_SORT_DIRECTION__ASCENDING,
    }
    updatedSortParameters.push(newSortParameter)

    setState((prevState) => ({
      ...prevState,
      sortParameterList: updatedSortParameters,
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

    setState((prevState) => ({
      ...prevState,
      sortParameterList: updatedList,
      sortCriteriaSelectedKey: null,
    }))
  }

  const onDeleteSortParameter = (listItemID: string) => {
    const { sortParameterList } = state
    const updatedList = sortParameterList.filter((item) => item.id !== listItemID)

    setState((prevState) => ({
      ...prevState,
      sortParameterList: updatedList,
      sortCriteriaSelectedKey: null,
    }))
  }

  const onChangeSortDirection = (listItemID: string, sortDirection: TTableSortInstruction["sortDirection"]) => {
    setState((prevState) => ({
      ...prevState,
      sortParameterList: prevState.sortParameterList.map((sortParameter) => {
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

  const removeEmptyFilterGroups = (filterGroupDrafts: TQueryFilterGroupDraft[]) => {
    return filterGroupDrafts.filter((group) => group.clauses.length > 0)
  }

  const onAddFilterParameter = (targetFilterCriteriaID: string) => {
    setState((prevState) => ({
      ...prevState,
      filterGroupDrafts: (() => {
        const selectedFilterCriteria = possibleFilterCriteria.find((item) => item.id === targetFilterCriteriaID)
        if (!selectedFilterCriteria) return prevState.filterGroupDrafts

        const existingGroup = prevState.filterGroupDrafts.find(
          (group) => group.criteriaID === selectedFilterCriteria.id,
        )

        if (existingGroup) {
          return prevState.filterGroupDrafts.map((group) => {
            if (group.id !== existingGroup.id) return group

            return appendQueryFilterClauseDraftToGroup(group, {
              allowDuplicateOperationCodes: true,
              allowedOperationCodes: selectedFilterCriteria.allowedOperationCodes,
            })
          })
        }

        return [...prevState.filterGroupDrafts, createQueryFilterGroupDraftFromCriteria(selectedFilterCriteria)]
      })(),
    }))
  }

  const onModifyFilterClause = ({ updatedClause, newCriteriaID }: TModifyFilterClauseArgs) => {
    setState((prevState) => ({
      ...prevState,
      filterGroupDrafts: (() => {
        const groupsWithoutClause = removeEmptyFilterGroups(
          prevState.filterGroupDrafts.map((group) => ({
            ...group,
            clauses: group.clauses.filter((c) => c.id !== updatedClause.id),
          })),
        )

        const targetGroup = groupsWithoutClause.find((group) => group.criteriaID === newCriteriaID)

        if (targetGroup) {
          return groupsWithoutClause.map((group) => {
            if (group.id !== targetGroup.id) return group
            return { ...group, clauses: [...group.clauses, updatedClause] }
          })
        }

        const selectedCriteria = possibleFilterCriteria.find((c) => c.id === newCriteriaID)
        if (!selectedCriteria) return prevState.filterGroupDrafts

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
    setState((prevState) => ({
      ...prevState,
      filterGroupDrafts: removeEmptyFilterGroups(
        prevState.filterGroupDrafts.map((group) => ({
          ...group,
          clauses: group.clauses.filter((clause) => clause.id !== listItemID),
        })),
      ),
      filterCriteriaSelectedKey: null,
    }))
  }

  const onChangeFilterGroupJoinOperator = (criteriaID: string, joinOperator: TTableFilterJoinOperator) => {
    setState((prevState) => ({
      ...prevState,
      filterGroupDrafts: prevState.filterGroupDrafts.map((group) => {
        if (group.criteriaID !== criteriaID) return group

        return {
          ...group,
          joinOperator,
        }
      }),
    }))
  }

  const onClearAllSortAndFilterParameters = () => {
    setState((prevState) => ({
      ...prevState,
      filterGroupDrafts: [],
      sortParameterList: [],
    }))
  }

  const onCancelPendingChanges = () => {
    const { previouslyAppliedSortParameterList, previouslyAppliedFilterGroupDrafts } = state

    setState((prevState) => ({
      ...prevState,
      sortParameterList: previouslyAppliedSortParameterList,
      filterGroupDrafts: previouslyAppliedFilterGroupDrafts,
    }))
  }

  const onApplyPendingSortAndFilterChanges = () => {
    const { sortParameterList, filterGroupDrafts } = state
    const filterGroups = normalizeDraftToQueryFilterGroups(filterGroupDrafts)

    applyPendingSortAndFilterChanges({ sortInstructions: sortParameterList, filterGroups })

    setState((prevState) => ({
      ...prevState,
      previouslyAppliedSortParameterList: sortParameterList,
      previouslyAppliedFilterGroupDrafts: filterGroupDrafts,
    }))
  }

  const { sortParameterList, sortCriteriaSelectedKey, filterCriteriaSelectedKey, filterGroupDrafts } = state
  const availableSortCriteria = useMemo(() => {
    const activeSortCriteriaIDs = new Set(sortParameterList.map((item) => item.criteriaID))

    return possibleSortCriteria.filter((criteria) => !activeSortCriteriaIDs.has(criteria.id))
  }, [possibleSortCriteria, sortParameterList])
  const availableFilterCriteria = possibleFilterCriteria
  const resolvedLabels = useMemo(() => resolveSortAndFilterPanelLabels(labels), [labels])

  return (
    <Panel
      backgroundColor="var(--aui-background)"
      customOverlayStyles={customOverlayStyles}
      customStyles={customModalStyles}
      height={height}
      horizontalGap={horizontalGap}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      overlayBlur={overlayBlur}
      panelGeometry={panelGeometry}
      position={position}
      raised={raised}
      width={width}
    >
      <Dialog aria-label={title} className={dialogStyles} style={customDialogStyles} role="dialog">
        {({ close: closePanel }) => (
          <>
            <PanelHeader title={title} labels={resolvedLabels.header} onCloseSortAndFilterPanel={closePanel} />

            <LineSegment color={SORT_AND_FILTER_PANEL_DIVIDER_COLOR} height={1} size="100%" />

            <FormField label={resolvedLabels.form.addSortCriteriaLabel} labelID="sort-criteria-select-id">
              <Select
                aria-labelledby="sort-criteria-select-id"
                ref={selectNewSortCriteriaRef}
                items={availableSortCriteria}
                placeholder={resolvedLabels.form.addSortCriteriaPlaceholder}
                customStyles={{ width: "100%" }}
                value={sortCriteriaSelectedKey}
                onChange={(id) => onAddSortParameter(id as string)}
              >
                {(item: object) => {
                  const listItem = item as unknown as TAvailableSortCriteria

                  return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
                }}
              </Select>
            </FormField>

            <FormField label={resolvedLabels.form.addFilterCriteriaLabel} labelID="filter-criteria-select-id">
              <Select
                aria-labelledby="filter-criteria-select-id"
                ref={selectNewFilterCriteriaRef}
                items={availableFilterCriteria}
                placeholder={resolvedLabels.form.addFilterCriteriaPlaceholder}
                customStyles={{ width: "100%" }}
                value={filterCriteriaSelectedKey}
                onChange={(id) => onAddFilterParameter(id as string)}
              >
                {(item: object) => {
                  const listItem = item as unknown as TAvailableListItem

                  return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
                }}
              </Select>
            </FormField>

            <LineSegment color={SORT_AND_FILTER_PANEL_DIVIDER_COLOR} height={1} size="100%" />

            <ActiveSorts
              onSortAscending={onSortAscending}
              onSortDescending={onSortDescending}
              onDeleteSortParameter={onDeleteSortParameter}
              onModifySortParameter={onModifySortParameter}
              onSortParameterDragStart={onSortParameterDragStart}
              onSortParameterDrop={onSortParameterDrop}
              availableSortCriteria={availableSortCriteria}
              sortParameterList={sortParameterList}
              labels={{
                activeSorts: resolvedLabels.activeSorts,
                sortParameterList: resolvedLabels.sortParameterList,
                sortEntry: resolvedLabels.sortEntry,
              }}
            />

            <LineSegment color={SORT_AND_FILTER_PANEL_DIVIDER_COLOR} height={1} size="100%" />

            <ActiveFilters
              filterGroupDrafts={filterGroupDrafts}
              availableFilterCriteria={availableFilterCriteria}
              onChangeFilterGroupJoinOperator={onChangeFilterGroupJoinOperator}
              onAddFilterParameter={onAddFilterParameter}
              onModifyFilterClause={onModifyFilterClause}
              onDeleteFilterParameter={onDeleteFilterParameter}
              booleanArgumentComponent={booleanArgumentComponent}
              labels={{
                activeFilters: resolvedLabels.activeFilters,
                filtering: resolvedLabels.filtering,
              }}
            />

            <LineSegment color={SORT_AND_FILTER_PANEL_DIVIDER_COLOR} height={1} size="100%" />

            <PanelFooter
              labels={resolvedLabels.footer}
              onClearAllSortAndFilterParameters={onClearAllSortAndFilterParameters}
              onCancelPendingChanges={() => {
                onCancelPendingChanges()
                closePanel()
              }}
              onApplyPendingChanges={() => {
                onApplyPendingSortAndFilterChanges()
                closePanel()
              }}
            />
          </>
        )}
      </Dialog>
    </Panel>
  )
}

export default SortAndFilterPanel
