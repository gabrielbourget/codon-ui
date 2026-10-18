import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
  type RefAttributes,
} from "react"
import { ScrollView, View, useWindowDimensions } from "react-native"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { Input } from "../Input/Input"
import { NativeContentContext } from "../NativeContentContext"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeTypeaheadLoadingIndicator, NativeTypeaheadSearchIcon } from "./affordances"
import { getTypeaheadEntries } from "./collection"
import { resolveTypeaheadSearchLabels } from "./labels"
import { NativeTypeaheadResults } from "./Results"
import { AVAILABLE_TYPEAHEAD_SEARCH_STATUSES } from "./status"
import { getTypeaheadStyles } from "./styles"
import {
  NATIVE_TYPEAHEAD_INPUT_PROP_KEYS,
  type TNativeTypeaheadSearchInputProps,
  type TNativeTypeaheadSearchProps,
  type TNativeTypeaheadSearchRef,
  type TTypeaheadViewport,
} from "./types"

const NativeTypeaheadSearch = <T extends object>(
  props: TNativeTypeaheadSearchProps<T>,
  ref: ForwardedRef<TNativeTypeaheadSearchRef>,
) => {
  const status = props.status ?? "results"
  if (typeof props.inputValue !== "string" || typeof props.onInputChange !== "function")
    throw new TypeError("TypeaheadSearch: inputValue and onInputChange are required controlled query props")
  if (!AVAILABLE_TYPEAHEAD_SEARCH_STATUSES.includes(status)) throw new TypeError("TypeaheadSearch: unsupported status")
  const latest = useRef(props)
  latest.current = props
  const mounted = useRef(true)
  const [focused, setFocused] = useState({ input: false, button: false })
  const scroll = useRef<ScrollView>(null)
  const content = useRef<View>(null)
  const viewport = useRef<TTypeaheadViewport>({ width: 0, height: 0, offset: 0, contentHeight: 0, generation: 0 })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (props.isDisabled) setFocused({ input: false, button: false })
  }, [props.isDisabled])
  const live = () => mounted.current && !latest.current.isDisabled
  const submit = () => {
    if (live()) latest.current.onSubmitQuery?.(latest.current.inputValue.trim())
  }
  const items = useMemo(() => Array.from(props.items ?? []), [props.items])
  const entries = useMemo(
    () => (status === "results" ? getTypeaheadEntries(items, props) : []),
    [status, items, props.getItemKey, props.getItemTextValue],
  )
  const labels = resolveTypeaheadSearchLabels(props)
  const theme = useNativeTheme()
  const windowDimensions = useWindowDimensions()
  const styles = getTypeaheadStyles(
    theme,
    props,
    !props.isDisabled && (focused.input || focused.button),
    windowDimensions.height,
  )
  const containerSignature = JSON.stringify(styles.container)
  const previousContainer = useRef(containerSignature)
  if (containerSignature !== previousContainer.current) {
    previousContainer.current = containerSignature
    viewport.current.generation++
  }
  const nativeInput = Object.fromEntries(
    NATIVE_TYPEAHEAD_INPUT_PROP_KEYS.map((key) => [key, props.inputProps?.[key]]),
  ) as TNativeTypeaheadSearchInputProps
  const message =
    status === "idle"
      ? labels.status.idleMessage
      : status === "minimum-query"
        ? labels.status.minimumInputLengthMessage({ minimumInputLength: props.minimumInputLength ?? 0 })
        : status === "loading"
          ? labels.status.loadingMessage
          : status === "empty"
            ? labels.status.emptyListMessage
            : status === "error"
              ? labels.status.errorMessage
              : undefined
  return (
    <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
      <View
        ref={ref}
        testID={props.testID ?? props["data-testid"] ?? "typeahead-search"}
        nativeID={props.nativeID}
        id={props.id}
        onLayout={props.onLayout}
        pointerEvents={props.pointerEvents}
        collapsable={props.collapsable}
        accessibilityHint={props.accessibilityHint}
        style={styles.root}
      >
        <View testID="typeahead-search-input-row" style={styles.row}>
          <Input
            {...nativeInput}
            ref={props.inputRef}
            testID="typeahead-search-input"
            accessibilityLabel={props.accessibilityLabel ?? props["aria-label"]}
            value={props.inputValue}
            placeholder={props.placeholder}
            isDisabled={props.isDisabled}
            autoFocus={props.shouldAutoFocusInput}
            enableFocusStyle={false}
            customStyles={styles.input}
            onChangeText={(text) => {
              if (live()) latest.current.onInputChange(text)
            }}
            onChange={(event) => {
              if (live()) latest.current.inputProps?.onChange?.(event)
            }}
            onSubmitEditing={(event) => {
              if (!live()) return
              latest.current.inputProps?.onSubmitEditing?.(event)
              submit()
            }}
            onFocus={(event) => {
              if (!live()) return
              viewport.current.generation++
              setFocused((current) => ({ ...current, input: true }))
              latest.current.inputProps?.onFocus?.(event)
            }}
            onBlur={(event) => {
              if (!mounted.current) return
              setFocused((current) => ({ ...current, input: false }))
              latest.current.inputProps?.onBlur?.(event)
            }}
            onEndEditing={(event) => {
              if (mounted.current) latest.current.inputProps?.onEndEditing?.(event)
            }}
            onSelectionChange={(event) => {
              if (live()) latest.current.inputProps?.onSelectionChange?.(event)
            }}
            onKeyPress={(event) => {
              if (live()) latest.current.inputProps?.onKeyPress?.(event)
            }}
          />
          <Button
            testID="typeahead-search-button"
            accessibilityLabel={labels.searchButtonAriaLabel}
            customStyles={styles.button}
            isDisabled={props.isDisabled}
            geometry="rounded"
            raised={false}
            onPress={submit}
            onFocusChange={(value) => {
              if (mounted.current) {
                if (value && !latest.current.isDisabled) viewport.current.generation++
                setFocused((current) => ({ ...current, button: value && !latest.current.isDisabled }))
              }
            }}
          >
            {props.SearchIcon || <NativeTypeaheadSearchIcon />}
          </Button>
        </View>
        <ScrollView
          ref={scroll}
          testID="typeahead-search-results-container"
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          scrollEventThrottle={16}
          onLayout={({ nativeEvent: { layout } }) => {
            if (
              !Number.isFinite(layout.width) ||
              !Number.isFinite(layout.height) ||
              layout.width < 0 ||
              layout.height < 0
            )
              return
            if (viewport.current.width !== layout.width || viewport.current.height !== layout.height)
              viewport.current.generation++
            viewport.current.width = layout.width
            viewport.current.height = layout.height
          }}
          onContentSizeChange={(_width, height) => {
            if (!Number.isFinite(height) || height < 0) return
            if (viewport.current.contentHeight !== height) viewport.current.generation++
            viewport.current.contentHeight = height
          }}
          onScroll={({ nativeEvent }) => {
            if (Number.isFinite(nativeEvent.contentOffset.y)) viewport.current.offset = nativeEvent.contentOffset.y
          }}
        >
          <View ref={content} collapsable={false} testID="typeahead-search-scroll-content">
            {status === "results" ? (
              <NativeTypeaheadResults
                entries={entries}
                query={props.inputValue}
                label={labels.resultsListAriaLabel}
                shouldFocusWrap={props.shouldFocusWrap ?? true}
                renderItem={props.renderItem}
                onSelectionChange={props.onSelectionChange}
                style={styles.list}
                scroll={scroll}
                content={content}
                viewport={viewport}
              />
            ) : (
              <View testID={`typeahead-search-${status}-state`} style={styles.status} accessibilityLiveRegion="polite">
                {status === "loading"
                  ? getNativeButtonContent(props.LoadingIndicator || <NativeTypeaheadLoadingIndicator />)
                  : null}
                <PlaceholderText align="center">{message}</PlaceholderText>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </NativeContentContext.Provider>
  )
}

export const TypeaheadSearch = forwardRef(NativeTypeaheadSearch) as <T extends object = object>(
  props: TNativeTypeaheadSearchProps<T> & RefAttributes<TNativeTypeaheadSearchRef>,
) => ReactElement | null
