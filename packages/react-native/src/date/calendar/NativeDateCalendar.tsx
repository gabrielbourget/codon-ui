import { createCalendar, type CalendarDate } from "@internationalized/date"
import {
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { findNodeHandle, Text, View, type GestureResponderEvent } from "react-native"
import { useCalendarState } from "react-stately/useCalendarState"
import { useRangeCalendarState } from "react-stately/useRangeCalendarState"

import { NativeButton } from "../../components/Button/Button"
import { useNativeContentContext } from "../../components/NativeContentContext"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { NativeDatePickerChevron } from "../picker/icons"
import type { TNativeDatePickerOptions } from "../picker/NativeDatePickerView"

import { Owner, type TCalendarOwner, type TCalendarProps } from "./context"
import { type TNativeCalendarState } from "./keys"
import { pointer } from "./NativeCalendarDay"
import { Month } from "./NativeCalendarMonth"
import { NativeCalendarRangeGesture } from "./rangeGesture"
import { calendarStrings, nativeCalendarSelection, nativeCalendarTitle } from "./semantics"
import { NativeCalendarTargets } from "./targets"
import { useNativeCalendarPointers } from "./useCalendarPointers"
const noSubscription = () => () => {},
  zero = () => 0
let calendarOwnerRevisions = 0
const CalendarView = ({ state, ...props }: TCalendarProps & { state: TNativeCalendarState }) => {
  const root = useRef<View | null>(null),
    previous = useRef<View | null>(null),
    next = useRef<View | null>(null),
    observedFocus = useRef(false)
  const [navigationFocus, setNavigationFocus] = useState<"previous" | "next" | null>(null)
  useLayoutEffect(() => {
    if (
      (navigationFocus === "previous" && state.isPreviousVisibleRangeInvalid()) ||
      (navigationFocus === "next" && state.isNextVisibleRangeInvalid())
    )
      state.setFocused(true)
  }, [navigationFocus, state.isPreviousVisibleRangeInvalid(), state.isNextVisibleRangeInvalid()])
  const inherited = useNativeContentContext()
  const scope = useNativeKeyScope(),
    floating = useContext(NativeFloatingScopeContext),
    window = useContext(NativeFloatingWindowContext)
  useSyncExternalStore(scope?.subscribe ?? noSubscription, scope?.snapshot ?? zero, zero)
  const session = scope?.acknowledgedSession(),
    sessionKey = JSON.stringify([session?.windowId, session?.epoch])
  const live = useRef(false),
    latest = useRef({ state, props, scope, floating, window, sessionKey })
  useInsertionEffect(() => {
    latest.current = { state, props, scope, floating, window, sessionKey }
  })
  const canAct = useCallback(
    () =>
      live.current &&
      latest.current.scope?.isWindowActive() !== false &&
      latest.current.floating?.canAct() !== false &&
      latest.current.window?.() !== false,
    [],
  )
  const [targets] = useState(() => new NativeCalendarTargets())
  const request = useCallback(
    (date: CalendarDate, run: (state: TNativeCalendarState) => void) => {
      const target = targets.forDate(date)
      target?.request(() => {
        if (canAct()) run(latest.current.state)
      })
    },
    [targets, canAct],
  )
  const value = props.options.state.value
  const valueSignature =
    value && "start" in value ? `${value.start?.toString() ?? ""}/${value.end?.toString() ?? ""}` : value?.toString()
  const revision = useMemo(
    () => `calendar-owner:${++calendarOwnerRevisions}`,
    [
      sessionKey,
      valueSignature,
      props.options.props.minValue?.toString(),
      props.options.props.maxValue?.toString(),
      props.options.props.isDisabled,
      props.options.props.isReadOnly,
      props.options.locale,
      props.options.props.isDateUnavailable,
    ],
  )
  const revisionRef = useRef(revision)
  useInsertionEffect(() => {
    revisionRef.current = revision
  })
  const [gesture] = useState(() =>
    "anchorDate" in state
      ? new NativeCalendarRangeGesture(() => ({
          state: latest.current.state as ReturnType<typeof useRangeCalendarState>,
          revision: revisionRef.current,
          canAct,
          admit: (date, run) =>
            request(date, (current) => {
              if ("anchorDate" in current) run(current)
            }),
        }))
      : null,
  )
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      gesture?.cancel()
    }
  }, [gesture])
  useLayoutEffect(() => {
    gesture?.cancel()
  }, [gesture, revision])
  useLayoutEffect(() => {
    if (!canAct()) gesture?.cancel()
  })
  const pointers = useNativeCalendarPointers({
    root,
    state,
    revision,
    canAct,
    focusObserved: () => observedFocus.current,
    gesture,
    request,
  })
  useLayoutEffect(() => {
    const releases = [previous, next].map((ref) =>
      ref.current ? pointers.register(ref.current, null, canAct) : () => {},
    )
    return () => releases.forEach((release) => release())
  }, [pointers.register, canAct])
  const owner: TCalendarOwner = { ...props, state, targets, gesture, canAct, request, pointers }
  const title = nativeCalendarTitle(state, props.options.locale),
    selected = nativeCalendarSelection(state, props.options.locale),
    strings = calendarStrings(props.options.locale)
  const months = (props.options.props.multiMonth ?? !props.options.range) ? 2 : 1
  const receiveEnd = (event: GestureResponderEvent) => {
    if (pointers.available || !gesture || gesture.currentPointer()?.type !== "touch") return
    const touch = event.nativeEvent.changedTouches?.[0] ?? event.nativeEvent
    const originalSession = latest.current.sessionKey
    void targets.hit(touch.pageX, touch.pageY).then((date) => {
      if (canAct() && latest.current.sessionKey === originalSession)
        gesture.up(date, { id: touch.identifier, type: "touch" })
    })
  }
  const receiveMove = (event: GestureResponderEvent) => {
    if (pointers.available || !gesture || !("isDragging" in state) || !state.isDragging) return
    const touch = event.nativeEvent.changedTouches?.[0] ?? event.nativeEvent
    const originalSession = latest.current.sessionKey
    void targets.hit(touch.pageX, touch.pageY).then((date) => {
      if (date && canAct() && latest.current.sessionKey === originalSession)
        gesture.enter(date, { id: touch.identifier, type: "touch" })
    })
  }
  return (
    <Owner.Provider value={owner}>
      <NativeFocusHost
        ref={root}
        nativeFocusWithinObservation
        nativeOnFocusWithin={(event) => {
          observedFocus.current = event.nativeEvent.within
          if (!event.nativeEvent.within) state.setFocused(false)
        }}
        nativeOnFocusWithinRetired={() => {
          observedFocus.current = false
          if (live.current) state.setFocused(false)
        }}
        role="application"
        testID={`${props.testID}-calendar`}
        accessible={false}
        focusable={false}
        accessibilityLabel={props.labels.calendarAriaLabel}
        style={{ direction: props.options.direction, ...props.appearance.calendar }}
        {...{
          onTouchMoveCapture: receiveMove,
          onTouchEndCapture: receiveEnd,
          onTouchCancelCapture: () => gesture?.cancel(),
        }}
        onPointerUp={(event) => {
          const native = event.nativeEvent,
            observed = pointer(event)
          if (pointers.available || observed.type === "touch") return
          void targets.hit(native.clientX, native.clientY).then((date) => {
            if (canAct()) gesture?.up(date, observed)
          })
        }}
        onPointerCancel={() => gesture?.cancel()}
      >
        <View style={props.appearance.top}>
          <NativeButton
            ref={previous}
            onFocus={(event) => {
              if (canAct() && event.nativeEvent.target === findNodeHandle(previous.current))
                setNavigationFocus("previous")
            }}
            onBlur={() => setNavigationFocus((value) => (value === "previous" ? null : value))}
            raised={false}
            slot={null}
            isDisabled={state.isDisabled || state.isPreviousVisibleRangeInvalid()}
            accessibilityLabel={strings.format("previous")}
            customStyles={props.appearance.previous}
            onPress={() => {
              if (canAct()) state.focusPreviousPage()
            }}
            testID={`${props.testID}-prev-btn`}
          >
            <NativeDatePickerChevron />
          </NativeButton>
          <Text
            accessibilityRole="header"
            style={{ ...inherited?.textStyle, color: inherited?.foregroundColor, ...props.appearance.heading }}
            testID={`${props.testID}-calendar-heading`}
          >
            {title}
          </Text>
          <NativeButton
            ref={next}
            onFocus={(event) => {
              if (canAct() && event.nativeEvent.target === findNodeHandle(next.current)) setNavigationFocus("next")
            }}
            onBlur={() => setNavigationFocus((value) => (value === "next" ? null : value))}
            raised={false}
            slot={null}
            isDisabled={state.isDisabled || state.isNextVisibleRangeInvalid()}
            accessibilityLabel={strings.format("next")}
            customStyles={props.appearance.next}
            onPress={() => {
              if (canAct()) state.focusNextPage()
            }}
            testID={`${props.testID}-next-btn`}
          >
            <NativeDatePickerChevron next />
          </NativeButton>
        </View>
        <View style={props.appearance.months}>
          {Array.from({ length: months }, (_, offset) => (
            <Month key={offset} owner={owner} start={state.visibleRange.start.add({ months: offset })} />
          ))}
        </View>
        <Text
          accessibilityLiveRegion="polite"
          accessible={false}
          style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
        >
          {selected || title}
        </Text>
      </NativeFocusHost>
    </Owner.Provider>
  )
}
const SingleCalendar = (
  props: TCalendarProps & { options: Extract<TNativeDatePickerOptions, { range: false }> & TCalendarProps["options"] },
) => {
  const { options } = props,
    p = options.props
  const state = useCalendarState({
    minValue: p.minValue,
    maxValue: p.maxValue,
    isDateUnavailable: p.isDateUnavailable,
    isDisabled: p.isDisabled,
    isReadOnly: p.isReadOnly,
    firstDayOfWeek: p.firstDayOfWeek,
    pageBehavior: p.pageBehavior,

    locale: options.locale,
    createCalendar,
    value: options.state.dateValue,
    onChange: options.state.setDateValue,
    visibleDuration: { months: (p.multiMonth ?? true) ? 2 : 1 },
    defaultFocusedValue: p.placeholderValue ?? undefined,
    isInvalid: options.state.isInvalid,
    autoFocus: true,
  })
  return <CalendarView {...props} state={state} />
}
const RangeCalendar = (
  props: TCalendarProps & { options: Extract<TNativeDatePickerOptions, { range: true }> & TCalendarProps["options"] },
) => {
  const { options } = props,
    p = options.props,
    value = options.state.dateRange
  const state = useRangeCalendarState({
    allowsNonContiguousRanges: p.allowsNonContiguousRanges,
    minValue: p.minValue,
    maxValue: p.maxValue,
    isDateUnavailable: p.isDateUnavailable,
    isDisabled: p.isDisabled,
    isReadOnly: p.isReadOnly,
    firstDayOfWeek: p.firstDayOfWeek,
    pageBehavior: p.pageBehavior,

    locale: options.locale,
    createCalendar,
    value: value?.start && value?.end ? { start: value.start, end: value.end } : null,
    onChange: options.state.setDateRange,
    visibleDuration: { months: (p.multiMonth ?? false) ? 2 : 1 },
    defaultFocusedValue: p.placeholderValue ?? undefined,
    isInvalid: options.state.isInvalid,
    autoFocus: true,
  })
  return <CalendarView {...props} state={state} />
}
export const NativeDateCalendar = (props: TCalendarProps) =>
  props.options.range ? (
    <RangeCalendar {...props} options={props.options} />
  ) : (
    <SingleCalendar {...props} options={props.options} />
  )
