import { useContext, useId, useInsertionEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { View } from "react-native"
import { findNodeHandle, ScrollView, type ColorValue, type TextStyle } from "react-native"

import { focusNativeTarget, getNativeFocusedTarget, subscribeNativeFocus } from "../input/focus"
import { nativeKeyTokens } from "../input/keyScope"
import { NativeFocusView } from "../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../input/NativeKeyboardScope"
import { NativePressable } from "../input/NativePressable"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../overlays/floating/scope"
import { useNativeTheme } from "../theme"

import { useNativeContentContext } from "./NativeContentContext"
import { splitNativeTextStyle } from "./nativeTextStyle"
import { getNativeControlRootStyle } from "./selection"
import { Text } from "./Text/Text"

export type TNativeOptionItem = Readonly<{
  id: string
  content: string
  disabled: boolean
  ariaLabel?: string
  href?: string
}>
const subscribeNone = () => () => {}
const zero = () => 0

const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"] as const
const tokens = keys.flatMap((key) =>
  nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:")),
)

type TProps<T extends TNativeOptionItem> = {
  items: readonly T[]
  label: string
  style: TextStyle
  disabled: boolean
  onAction?: (item: T) => void
  onSelectionChange?: (item: T | null) => void
  selectionOnly?: boolean
  autoFocus?: boolean
  prefix?: string
  getItemLifetime?: (item: T) => string | number | undefined
}
export const NativeOptionList = <T extends TNativeOptionItem>({
  items,
  label,
  style,
  disabled,
  onAction,
  onSelectionChange,
  selectionOnly = false,
  autoFocus = true,
  prefix = "breadcrumb",
  getItemLifetime,
}: TProps<T>) => {
  const scope = useContext(NativeFloatingScopeContext)
  const theme = useNativeTheme()
  const window = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  useSyncExternalStore(input?.subscribe ?? subscribeNone, input?.snapshot ?? zero, zero)
  const inputReady = input?.isNativeReady() ?? true
  const session = JSON.stringify(input?.acknowledgedSession())
  const listStyle = splitNativeTextStyle(style)
  const { boxShadow, shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation, ...contentStyle } =
    listStyle.view
  const root = useRef<View>(null)
  const scroll = useRef<ScrollView>(null)
  const refs = useRef(new Map<string, View>())
  const refSetters = useRef(new Map<string, (target: View | null) => void>())
  const refFor = (id: string) => {
    let setter = refSetters.current.get(id)
    if (!setter) {
      setter = (target) => {
        if (target) refs.current.set(id, target)
        else refs.current.delete(id)
      }
      refSetters.current.set(id, setter)
    }
    return setter
  }
  const frames = useRef(new Map<string, { y: number; height: number }>())
  const viewport = useRef(0),
    offset = useRef(0)
  const [targetTag, setTargetTag] = useState(0)
  const enabled = items.filter((item) => !item.disabled && !disabled)
  const [requested, setRequested] = useState<string | null>(() => enabled[0]?.id ?? null)
  const previousOrder = useRef(items.map((item) => item.id))
  const previousIndex = requested === null ? -1 : previousOrder.current.indexOf(requested)
  const recovered =
    previousIndex < 0
      ? undefined
      : [
          ...previousOrder.current.slice(previousIndex + 1),
          ...previousOrder.current.slice(0, previousIndex).reverse(),
        ].find((id) => enabled.some((item) => item.id === id))
  const active = enabled.some((item) => item.id === requested) ? requested : (recovered ?? enabled[0]?.id ?? null)
  useInsertionEffect(() => {
    if (requested === active || requested === null) previousOrder.current = items.map((item) => item.id)
  })
  const [focusIntent, setFocusIntent] = useState(0)
  const issuedFocus = useRef<{ key: string | null; target: View; session: string; intent: number } | null>(null)
  const observedFocus = useRef<{ key: string; session: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const selectedValue = useRef<string | null>(null)
  const live = useRef(false)
  const identity = useId()
  const lifetime = JSON.stringify(items.map((item) => [item.id, getItemLifetime?.(item), item.content, item.disabled]))
  const search = useRef({ value: "", time: 0 })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const current = useRef({
    items,
    active,
    scope,
    window,
    input,
    disabled,
    onAction,
    onSelectionChange,
    selectionOnly,
    lifetime,
  })
  useInsertionEffect(() => {
    current.current = {
      items,
      active,
      scope,
      window,
      input,
      disabled,
      onAction,
      onSelectionChange,
      selectionOnly,
      lifetime,
    }
  })
  useLayoutEffect(() => {
    for (const id of refSetters.current.keys())
      if (!items.some((item) => item.id === id)) {
        refSetters.current.delete(id)
        frames.current.delete(id)
      }
    if (requested !== active) setRequested(active)
    if (selected !== null && !items.some((item) => item.id === selected)) {
      selectedValue.current = null
      setSelected(null)
    }
    search.current = { value: "", time: 0 }
  }, [lifetime])
  const admitted = () =>
    live.current &&
    !current.current.disabled &&
    current.current.scope?.canAct() !== false &&
    current.current.window?.() !== false &&
    current.current.input?.isWindowActive() !== false
  const request = (id: string) => {
    setRequested(id)
    setFocusIntent((value) => value + 1)
  }
  const focusWithin = useSyncExternalStore(
    subscribeNativeFocus,
    () => {
      const target = getNativeFocusedTarget()
      return target !== null && (target === root.current || [...refs.current.values()].some((view) => view === target))
    },
    () => false,
  )
  const reveal = (id: string) => {
    const frame = frames.current.get(id)
    if (!frame || viewport.current <= 0) return
    const next =
      frame.y < offset.current
        ? frame.y
        : frame.y + frame.height > offset.current + viewport.current
          ? frame.y + frame.height - viewport.current
          : offset.current
    if (next !== offset.current) scroll.current?.scrollTo({ y: Math.max(0, next), animated: false })
  }
  useLayoutEffect(() => {
    if (!inputReady || !admitted()) return
    const prior = issuedFocus.current
    const recovering =
      observedFocus.current !== null &&
      observedFocus.current.session === session &&
      observedFocus.current.key !== active
    const intended = focusIntent !== (prior?.intent ?? 0)
    if (!(autoFocus && (prior === null || prior.session !== session)) && !recovering && !intended) return
    let retired = false
    const frame = requestAnimationFrame(() => {
      if (
        retired ||
        !admitted() ||
        current.current.input?.isNativeReady() === false ||
        JSON.stringify(current.current.input?.acknowledgedSession()) !== session ||
        current.current.lifetime !== lifetime ||
        current.current.active !== active
      )
        return
      const target = active === null ? root.current : refs.current.get(active)
      if (active !== null) reveal(active)
      if (target && focusNativeTarget(target))
        issuedFocus.current = { key: active, target, session, intent: focusIntent }
    })
    return () => {
      retired = true
      cancelAnimationFrame(frame)
    }
  }, [active, scope, lifetime, inputReady, session, autoFocus, focusIntent])
  const select = (item: T) => {
    const next = selectedValue.current === item.id ? null : item.id
    selectedValue.current = next
    setSelected(next)
    current.current.onSelectionChange?.(next === null ? null : item)
  }
  const move = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      !admitted() ||
      data.phase !== "down" ||
      data.cancelled ||
      !data.nativeDefaultHandled ||
      data.altKey ||
      data.ctrlKey ||
      data.metaKey
    )
      return
    const available = current.current.items.filter((item) => !item.disabled)
    if (!available.length) return
    const nativeTarget =
      "focusedTarget" in data && typeof data.focusedTarget === "number" ? data.focusedTarget : undefined
    const actual =
      nativeTarget === undefined
        ? undefined
        : available.find((item) => findNodeHandle(refs.current.get(item.id) ?? null) === nativeTarget)?.id
    if (actual === undefined) return
    const index = available.findIndex((item) => item.id === actual)
    let next = index
    if (data.key === "Home") next = 0
    else if (data.key === "End") next = available.length - 1
    else if (data.key === "ArrowDown") next = (index + 1) % available.length
    else if (data.key === "ArrowUp") next = (index - 1 + available.length) % available.length
    else if (data.key === "PageDown" || data.key === "PageUp") {
      const frame = frames.current.get(actual)
      if (!frame || viewport.current <= 0) return
      const destination =
        data.key === "PageDown"
          ? frame.y - frame.height + viewport.current
          : Math.max(0, frame.y + frame.height - viewport.current)
      if (data.key === "PageDown") {
        while (next < available.length - 1 && (frames.current.get(available[next].id)?.y ?? Infinity) < destination)
          next++
      } else {
        while (next > 0 && (frames.current.get(available[next].id)?.y ?? -Infinity) > destination) next--
      }
    } else return
    request(available[next].id)
  }
  useNativeKeyPolicy({
    tokens,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !!targetTag && !disabled && scope?.canAct() !== false,
    targetTag,
    lifetimeKey: `${identity}:${lifetime}`,
    canAct: admitted,
    onKey: move,
  })
  const typed = (event: TNativeKeyboardEvent, item: T) => {
    const data = event.nativeEvent
    if (!admitted() || item.disabled || data.cancelled || data.repeat) return
    if (data.key === " " || (selectionOnly && data.key === "Enter")) {
      if (!item.href) select(item)
      return
    }
    if (data.altKey || data.ctrlKey || data.metaKey || [...data.key].length !== 1) return
    const now = data.timestamp
    const prior = now - search.current.time < 1000 ? search.current.value : ""
    const value = prior && [...prior].every((char) => char === data.key) ? data.key : prior + data.key
    search.current = { value, time: now }
    const fold = (text: string) =>
      text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
    const options = current.current.items.filter((candidate) => !candidate.disabled)
    const index = options.findIndex((candidate) => candidate.id === item.id)
    const ordered = [...options.slice(index + 1), ...options.slice(0, index + 1)]
    const collator =
      typeof Intl.Collator === "function"
        ? new Intl.Collator(undefined, { usage: "search", sensitivity: "base" })
        : null
    const match = ordered.find((candidate) =>
      collator
        ? collator.compare(candidate.content.slice(0, value.length), value) === 0
        : fold(candidate.content).startsWith(fold(value)),
    )
    if (match) request(match.id)
  }
  return (
    <NativeFocusView
      ref={root}
      role="radiogroup"
      accessible={active === null}
      accessibilityLabel={label}
      focusable={active === null}
      style={[
        {
          boxShadow,
          shadowColor,
          shadowOffset,
          shadowOpacity,
          shadowRadius,
          elevation,
          borderRadius: listStyle.view.borderRadius,
        },
        focusWithin ? { outlineWidth: 1.5, outlineOffset: 1.5, outlineColor: theme.colors.focusRing } : undefined,
      ]}
      onLayout={() => setTargetTag(findNodeHandle(root.current) ?? 0)}
      testID={`${prefix}-overflow-list`}
    >
      <ScrollView
        ref={scroll}
        testID={`${prefix}-overflow-scroll`}
        style={{ flexShrink: 1 }}
        contentContainerStyle={contentStyle}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="always"
      >
        {items.map((item) => (
          <NativeOption
            key={item.id}
            item={item}
            prefix={prefix}
            selectionOnly={selectionOnly}
            textStyle={listStyle.text}
            disabled={disabled || item.disabled}
            selected={item.id === selected}
            focused={item.id === active}
            setRef={refFor(item.id)}
            onLayout={(frame) => {
              if (live.current && current.current.items.includes(item)) frames.current.set(item.id, frame)
            }}
            onFocus={() => {
              observedFocus.current = { key: item.id, session }
              setRequested(item.id)
              reveal(item.id)
            }}
            onBlur={() => {
              if (observedFocus.current?.key === item.id) observedFocus.current = null
            }}
            onRequestFocus={() => request(item.id)}
            onKeyDown={(event) => typed(event, item)}
            onAction={(event) => {
              if (
                admitted() &&
                !item.disabled &&
                !(
                  "kind" in event.nativeEvent &&
                  event.nativeEvent.kind === "keyboard" &&
                  event.nativeEvent.key !== "Enter"
                )
              ) {
                if (current.current.selectionOnly || (!item.href && selectedValue.current !== null)) {
                  if ("kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard") return
                  select(item)
                } else current.current.onAction?.(item)
              }
            }}
          />
        ))}
      </ScrollView>
    </NativeFocusView>
  )
}
const NativeOption = ({
  item,
  prefix,
  selectionOnly,
  textStyle,
  disabled,
  selected,
  focused,
  setRef,
  onLayout,
  onFocus,
  onBlur,
  onRequestFocus,
  onKeyDown,
  onAction,
}: {
  item: TNativeOptionItem
  prefix: string
  selectionOnly: boolean
  textStyle: TextStyle
  disabled: boolean
  selected: boolean
  focused: boolean
  setRef: (view: View | null) => void
  onLayout: (frame: { y: number; height: number }) => void
  onFocus: () => void
  onBlur: () => void
  onRequestFocus: () => void
  onKeyDown: (event: TNativeKeyboardEvent) => void
  onAction: (event: TNativePressEvent) => void
}) => {
  const theme = useNativeTheme()
  const inherited = useNativeContentContext()
  const [hovered, setHovered] = useState(false),
    [nativeFocused, setNativeFocused] = useState(false)
  const foreground: ColorValue = inherited?.foregroundColor ?? theme.colors.foreground
  const style = getNativeControlRootStyle(
    "Breadcrumbs option",
    {
      justifyContent: "center",
      padding: theme.spacing.unit,
      minHeight: 20,
      width: "100%",
      borderRadius: theme.radius.rounded,
      backgroundColor: selected || nativeFocused || hovered ? theme.colors.controlHoverBackground : "transparent",
      opacity: disabled ? theme.opacity.disabled : 1,
    },
    undefined,
    undefined,
    {},
  )
  return (
    <NativePressable
      ref={setRef}
      accessible
      role="radio"
      accessibilityRole="radio"
      accessibilityLabel={item.ariaLabel ?? item.content}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      tabIndex={focused && !disabled ? 0 : -1}
      style={style}
      onLayout={(event) => onLayout(event.nativeEvent.layout)}
      onFocus={() => {
        setNativeFocused(true)
        onFocus()
      }}
      onBlur={() => {
        setNativeFocused(false)
        onBlur()
      }}
      onPressIn={onRequestFocus}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onHoverCancel={() => setHovered(false)}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.nativeEvent.key === " " || (selectionOnly && event.nativeEvent.key === "Enter"))
          event.preventDefault()
      }}
      onPress={onAction}
      testID={`${prefix}-option-${item.id}`}
    >
      <Text selectable={false} style={[{ color: foreground }, textStyle]}>
        {item.content}
      </Text>
    </NativePressable>
  )
}
