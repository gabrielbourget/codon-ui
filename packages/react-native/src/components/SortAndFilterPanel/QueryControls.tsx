import { forwardRef, useContext, useInsertionEffect, useRef } from "react"
import { View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeTooltipTrigger } from "../../overlays/floating/NativeTooltipTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { FormField } from "../FormField/FormField"
import { Select } from "../Select/Select"
import type { TNativeSelectRef } from "../Select/types"
import type { TAvailableSortCriteria } from "../Table/filterMetadata"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableSortInstruction,
} from "../Table/queryTypes"
import { Tag } from "../TagGroup/Tag"
import { TagGroup } from "../TagGroup/TagGroup"
import { Text } from "../Text/Text"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"
import { Tooltip } from "../Tooltip/Tooltip"

import type { TQueryControlLabels } from "./controlLabels"
import { QueryGlyph } from "./glyphs"

type TAvailability = { canAct?: () => boolean }

const useControlRequest = <T extends TAvailability>(props: T, delegatesAdmission = false) => {
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const live = useRef(false)
  const current = useRef({ props, scope, windowActive, input })
  useInsertionEffect(() => {
    current.current = { props, scope, windowActive, input }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  return <A extends unknown[]>(request: (owner: T, ...args: A) => void) =>
    (...args: A) => {
      const latest = current.current
      if (
        !live.current ||
        (!delegatesAdmission &&
          (latest.scope?.canAct() === false ||
            latest.windowActive?.() === false ||
            latest.input?.isWindowActive() === false)) ||
        latest.props.canAct?.() === false
      )
        return
      request(latest.props, ...args)
    }
}

export type TQuerySortEntryProps = TAvailability & {
  parameter: TTableSortInstruction
  availableSortCriteria: TAvailableSortCriteria[]
  labels: TQueryControlLabels["sortEntry"]
  onModifySortParameter: (args: { sortCriteriaID: string; listItemID: string }) => void
  onSortAscending: (id: string) => void
  onSortDescending: (id: string) => void
  onDeleteSortParameter: (id: string) => void
}

export const QuerySortEntry = (props: TQuerySortEntryProps) => {
  const { parameter, labels } = props
  const theme = useNativeTheme()
  const request = useControlRequest(props)
  const ascending = parameter.sortDirection === TABLE_SORT_DIRECTION__ASCENDING
  const descending = parameter.sortDirection === TABLE_SORT_DIRECTION__DESCENDING
  const primary = theme.actions.primary.background
  return (
    <View
      testID="query-sort-entry"
      style={{
        width: "100%",
        padding: theme.spacing.unit * 2,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.unit,
        backgroundColor: theme.colors.controlHoverBackground,
        borderRadius: theme.radius.rounded,
      }}
    >
      <QueryGlyph kind="grip" size={10} color={theme.colors.foreground} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }}>
        <Text>{parameter.criteriaName}</Text>
      </View>
      <View
        accessible={false}
        accessibilityLabel={labels.controlsGroupAriaLabel}
        style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }}
      >
        <Button
          aria-label={labels.sortAscendingButtonAriaLabel}
          accessibilityState={{ checked: ascending }}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          hoverColor={primary}
          onPress={request((owner) => {
            if (owner.parameter.sortDirection !== TABLE_SORT_DIRECTION__ASCENDING)
              owner.onSortAscending(owner.parameter.id)
          })}
        >
          <QueryGlyph kind="ascending" color={ascending ? primary : theme.colors.foreground} />
        </Button>
        <Button
          aria-label={labels.sortDescendingButtonAriaLabel}
          accessibilityState={{ checked: descending }}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          hoverColor={primary}
          onPress={request((owner) => {
            if (owner.parameter.sortDirection !== TABLE_SORT_DIRECTION__DESCENDING)
              owner.onSortDescending(owner.parameter.id)
          })}
        >
          <QueryGlyph kind="descending" color={descending ? primary : theme.colors.foreground} />
        </Button>
        <Button
          aria-label={labels.deleteButtonAriaLabel}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          hoverColor={primary}
          onPress={request((owner) => owner.onDeleteSortParameter(owner.parameter.id))}
        >
          <QueryGlyph kind="delete" color={theme.colors.foreground} />
        </Button>
      </View>
    </View>
  )
}

export type TQuerySortCriteriaFieldProps = TAvailability & {
  availableSortCriteria: TAvailableSortCriteria[]
  labels: TQueryControlLabels["form"]
  closeLabel: string
  onAddSortParameter: (id: string) => void
}
export const QuerySortCriteriaField = forwardRef<TNativeSelectRef, TQuerySortCriteriaFieldProps>((props, ref) => {
  // Select admits changes from its own native window while the parent window is inactive.
  const request = useControlRequest(props, true)
  return (
    <FormField label={props.labels.addSortCriteriaLabel}>
      <Select
        ref={ref}
        accessibilityLabel={props.labels.addSortCriteriaLabel}
        closeLabel={props.closeLabel}
        items={props.availableSortCriteria}
        getKey={(item) => item.id}
        getTextValue={(item) => item.name}
        value={null}
        placeholder={props.labels.addSortCriteriaPlaceholder}
        width="100%"
        onChange={request((owner, key: string | number | null) => {
          if (typeof key === "string" && owner.availableSortCriteria.some((item) => item.id === key))
            owner.onAddSortParameter(key)
        })}
      />
    </FormField>
  )
})
QuerySortCriteriaField.displayName = "QuerySortCriteriaField"

export type TQueryActiveSortsProps = TAvailability & {
  sortParameterList: TTableSortInstruction[]
  labels: TQueryControlLabels["activeSorts"]
  onDeleteSortParameter: (id: string) => void
}
export const QueryActiveSorts = (props: TQueryActiveSortsProps) => {
  const theme = useNativeTheme()
  const request = useControlRequest(props)
  return (
    <View
      testID="query-active-sorts"
      style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.unit }}
    >
      <Text variant="b10">{props.labels.headingLabel}</Text>
      {props.sortParameterList.length === 0 ? (
        <PlaceholderText>{props.labels.noSortsFallback}</PlaceholderText>
      ) : (
        <TagGroup
          accessibilityLabel={props.labels.activeSortsAriaLabel}
          items={props.sortParameterList}
          getKey={(item) => item.id}
          selectionMode="none"
          onRemove={(keys) => {
            for (const key of keys)
              request((owner) => {
                if (typeof key === "string" && owner.sortParameterList.some((item) => item.id === key))
                  owner.onDeleteSortParameter(key)
              })()
          }}
        >
          {(item) => (
            <Tag
              id={item.id}
              color={theme.actions.primary.background}
              geometry="round"
              textValue={item.criteriaName}
              customStyles={{ borderWidth: 0 }}
            >
              <Text variant="b11">{item.criteriaName}</Text>
            </Tag>
          )}
        </TagGroup>
      )}
    </View>
  )
}

export type TQueryPanelHeaderProps = TAvailability & {
  title: string
  labels: TQueryControlLabels["header"]
  onCloseSortAndFilterPanel: () => void
}
export const QueryPanelHeader = (props: TQueryPanelHeaderProps) => {
  const theme = useNativeTheme()
  const request = useControlRequest(props)
  return (
    <View
      testID="query-panel-header"
      style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
    >
      <View
        style={{
          padding: theme.spacing.unit,
          borderRadius: theme.radius.rounded,
          backgroundColor: theme.colors.controlHoverBackground,
        }}
      >
        <Text variant="b8" fontWeight="bold">
          {props.title}
        </Text>
      </View>
      <NativeTooltipTrigger
        delay={1000}
        trigger={({ triggerProps }) => (
          <Button
            {...triggerProps}
            aria-label={props.labels.closeButtonAriaLabel}
            raised={false}
            raisedOnHover
            color={theme.colors.background}
            customStyles={{ aspectRatio: 1, padding: 4 }}
            geometry="round"
            hoverColor={theme.actions.primary.background}
            onPress={request((owner) => owner.onCloseSortAndFilterPanel())}
          >
            <QueryGlyph kind="close" size={20} color={theme.colors.foreground} />
          </Button>
        )}
      >
        <Tooltip descriptionLabel={props.labels.closeButtonAriaLabel}>
          <Text>{props.labels.closeButtonAriaLabel}</Text>
        </Tooltip>
      </NativeTooltipTrigger>
    </View>
  )
}

export type TQueryPanelFooterProps = TAvailability & {
  labels: TQueryControlLabels["footer"]
  onClearAllSortAndFilterParameters: () => void
  onCancelPendingChanges: () => void
  onApplyPendingChanges: () => void
}
export const QueryPanelFooter = (props: TQueryPanelFooterProps) => {
  const theme = useNativeTheme()
  const request = useControlRequest(props)
  const textStyle = { borderBottomWidth: 1, borderBottomColor: theme.actions.primary.background, paddingBottom: 2 }
  return (
    <View
      testID="query-panel-footer"
      style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
    >
      <Button
        transparent
        geometry="rounded"
        raised={false}
        onPress={request((owner) => owner.onClearAllSortAndFilterParameters())}
      >
        <Text variant="b10" color={theme.actions.primary.background} customStyles={textStyle}>
          {props.labels.clearAllButton}
        </Text>
      </Button>
      <View style={{ flexDirection: "row", gap: theme.spacing.unit * 2, alignItems: "center" }}>
        <Button
          transparent
          geometry="rounded"
          raised={false}
          onPress={request((owner) => owner.onCancelPendingChanges())}
        >
          <Text variant="b10" color={theme.actions.primary.background} customStyles={textStyle}>
            {props.labels.cancelButton}
          </Text>
        </Button>
        <Button
          geometry="rounded"
          raised={false}
          order="primary"
          onPress={request((owner) => owner.onApplyPendingChanges())}
        >
          <Text variant="b10" fontWeight="bold">
            {props.labels.applyButton}
          </Text>
        </Button>
      </View>
    </View>
  )
}
