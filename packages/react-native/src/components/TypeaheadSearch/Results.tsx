import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { getNativeControlRootStyle, useNativeSelectionInteraction } from "../selection"

import type { TNativeTypeaheadSearchKey, TTypeaheadEntry, TTypeaheadResultsProps } from "./types"

type TRowProps<T> = {
  entry: TTypeaheadEntry<T>
  selected: boolean
  children: ReactNode
  register: (key: string, node: View | null) => void
  activate: (key: string) => void
  move: (key: string, offset: number) => void
  focused: (key: string, active: boolean) => void
}

const NativeTypeaheadRow = <T,>(props: TRowProps<T>) => {
  const latest = useRef(props)
  latest.current = props
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const encoded = props.entry.encodedKey
  const register = useCallback((node: View | null) => latest.current.register(encoded, node), [encoded])
  const interaction = useNativeSelectionInteraction(
    {
      onPress: () => {
        if (mounted.current) latest.current.activate(encoded)
      },
      onFocus: () => {
        if (mounted.current) latest.current.focused(encoded, true)
      },
      onBlur: () => {
        if (mounted.current) latest.current.focused(encoded, false)
      },
    },
    false,
    false,
    () => undefined,
  )
  const theme = useNativeTheme()
  const highlighted = props.selected || interaction.flags.isFocused || interaction.flags.isHovered
  const foreground = useNativeContentContext()?.foregroundColor ?? theme.colors.controlForeground
  const style = getNativeControlRootStyle(
    "TypeaheadSearch row",
    {
      width: "100%",
      justifyContent: "center",
      padding: theme.spacing.unit,
      borderRadius: theme.radius.rounded,
      backgroundColor: highlighted ? theme.colors.controlHoverBackground : "transparent",
    },
    undefined,
    undefined,
    interaction.flags,
  )
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: true }}>
      <Pressable
        {...interaction.handlers}
        ref={register}
        testID="typeahead-search-item"
        accessible
        role="radio"
        accessibilityRole="radio"
        accessibilityState={{ checked: props.selected, disabled: false }}
        aria-checked={props.selected}
        focusable
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!mounted.current) return
          if (nativeEvent.actionName === "increment") latest.current.move(encoded, 1)
          else if (nativeEvent.actionName === "decrement") latest.current.move(encoded, -1)
        }}
        style={style}
      >
        {getNativeButtonContent(props.children, {
          color: foreground,
          fontSize: theme.typography.fontSizes.b10,
          flexShrink: 1,
        })}
      </Pressable>
    </NativeContentContext.Provider>
  )
}

export const NativeTypeaheadResults = <T extends object>(props: TTypeaheadResultsProps<T>) => {
  const theme = useNativeTheme()
  const signature = JSON.stringify([
    props.query,
    props.style,
    props.shouldFocusWrap,
    theme.spacing.unit,
    theme.radius.rounded,
    theme.typography.fontSizes.b10,
    theme.typography.fontFamilies.body,
    theme.typography.fontWeights.regular,
    theme.typography.lineHeight,
  ])
  const rendering = useRef({ signature, entries: props.entries, renderItem: props.renderItem, generation: 0 })
  const previousRendering = rendering.current
  const sameEntries =
    previousRendering.entries.length === props.entries.length &&
    props.entries.every((entry, index) => {
      const old = previousRendering.entries[index]
      return (
        old.encodedKey === entry.encodedKey && old.text === entry.text && (!props.renderItem || old.item === entry.item)
      )
    })
  if (signature !== previousRendering.signature || props.renderItem !== previousRendering.renderItem || !sameEntries)
    rendering.current = {
      signature,
      entries: props.entries,
      renderItem: props.renderItem,
      generation: previousRendering.generation + 1,
    }
  const [selected, setSelected] = useState<TNativeTypeaheadSearchKey | null>(null)
  const selection = useRef(selected)
  const latest = useRef(props)
  latest.current = props
  const mounted = useRef(true)
  const nodes = useRef(new Map<string, View>())
  const focused = useRef<string | null>(null)
  const focusActive = useRef(false)
  const request = useRef(0)
  const previous = useRef(props.entries)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current++
    }
  }, [])
  const register = useCallback((key: string, node: View | null) => {
    if (node) nodes.current.set(key, node)
    else nodes.current.delete(key)
  }, [])
  const focus = (key: string) => {
    const attempt = ++request.current
    const inputs = latest.current
    const renderGeneration = rendering.current.generation
    const row = nodes.current.get(key)
    const content = inputs.content.current
    const scroll = inputs.scroll.current
    const layoutGeneration = inputs.viewport.current.generation
    if (!row || !content || !scroll) return
    row.measureLayout(
      content,
      (_x, y, _width, height) => {
        if (
          !mounted.current ||
          attempt !== request.current ||
          rendering.current.generation !== renderGeneration ||
          nodes.current.get(key) !== row ||
          latest.current.content.current !== content ||
          latest.current.scroll.current !== scroll ||
          latest.current.viewport.current.generation !== layoutGeneration ||
          !Number.isFinite(y) ||
          !Number.isFinite(height) ||
          height < 0
        )
          return
        const viewport = latest.current.viewport.current
        let offset = viewport.offset
        if (viewport.height <= 0 || y < offset) offset = Math.max(0, y)
        else if (y + height > offset + viewport.height) offset = y + height - viewport.height
        if (viewport.contentHeight > 0 && viewport.height > 0)
          offset = Math.min(offset, Math.max(0, viewport.contentHeight - viewport.height))
        if (offset !== viewport.offset) scroll.scrollTo({ y: offset, animated: false })
        focused.current = key
        row.focus()
      },
      () => undefined,
    )
  }
  const activate = (key: string) => {
    if (!mounted.current) return
    const entry = latest.current.entries.find((candidate) => candidate.encodedKey === key)
    if (!entry) return
    const next = new Set([selection.current]).has(entry.key) ? null : Array.from(new Set([entry.key]))[0]
    selection.current = next
    setSelected(next)
    latest.current.onSelectionChange?.(next)
  }
  const move = (key: string, offset: number) => {
    if (!mounted.current) return
    const current = latest.current
    const index = current.entries.findIndex((entry) => entry.encodedKey === key)
    if (index < 0 || current.entries.length < 2) return
    const next = index + offset
    if (!current.shouldFocusWrap && (next < 0 || next >= current.entries.length)) return
    focus(current.entries[(next + current.entries.length) % current.entries.length].encodedKey)
  }
  useEffect(() => {
    const oldEntries = previous.current
    previous.current = props.entries
    const key = focused.current
    if (key === null || props.entries.some((entry) => entry.encodedKey === key)) return
    const index = oldEntries.findIndex((entry) => entry.encodedKey === key)
    const present = new Set(props.entries.map((entry) => entry.encodedKey))
    const candidate = [...oldEntries.slice(index + 1), ...oldEntries.slice(0, Math.max(index, 0)).reverse()].find(
      (entry) => present.has(entry.encodedKey),
    )
    focused.current = candidate?.encodedKey ?? null
    if (candidate && focusActive.current) focus(candidate.encodedKey)
  }, [props.entries])
  return (
    <View
      testID="typeahead-search-results-list"
      accessible={false}
      role="radiogroup"
      accessibilityLabel={props.label}
      style={props.style}
    >
      {props.entries.map((entry) => (
        <NativeTypeaheadRow
          key={entry.encodedKey}
          entry={entry}
          selected={new Set([selected]).has(entry.key)}
          register={register}
          activate={activate}
          move={move}
          focused={(key, active) => {
            if (!mounted.current) return
            if (active) {
              focused.current = key
              focusActive.current = true
            } else if (focused.current === key) focusActive.current = false
          }}
        >
          {props.renderItem
            ? props.renderItem(entry.item, { query: props.query, textValue: entry.text, itemKey: entry.key })
            : entry.text}
        </NativeTypeaheadRow>
      ))}
    </View>
  )
}
