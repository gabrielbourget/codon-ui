"use client"

import { useRef, useState, type CSSProperties, type FC, type PropsWithChildren } from "react"
import { Dialog } from "react-aria-components"

import FormField from "../FormField/FormField"
import ListBoxItem from "../ListBoxItem/ListBoxItem"
import Panel from "../Panel/Panel"
import Select from "../Select/Select"

import {
  initState,
  useCalibratedComponent,
  type TAvailableListItem,
  type TAvailableSortCriteria,
  type TSortAndFilterPanelProps,
  type TSortAndFilterPanelState,
} from "./helpers"
import ActiveFilters from "./InternalComponents/ActiveFilters/ActiveFilters"
import ActiveSorts from "./InternalComponents/ActiveSorts/ActiveSorts"
import PanelFooter from "./InternalComponents/PanelFooter/PanelFooter"
import PanelHeader from "./InternalComponents/PanelHeader/PanelHeader"
import { LineSegment } from "./registryDependencies"
import styles from "./SortAndFilterPanelStyles.module.css"

const { sortAndFilterPanel__content: dialogStyles } = styles
const SORT_AND_FILTER_PANEL_SELECT_STYLES: CSSProperties = { width: "100%" }

const SortAndFilterPanel: FC<PropsWithChildren<TSortAndFilterPanelProps>> = (props) => {
  const {
    isOpen,
    onOpenChange,
    possibleFilterCriteria,
    title = "Sort and Filter Panel",
    height = "100vh",
    width = 350,
    horizontalGap,
    position = "right",
    panelGeometry,
    raised = true,
    overlayBlur = true,
    booleanArgumentComponent = "Checkbox",
    customOverlayStyles,
    customModalStyles,
    customDialogStyles,
    isDismissable = true,
    isKeyboardDismissDisabled = false,
  } = props
  const selectNewSortCriteriaRef = useRef<HTMLDivElement | null>(null)
  const selectNewFilterCriteriaRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<TSortAndFilterPanelState>(initState)
  const { sortParameterList, sortCriteriaSelectedKey, filterCriteriaSelectedKey, filterGroupDrafts } = state
  const {
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
  } = useCalibratedComponent({ props, state, setState, selectNewSortCriteriaRef, selectNewFilterCriteriaRef })

  return (
    <Panel
      backgroundColor="var(--cui-background)"
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
      <Dialog aria-label={title} className={dialogStyles} role="dialog" style={customDialogStyles}>
        {({ close: closePanel }) => (
          <>
            <PanelHeader labels={resolvedLabels.header} title={title} onCloseSortAndFilterPanel={closePanel} />

            <LineSegment color="var(--cui-border-muted)" height={1} size="100%" />

            <FormField label={resolvedLabels.form.addSortCriteriaLabel} labelID="sort-criteria-select-id">
              <Select
                aria-labelledby="sort-criteria-select-id"
                customStyles={SORT_AND_FILTER_PANEL_SELECT_STYLES}
                items={availableSortCriteria}
                onChange={(id) => onAddSortParameter(id as string)}
                placeholder={resolvedLabels.form.addSortCriteriaPlaceholder}
                ref={selectNewSortCriteriaRef}
                value={sortCriteriaSelectedKey}
              >
                {(item) => {
                  const listItem = item as TAvailableSortCriteria
                  return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
                }}
              </Select>
            </FormField>

            <FormField label={resolvedLabels.form.addFilterCriteriaLabel} labelID="filter-criteria-select-id">
              <Select
                aria-labelledby="filter-criteria-select-id"
                customStyles={SORT_AND_FILTER_PANEL_SELECT_STYLES}
                items={possibleFilterCriteria}
                onChange={(id) => onAddFilterParameter(id as string)}
                placeholder={resolvedLabels.form.addFilterCriteriaPlaceholder}
                ref={selectNewFilterCriteriaRef}
                value={filterCriteriaSelectedKey}
              >
                {(item) => {
                  const listItem = item as TAvailableListItem
                  return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
                }}
              </Select>
            </FormField>

            <LineSegment color="var(--cui-border-muted)" height={1} size="100%" />

            <ActiveSorts
              availableSortCriteria={availableSortCriteria}
              labels={{
                activeSorts: resolvedLabels.activeSorts,
                sortEntry: resolvedLabels.sortEntry,
                sortParameterList: resolvedLabels.sortParameterList,
              }}
              onDeleteSortParameter={onDeleteSortParameter}
              onModifySortParameter={onModifySortParameter}
              onSortAscending={onSortAscending}
              onSortDescending={onSortDescending}
              onSortParameterDragStart={onSortParameterDragStart}
              onSortParameterDrop={onSortParameterDrop}
              sortParameterList={sortParameterList}
            />

            <LineSegment color="var(--cui-border-muted)" height={1} size="100%" />

            <ActiveFilters
              availableFilterCriteria={possibleFilterCriteria}
              booleanArgumentComponent={booleanArgumentComponent}
              filterGroupDrafts={filterGroupDrafts}
              labels={{ activeFilters: resolvedLabels.activeFilters, filtering: resolvedLabels.filtering }}
              onAddFilterParameter={onAddFilterParameter}
              onChangeFilterGroupJoinOperator={onChangeFilterGroupJoinOperator}
              onDeleteFilterParameter={onDeleteFilterParameter}
              onModifyFilterClause={onModifyFilterClause}
            />

            <LineSegment color="var(--cui-border-muted)" height={1} size="100%" />

            <PanelFooter
              labels={resolvedLabels.footer}
              onClearAllSortAndFilterParameters={onClearAllSortAndFilterParameters}
              onCancelPendingChanges={() => onCancelPendingChanges(closePanel)}
              onApplyPendingChanges={() => onApplyPendingChanges(closePanel)}
            />
          </>
        )}
      </Dialog>
    </Panel>
  )
}

export default SortAndFilterPanel
