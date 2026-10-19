import { useState } from "react"
import { ScrollView, View } from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
import { useNativeQueryDraftController, type TNativeQueryApplyRequest } from "../../../SortAndFilterPanel/controller"
import type { TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import { FilterClauseSelectors } from "../../FilterClauseSelectors"
import { computeFilterArgumentType, computeFilterArgumentAccessibleLabel } from "../../metadata"
import {
  renderNonTemporalFilterArgumentInput,
  isNonTemporalFilterArgumentDataType,
  type TNonTemporalFilterArgumentContext,
} from "../../renderNonTemporalArgument"

const criteria: TAvailableFilterCriteria[] = [
  {
    id: "status",
    name: "Status",
    dataType: "text",
    usesSelectInput: true,
    allowedOperationCodes: ["equal", "in", "between"],
    availableCriteriaArguments: [
      { id: "", name: "False", argumentValue: false },
      { id: "zero", name: "Zero", argumentValue: 0 },
    ],
  },
  {
    id: "names",
    name: "Names",
    dataType: "text",
    allowedOperationCodes: ["in", "equal", "like", "similar-to"],
    availableCriteriaArguments: [
      { id: "alpha", name: "Alpha", argumentValue: false },
      { id: "beta", name: "Beta", argumentValue: 0 },
    ],
  },
  { id: "amount", name: "Amount", dataType: "number", allowedOperationCodes: ["equal", "between", "in"] },
  {
    id: "search",
    name: "Search labels",
    dataType: "text",
    usesTypeAheadInput: true,
    allowedOperationCodes: ["equal", "in"],
  },
  { id: "enabled", name: "Enabled", dataType: "boolean", allowedOperationCodes: ["equal", "not-equal"] },
  {
    id: "suggested",
    name: "Suggested",
    dataType: "text",
    usesComboBoxInput: true,
    allowedOperationCodes: ["equal"],
    availableCriteriaArguments: [{ id: "", name: "Alpha", argumentValue: false }],
  },
]
const initial = (): TNativeQueryApplyRequest => ({
  sortInstructions: [],
  filterGroups: [
    {
      id: "status",
      criteriaID: "status",
      criteriaName: "Status",
      dataType: "text",
      joinOperator: "and",
      clauses: [{ id: "status-clause", operationCode: "equal", argument: false }],
    },
    {
      id: "names",
      criteriaID: "names",
      criteriaName: "Names",
      dataType: "text",
      joinOperator: "or",
      clauses: [{ id: "names-clause", operationCode: "in", argument: ["Alpha"] }],
    },
  ],
})

// Nonshipping controls and non-temporal editors. The root wrapper, Card row and date policy remain open.
const FilterControlProbe = () => {
  const [confirmed, setConfirmed] = useState(initial)
  const [metadata, setMetadata] = useState(criteria)
  const [echo, setEcho] = useState(false)
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<"light" | "dark">("light")
  const [lastRequest, setLastRequest] = useState<TNativeQueryApplyRequest | null>(null)
  const [closeRequests, setCloseRequests] = useState(0)
  const controller = useNativeQueryDraftController({
    isOpen: open,
    activeSorts: confirmed.sortInstructions,
    activeFilters: confirmed.filterGroups,
    possibleSortCriteria: [],
    possibleFilterCriteria: metadata,
    applyPendingSortAndFilterChanges: (request) => {
      setLastRequest(request)
      if (echo) setConfirmed(request)
    },
    onOpenChange: () => setCloseRequests((count) => count + 1),
  })
  const reset = () => {
    setConfirmed(initial())
    setMetadata(criteria)
    setEcho(false)
    setOpen(true)
    setMode("light")
    setLastRequest(null)
    setCloseRequests(0)
  }
  return (
    <NativeThemeProvider mode={mode}>
      <NativeFloatingLayerHost>
        <ScrollView>
          <Text>Private filter controls</Text>
          <Text>
            Open {String(open)}; echo {String(echo)}; close requests {closeRequests}
          </Text>
          <Button onPress={() => setEcho((value) => !value)}>Toggle filter echo</Button>
          <Button onPress={() => setOpen((value) => !value)}>Toggle filter open</Button>
          <Button onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))}>
            Toggle filter theme
          </Button>
          <Button onPress={() => setMetadata(criteria.map((item) => ({ ...item, name: item.name + " refreshed" })))}>
            Refresh filter metadata
          </Button>
          {controller.draft.filterGroups.map((group) =>
            group.clauses.map((clause) => {
              const kind = computeFilterArgumentType(group, clause)
              const change: TNonTemporalFilterArgumentContext["onArgumentChange"] = ({
                argument,
                filterArgumentSelectedKey,
              }) =>
                controller.modifyFilterClause({
                  newCriteriaID: group.criteriaID,
                  updatedClause: {
                    ...clause,
                    argument: argument === null ? undefined : argument,
                    filterArgumentSelectedKey,
                  },
                })
              return (
                <View key={clause.id} testID={`filter-probe-${clause.id}`}>
                  <Text>{group.criteriaName}</Text>
                  <FilterClauseSelectors
                    group={group}
                    clause={clause}
                    availableFilterCriteria={metadata}
                    closeLabels={{
                      criteria: "Close filter criteria",
                      operation: "Close filter operation",
                      conditionType: "Close filter type",
                    }}
                    canAct={() => open}
                    onModifyFilterClause={controller.modifyFilterClause}
                    onDeleteFilterClause={controller.removeFilterClause}
                  />
                  {isNonTemporalFilterArgumentDataType(group.dataType) ? (
                    renderNonTemporalFilterArgumentInput({
                      dataType: group.dataType,
                      filterArgumentType: kind,
                      argument: clause.argument,
                      filterArgumentSelectedKey: clause.filterArgumentSelectedKey ?? null,
                      availableFilterArguments: group.availableFilterArguments,
                      filterArgumentAccessibleLabel: computeFilterArgumentAccessibleLabel({
                        criteriaName: group.criteriaName,
                        operationCode: clause.operationCode,
                      }),
                      booleanArgumentComponent: "Checkbox",
                      nativeLabels: {
                        number: { incrementLabel: "Increase argument", decrementLabel: "Decrease argument" },
                        range: {
                          minimumIncrement: "Increase minimum",
                          minimumDecrement: "Decrease minimum",
                          maximumIncrement: "Increase maximum",
                          maximumDecrement: "Decrease maximum",
                        },
                        options: { inputLabel: "Edit filter argument", closeLabel: "Close filter arguments" },
                      },
                      canAct: () => open,
                      onArgumentChange: change,
                    })
                  ) : (
                    <Text>
                      Unreceived temporal argument: {group.dataType} / {kind ?? "unset"}
                    </Text>
                  )}
                </View>
              )
            }),
          )}
          <Button onPress={controller.apply}>Apply filter draft</Button>
          <Button onPress={controller.cancel}>Cancel filter draft</Button>
          <Button onPress={controller.clear}>Clear filter draft</Button>
          <Button onPress={reset}>Reset filter probe</Button>
          <Text testID="native-filter-controls-proof">
            {JSON.stringify({ confirmed, draft: controller.draft, lastRequest })}
          </Text>
        </ScrollView>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}
export default FilterControlProbe
