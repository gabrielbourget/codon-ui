import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { findNodeHandle, type View } from "react-native"

import { captureNativeFocusTarget, focusNativeContainer, focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost, type TNativeLocalKeyPolicy } from "../../input/NativeFocusView"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import { useNativeCollectionTabBoundary } from "../../input/nativeToolbarKeyboard"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { getNativeControlRootStyle } from "../selection"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../Tag/motion"

import { createTypeaheadResultsKeyboard } from "./resultsKeyboard"
import type { TNativeTypeaheadSearchKey, TTypeaheadEntry, TTypeaheadResultsProps } from "./types"

type TRowProps<T> = {
  entry: TTypeaheadEntry<T>
  selected: boolean
  children: ReactNode
  register: (key: string, node: View | null) => void
  activate: (key: string) => void
  move: (key: string, offset: number) => void
  focused: (key: string, active: boolean, keyboard?: boolean) => void
  tokens: readonly string[]
  tabStop: boolean
  lifetime: string
  keyDown: TNativeLocalKeyPolicy["onKey"]
  retire: () => void
}

const rowKeys = ["ArrowDown", "ArrowUp", "Home", "End", "PageUp", "PageDown", "Escape", "Enter", " "]
const resultKeyTokens = (keys: readonly string[]) => keys.flatMap(nativeKeyTokens)

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
  const [isFocused, setFocused] = useState(false)
  const [isHovered, setHovered] = useState(false)
  const selectedOnStart = useRef(false)
  const pressLifetime = useRef<string | null>(null)
  const theme = useNativeTheme()
  const highlighted = props.selected || isFocused || isHovered
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
    { isFocused, isHovered, isPressed: false, isDisabled: false, isReadOnly: false },
  )
  const reduced = useNativeTagReducedMotion()
  const rowTiming = resolveNativeTagTransition(theme.transitions?.backgroundColor, 250)
  const backgroundColor = useNativeTagColor(style.backgroundColor ?? "transparent", rowTiming, reduced, true).rendered
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: true }}>
      <NativePressable
        ref={register}
        testID="typeahead-search-item"
        accessible
        role="radio"
        accessibilityRole="radio"
        accessibilityState={{ checked: props.selected, disabled: false }}
        aria-checked={props.selected}
        focusable
        nativeTabStop={props.tabStop}
        nativeObservePressCohort
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onHoverCancel={() => setHovered(false)}
        onFocus={(event) => {
          if (!mounted.current) return
          setFocused(true)
          latest.current.focused(encoded, true, event?.nativeEvent.origin === "keyboard")
        }}
        onBlur={() => {
          if (!mounted.current) return
          setFocused(false)
          latest.current.focused(encoded, false)
          latest.current.retire()
        }}
        onPressIn={(_event, admission) => {
          selectedOnStart.current = false
          pressLifetime.current = latest.current.lifetime
          if (mounted.current && admission?.cohort === "mouse" && admission.isCurrent()) {
            selectedOnStart.current = true
            latest.current.activate(encoded)
          }
        }}
        onPressCancel={() => {
          selectedOnStart.current = false
          pressLifetime.current = null
        }}
        onPress={() => {
          if (
            mounted.current &&
            !selectedOnStart.current &&
            (pressLifetime.current === null || pressLifetime.current === latest.current.lifetime)
          )
            latest.current.activate(encoded)
          selectedOnStart.current = false
          pressLifetime.current = null
        }}
        nativeRender={(host) => (
          <NativeFocusHost
            {...host}
            onKeyDown={undefined}
            onKeyUp={undefined}
            nativeKeyPolicy={{
              tokens: props.tokens,
              isEnabled: true,
              lifetimeKey: props.lifetime,
              canAct: () => mounted.current,
              onKey: (event, frame) => latest.current.keyDown(event, frame),
              onRetire: () => latest.current.retire(),
            }}
          />
        )}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!mounted.current) return
          if (nativeEvent.actionName === "increment") latest.current.move(encoded, 1)
          else if (nativeEvent.actionName === "decrement") latest.current.move(encoded, -1)
        }}
        style={{ ...style, backgroundColor }}
      >
        {getNativeButtonContent(props.children, {
          color: foreground,
          fontSize: theme.typography.fontSizes.b10,
          flexShrink: 1,
        })}
      </NativePressable>
    </NativeContentContext.Provider>
  )
}

const NativeTypeaheadResultsImpl = <T extends object>(props: TTypeaheadResultsProps<T>) => {
  const theme = useNativeTheme()
  const scope = useNativeKeyScope()!
  const { locale } = useNativeLocale()
  const collator = useMemo(() => new Intl.Collator(locale, { usage: "search", sensitivity: "base" }), [locale])
  const signature = JSON.stringify([
    props.query,
    props.style,
    props.shouldFocusWrap,
    locale,
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
  const group = useRef<View>(null)
  const focused = useRef<string | null>(null)
  const [tabKey, setTabKey] = useState<string | null>(null)
  const tabExit = useRef<{ origin: string; edgeTarget: number } | null>(null)
  const focusActive = useRef(false)
  const tabEntry = useRef<{ backward: boolean; windowId: string; epoch: number } | null>(null)
  useEffect(() => {
    tabEntry.current = null
    tabExit.current = null
  }, [rendering.current.generation])
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
    const admitted = captureNativeFocusTarget(row)
    if (!admitted) return
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
          !admitted() ||
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
        focusNativeTarget(row)
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
  const clear = () => {
    if (!mounted.current || selection.current === null) return
    selection.current = null
    setSelected(null)
    latest.current.onSelectionChange?.(null)
  }
  const page = (key: string, direction: -1 | 1) => {
    const inputs = latest.current,
      content = inputs.content.current,
      scroll = inputs.scroll.current
    if (!content || !scroll || inputs.viewport.current.height <= 0) return
    const entries = inputs.entries,
      index = entries.findIndex((entry) => entry.encodedKey === key)
    if (index < 0) return
    const attempt = ++request.current,
      generation = rendering.current.generation
    const layout = inputs.viewport.current.generation
    const boxes = new Map<string, { y: number; height: number }>()
    let remaining = entries.length,
      failed = false
    for (const entry of entries) {
      const original = nodes.current.get(entry.encodedKey)
      if (!original) {
        failed = true
        continue
      }
      original.measureLayout(
        content,
        (_x, y, _width, height) => {
          if (
            nodes.current.get(entry.encodedKey) !== original ||
            !Number.isFinite(y) ||
            !Number.isFinite(height) ||
            height < 0
          )
            failed = true
          boxes.set(entry.encodedKey, { y, height })
          if (
            --remaining ||
            failed ||
            !mounted.current ||
            attempt !== request.current ||
            generation !== rendering.current.generation ||
            layout !== latest.current.viewport.current.generation ||
            latest.current.content.current !== content ||
            latest.current.scroll.current !== scroll
          )
            return
          const start = boxes.get(key)!,
            viewport = latest.current.viewport.current
          const edge =
            direction > 0
              ? Math.min(viewport.contentHeight || Infinity, start.y - start.height + viewport.height)
              : Math.max(0, start.y + start.height - viewport.height)
          let candidate = index
          while (
            direction > 0
              ? boxes.get(entries[candidate]!.encodedKey)!.y < edge
              : boxes.get(entries[candidate]!.encodedKey)!.y > edge
          ) {
            const next = candidate + direction
            if (next < 0 || next >= entries.length) break
            candidate = next
          }
          focus(entries[candidate]!.encodedKey)
        },
        () => {
          failed = true
        },
      )
    }
  }
  const keyboardOptions = useRef({ collator, focus, page, activate, clear })
  keyboardOptions.current = { collator, focus, page, activate, clear }
  const keyboard = useRef<ReturnType<typeof createTypeaheadResultsKeyboard<T>> | null>(null)
  keyboard.current ??= createTypeaheadResultsKeyboard({
    current: () => ({
      entries: latest.current.entries,
      wrap: latest.current.shouldFocusWrap,
      collator: keyboardOptions.current.collator,
      live: mounted.current,
    }),
    focus: (key) => keyboardOptions.current.focus(key),
    page: (key, direction) => keyboardOptions.current.page(key, direction),
    activate: (key) => keyboardOptions.current.activate(key),
    clear: () => keyboardOptions.current.clear(),
  })
  useEffect(() => () => keyboard.current?.dispose(), [])
  useNativeKeyboardObservation({
    isEnabled: true,
    lifetimeKey: `${rendering.current.generation}`,
    canAct: () => mounted.current && scope.isNativeReady(),
    onKeyDown: ({ nativeEvent: data }) => {
      tabEntry.current = null
      tabExit.current = null
      if (data.key !== "Tab" || data.defaultCaptured || data.isComposing || data.cancelled) return
      const inside = [...nodes.current.values(), group.current].some(
        (original) => original && findNodeHandle(original) === data.focusedTarget,
      )
      if (!inside) tabEntry.current = { backward: data.shiftKey, windowId: data.windowId, epoch: data.epoch }
    },
  })
  useEffect(
    () =>
      scope.subscribe(() => {
        const session = scope.acknowledgedSession()
        const entry = tabEntry.current
        if (
          !scope.isNativeReady() ||
          scope.lastInput()?.origin === "pointer" ||
          (entry && (entry.windowId !== session.windowId || entry.epoch !== session.epoch))
        ) {
          tabEntry.current = null
          tabExit.current = null
        }
      }),
    [scope],
  )
  const tabBoundary = useNativeCollectionTabBoundary({
    rootRef: group,
    enabled: true,
    lifetimeKey: `${rendering.current.generation}`,
    canAct: () => mounted.current && scope.isNativeReady(),
    receive: (data) => {
      if (data.disposition !== "tab" || data.phase !== "down" || data.cancelled || data.isComposing) return
      const key = data.physicalPath
        ?.map(
          (tag) =>
            latest.current.entries.find((entry) => {
              const original = nodes.current.get(entry.encodedKey)
              return original && findNodeHandle(original) === tag
            })?.encodedKey,
        )
        .find((key) => key !== undefined)
      if (key === undefined) return
      tabEntry.current = null
      tabExit.current = { origin: key, edgeTarget: data.requestedTarget }
      setTabKey(key)
    },
  })
  if (tabBoundary.error) throw new Error(`TypeaheadSearch results Tab boundary: ${tabBoundary.error}`)
  const entryKey = (keyboard: boolean) => {
    const entry = tabEntry.current
    tabEntry.current = null
    const session = scope.acknowledgedSession()
    if (
      !keyboard ||
      !entry ||
      !scope.isNativeReady() ||
      entry.windowId !== session.windowId ||
      entry.epoch !== session.epoch
    )
      return null
    return (
      latest.current.entries.find((item) => new Set([selection.current]).has(item.key))?.encodedKey ??
      (entry.backward ? latest.current.entries.at(-1)?.encodedKey : latest.current.entries[0]?.encodedKey) ??
      null
    )
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
    focused.current = null
    if (candidate && focusActive.current) focus(candidate.encodedKey)
    else if (!candidate && focusActive.current) focusNativeContainer(group.current)
  }, [props.entries])
  return (
    <NativeFocusHost
      {...tabBoundary.listenerProps}
      ref={group}
      testID="typeahead-search-results-list"
      accessible={false}
      focusable
      nativeTabStop={props.entries.length === 0}
      onFocus={(event) => {
        const destination = entryKey(event.nativeEvent.origin === "keyboard")
        focusActive.current = true
        if (destination) focus(destination)
      }}
      onBlur={() => {
        focusActive.current = false
        request.current++
        keyboard.current?.retire()
      }}
      nativeKeyPolicy={{
        tokens: resultKeyTokens([
          ...(props.entries.length ? ["ArrowDown", "ArrowUp", "Home", "End"] : []),
          ...(selected !== null ? ["Escape"] : []),
        ]).filter((token) => !token.startsWith("1") || (!token.endsWith(":Home") && !token.endsWith(":End"))),
        isEnabled: true,
        lifetimeKey: `${rendering.current.generation}`,
        canAct: () => mounted.current,
        onRetire: () => {
          request.current++
          keyboard.current?.retire()
        },
        onKey: (event, frame) => {
          if (frame.isComposing || event.nativeEvent.phase !== "down") return
          const entries = latest.current.entries
          const key = event.nativeEvent.key
          if (frame.admitted && key === "Escape") clear()
          else if (
            frame.admitted &&
            (key === "ArrowDown" || (key === "Home" && !event.nativeEvent.shiftKey)) &&
            entries.length
          )
            focus(entries[0]!.encodedKey)
          else if (
            frame.admitted &&
            (key === "ArrowUp" || (key === "End" && !event.nativeEvent.shiftKey)) &&
            entries.length
          )
            focus(entries[entries.length - 1]!.encodedKey)
          else if (entries.length) keyboard.current?.receive(entries[0]!.encodedKey, event.nativeEvent, false, false)
        },
      }}
      role="radiogroup"
      accessibilityLabel={props.label}
      style={props.style}
    >
      {props.entries.map((entry, index) => (
        <NativeTypeaheadRow
          key={entry.encodedKey}
          entry={entry}
          selected={new Set([selected]).has(entry.key)}
          register={register}
          activate={activate}
          move={move}
          tabStop={
            entry.encodedKey ===
            (props.entries.some((item) => item.encodedKey === tabKey)
              ? tabKey
              : (props.entries.find((item) => new Set([selected]).has(item.key))?.encodedKey ??
                props.entries[0]?.encodedKey))
          }
          lifetime={`${rendering.current.generation}`}
          tokens={resultKeyTokens(
            rowKeys.filter((key) =>
              key === "Escape"
                ? selected !== null
                : key === "ArrowUp"
                  ? props.shouldFocusWrap || index > 0
                  : key === "ArrowDown"
                    ? props.shouldFocusWrap || index < props.entries.length - 1
                    : true,
            ),
          )}
          keyDown={(event, frame) => {
            if (nodes.current.get(entry.encodedKey) !== event.currentTarget) return
            keyboard.current?.receive(entry.encodedKey, event.nativeEvent, frame.admitted === true, frame.isComposing)
          }}
          retire={() => {
            request.current++
            keyboard.current?.retire()
          }}
          focused={(key, active, keyboard = false) => {
            if (!mounted.current) return
            if (active) {
              const destination = entryKey(keyboard)
              if (focused.current === null && destination && destination !== key) focus(destination)
              focused.current = key
              const exit = tabExit.current
              const original = nodes.current.get(key)
              if (!exit || key === exit.origin || !original || findNodeHandle(original) !== exit.edgeTarget)
                setTabKey(key)
              focusActive.current = true
            } else if (focused.current === key) focusActive.current = false
          }}
        >
          {props.renderItem
            ? props.renderItem(entry.item, { query: props.query, textValue: entry.text, itemKey: entry.key })
            : entry.text}
        </NativeTypeaheadRow>
      ))}
    </NativeFocusHost>
  )
}

export const NativeTypeaheadResults = memo(NativeTypeaheadResultsImpl) as typeof NativeTypeaheadResultsImpl
