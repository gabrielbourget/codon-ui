import { useMemo } from "react"
import { ScrollView, View } from "react-native"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { FilterClauseRow } from "../Filtering/FilterClauseRow"
import { useFilterRequest } from "../Filtering/requests"
import { TableAddConditionGlyph } from "../Table/filterGlyphs"
import { Tag } from "../TagGroup/Tag"
import { TagGroup } from "../TagGroup/TagGroup"
import { Text } from "../Text/Text"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"
import { ToggleSwitcher } from "../ToggleSwitcher/ToggleSwitcher"

import type { useNativeQueryDraftController } from "./controller"
import type { resolveNativeSortAndFilterPanelLabels } from "./labels"

type TController = ReturnType<typeof useNativeQueryDraftController>
export type TNativeQueryActiveFiltersProps = {
  controller: TController
  criteria: Parameters<typeof useNativeQueryDraftController>[0]["possibleFilterCriteria"]
  labels: ReturnType<typeof resolveNativeSortAndFilterPanelLabels>
  booleanArgumentComponent?: "Checkbox" | "Toggle"
  canAct: () => boolean
}
export const QueryActiveFilters = (props: TNativeQueryActiveFiltersProps) => {
  const { controller, criteria, labels } = props
  const theme = useNativeTheme()
  const request = useFilterRequest(props, false)
  const items = useMemo(
    () =>
      controller.draft.filterGroups.flatMap((group) =>
        group.clauses.map((clause) => ({
          key: clause.id,
          type: "item",
          value: clause,
          props: { id: clause.id, textValue: group.criteriaName },
          textValue: group.criteriaName,
          rendered: null,
          render: () => (
            <Tag
              id={clause.id}
              textValue={group.criteriaName}
              geometry="round"
              color={theme.actions.primary.background}
              customStyles={{ borderWidth: 0 }}
            >
              <Text variant="b11" color={theme.actions.primary.foreground}>
                {group.criteriaName}
              </Text>
            </Tag>
          ),
        })),
      ),
    [controller.draft.filterGroups, theme.actions.primary.background, theme.actions.primary.foreground],
  )
  return (
    <ScrollView
      testID="query-active-filters"
      style={{ flex: 1, minHeight: 0, width: "100%" }}
      contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.unit }}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="none"
      nestedScrollEnabled
    >
      <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.unit }}>
        <Text variant="b10">{labels.activeFilters.headingLabel}</Text>
        {items.length === 0 ? (
          <PlaceholderText>{labels.activeFilters.noFiltersFallback}</PlaceholderText>
        ) : (
          <TagGroup
            accessibilityLabel={labels.activeFilters.activeFiltersAriaLabel}
            items={items}
            selectionMode="none"
            onRemove={(keys) =>
              request((current) => {
                for (const key of keys) if (typeof key === "string") current.controller.removeFilterClause(key)
              })()
            }
          />
        )}
      </View>
      {controller.draft.filterGroups.length > 0 && (
        <ScrollView
          testID="query-filter-parameter-list"
          accessibilityLabel={labels.activeFilters.activeFiltersListAriaLabel}
          style={{ width: "100%", flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.unit }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          nestedScrollEnabled
        >
          {controller.draft.filterGroups.map((group) => (
            <View
              key={group.id}
              accessibilityLabel={labels.activeFilters.filterGroupAriaLabel({ criteriaName: group.criteriaName })}
              style={{
                width: "100%",
                gap: theme.spacing.unit,
                padding: theme.spacing.unit,
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.borderMuted,
                borderWidth: 1,
                borderRadius: theme.radius.rounded,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: theme.spacing.unit,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: theme.spacing.unit,
                    minWidth: 0,
                  }}
                >
                  <Text variant="b10" fontWeight="semibold">
                    {labels.activeFilters.filterGroupLabel}
                  </Text>
                  <View
                    style={{
                      maxWidth: "100%",
                      padding: theme.spacing.unit,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.actions.primary.background,
                      borderRadius: 10000,
                    }}
                  >
                    <Text variant="b11" fontWeight="semibold" color={theme.actions.primary.foreground}>
                      {group.criteriaName}
                    </Text>
                  </View>
                </View>
                <Button
                  order="primary"
                  geometry="round"
                  raised={false}
                  accessibilityLabel={labels.activeFilters.addFilterButtonAriaLabel({
                    criteriaName: group.criteriaName,
                  })}
                  customStyles={{ padding: theme.spacing.unit, flexShrink: 0 }}
                  onPress={request((current) => current.controller.addFilter(group.criteriaID))}
                >
                  <TableAddConditionGlyph color={theme.actions.primary.foreground} />
                </Button>
              </View>
              {group.clauses.length > 1 && (
                <ToggleSwitcher
                  accessibilityLabel={labels.activeFilters.matchModeAriaLabel({ criteriaName: group.criteriaName })}
                  items={(["and", "or"] as const).map((id) => ({ id, label: labels.activeFilters.joinOperators[id] }))}
                  selectedKey={group.joinOperator}
                  onSelectionChange={(key) => {
                    if (key === "and" || key === "or") controller.setFilterJoin(group.criteriaID, key)
                  }}
                  width="100%"
                  uppercase
                  optionFontWeight="bold"
                  selectedOptionFontWeight="bold"
                />
              )}
              <View style={{ width: "100%", gap: theme.spacing.unit }}>
                {group.clauses.map((clause, index) => (
                  <FilterClauseRow
                    key={clause.id}
                    listIndex={index}
                    group={group}
                    clause={clause}
                    availableFilterCriteria={criteria}
                    labels={labels.filtering}
                    booleanArgumentComponent={props.booleanArgumentComponent}
                    canAct={props.canAct}
                    onModifyFilterClause={controller.modifyFilterClause}
                    onDeleteFilterClause={controller.removeFilterClause}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  )
}
