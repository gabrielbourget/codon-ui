import { useRef, type ReactNode, type RefObject } from "react"
import { View, type StyleProp, type TextStyle } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { useFilterRequest } from "../Filtering/requests"
import { FormField } from "../FormField/FormField"
import { LineSegment } from "../LineSegment/LineSegment"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NativePanelFocusIntentContext } from "../Panel/focus"
import { Panel } from "../Panel/Panel"
import type { TNativePanelProps } from "../Panel/types"
import { Select } from "../Select/Select"
import type { TNativeSelectRef } from "../Select/types"

import { QueryActiveFilters } from "./ActiveFilters"
import { useNativeQueryDraftController, type TNativeQueryControllerProps } from "./controller"
import { resolveNativeSortAndFilterPanelLabels, type TPartialNativeSortAndFilterPanelLabels } from "./labels"
import { QueryActiveSorts, QueryPanelFooter, QueryPanelHeader, QuerySortCriteriaField } from "./QueryControls"
import { QuerySortParameterList } from "./SortParameterList"

export const NATIVE_QUERY_FOCUS_TARGETS = ["sort", "filter"] as const
export type TNativeQueryFocusTarget = (typeof NATIVE_QUERY_FOCUS_TARGETS)[number]
export type TNativeSortAndFilterPanelProps = Omit<TNativeQueryControllerProps, "canAct"> &
  Pick<
    TNativePanelProps,
    | "height"
    | "width"
    | "horizontalGap"
    | "position"
    | "panelGeometry"
    | "raised"
    | "overlayBlur"
    | "isDismissable"
    | "isKeyboardDismissDisabled"
    | "customOverlayStyles"
  > & {
    title?: string
    testID?: string
    "data-testid"?: string
    initialFocusTarget?: TNativeQueryFocusTarget
    booleanArgumentComponent?: "Checkbox" | "Toggle"
    labels?: TPartialNativeSortAndFilterPanelLabels
    customModalStyles?: StyleProp<TextStyle>
    customDialogStyles?: StyleProp<TextStyle>
    children?: ReactNode
  }
type TCriteriaRefs = { sort: RefObject<TNativeSelectRef | null>; filter: RefObject<TNativeSelectRef | null> }
const QueryPanelBody = ({
  props,
  criteriaRefs,
}: {
  props: TNativeSortAndFilterPanelProps & { title: string }
  criteriaRefs: TCriteriaRefs
}) => {
  const labels = resolveNativeSortAndFilterPanelLabels(props.labels)
  const theme = useNativeTheme()
  const controller = useNativeQueryDraftController(props)
  const request = useFilterRequest({ ...props, canAct: () => props.isOpen })
  const style = splitNativeTextStyle(
    resolveNativeStyle(
      [
        {
          height: "100%",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          gap: theme.spacing.unit * 2,
          padding: theme.spacing.unit * 2,
        },
        props.customDialogStyles,
      ],
      "SortAndFilterPanel",
      "customDialogStyles",
    ),
  )
  const separator = <LineSegment color={theme.colors.controlBorder} height={1} size="100%" />
  return (
    <NativeContentContext.Provider
      value={{ foregroundColor: style.text.color ?? theme.colors.foreground, isButton: false }}
    >
      <NativeFocusView
        testID="query-panel-dialog"
        role="dialog"
        accessible={false}
        accessibilityLabel={props.title}
        style={style.view}
      >
        <QueryPanelHeader
          title={props.title}
          labels={labels.header}
          canAct={() => props.isOpen}
          onCloseSortAndFilterPanel={() => props.onOpenChange(false)}
        />
        {separator}
        <QuerySortCriteriaField
          ref={criteriaRefs.sort}
          labels={labels.form}
          closeLabel={labels.native.closeSortCriteria}
          availableSortCriteria={controller.availableSortCriteria}
          canAct={() => props.isOpen}
          onAddSortParameter={controller.addSort}
        />
        <FormField label={labels.form.addFilterCriteriaLabel}>
          <Select
            ref={criteriaRefs.filter}
            accessibilityLabel={labels.form.addFilterCriteriaLabel}
            closeLabel={labels.native.closeFilterCriteria}
            items={props.possibleFilterCriteria}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            value={null}
            placeholder={labels.form.addFilterCriteriaPlaceholder}
            width="100%"
            onChange={request((current, key: string | number | null) => {
              if (typeof key === "string" && current.possibleFilterCriteria.some((criterion) => criterion.id === key))
                controller.addFilter(key)
            })}
          />
        </FormField>
        {separator}
        <View style={{ width: "100%", gap: theme.spacing.unit * 2 }}>
          <QueryActiveSorts
            sortParameterList={controller.draft.sortInstructions}
            labels={labels.activeSorts}
            canAct={() => props.isOpen}
            onDeleteSortParameter={controller.removeSort}
          />
          {controller.draft.sortInstructions.length > 0 && (
            <QuerySortParameterList
              sortParameterList={controller.draft.sortInstructions}
              availableSortCriteria={controller.availableSortCriteria}
              labels={labels.sortEntry}
              listLabels={labels.sortParameterList}
              canAct={() => props.isOpen}
              onModifySortParameter={({ listItemID, sortCriteriaID }) =>
                controller.modifySort(listItemID, sortCriteriaID)
              }
              onSortAscending={(id) => controller.setSortDirection(id, "Ascending")}
              onSortDescending={(id) => controller.setSortDirection(id, "Descending")}
              onDeleteSortParameter={controller.removeSort}
            />
          )}
        </View>
        {separator}
        <QueryActiveFilters
          controller={controller}
          criteria={props.possibleFilterCriteria}
          labels={labels}
          booleanArgumentComponent={props.booleanArgumentComponent ?? "Checkbox"}
          canAct={() => props.isOpen}
        />
        {separator}
        <QueryPanelFooter
          labels={labels.footer}
          canAct={() => props.isOpen}
          onClearAllSortAndFilterParameters={controller.clear}
          onCancelPendingChanges={controller.cancel}
          onApplyPendingChanges={controller.apply}
        />
      </NativeFocusView>
    </NativeContentContext.Provider>
  )
}

// Private compound view; parent sort collection/reorder, temporal and native acceptance remain required.
export const SortAndFilterPanel = (props: TNativeSortAndFilterPanelProps) => {
  const {
    title = "Sort and Filter Panel",
    height = "100%",
    width = 350,
    position = "right",
    raised = true,
    overlayBlur = true,
    isDismissable = true,
    isKeyboardDismissDisabled = false,
  } = props
  const sort = useRef<TNativeSelectRef>(null),
    filter = useRef<TNativeSelectRef>(null)
  const criteriaRefs = useRef<TCriteriaRefs>({ sort, filter }).current
  const theme = useNativeTheme()
  return (
    <NativePanelFocusIntentContext.Provider value={props.initialFocusTarget ?? "sort"}>
      <Panel
        testID={props.testID ?? props["data-testid"] ?? "sort-filter-panel"}
        accessibilityLabel={title}
        height={height}
        width={width}
        horizontalGap={props.horizontalGap}
        position={position}
        panelGeometry={props.panelGeometry}
        raised={raised}
        overlayBlur={overlayBlur}
        isDismissable={isDismissable}
        isKeyboardDismissDisabled={isKeyboardDismissDisabled}
        isOpen={props.isOpen}
        onOpenChange={props.onOpenChange}
        initialFocusRef={criteriaRefs[props.initialFocusTarget ?? "sort"]}
        backgroundColor={theme.colors.background}
        customStyles={props.customModalStyles}
        customOverlayStyles={props.customOverlayStyles}
      >
        <QueryPanelBody props={{ ...props, title }} criteriaRefs={criteriaRefs} />
      </Panel>
    </NativePanelFocusIntentContext.Provider>
  )
}
