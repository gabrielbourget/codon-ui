import { useContext, useId, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import type { View } from "react-native"
import { findNodeHandle, ScrollView, type ColorValue, type TextStyle } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyPolicy } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { getNativeControlRootStyle } from "../selection"
import { Text } from "../Text/Text"

import type { TNativeBreadcrumbItem } from "./model"

const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"] as const
const tokens = keys.flatMap((key) =>
  nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:")),
)

type TProps = {
  items: readonly TNativeBreadcrumbItem[]
  label: string
  style: TextStyle
  disabled: boolean
  onAction: (item: TNativeBreadcrumbItem) => void
}
export const NativeBreadcrumbOverflow = ({ items, label, style, disabled, onAction }: TProps) => {
  const scope = useContext(NativeFloatingScopeContext)
  const root = useRef<View>(null)
  const scroll = useRef<ScrollView>(null)
  const refs = useRef(new Map<string, View>())
  const frames = useRef(new Map<string, { y: number; height: number }>())
  const viewport = useRef(0),
    offset = useRef(0)
  const [targetTag, setTargetTag] = useState(0)
  const enabled = items.filter((item) => !item.disabled && !disabled)
  const [requested, setRequested] = useState<string | null>(() => enabled[0]?.id ?? null)
  const active = enabled.some((item) => item.id === requested) ? requested : (enabled[0]?.id ?? null)
  const [selected, setSelected] = useState<string | null>(null)
  const live = useRef(false)
  const identity = useId()
  const lifetime = JSON.stringify(items.map((item) => [item.id, item.href, item.content, item.disabled]))
  const search = useRef({ value: "", time: 0 })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const current = useRef({ items, active, scope, disabled, onAction })
  useInsertionEffect(() => {
    current.current = { items, active, scope, disabled, onAction }
  })
  useLayoutEffect(() => {
    if (requested !== active) setRequested(active)
    if (selected !== null && !items.some((item) => item.id === selected)) setSelected(null)
    search.current = { value: "", time: 0 }
  }, [lifetime])
  const admitted = () => live.current && !current.current.disabled && current.current.scope?.canAct() !== false
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
    let retired = false
    const frame = requestAnimationFrame(() => {
      if (retired || !admitted() || current.current.active !== active) return
      const target = active === null ? root.current : refs.current.get(active)
      if (active !== null) reveal(active)
      if (target) focusNativeTarget(target)
    })
    return () => {
      retired = true
      cancelAnimationFrame(frame)
    }
  }, [active, scope, lifetime])
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
    setRequested(available[next].id)
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
  const typed = (event: TNativeKeyboardEvent, item: TNativeBreadcrumbItem) => {
    const data = event.nativeEvent
    if (!admitted() || item.disabled || data.cancelled || data.repeat) return
    if (data.key === " ") {
      setSelected((value) => (value === item.id ? null : item.id))
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
    if (match) setRequested(match.id)
  }
  return (
    <NativeFocusView
      ref={root}
      role="radiogroup"
      accessible={active === null}
      accessibilityLabel={label}
      focusable={active === null}
      onLayout={() => setTargetTag(findNodeHandle(root.current) ?? 0)}
      testID="breadcrumb-overflow-list"
    >
      <ScrollView
        ref={scroll}
        testID="breadcrumb-overflow-scroll"
        style={{ flexShrink: 1 }}
        contentContainerStyle={style}
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
          <NativeBreadcrumbOption
            key={item.id}
            item={item}
            disabled={disabled || item.disabled}
            selected={item.id === selected}
            focused={item.id === active}
            setRef={(target) => {
              if (target) refs.current.set(item.id, target)
              else refs.current.delete(item.id)
            }}
            onLayout={(frame) => frames.current.set(item.id, frame)}
            onFocus={() => {
              setRequested(item.id)
              reveal(item.id)
            }}
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
              )
                current.current.onAction(item)
            }}
          />
        ))}
      </ScrollView>
    </NativeFocusView>
  )
}
const NativeBreadcrumbOption = ({
  item,
  disabled,
  selected,
  focused,
  setRef,
  onLayout,
  onFocus,
  onKeyDown,
  onAction,
}: {
  item: TNativeBreadcrumbItem
  disabled: boolean
  selected: boolean
  focused: boolean
  setRef: (view: View | null) => void
  onLayout: (frame: { y: number; height: number }) => void
  onFocus: () => void
  onKeyDown: (event: TNativeKeyboardEvent) => void
  onAction: (event: TNativePressEvent) => void
}) => {
  const theme = useNativeTheme()
  const [pressed, setPressed] = useState(false),
    [hovered, setHovered] = useState(false),
    [nativeFocused, setNativeFocused] = useState(false),
    [visible, setVisible] = useState(false)
  const foreground: ColorValue = selected ? theme.colors.controlSelectedForeground : theme.colors.controlForeground
  const style = getNativeControlRootStyle(
    "Breadcrumbs option",
    {
      justifyContent: "center",
      padding: theme.spacing.unit * 2,
      borderRadius: theme.radius.rounded,
      backgroundColor: selected
        ? theme.colors.controlSelectedBackground
        : pressed
          ? theme.colors.controlPressedBackground
          : hovered
            ? theme.colors.controlHoverBackground
            : theme.colors.controlBackground,
      opacity: disabled ? theme.opacity.disabled : 1,
      ...(nativeFocused && visible
        ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 }
        : {}),
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
      accessibilityLabel={item.content}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      tabIndex={focused && !disabled ? 0 : -1}
      style={style}
      onLayout={(event) => onLayout(event.nativeEvent.layout)}
      onFocus={() => {
        setNativeFocused(true)
        onFocus()
      }}
      onBlur={() => setNativeFocused(false)}
      onFocusVisibilityChange={setVisible}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPressCancel={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onHoverCancel={() => setHovered(false)}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.nativeEvent.key === " ") event.preventDefault()
      }}
      onPress={onAction}
      testID={`breadcrumb-option-${item.id}`}
    >
      <Text selectable={false} color={foreground}>
        {item.content}
      </Text>
    </NativePressable>
  )
}
