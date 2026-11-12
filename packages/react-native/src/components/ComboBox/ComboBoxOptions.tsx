import { useContext, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  findNodeHandle,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
  type GestureResponderEvent,
  type ViewToken,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useNativeCollectionRefs } from "../../collection/context"
import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import { NativeTargetKeyPolicy } from "../../input/NativeTargetKeyPolicy"
import { useNativeCollectionTabBoundary } from "../../input/nativeToolbarKeyboard"
import { NativeOrdinaryEditorKeysContext } from "../../input/ordinaryEditorKeys"
import { createNativeOriginalEditorEnterAdapter } from "../../input/originalEditorEnterPolicy"
import { useNativeOriginalEditorKeyPolicy } from "../../input/originalEditorKeyPolicy"
import type { TNativePressEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import type { TNativeCollectionEntry } from "../collection"
import { NativeInput as Input } from "../Input/Input"
import { useNativeInputBorder } from "../Input/motion"
import { ListBoxItem } from "../ListBoxItem/ListBoxItem"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import type { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxKey, TNativeComboBoxProps } from "./types"

type TComboBoxOptionsProps<T> = {
  props: TNativeComboBoxProps<T>
  entries: TNativeCollectionEntry<T>[]
  selectedKey: TNativeComboBoxKey | null
  disabledKeys: Set<string>
  identity: string
  query: string
  styles: ReturnType<typeof getNativeComboBoxStyles<T>>
  active: () => boolean
  focus: (focused: boolean) => void
  change: (query: string) => void
  close: () => void
  activate: (key: TNativeComboBoxKey) => void
  revert: () => void
  strategy: "first" | "last" | "selected"
  closeFromTab: (requestClose: boolean) => void
}

const isGesturePress = (event: TNativePressEvent): event is GestureResponderEvent => !("kind" in event.nativeEvent)

export const ComboBoxOptions = <T,>({
  props,
  entries,
  selectedKey,
  disabledKeys,
  identity,
  query,
  styles,
  active,
  focus,
  change,
  close,
  activate,
  revert,
  strategy,
  closeFromTab,
}: TComboBoxOptionsProps<T>) => {
  const { onKeyDown: _onKeyDown, onKeyUp: _onKeyUp, ...inputProps } = props.inputProps ?? {}
  const theme = useNativeTheme()
  const scope = useNativeKeyScope()!
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const editorRef = useRef<TextInput | null>(null)
  const [originalEditor, setOriginalEditor] = useState<TextInput | null>(null)
  const editorBinding = useNativeCollectionRefs<TextInput>(editorRef, setOriginalEditor)
  const publishedEditor = useRef<{
    target: TextInput
    owner: typeof props.inputRef
    release: () => void
  } | null>(null)
  useLayoutEffect(() => {
    const target = editorRef.current
    const published = publishedEditor.current
    if (published && published.target === target && published.owner === props.inputRef) return
    publishedEditor.current = null
    published?.release()
    if (!target || !props.inputRef) return
    const owner = props.inputRef
    let release: () => void
    if (typeof owner === "function") {
      const cleanup = owner(target)
      release = typeof cleanup === "function" ? cleanup : () => owner(null)
    } else {
      owner.current = target
      release = () => {
        owner.current = null
      }
    }
    // Stock TextInput replays its ref effect on event counts; publish committed host identity.
    publishedEditor.current = { target, owner, release }
  }, [originalEditor, props.inputRef])
  useLayoutEffect(
    () => () => {
      const published = publishedEditor.current
      publishedEditor.current = null
      published?.release()
    },
    [],
  )
  const list = useRef<FlatList<TNativeCollectionEntry<T>>>(null)
  const root = useRef<View | null>(null)
  const closeButton = useRef<View | null>(null)
  const rows = useRef(new Map<string, View>())
  const targets = useRef(new Map<string, { current: View | null }>())
  const bindings = useRef(new Map<string, (target: View | null) => void>())
  const held = useRef(new Set<number>())
  const targetFor = (key: string) => {
    if (!targets.current.has(key)) targets.current.set(key, { current: null })
    return targets.current.get(key)!
  }
  const bindRow = (key: string) => {
    if (!bindings.current.has(key)) {
      const target = targetFor(key)
      bindings.current.set(key, (receiver) => {
        target.current = receiver
        if (receiver) rows.current.set(key, receiver)
        else rows.current.delete(key)
      })
    }
    return bindings.current.get(key)!
  }
  const visible = useRef(new Set<string>())
  const metrics = useRef({ height: 0, offset: 0 })
  const measuredRows = useRef(new Set<string>())
  const position = useRef<{
    key: string
    physical: boolean
    revision: string
    window: string
    attempts: number
    waitingAfter?: number
  } | null>(null)
  const signature = JSON.stringify(
    entries.map((entry) => [entry.encodedKey, entry.text, disabledKeys.has(entry.encodedKey)]),
  )
  const sequence = useRef(0)
  const revision = useMemo(
    () => String(++sequence.current),
    [props.items, signature, props.isDisabled, props.isReadOnly],
  )
  const [highlighted, setHighlighted] = useState<string | null>(() => {
    const enabled = entries.filter((entry) => !disabledKeys.has(entry.encodedKey))
    return (
      (strategy === "last"
        ? enabled.at(-1)
        : strategy === "first"
          ? enabled[0]
          : enabled.find((entry) => entry.key === selectedKey)
      )?.encodedKey ?? null
    )
  })
  const editorHighlight = useRef(highlighted)
  const current = useRef({
    props,
    entries,
    disabledKeys,
    active,
    change,
    activate,
    revert,
    closeFromTab,
    highlighted,
    query,
    scope,
    registry,
    originalEditor,
    revision,
    live: true,
  })
  useInsertionEffect(() => {
    current.current = {
      props,
      entries,
      disabledKeys,
      active,
      change,
      activate,
      revert,
      closeFromTab,
      highlighted,
      query,
      scope,
      registry,
      originalEditor,
      revision,
      live: true,
    }
  })
  useInsertionEffect(
    () => () => {
      current.current.live = false
    },
    [],
  )
  const canAct = () =>
    current.current.live &&
    current.current.active() &&
    !current.current.props.isDisabled &&
    current.current.scope.isWindowActive() === true
  const enabled = () => current.current.entries.filter((entry) => !current.current.disabledKeys.has(entry.encodedKey))
  const selectHighlight = (key: string | null, physical = false) => {
    if (!canAct()) return
    page.current = null
    measurement.current++
    const index = current.current.entries.findIndex((entry) => entry.encodedKey === key)
    if (key !== null && (index < 0 || current.current.disabledKeys.has(key))) return
    setHighlighted(key)
    if (!physical) editorHighlight.current = key
    current.current.highlighted = key
    position.current = key
      ? { key, physical, revision: current.current.revision, window: windowIdentity(), attempts: 0 }
      : null
    positionHighlight()
  }
  const commit = (tab = false) => {
    if (!canAct()) return
    const owner = current.current
    if (tab) owner.closeFromTab(false)
    if (!owner.props.isReadOnly) {
      const entry =
        enabled().find((entry) => entry.encodedKey === owner.highlighted) ??
        enabled().find((entry) => entry.text === owner.query)
      if (entry) owner.activate(entry.key)
      else owner.revert()
    }
    if (tab && owner.props.isReadOnly) owner.closeFromTab(true)
  }
  const page = useRef<{ revision: string; window: string; target: number; physical: boolean; ticket: number } | null>(
    null,
  )
  const measurement = useRef(0)
  const windowIdentity = () => JSON.stringify(current.current.scope.acknowledgedSession())
  const positionHighlight = () => {
    const request = position.current
    if (!request) return
    if (!canAct() || request.revision !== current.current.revision || request.window !== windowIdentity()) {
      position.current = null
      return
    }
    const receiver = rows.current.get(request.key)
    if (receiver && visible.current.has(request.key)) {
      position.current = null
      if (request.physical) focusNativeTarget(receiver)
      return
    }
    if (request.waitingAfter !== undefined && measuredRows.current.size <= request.waitingAfter) return
    const index = current.current.entries.findIndex((entry) => entry.encodedKey === request.key)
    if (index < 0 || request.attempts >= Math.min(32, current.current.entries.length + 1)) {
      position.current = null
      return
    }
    request.waitingAfter = undefined
    request.attempts++
    list.current?.scrollToIndex({ index, animated: false })
  }
  const scrollViewport = () => {
    const receiver = list.current?.getNativeScrollRef()
    return receiver && "measureInWindow" in receiver && typeof receiver.measureInWindow === "function" ? receiver : null
  }
  const measurePage = () => {
    const request = page.current
    const viewport = scrollViewport()
    if (
      !request ||
      !viewport ||
      !canAct() ||
      request.revision !== current.current.revision ||
      request.window !== windowIdentity()
    ) {
      page.current = null
      return
    }
    const candidates = enabled().filter(
      (entry) => visible.current.has(entry.encodedKey) && rows.current.has(entry.encodedKey),
    )
    const ticket = ++measurement.current
    viewport.measureInWindow((_x: number, y: number, _width: number, viewportHeight: number) => {
      if (page.current !== request || ticket !== measurement.current || !canAct() || viewportHeight <= 0) return
      const measured = new Map<string, number | null>()
      for (const entry of candidates) {
        const receiver = rows.current.get(entry.encodedKey)!
        receiver.measureInWindow((_x, rowY, _width, height) => {
          if (
            page.current !== request ||
            ticket !== measurement.current ||
            !canAct() ||
            rows.current.get(entry.encodedKey) !== receiver ||
            request.revision !== current.current.revision ||
            request.window !== windowIdentity()
          )
            return
          const inViewport =
            Number.isFinite(rowY) &&
            Number.isFinite(height) &&
            height > 0 &&
            rowY >= y &&
            rowY + height <= y + viewportHeight
          measured.set(entry.encodedKey, inViewport ? rowY - y + metrics.current.offset : null)
          if (measured.size !== candidates.length) return
          const key = [...measured]
            .filter((entry): entry is [string, number] => entry[1] !== null)
            .sort((a, b) => Math.abs(a[1] - request.target) - Math.abs(b[1] - request.target))[0]?.[0]
          if (key) {
            page.current = null
            selectHighlight(key, request.physical)
          }
        })
      }
    })
  }
  const navigate = (key: string, physical = false) => {
    if (!canAct() || current.current.props.isReadOnly) return
    const available = enabled(),
      index = available.findIndex((entry) => entry.encodedKey === current.current.highlighted)
    if (key === "ArrowDown" || key === "ArrowUp")
      selectHighlight(
        available[
          index < 0
            ? key === "ArrowDown"
              ? 0
              : available.length - 1
            : (index + (key === "ArrowDown" ? 1 : available.length - 1) + available.length) % available.length
        ]?.encodedKey ?? null,
        physical,
      )
    else if (key === "Home" || key === "End")
      selectHighlight((key === "Home" ? available[0] : available.at(-1))?.encodedKey ?? null, physical)
    else if (key === "Escape") current.current.revert()
    else if (key === "Enter") commit()
    else if ((key === "PageDown" || key === "PageUp") && current.current.highlighted) {
      const anchor = rows.current.get(current.current.highlighted),
        viewport = scrollViewport(),
        height = metrics.current.height
      if (!anchor || !viewport || height <= 0) return
      const revision = current.current.revision,
        window = windowIdentity(),
        ticket = ++measurement.current
      viewport.measureInWindow((_x: number, viewportY: number) =>
        anchor.measureInWindow((_x, rowY, _width, rowHeight) => {
          if (
            ticket !== measurement.current ||
            revision !== current.current.revision ||
            window !== windowIdentity() ||
            !canAct() ||
            rowHeight <= 0 ||
            !Number.isFinite(rowY)
          )
            return
          const direction = key === "PageDown" ? 1 : -1
          page.current = {
            revision,
            window,
            target: rowY - viewportY + metrics.current.offset + direction * height,
            physical,
            ticket,
          }
          list.current?.scrollToOffset({
            offset: Math.max(0, metrics.current.offset + direction * height),
            animated: false,
          })
        }),
      )
    }
  }
  const enter = useRef<ReturnType<typeof createNativeOriginalEditorEnterAdapter<TextInput>> | null>(null)
  if (!enter.current)
    enter.current = createNativeOriginalEditorEnterAdapter({
      current: () => ({
        original: current.current.originalEditor === editorRef.current ? editorRef.current : null,
        enabled: canAct() && !current.current.props.isReadOnly,
        lifetimeKey: current.current.revision,
        canAct,
      }),
      isCurrent: (target, frame) => {
        const owner = current.current,
          session = owner.scope.acknowledgedSession()
        return (
          owner.scope.isNativeReady() &&
          owner.scope.isWindowActive() === true &&
          frame.ownerId === owner.scope.ownerId &&
          frame.windowId === session.windowId &&
          frame.epoch === session.epoch &&
          frame.policyRevision === owner.scope.policyRevision() &&
          owner.registry?.isCurrentActionBinding(target, frame) === true
        )
      },
      onSubmit: () => commit(),
    })
  const tokens = [
    "ArrowDown",
    "ArrowUp",
    "Escape",
    "Enter",
    ...(highlighted ? ["Home", "End", "PageDown", "PageUp"] : []),
  ].flatMap(nativeKeyTokens)
  const receive = useNativeOriginalEditorKeyPolicy(originalEditor, {
    enabled: !props.isDisabled,
    actionEnabled: !props.isReadOnly,
    lifetimeKey: revision,
    tokens,
    current: () => editorRef.current,
    canAct,
    onAction: (frame) => {
      if (frame.key === "Enter") enter.current?.onAction(frame)
      else navigate(frame.key)
    },
    receive: (event) => {
      const owner = current.current
      if (!canAct() || event.target !== editorRef.current || event.currentTarget !== editorRef.current) return
      if (event.nativeEvent.phase === "down") {
        owner.props.onKeyDown?.(event)
        if (canAct()) current.current.props.inputProps?.onKeyDown?.(event)
      } else {
        owner.props.onKeyUp?.(event)
        if (canAct()) current.current.props.inputProps?.onKeyUp?.(event)
      }
      if (!canAct()) return
      enter.current?.receive(event)
      if (
        !current.current.props.isReadOnly &&
        event.nativeEvent.phase === "down" &&
        (event.nativeEvent.key === "ArrowLeft" || event.nativeEvent.key === "ArrowRight") &&
        !event.nativeEvent.isComposing
      )
        selectHighlight(null)
    },
  })
  useLayoutEffect(
    () => () => {
      enter.current?.retire()
      held.current.clear()
      page.current = null
      position.current = null
      measurement.current++
    },
    [revision, scope, originalEditor],
  )
  useLayoutEffect(
    () =>
      scope.subscribe(() => {
        if (scope.isWindowActive() !== true) {
          held.current.clear()
          page.current = null
          position.current = null
          measurement.current++
        }
      }),
    [scope],
  )
  useLayoutEffect(() => {
    const keys = new Set(entries.map((entry) => entry.encodedKey))
    for (const key of targets.current.keys())
      if (!keys.has(key)) {
        targets.current.delete(key)
        bindings.current.delete(key)
        measuredRows.current.delete(key)
      }
    if (highlighted && !enabled().some((entry) => entry.encodedKey === highlighted)) setHighlighted(null)
  })
  useLayoutEffect(() => {
    let focused = false
    const focusOriginal = () => {
      if (!focused && canAct() && scope.isNativeReady() && editorRef.current)
        focused = focusNativeTarget(editorRef.current)
    }
    focusOriginal()
    return scope.subscribe(focusOriginal)
  }, [scope, originalEditor])
  const tab = useNativeCollectionTabBoundary({
    rootRef: root,
    enabled: !props.isDisabled,
    lifetimeKey: revision,
    canAct,
    receive: (data) => {
      if (data.disposition === "tab" && data.phase === "down") {
        const path = data.physicalPath ?? []
        const editor = editorRef.current ? findNodeHandle(editorRef.current) : null
        if (editor && path.includes(editor)) current.current.highlighted = editorHighlight.current
        else {
          const original = [...rows.current].find(([, receiver]) => {
            const tag = findNodeHandle(receiver)
            return tag !== null && path.includes(tag)
          })
          const closeTarget = closeButton.current ? findNodeHandle(closeButton.current) : null
          if (original) current.current.highlighted = original[0]
          else if (closeTarget && path.includes(closeTarget)) current.current.highlighted = editorHighlight.current
          else return
        }
        commit(true)
      }
    },
  })
  const groupStyle = useNativeInputBorder(styles.group)
  const viewable = useRef(({ viewableItems }: { viewableItems: ViewToken<TNativeCollectionEntry<T>>[] }) => {
    visible.current = new Set(viewableItems.filter((item) => item.isViewable).map((item) => item.item.encodedKey))
    positionHighlight()
    measurePage()
  }).current

  return (
    <SafeAreaView
      testID={`${identity}-modal`}
      accessibilityViewIsModal
      onAccessibilityEscape={close}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <NativeFocusHost
        ref={root}
        accessible={false}
        focusable={false}
        nativeTabStop={false}
        style={{ flex: 1 }}
        {...tab.listenerProps}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: theme.spacing.unit * 2,
              padding: theme.spacing.unit * 2,
            }}
          >
            <View testID={`${identity}-query-group`} style={[{ flexGrow: 1, flexBasis: 160 }, groupStyle]}>
              <Input
                {...inputProps}
                ref={editorBinding}
                nativeRender={(native) => {
                  const original = { ...native, onNativeOrdinaryEditorKey: receive }
                  return <TextInput {...original} />
                }}
                testID={`${identity}-input`}
                accessibilityLabel={props.inputLabel}
                value={query}
                placeholder={props.placeholder ?? ""}
                isDisabled={props.isDisabled}
                isReadOnly={props.isReadOnly}
                textSize={props.textSize}
                geometry={props.geometry}
                enableFocusStyle={false}
                customStyles={styles.input}
                onChangeText={(text) => {
                  if (active()) change(text)
                }}
                onSubmitEditing={(event) => {
                  props.inputProps?.onSubmitEditing?.(event)
                  if (!("isComposing" in event.nativeEvent && event.nativeEvent.isComposing)) commit()
                }}
                onFocus={(event) => {
                  if (!active()) return
                  focus(true)
                  props.inputProps?.onFocus?.(event)
                }}
                onBlur={(event) => {
                  focus(false)
                  props.inputProps?.onBlur?.(event)
                }}
              />
            </View>
            <Button
              ref={closeButton}
              testID={`${identity}-close`}
              accessibilityLabel={props.closeLabel}
              onPress={close}
              raised={false}
            >
              {props.closeLabel}
            </Button>
          </View>
          <FlatList
            testID={`${identity}-list`}
            ref={list}
            data={entries}
            onLayout={(event) => {
              metrics.current.height = event.nativeEvent.layout.height
              positionHighlight()
            }}
            onContentSizeChange={positionHighlight}
            onScroll={(event) => {
              metrics.current.offset = event.nativeEvent.contentOffset.y
              measurePage()
            }}
            onViewableItemsChanged={viewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 100 }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              const request = position.current
              if (!request || !canAct()) return
              request.waitingAfter = measuredRows.current.size
              if (averageItemLength > 0)
                list.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * index), animated: false })
            }}
            extraData={{
              selectedKey,
              disabledKeys,
              disabled: props.isDisabled,
              readOnly: props.isReadOnly,
              renderItem: props.renderItem,
              textSize: props.textSize,
            }}
            keyExtractor={(entry) => entry.encodedKey}
            style={styles.list}
            contentContainerStyle={{ padding: theme.spacing.unit * 2 }}
            ItemSeparatorComponent={<View style={{ height: theme.spacing.unit }} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={5}
            removeClippedSubviews={false}
            ListEmptyComponent={
              <PlaceholderText align="center" testID={`${identity}-empty`}>
                {props.emptyListMessage ?? "No items remaining to select"}
              </PlaceholderText>
            }
            renderItem={({ item: entry }) => (
              <ListBoxItem
                id={entry.key}
                textValue={entry.text}
                isSelected={entry.key === selectedKey}
                isDisabled={props.isDisabled || disabledKeys.has(entry.encodedKey)}
                isReadOnly={props.isReadOnly}
                textSize={props.textSize}
                testID={`${identity}-option-${entry.encodedKey}`}
                ref={bindRow(entry.encodedKey)}
                render={(native) => {
                  const { onFocus, onBlur, onPress, onPressIn, onPressOut, ...host } = native
                  return (
                    <NativePressable
                      {...host}
                      nativeInteraction={!props.isReadOnly}
                      onPressIn={(event) => {
                        if (isGesturePress(event)) onPressIn?.(event)
                      }}
                      onPressOut={(event) => {
                        if (isGesturePress(event)) onPressOut?.(event)
                      }}
                      onPressCancel={(event) => {
                        if (isGesturePress(event)) onPressOut?.(event)
                      }}
                      onHoverCancel={native.onHoverOut ?? undefined}
                      onPress={(event) => {
                        if (isGesturePress(event)) onPress?.(event)
                        else if (canAct() && !current.current.props.isReadOnly) current.current.activate(entry.key)
                      }}
                      onFocus={(event) => {
                        onFocus?.(event)
                        setHighlighted(entry.encodedKey)
                        focus(true)
                      }}
                      onBlur={(event) => {
                        onBlur?.(event)
                        focus(false)
                      }}
                      nativeRender={(pressable) => (
                        <NativeFocusHost
                          {...pressable}
                          nativePressable={
                            !props.isDisabled && !props.isReadOnly && !disabledKeys.has(entry.encodedKey)
                          }
                          capturedKeys={[]}
                          onKeyDown={undefined}
                          onKeyUp={undefined}
                        >
                          {pressable.children}
                          <NativeTargetKeyPolicy
                            target={targetFor(entry.encodedKey)}
                            tokens={[
                              "ArrowDown",
                              "ArrowUp",
                              "Home",
                              "End",
                              "PageDown",
                              "PageUp",
                              "Escape",
                              "Enter",
                            ].flatMap(nativeKeyTokens)}
                            lifetimeKey={revision}
                            isEnabled={!props.isDisabled && !props.isReadOnly && !disabledKeys.has(entry.encodedKey)}
                            excludeEditable
                            excludeComposing
                            canAct={canAct}
                            onKey={(event) => {
                              if (event.nativeEvent.phase === "up") {
                                held.current.delete(event.nativeEvent.nativeCode)
                                return
                              }
                              if (
                                event.nativeEvent.phase === "down" &&
                                event.nativeEvent.nativeDefaultHandled &&
                                !event.nativeEvent.cancelled &&
                                (event.nativeEvent.key !== "Enter" ||
                                  (!event.nativeEvent.repeat && !held.current.has(event.nativeEvent.nativeCode)))
                              ) {
                                if (event.nativeEvent.key === "Enter") held.current.add(event.nativeEvent.nativeCode)
                                event.preventDefault()
                                current.current.highlighted = entry.encodedKey
                                navigate(event.nativeEvent.key, true)
                              }
                            }}
                          />
                        </NativeFocusHost>
                      )}
                    />
                  )
                }}
                customStyles={
                  highlighted === entry.encodedKey
                    ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 }
                    : undefined
                }
                onLayout={() => {
                  measuredRows.current.add(entry.encodedKey)
                  positionHighlight()
                  measurePage()
                }}
                onPress={() => {
                  if (active()) activate(entry.key)
                }}
              >
                {(state) =>
                  props.renderItem
                    ? props.renderItem(entry.item, {
                        ...state,
                        isFocused: state.isFocused || highlighted === entry.encodedKey,
                      })
                    : entry.text
                }
              </ListBoxItem>
            )}
          />
        </KeyboardAvoidingView>
      </NativeFocusHost>
    </SafeAreaView>
  )
}
