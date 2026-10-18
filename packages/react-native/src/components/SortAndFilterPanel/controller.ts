import { useInsertionEffect, useLayoutEffect, useRef, useState } from "react"

import { normalizeDraftToQueryFilterGroups, type TModifyFilterClauseArgs } from "../Table/filterDraft"
import type { TAvailableFilterCriteria, TAvailableSortCriteria } from "../Table/filterMetadata"
import type {
  TTableFilterGroup,
  TTableFilterJoinOperator,
  TTableSortDirection,
  TTableSortInstruction,
} from "../Table/queryTypes"

import {
  addFilter,
  addSort,
  availableSortCriteria,
  clearDraft,
  modifyFilterClause,
  modifySort,
  removeFilterClause,
  removeSort,
  reorderSort,
  setFilterJoin,
  setSortDirection,
  type TNativeQueryDraft,
} from "./commands"
import { buildFilterGroupDraftsFromQueryFilterGroups, rebaseFilterGroupDrafts } from "./hydration"

export type TNativeQueryApplyRequest = { sortInstructions: TTableSortInstruction[]; filterGroups: TTableFilterGroup[] }
export type TNativeQueryControllerProps = {
  isOpen: boolean
  activeSorts?: TTableSortInstruction[]
  activeFilters?: TTableFilterGroup[]
  possibleSortCriteria: TAvailableSortCriteria[]
  possibleFilterCriteria: TAvailableFilterCriteria[]
  applyPendingSortAndFilterChanges: (request: TNativeQueryApplyRequest) => void
  onOpenChange: (open: boolean) => void
  canAct?: () => boolean
}

const EMPTY_SORTS: TTableSortInstruction[] = []
const EMPTY_FILTERS: TTableFilterGroup[] = []

const confirmedDraft = (props: TNativeQueryControllerProps): TNativeQueryDraft => ({
  sortInstructions: props.activeSorts ?? EMPTY_SORTS,
  filterGroups: buildFilterGroupDraftsFromQueryFilterGroups(
    props.activeFilters ?? EMPTY_FILTERS,
    props.possibleFilterCriteria,
  ),
})

/** Private transactional query model; native controls and gesture/window delivery are separate owners. */
export const useNativeQueryDraftController = (props: TNativeQueryControllerProps) => {
  const [draft, setDraft] = useState(() => confirmedDraft(props))
  const committed = useRef({ props, draft })
  const mounted = useRef(false)
  const previousOwner = useRef<{ open: boolean; sorts: TTableSortInstruction[]; filters: TTableFilterGroup[] } | null>(
    null,
  )
  const sorts = props.activeSorts ?? EMPTY_SORTS
  const filters = props.activeFilters ?? EMPTY_FILTERS

  useInsertionEffect(() => {
    committed.current = { props, draft }
  })
  useInsertionEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useLayoutEffect(() => {
    const previous = previousOwner.current
    previousOwner.current = { open: props.isOpen, sorts, filters }
    if (!props.isOpen) return
    if (!previous?.open || previous.sorts !== sorts || previous.filters !== filters) {
      setDraft(confirmedDraft(props))
      return
    }
    setDraft((current) => {
      const filterGroups = rebaseFilterGroupDrafts(current.filterGroups, props.possibleFilterCriteria)
      return filterGroups === current.filterGroups ? current : { ...current, filterGroups }
    })
  }, [sorts, filters, props.isOpen, props.possibleFilterCriteria])

  const actionable = () => {
    const current = committed.current.props
    return mounted.current && current.isOpen && (current.canAct?.() ?? true)
  }
  const edit = (command: (current: TNativeQueryDraft, owner: TNativeQueryControllerProps) => TNativeQueryDraft) => {
    if (!actionable()) return
    const currentOwner = committed.current.props
    setDraft((current) => command(current, currentOwner))
  }
  const editSorts = (
    command: (current: TTableSortInstruction[], owner: TNativeQueryControllerProps) => TTableSortInstruction[],
  ) =>
    edit((current, owner) => {
      const sortInstructions = command(current.sortInstructions, owner)
      return sortInstructions === current.sortInstructions ? current : { ...current, sortInstructions }
    })
  const editFilters = (
    command: (
      current: TNativeQueryDraft["filterGroups"],
      owner: TNativeQueryControllerProps,
    ) => TNativeQueryDraft["filterGroups"],
  ) =>
    edit((current, owner) => {
      const filterGroups = command(current.filterGroups, owner)
      return filterGroups === current.filterGroups ? current : { ...current, filterGroups }
    })

  return {
    draft,
    availableSortCriteria: availableSortCriteria(draft.sortInstructions, props.possibleSortCriteria),
    addSort: (criteriaID: string) =>
      editSorts((current, owner) => addSort(current, owner.possibleSortCriteria, criteriaID)),
    modifySort: (rowID: string, criteriaID: string) =>
      editSorts((current, owner) => modifySort(current, owner.possibleSortCriteria, rowID, criteriaID)),
    removeSort: (rowID: string) => editSorts((current) => removeSort(current, rowID)),
    setSortDirection: (rowID: string, direction: TTableSortDirection) =>
      editSorts((current) => setSortDirection(current, rowID, direction)),
    reorderSort: (sourceID: string, targetID: string, position: "before" | "after") =>
      editSorts((current) => reorderSort(current, sourceID, targetID, position)),
    addFilter: (criteriaID: string) =>
      editFilters((current, owner) => addFilter(current, owner.possibleFilterCriteria, criteriaID)),
    modifyFilterClause: (change: TModifyFilterClauseArgs) =>
      editFilters((current, owner) => modifyFilterClause(current, owner.possibleFilterCriteria, change)),
    removeFilterClause: (clauseID: string) => editFilters((current) => removeFilterClause(current, clauseID)),
    setFilterJoin: (criteriaID: string, join: TTableFilterJoinOperator) =>
      editFilters((current) => setFilterJoin(current, criteriaID, join)),
    clear: () => edit(clearDraft),
    cancel: () => {
      if (!actionable()) return
      setDraft(confirmedDraft(committed.current.props))
      committed.current.props.onOpenChange(false)
    },
    apply: () => {
      if (!actionable()) return
      const current = committed.current
      current.props.applyPendingSortAndFilterChanges({
        sortInstructions: current.draft.sortInstructions,
        filterGroups: normalizeDraftToQueryFilterGroups(current.draft.filterGroups),
      })
      if (actionable()) committed.current.props.onOpenChange(false)
    },
  }
}
