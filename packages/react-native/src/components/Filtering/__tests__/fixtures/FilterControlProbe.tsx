import { useState } from "react"
import { ScrollView, View } from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
import { useNativeQueryDraftController, type TNativeQueryApplyRequest } from "../../../SortAndFilterPanel/controller"
import type { TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import { BooleanFilterArgument } from "../../BooleanArgument"
import { ComboBoxFilterArgument } from "../../ComboBoxArgument"
import { FilterClauseSelectors } from "../../FilterClauseSelectors"
import { ListFilterArgument } from "../../ListArgument"
import { computeFilterArgumentType } from "../../metadata"
import { NumberFilterArgument } from "../../NumberArgument"
import { MultiSelectFilterArgument, SelectFilterArgument } from "../../OptionArguments"
import { RangeFilterArgument } from "../../RangeArgument"
import { TextFilterArgument } from "../../TextArgument"

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
    allowedOperationCodes: ["in", "equal"],
    availableCriteriaArguments: [
      { id: "alpha", name: "Alpha", argumentValue: false },
      { id: "beta", name: "Beta", argumentValue: 0 },
    ],
  },
  { id: "amount", name: "Amount", dataType: "number", allowedOperationCodes: ["equal", "between", "in"] },
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

// Nonshipping controls and non-temporal editors. Full row/dispatcher and date policy remain open.
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
              const change: Parameters<typeof SelectFilterArgument>[0]["onArgumentChange"] = ({
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
                  {kind === "Select" ? (
                    <SelectFilterArgument
                      argument={clause.argument}
                      filterArgumentSelectedKey={clause.filterArgumentSelectedKey ?? null}
                      availableFilterArguments={group.availableFilterArguments}
                      closeLabel="Close filter arguments"
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Multi Select" ? (
                    <MultiSelectFilterArgument
                      argument={clause.argument}
                      availableFilterArguments={group.availableFilterArguments}
                      inputLabel="Find filter arguments"
                      closeLabel="Close filter arguments"
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Input" && group.dataType === "text" ? (
                    <TextFilterArgument
                      argument={clause.argument}
                      filterArgumentAccessibleLabel={`Filter ${group.criteriaName}`}
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Input" && group.dataType === "number" ? (
                    <NumberFilterArgument
                      argument={clause.argument}
                      incrementLabel="Increase argument"
                      decrementLabel="Decrease argument"
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Boolean" ? (
                    <BooleanFilterArgument
                      argument={clause.argument}
                      booleanArgumentComponent="Checkbox"
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Range" && (group.dataType === "text" || group.dataType === "number") ? (
                    <RangeFilterArgument
                      dataType={group.dataType}
                      argument={clause.argument}
                      numberLabels={{
                        minimumIncrement: "Increase minimum",
                        minimumDecrement: "Decrease minimum",
                        maximumIncrement: "Increase maximum",
                        maximumDecrement: "Decrease maximum",
                      }}
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : kind === "Multi Input" ? (
                    <ListFilterArgument argument={clause.argument} canAct={() => open} onArgumentChange={change} />
                  ) : kind === "Combo Box" ? (
                    <ComboBoxFilterArgument
                      argument={clause.argument}
                      availableFilterArguments={group.availableFilterArguments}
                      filterArgumentSelectedKey={clause.filterArgumentSelectedKey}
                      inputLabel="Edit filter argument"
                      closeLabel="Close filter arguments"
                      canAct={() => open}
                      onArgumentChange={change}
                    />
                  ) : (
                    <Text>Argument renderer: {kind ?? "unset"}</Text>
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
