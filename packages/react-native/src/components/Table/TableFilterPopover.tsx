import { useEffect, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react"
import { View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { NativeForm } from "../../form/NativeForm"
import { NativeFormAction } from "../../form/NativeFormAction"
import { NativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { useNativeTheme } from "../../theme"
import { Button, NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { ClickPopover } from "../ClickPopover/ClickPopover"
import { resolveNativeStyle } from "../colors"
import { FilterClauseRow } from "../Filtering/FilterClauseRow"
import { useFilterRequest } from "../Filtering/requests"
import { Tag } from "../Tag/Tag"
import { Text } from "../Text/Text"
import { ToggleSwitcher } from "../ToggleSwitcher/ToggleSwitcher"

import {
  computeNextQueryFilterClauseOperationCode,
  createQueryFilterClauseDraft,
  normalizeDraftToQueryFilterGroups,
  type TQueryFilterGroupDraft,
} from "./filterDraft"
import { TableAddConditionGlyph } from "./filterGlyphs"
import { resolveNativeTableFilteringLabels, type TPartialNativeTableFilteringLabels } from "./filterLabels"
import type { TAvailableFilterCriteria } from "./filterMetadata"
import { buildNativeTableFilterDraft, replaceNativeTableFilterGroup } from "./filterPopoverDraft"
import type { TTableFilterGroup } from "./queryTypes"
import type { TNativeTableColumnMetadata } from "./types"

export type TNativeTableFilterPopoverProps<T extends object> = {
  column: TNativeTableColumnMetadata<T>
  filterGroup?: TTableFilterGroup
  activeFilters: TTableFilterGroup[]
  onFiltersChange: (next: TTableFilterGroup[]) => void
  isFilterActive: boolean
  activeFilterIcon: ReactNode
  inactiveFilterIcon: ReactNode
  testID?: string
  "data-testid"?: string
  labels?: TPartialNativeTableFilteringLabels
  requestOpen?: (run: () => void) => void
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  triggerStyle?: StyleProp<TextStyle>
  customTriggerStyles?: StyleProp<TextStyle>
  customPopoverStyles?: StyleProp<TextStyle>
  customTitleRowStyles?: StyleProp<ViewStyle>
  customTitleGroupStyles?: StyleProp<ViewStyle>
  customClauseListStyles?: StyleProp<ViewStyle>
  customActionsStyles?: StyleProp<ViewStyle>
}
const FilterPopoverBody = <T extends object>({
  props,
  draft,
  setDraft,
  isOpen,
  close,
}: {
  props: TNativeTableFilterPopoverProps<T>
  draft: TQueryFilterGroupDraft
  setDraft: Dispatch<SetStateAction<TQueryFilterGroupDraft>>
  isOpen: boolean
  close: () => void
}) => {
  const { column } = props
  const criteriaID = column.filter?.criteriaID ?? column.id
  const criteriaName = column.name ?? column.id
  const allowed = column.filter?.allowedOperationCodes ?? []
  const labels = resolveNativeTableFilteringLabels(props.labels)
  const theme = useNativeTheme()
  const { width } = useWindowDimensions()
  const request = useFilterRequest({ ...props, draft, canAct: () => isOpen }, false)
  const criteria: TAvailableFilterCriteria = {
    id: criteriaID,
    name: criteriaName,
    queryKey: column.filter?.queryKey,
    dataType: column.filter?.dataType ?? "text",
    allowedOperationCodes: allowed,
    usesTypeAheadInput: column.filter?.usesTypeAheadInput,
    typeAheadInputOnChange: column.filter?.typeAheadInputOnChange,
    usesSelectInput: column.filter?.usesSelectInput,
    usesComboBoxInput: column.filter?.usesComboBoxInput,
    availableCriteriaArguments: column.filter?.availableCriteriaArguments,
  }
  const apply = request((current) => {
    current.onFiltersChange(
      replaceNativeTableFilterGroup(
        current.activeFilters,
        current.column.filter?.criteriaID ?? current.column.id,
        normalizeDraftToQueryFilterGroups(current.draft)[0],
      ),
    )
    close()
  })
  const clear = request((current) => {
    setDraft(buildNativeTableFilterDraft(current.column))
    current.onFiltersChange(
      replaceNativeTableFilterGroup(current.activeFilters, current.column.filter?.criteriaID ?? current.column.id),
    )
    close()
  })
  return (
    <NativeForm
      testID={props.testID ?? props["data-testid"] ?? "table-filter-popover"}
      style={resolveNativeStyle<ViewStyle>(
        [
          { padding: 5, minWidth: 240, maxWidth: Math.min(320, width - 32), flexDirection: "column", gap: 10 },
          props.customStyles,
          props.style,
        ],
        "TableFilterPopover",
        "style",
      )}
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
    >
      <View
        testID="table-filter-title-row"
        style={[
          { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
          props.customTitleRowStyles,
        ]}
      >
        <View
          testID="table-filter-title-group"
          style={[
            { minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 },
            props.customTitleGroupStyles,
          ]}
        >
          <Text variant="b10" fontWeight="bold">
            {labels.popover.title}
          </Text>
          <Tag
            color={theme.colors.controlSelectedBackground}
            geometry="round"
            accessibilityLabel={labels.popover.criteriaTagAriaLabel({ criteriaName })}
            customStyles={{
              height: 22,
              maxWidth: "100%",
              paddingHorizontal: 5,
              borderWidth: 0,
              color: theme.colors.controlSelectedForeground,
            }}
          >
            <Text variant="b11" fontWeight="semibold">
              {criteriaName}
            </Text>
          </Tag>
        </View>
        {allowed.length > 1 && (
          <Button
            order="primary"
            geometry="round"
            raised={false}
            isDisabled={draft.clauses.length >= allowed.length}
            accessibilityLabel={labels.popover.addConditionButtonAriaLabel}
            customStyles={{ height: 24, width: 24, padding: 0, flexShrink: 0 }}
            onPress={request((current) => {
              const operations = current.column.filter?.allowedOperationCodes ?? []
              const next = computeNextQueryFilterClauseOperationCode({
                allowDuplicateOperationCodes: false,
                allowedOperationCodes: operations,
                existingOperationCodes: current.draft.clauses.map((clause) => clause.operationCode),
              })
              if (next)
                setDraft((previous) => ({
                  ...previous,
                  clauses: [
                    ...previous.clauses,
                    createQueryFilterClauseDraft({
                      id: `${current.column.filter?.criteriaID ?? current.column.id}-clause-${previous.clauses.length + 1}`,
                      operationCode: next,
                    }),
                  ],
                }))
            })}
          >
            <TableAddConditionGlyph color={theme.colors.controlSelectedForeground} />
          </Button>
        )}
      </View>
      <View style={{ flexDirection: "column", gap: 10 }}>
        {draft.clauses.length > 1 && (
          <ToggleSwitcher
            accessibilityLabel={labels.popover.matchModeAriaLabel({ criteriaName })}
            items={[
              { id: "and", label: labels.popover.joinOperators.and },
              { id: "or", label: labels.popover.joinOperators.or },
            ]}
            selectedKey={draft.joinOperator}
            onSelectionChange={(key) => setDraft((previous) => ({ ...previous, joinOperator: key as "and" | "or" }))}
            width="100%"
            uppercase
            optionFontWeight="bold"
            selectedOptionFontWeight="bold"
          />
        )}
        <View
          testID="table-filter-clause-list"
          style={[{ flexDirection: "column", gap: 5 }, props.customClauseListStyles]}
        >
          {draft.clauses.map((clause, index) => (
            <FilterClauseRow
              key={clause.id}
              listIndex={index}
              group={draft}
              clause={clause}
              availableFilterCriteria={[criteria]}
              showCriteriaSelector={false}
              hideDeleteButton={draft.clauses.length === 1}
              labels={props.labels}
              canAct={() => isOpen}
              onModifyFilterClause={({ updatedClause }) =>
                setDraft((previous) => ({
                  ...previous,
                  clauses: previous.clauses.map((item) => (item.id === updatedClause.id ? updatedClause : item)),
                }))
              }
              onDeleteFilterClause={(id) =>
                setDraft((previous) => ({ ...previous, clauses: previous.clauses.filter((item) => item.id !== id) }))
              }
            />
          ))}
        </View>
      </View>
      <View
        testID="table-filter-actions"
        style={[{ flexDirection: "row", justifyContent: "flex-end", gap: 5 }, props.customActionsStyles]}
      >
        <Button transparent raised={false} onPress={clear}>
          <Text variant="b11">{labels.popover.clearButton}</Text>
        </Button>
        <NativeFormAction action="submit" order="primary" raised={false}>
          <Text variant="b11">{labels.popover.applyButton}</Text>
        </NativeFormAction>
      </View>
    </NativeForm>
  )
}
export const TableFilterPopover = <T extends object>(props: TNativeTableFilterPopoverProps<T>) => {
  const { column, filterGroup } = props
  const criteriaName = column.name ?? column.id
  const labels = useMemo(() => resolveNativeTableFilteringLabels(props.labels), [props.labels])
  const theme = useNativeTheme()
  const [draft, setDraft] = useState(() => buildNativeTableFilterDraft(column, filterGroup))
  const [isOpen, setIsOpen] = useState(false)
  const color = props.isFilterActive ? theme.colors.controlSelectedBackground : theme.colors.controlForeground
  useEffect(() => {
    setDraft(buildNativeTableFilterDraft(column, filterGroup))
  }, [column, filterGroup])
  return (
    <NativeDialogTrigger
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={({ triggerProps }) => (
        <NativeButton
          {...triggerProps}
          accessibilityLabel={labels.popover.triggerButtonAriaLabel({ criteriaName })}
          accessibilityState={{ ...triggerProps.accessibilityState, checked: props.isFilterActive }}
          onPress={(event) =>
            props.requestOpen ? props.requestOpen(() => triggerProps.onPress(event)) : triggerProps.onPress(event)
          }
          nativeStyle={(flags, visible) => ({
            viewStyle: resolveNativeStyle(
              [
                {
                  padding: 2,
                  borderWidth: 0,
                  borderRadius: 3,
                  backgroundColor: "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                },
                flags.isFocused && visible
                  ? { outlineWidth: 2, outlineOffset: 1, outlineColor: theme.colors.focusRing }
                  : undefined,
                props.customTriggerStyles,
                props.triggerStyle,
              ],
              "TableFilterPopover",
              "triggerStyle",
            ),
            textStyle: {},
            foregroundColor: color,
            target: 0,
          })}
        >
          {getNativeButtonContent(props.isFilterActive ? props.activeFilterIcon : props.inactiveFilterIcon, { color })}
        </NativeButton>
      )}
    >
      <ClickPopover
        placement="bottom left"
        offset={0}
        customStyles={[{ width: "auto", padding: 0 }, props.customPopoverStyles]}
      >
        <FilterPopoverBody
          props={props}
          draft={draft}
          setDraft={setDraft}
          isOpen={isOpen}
          close={() => setIsOpen(false)}
        />
      </ClickPopover>
    </NativeDialogTrigger>
  )
}
