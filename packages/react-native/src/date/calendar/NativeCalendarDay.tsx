import { type CalendarDate } from "@internationalized/date"
import { useCallback, useContext, useInsertionEffect, useLayoutEffect, useRef } from "react"
import type { View } from "react-native"
import { findNodeHandle, type GestureResponderEvent, type PointerEvent } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import { NativeButton } from "../../components/Button/Button"
import { resolveNativeStyle } from "../../components/colors"
import { useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import { focusNativeTarget, getNativeFocusedTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeTargetKeyPolicy } from "../../input/NativeTargetKeyPolicy"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"

import { Grid, Owner } from "./context"
import { NativeCalendarDayHost } from "./DayHost"
import { nativeCalendarKeyCommand, preventNativeCalendarKey, NATIVE_CALENDAR_NAVIGATION_KEYS } from "./keys"
import { activateNativeRangeCalendarDay, type TNativeCalendarPointer } from "./rangeGesture"
import { nativeCalendarDaySemantics } from "./semantics"

const pressOrigin = (event: TNativePressEvent) =>
  "kind" in event.nativeEvent ? (event.nativeEvent.kind === "keyboard" ? "keyboard" : "virtual") : "touch"
export const pointer = (event: PointerEvent): TNativeCalendarPointer => ({
  id: event.nativeEvent.pointerId,
  type: event.nativeEvent.pointerType as TNativeCalendarPointer["type"],
})
type TDayProps = { id: string; date: CalendarDate; row: number; column: number; outside: boolean }
export const Day = createNativeCollectionLeaf<object, TDayProps, View>("cell", (props, _ref, node) => {
  const owner = useContext(Owner)!,
    grid = useContext(Grid)!,
    actions = useContext(NativeCollectionActionsContext)!
  const inherited = useNativeContentContext()
  const target = useRef<View | null>(null),
    current = useRef({ owner, node })
  useInsertionEffect(() => {
    current.current = { owner, node }
  })
  const active = useCallback(
    () => current.current.owner.canAct() && !!actions.bindingFor(current.current.node),
    [actions],
  )
  const request = useCallback(
    (run: () => void) => {
      const original = target.current,
        tag = original && findNodeHandle(original),
        candidate = current.current.node
      if (!active() || !tag) return
      actions.request(candidate, tag, () => {
        if (active() && target.current === original && current.current.node === candidate) run()
      })
    },
    [actions, active],
  )
  useLayoutEffect(() => {
    const entry = { date: props.date, outsideMonth: props.outside, original: () => target.current, active, request }
    const remove = owner.targets.add(entry)
    const pointerRelease = target.current ? owner.pointers.register(target.current, entry, active) : () => {}
    return () => {
      pointerRelease()
      remove()
    }
  }, [owner.targets, owner.pointers.register, props.date, props.outside, active, request])
  const binding = actions.bindingFor(node)
  const semantics = nativeCalendarDaySemantics(owner.state, props.date, owner.options.locale, props.outside),
    styles = splitNativeTextStyle(owner.appearance.day)
  useLayoutEffect(() => {
    if (
      binding &&
      semantics.focused &&
      owner.state.isFocused &&
      active() &&
      getNativeFocusedTarget() !== target.current
    )
      focusNativeTarget(target.current)
  }, [binding, semantics.focused, owner.state.isFocused, active, node])
  useLayoutEffect(() => {
    if (binding && active() && !props.outside && owner.state.focusedDate.compare(props.date) === 0) {
      const original = target.current
      owner.initialFocusRef.current = original
      return () => {
        if (owner.initialFocusRef.current === original) owner.initialFocusRef.current = null
      }
    }
  }, [binding, active, props.outside, owner.state.focusedDate, props.date, owner.initialFocusRef])
  const select = (event: TNativePressEvent) => {
    const origin = pressOrigin(event)
    if (origin === "touch") return
    if ("anchorDate" in owner.state) {
      request(() => {
        const state = current.current.owner.state
        if ("anchorDate" in state) activateNativeRangeCalendarDay(state, props.date, origin)
      })
    } else
      request(() => {
        const state = current.current.owner.state
        if (
          !state.isReadOnly &&
          !state.isDisabled &&
          !state.isCellDisabled(props.date) &&
          !state.isCellUnavailable(props.date)
        ) {
          state.selectDate(props.date)
          state.setFocusedDate(props.date)
          state.setFocused(true)
        }
      })
  }
  const begin = (event: TNativePressEvent) => {
    if (owner.pointers.available || pressOrigin(event) !== "touch" || !owner.gesture || owner.gesture.currentPointer())
      return
    const touch =
      (event as GestureResponderEvent).nativeEvent.changedTouches?.[0] ?? (event as GestureResponderEvent).nativeEvent
    owner.gesture.down(props.date, { id: touch.identifier, type: "touch" })
  }
  const key = (event: TNativeKeyboardEvent) => {
    const owner = current.current.owner
    if (event.nativeEvent.key === "Enter" || event.nativeEvent.key === " ") return
    if (!active() || event.nativeEvent.phase !== "down" || event.nativeEvent.cancelled) return
    if (event.nativeEvent.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      request(() => {
        const currentOwner = current.current.owner
        nativeCalendarKeyCommand(currentOwner.state, event.nativeEvent, currentOwner.options.direction)?.()
        currentOwner.options.state.setOpen(false)
      })
      return
    }
    if (!nativeCalendarKeyCommand(owner.state, event.nativeEvent, owner.options.direction)) return
    preventNativeCalendarKey(event)
    request(() =>
      nativeCalendarKeyCommand(
        current.current.owner.state,
        event.nativeEvent,
        current.current.owner.options.direction,
      )?.(),
    )
  }
  return (
    <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(node)}>
      <NativeTargetKeyPolicy
        target={target}
        lifetimeKey={actions.bindingFor(node)}
        tokens={NATIVE_CALENDAR_NAVIGATION_KEYS.flatMap(nativeKeyTokens)}
        isEnabled={!!actions.bindingFor(node)}
        excludeEditable={false}
        excludeComposing
        canAct={active}
        onKey={key}
      />

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
                selected: semantics.selected,
                rowHeaderTargets: [],
                columnHeaderTargets: grid.headers.get(props.column) ? [grid.headers.get(props.column)] : [],
              })
            : ""
        }
      >
        <NativeButton
          ref={target}
          nativeRole="button"
          nativeProgrammaticFocusable
          nativeTabStop={!props.outside && owner.state.focusedDate.compare(props.date) === 0 && !semantics.disabled}
          isDisabled={semantics.disabled}
          nativeInteraction={!owner.state.isReadOnly && !semantics.unavailable}
          accessibilityLabel={semantics.label}
          accessibilityHint={semantics.prompt || undefined}
          accessibilityState={{ selected: semantics.selected }}
          aria-disabled={semantics.disabled || semantics.unavailable}
          aria-invalid={semantics.invalid}
          raised={false}
          enableFocusStyle
          geometry="orthogonal"
          onPressStart={begin}
          onPressUp={select}
          onKeyDown={key}
          onPointerDown={(event) => {
            if (!owner.pointers.available && active() && event.nativeEvent.pointerType !== "touch")
              owner.gesture?.down(props.date, pointer(event))
          }}
          onPointerEnter={(event) => {
            if (active()) owner.gesture?.enter(props.date, pointer(event))
          }}
          onFocus={(event) => {
            if (event.nativeEvent.target === findNodeHandle(target.current) && active()) {
              owner.state.setFocusedDate(props.date)
              owner.state.setFocused(true)
            }
          }}
          nativeRender={(native) => (
            <NativeCalendarDayHost
              {...native}
              onResponderTerminate={(event) => {
                native.onResponderTerminate?.(event)
                current.current.owner.gesture?.cancel()
              }}
              onResponderTerminationRequest={(event) =>
                current.current.owner.gesture?.currentPointer()?.type === "touch" &&
                "isDragging" in current.current.owner.state &&
                current.current.owner.state.isDragging
                  ? false
                  : (native.onResponderTerminationRequest?.(event) ?? true)
              }
              onKeyDown={(event) => {
                native.onKeyDown?.(event)
              }}
            />
          )}
          nativeStyle={(flags) => ({
            viewStyle: {
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              ...styles.view,
              ...(props.outside ? { opacity: owner.appearance.outsideOpacity } : {}),
              ...(flags.isHovered
                ? { backgroundColor: owner.appearance.hover, boxShadow: owner.appearance.shadow }
                : {}),
              ...(semantics.selected ? { backgroundColor: owner.appearance.selected, borderRadius: 0 } : {}),
              ...(semantics.boundary ? { backgroundColor: owner.appearance.boundary, borderRadius: 3 } : {}),
              ...(flags.isFocused && !props.outside
                ? { outlineWidth: 1.5, outlineColor: owner.appearance.focusColor }
                : {}),
              ...resolveNativeStyle(
                owner.options.props.customCalendarGridBodyCellStyles,
                "DatePicker",
                "customCalendarGridBodyCellStyles",
              ),
            },
            textStyle: { ...inherited?.textStyle, ...styles.text },
            foregroundColor: styles.text.color ?? inherited?.foregroundColor ?? "#171717",
            target: 0,
          })}
          testID={`${owner.testID}-day-${props.date.toString()}`}
        >
          {new Intl.NumberFormat(owner.options.locale, { useGrouping: false }).format(props.date.day)}
        </NativeButton>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
})
