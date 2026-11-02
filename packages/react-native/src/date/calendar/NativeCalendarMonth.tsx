import {
  DateFormatter,
  getWeeksInMonth,
  startOfWeek,
  today,
  isSameMonth,
  type CalendarDate,
} from "@internationalized/date"
import { useCallback, useContext, useMemo, useState, type ComponentProps, type Ref } from "react"
import { findNodeHandle, Text, View, type ViewStyle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import {
  NativeCollectionBuilder,
  useNativeCollectionOwnerRef,
  createNativeCollectionBranch,
  createNativeCollectionLeaf,
} from "../../collection/CollectionBuilder"
import type { TNativeCollectionModelSnapshot } from "../../collection/model"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionItem, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import { NativeFocusHost } from "../../input/NativeFocusView"

import { Grid, Owner, type TCalendarOwner } from "./context"
import { Day } from "./NativeCalendarDay"

const Branch = createNativeCollectionBranch<object, { id: string; style?: ViewStyle }, View>(
  "item",
  (props, _ref, node) => {
    const renderer = useContext(NativeCollectionRendererContext),
      grid = useContext(Grid)!
    const inherited = useNativeContentContext()
    const style = splitNativeTextStyle(props.style ?? {})
    return (
      <View
        accessible={false}
        role="row"
        style={props.style ? style.view : { flexDirection: "row", alignItems: "stretch" }}
      >
        <NativeContentContext.Provider
          value={{
            foregroundColor: style.text.color ?? inherited?.foregroundColor ?? "#171717",
            isButton: false,
            textStyle: { ...inherited?.textStyle, ...style.text },
          }}
        >
          <renderer.CollectionBranch collection={grid.collection} parent={node} />
        </NativeContentContext.Provider>
      </View>
    )
  },
)
const Header = createNativeCollectionLeaf<object, { id: string; index: number; name: string }, View>(
  "column",
  (props) => {
    const owner = useContext(Owner)!,
      grid = useContext(Grid)!
    const bind = useCallback(
      (view: View | null) => {
        grid.registerHeader(props.index, view ? (findNodeHandle(view) ?? 0) : 0)
      },
      [grid.registerHeader, props.index],
    )
    const inherited = useNativeContentContext()
    const styles = splitNativeTextStyle(owner.appearance.headerCell)
    return (
      <NativeCollectionSemanticsContext.Provider
        value={
          grid.target
            ? JSON.stringify({
                kind: "cell",
                parentTarget: grid.target,
                rowIndex: 0,
                columnIndex: props.index,
                rowSpan: 1,
                columnSpan: 1,
                heading: true,
                selected: false,
                rowHeaderTargets: [],
                columnHeaderTargets: [],
              })
            : ""
        }
      >
        <NativeFocusHost
          ref={bind}
          role="columnheader"
          accessible
          style={{ flex: 1, alignItems: "center", ...styles.view }}
        >
          <Text style={{ ...inherited?.textStyle, color: inherited?.foregroundColor, ...styles.text }}>
            {props.name}
          </Text>
        </NativeFocusHost>
      </NativeCollectionSemanticsContext.Provider>
    )
  },
)
const Blank = createNativeCollectionLeaf<object, { id: string; row: number; column: number }, View>("cell", (props) => {
  const grid = useContext(Grid)!
  return (
    <NativeCollectionSemanticsContext.Provider
      value={
        grid.target
          ? JSON.stringify({
              kind: "cell",
              parentTarget: grid.target,
              rowIndex: props.row + 1,
              columnIndex: props.column,
              rowSpan: 1,
              columnSpan: 1,
              heading: false,
              selected: false,
              rowHeaderTargets: [],
              columnHeaderTargets: [],
            })
          : ""
      }
    >
      <NativeFocusHost accessible={false} focusable={false} style={{ flex: 1 }} />
    </NativeCollectionSemanticsContext.Provider>
  )
})
export const Month = ({ owner, start }: { owner: TCalendarOwner; start: CalendarDate }) => {
  const [target, setTarget] = useState(0),
    [headers, setHeaders] = useState(new Map<number, number>())
  const bind = useCallback((view: View | null) => setTarget(view ? (findNodeHandle(view) ?? 0) : 0), [])
  const registerHeader = useCallback(
    (index: number, value: number) =>
      setHeaders((previous) => {
        if (previous.get(index) === value) return previous
        const next = new Map(previous)
        if (value) next.set(index, value)
        else next.delete(index)
        return next
      }),
    [],
  )
  const weeks = getWeeksInMonth(start, owner.options.locale, owner.options.props.firstDayOfWeek)
  const monthSignature = `${start.calendar.identifier}:${start.toString()}:${owner.options.locale}:${owner.options.props.firstDayOfWeek ?? ""}`
  const dates = useMemo(
    () => Array.from({ length: weeks }, (_, index) => owner.state.getDatesInWeek(index, start)),
    [monthSignature, weeks],
  )
  const formatter = new DateFormatter(owner.options.locale, {
    weekday: owner.options.props.dayLength ?? "narrow",
    timeZone: owner.state.timeZone,
  })
  const weekStart = startOfWeek(today(owner.state.timeZone), owner.options.locale, owner.options.props.firstDayOfWeek)
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    formatter.format(weekStart.add({ days: index }).toDate(owner.state.timeZone)),
  )
  const headerStyle = JSON.stringify(owner.appearance.gridHeader),
    bodyStyle = JSON.stringify(owner.appearance.body)
  const items = useMemo<readonly TNativeCollectionItem<object>[]>(() => {
    const branch = (
      key: string,
      children: readonly TNativeCollectionItem<object>[],
      style?: ViewStyle,
    ): TNativeCollectionItem<object> => ({
      key,
      type: "item",
      value: undefined as unknown as object,
      textValue: "",
      rendered: null,
      props: { id: key, style },
      render: (node) => <Branch {...node.props} />,
      children,
    })
    return [
      branch(
        "header",
        [
          branch(
            "weekdays",
            weekdays.map((name, index) => ({
              key: `header:${index}`,
              type: "column",
              value: undefined as unknown as object,
              textValue: "",
              rendered: null,
              props: { id: `header:${index}`, index, name },
              render: (node) => <Header {...node.props} />,
            })),
          ),
        ],
        owner.appearance.gridHeader,
      ),
      branch(
        "body",
        dates.map((week, row) =>
          branch(
            `week:${row}`,
            week.map((date, column) => ({
              key: `${date ? "day" : "blank"}:${row}:${column}`,
              type: "cell",
              value: undefined as unknown as object,
              textValue: "",
              rendered: null,
              props: date
                ? { id: `day:${row}:${column}`, date, row, column, outside: !isSameMonth(date, start) }
                : { id: `blank:${row}:${column}`, row, column },
              render: (node) => (date ? <Day {...node.props} /> : <Blank {...node.props} />),
            })),
          ),
        ),
        owner.appearance.body,
      ),
    ]
  }, [dates, owner.options.locale, owner.options.props.dayLength, headerStyle, bodyStyle])
  return (
    <NativeCollectionBuilder<object> items={items}>
      {(collection, modelSnapshot) => (
        <Grid.Provider value={{ collection, target, headers, registerHeader }}>
          <NativeCollectionSemanticsContext.Provider
            value={
              target
                ? JSON.stringify({
                    kind: "root",
                    rowCount: weeks + 1,
                    columnCount: 7,
                    hierarchical: false,
                    selectionMode: "anchorDate" in owner.state ? "multiple" : "single",
                  })
                : ""
            }
          >
            <CalendarGrid
              modelSnapshot={modelSnapshot}
              forwardedRef={bind}
              nativeFocusWithinObservation
              nativeOnFocusWithin={(event) => {
                if (owner.canAct()) owner.state.setFocused(event.nativeEvent.within)
              }}
              nativeOnFocusWithinRetired={() => {
                if (owner.canAct()) owner.state.setFocused(false)
              }}
              role="grid"
              testID={`${owner.testID}-calendar-grid`}
              accessible={false}
              focusable={false}
              accessibilityLabel={owner.labels.calendarAriaLabel}
              accessibilityState={{ disabled: owner.state.isDisabled }}
              style={owner.appearance.grid}
            >
              <CollectionRows collection={collection} />
            </CalendarGrid>
          </NativeCollectionSemanticsContext.Provider>
        </Grid.Provider>
      )}
    </NativeCollectionBuilder>
  )
}
const CollectionRows = ({ collection }: { collection: TNativeCollectionSnapshot<object> }) => {
  const renderer = useContext(NativeCollectionRendererContext),
    actions = useContext(NativeCollectionActionsContext)!
  return (
    <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(null)}>
      <renderer.CollectionRoot collection={collection} />
    </NativeCollectionItemBindingContext.Provider>
  )
}

const CalendarGrid = ({
  modelSnapshot,
  forwardedRef,
  ...props
}: Omit<ComponentProps<typeof NativeFocusHost>, "ref"> & {
  modelSnapshot: TNativeCollectionModelSnapshot<object>
  forwardedRef: Ref<View>
}) => {
  const ref = useNativeCollectionOwnerRef(modelSnapshot, forwardedRef)
  return <NativeFocusHost {...props} ref={ref} />
}
