import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { AccessibilityInfo, FlatList, View, type ViewToken } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { resolveNativeStyle } from "../colors"
import { ListBoxItem } from "../ListBoxItem/ListBoxItem"
import { Text } from "../Text/Text"

import type { TNativeSelectEntry } from "./collection"
import type { TNativeSelectKey, TNativeSelectProps } from "./types"

type TSelectOptionsProps<T> = {
  entries: TNativeSelectEntry<T>[]
  selectedKey: TNativeSelectKey | null
  disabledKeys: Set<string>
  label: string
  identity: string
  ready: boolean
  close: () => void
  activate: (key: TNativeSelectKey) => void
  props: TNativeSelectProps<T>
}

export const SelectOptions = <T,>({
  entries,
  selectedKey,
  disabledKeys,
  label,
  identity,
  ready,
  close,
  activate,
  props,
}: TSelectOptionsProps<T>) => {
  const theme = useNativeTheme()
  const list = useRef<FlatList<TNativeSelectEntry<T>>>(null)
  const heading = useRef<View>(null)
  const rows = useRef(new Map<string, View>())
  const visible = useRef(new Set<string>())
  const attempts = useRef(0)
  const measuredThrough = useRef(-1)
  const waitingForMeasurementAfter = useRef<number | undefined>(undefined)
  const finished = useRef(false)
  const mounted = useRef(true)
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(undefined)
  const initialKey = useRef(selectedKey)
  const latest = useRef({ entries, ready })
  useLayoutEffect(() => {
    latest.current = { entries, ready }
  }, [entries, ready])
  const focusInitial = useCallback(() => {
    if (!mounted.current || !latest.current.ready || finished.current) return
    const entry = latest.current.entries.find((item) => item.key === initialKey.current)
    const target = entry
      ? visible.current.has(entry.encodedKey)
        ? rows.current.get(entry.encodedKey)
        : undefined
      : heading.current
    if (!target) return
    finished.current = true
    AccessibilityInfo.sendAccessibilityEvent(target, "focus")
  }, [])
  const positionInitial = useCallback(() => {
    if (!mounted.current || !latest.current.ready || finished.current) return
    const index = latest.current.entries.findIndex((entry) => entry.key === initialKey.current)
    if (index < 0) {
      focusInitial()
      return
    }
    const entry = latest.current.entries[index]
    if (visible.current.has(entry.encodedKey)) {
      focusInitial()
      return
    }
    if (
      waitingForMeasurementAfter.current !== undefined &&
      measuredThrough.current <= waitingForMeasurementAfter.current
    )
      return
    waitingForMeasurementAfter.current = undefined
    if (attempts.current >= 3) {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, "focus")
      finished.current = true
      return
    }
    attempts.current += 1
    list.current?.scrollToIndex({ index, animated: false, viewPosition: 0 })
  }, [focusInitial])
  const schedulePosition = useCallback(() => {
    if (!mounted.current || frame.current !== undefined || finished.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined
      positionInitial()
    })
  }, [positionInitial])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      frame.current = undefined
    }
  }, [])
  useEffect(() => {
    if (ready) schedulePosition()
  }, [ready, schedulePosition])
  const viewabilityChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<TNativeSelectEntry<T>>[] }) => {
      visible.current = new Set(viewableItems.filter((token) => token.isViewable).map((token) => token.item.encodedKey))
      schedulePosition()
    },
    [schedulePosition],
  )
  const listStyles = resolveNativeStyle(
    [{ flex: 1, backgroundColor: theme.colors.background }, props.customOptionsListStyles],
    "Select",
    "customOptionsListStyles",
  )
  return (
    <SafeAreaView
      testID={`${identity}-modal`}
      accessibilityViewIsModal
      onAccessibilityEscape={close}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View style={{ padding: theme.spacing.unit * 2, gap: theme.spacing.unit * 2 }}>
        <Text ref={heading} elementType="h2" variant="h3" testID={`${identity}-heading`}>
          {label}
        </Text>
        <Button
          testID={`${identity}-close`}
          accessibilityLabel={props.closeLabel}
          onPress={close}
          order="primary"
          raised={false}
        >
          {props.closeLabel}
        </Button>
      </View>
      <FlatList
        ref={list}
        testID={`${identity}-list`}
        data={entries}
        extraData={{
          selectedKey,
          disabledKeys,
          disabled: props.isDisabled,
          readOnly: props.isReadOnly,
          renderItem: props.renderItem,
          textSize: props.textSize,
        }}
        keyExtractor={(entry) => entry.encodedKey}
        style={listStyles}
        contentContainerStyle={{ padding: theme.spacing.unit * 2 }}
        ItemSeparatorComponent={<View style={{ height: theme.spacing.unit }} />}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={5}
        removeClippedSubviews={false}
        onLayout={schedulePosition}
        onContentSizeChange={schedulePosition}
        onViewableItemsChanged={viewabilityChanged}
        onScrollToIndexFailed={({ index, averageItemLength, highestMeasuredFrameIndex }) => {
          if (!mounted.current || finished.current) return
          if (averageItemLength <= 0) {
            attempts.current = Math.max(0, attempts.current - 1)
            return
          }
          // Wait for newly measured cells before spending another positioning attempt.
          waitingForMeasurementAfter.current = highestMeasuredFrameIndex
          list.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * index), animated: false })
        }}
        ListEmptyComponent={
          <Text testID={`${identity}-empty`}>{props.emptyListMessage ?? "No items remaining to select"}</Text>
        }
        renderItem={({ item: entry, index }) => (
          <ListBoxItem
            ref={(node) => {
              if (node) rows.current.set(entry.encodedKey, node)
              else rows.current.delete(entry.encodedKey)
            }}
            id={entry.key}
            textValue={entry.text}
            isSelected={entry.key === selectedKey}
            isDisabled={props.isDisabled || disabledKeys.has(entry.encodedKey)}
            isReadOnly={props.isReadOnly}
            textSize={props.textSize}
            testID={`${identity}-option-${entry.encodedKey}`}
            onLayout={() => {
              measuredThrough.current = Math.max(measuredThrough.current, index)
              schedulePosition()
            }}
            onPress={() => activate(entry.key)}
          >
            {(state) => (props.renderItem ? props.renderItem(entry.item, state) : entry.text)}
          </ListBoxItem>
        )}
      />
    </SafeAreaView>
  )
}
