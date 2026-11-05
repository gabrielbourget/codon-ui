import { useCallback, useEffect, useRef, useState } from "react"
import { findNodeHandle, Pressable, Text as CoreText, View } from "react-native"

import {
  PlaceholderText,
  useNativeTheme,
  type TNativePlaceholderTextProps,
  type TNativePlaceholderTextRef,
} from "@codon-ui/react-native"

type TPressEvent = Parameters<NonNullable<TNativePlaceholderTextProps["onPress"]>>[0]
type TFixtureProps = Pick<TNativePlaceholderTextProps, "align" | "children" | "customStyles" | "style"> & {
  increment: () => void
}
type TCallback = "original" | "replacement" | "absent"
type TTakeover = "none" | "disabled" | "removed"
const CONTENT_MODES = ["initial", "zero", "empty", "false", "null", "restored"] as const
type TContentMode = "scene" | "deferred" | (typeof CONTENT_MODES)[number]
type TReceipt = {
  sequence: number
  kind: string
  callback: TCallback
  receivedAt: number
  rootTag: number | null
  refIdentity: number | null
  afterDetach: boolean
  eventIdentity: number
  nativeIdentity: number
  native: Record<string, unknown>
}

// App-local observation only: every action still originates at the original public PlaceholderText.
export const PlaceholderG02Fixture = ({ increment, children, ...styles }: TFixtureProps) => {
  const theme = useNativeTheme()
  const [visible, setVisible] = useState(true)
  const [contentMode, setContentMode] = useState<TContentMode>("scene")
  const [callback, setCallback] = useState<TCallback>("original")
  const [disabled, setDisabled] = useState<boolean>()
  const [selection, setSelection] = useState<boolean>()
  const [labelIntent, setLabelIntent] = useState(false)
  const [longPress, setLongPress] = useState(false)
  const [takeover, setTakeover] = useState<TTakeover>("none")
  const [receipts, setReceipts] = useState<TReceipt[]>([])
  const trace = useRef<TReceipt[]>([])
  const [dropped, setDropped] = useState(0)
  const [binding, setBinding] = useState({
    rootTag: null as number | null,
    refIdentity: null as number | null,
    attaches: 0,
    detaches: 0,
  })
  const root = useRef<TNativePlaceholderTextRef | null>(null)
  const refObjects = useRef(new WeakMap<object, number>())
  const eventObjects = useRef(new WeakMap<object, number>())
  const nativeObjects = useRef(new WeakMap<object, number>())
  const nextIdentity = useRef(0)
  const nextSequence = useRef(0)
  const ownerRevision = useRef(0)
  const identity = (objects: WeakMap<object, number>, value: object) => {
    let token = objects.get(value)
    if (token === undefined) {
      token = ++nextIdentity.current
      objects.set(value, token)
    }
    return token
  }
  const bind = useCallback((node: TNativePlaceholderTextRef | null) => {
    root.current = node
    let refIdentity: number | null = null
    if (node !== null) {
      refIdentity = refObjects.current.get(node) ?? ++nextIdentity.current
      refObjects.current.set(node, refIdentity)
    }
    setBinding((current) => ({
      rootTag: node === null ? null : findNodeHandle(node),
      refIdentity,
      attaches: current.attaches + (node === null ? 0 : 1),
      detaches: current.detaches + (node === null ? 1 : 0),
    }))
  }, [])
  useEffect(
    () => () => {
      ownerRevision.current += 1
    },
    [],
  )

  const observe = (kind: string, event: TPressEvent, recipient: TCallback) => {
    const native = event.nativeEvent
    // Snapshot original scalars synchronously; never persist, replace or mutate the received event.
    const row: TReceipt = {
      sequence: ++nextSequence.current,
      kind,
      callback: recipient,
      receivedAt: Date.now(),
      rootTag: root.current === null ? null : findNodeHandle(root.current),
      refIdentity: root.current === null ? null : (refObjects.current.get(root.current) ?? null),
      afterDetach: root.current === null,
      eventIdentity: identity(eventObjects.current, event),
      nativeIdentity: identity(nativeObjects.current, native),
      native: Object.fromEntries(
        ["target", "timestamp", "identifier", "pageX", "pageY", "locationX", "locationY"]
          .filter((key) => key in native)
          .map((key) => [key, native[key as keyof typeof native]]),
      ),
    }
    if (trace.current.length < 256) {
      trace.current = [...trace.current, row]
      setReceipts(trace.current)
    } else {
      setDropped((count) => count + 1)
    }
  }
  const onPress = (event: TPressEvent) => {
    observe("press", event, callback)
    // Deliberately no fixture guard: an incorrectly delivered late/disabled action must remain visible.
    increment()
  }
  const setContent = (mode: TContentMode) => {
    ownerRevision.current += 1
    setContentMode(mode)
  }
  const content =
    contentMode === "scene"
      ? children
      : contentMode === "initial"
        ? "Choose an item"
        : contentMode === "zero"
          ? 0
          : contentMode === "empty"
            ? ""
            : contentMode === "false"
              ? false
              : contentMode === "null"
                ? null
                : contentMode === "restored"
                  ? "Restored owner content"
                  : "Deferred owner content"
  const state = {
    theme: theme.mode,
    contentMode,
    callback,
    visible,
    disabled: disabled ?? null,
    selectable: selection ?? null,
    elementType: labelIntent ? "label" : "p",
    longPress,
    takeover,
    ...binding,
    actions: receipts.filter((row) => row.kind === "press").length,
    longActions: receipts.filter((row) => row.kind === "longPress").length,
    dropped,
    receipts,
  }
  const control = (label: string, onPressControl: () => void) => (
    <Pressable
      key={label}
      role="button"
      accessibilityLabel={label}
      onPress={onPressControl}
      style={{ padding: 6, borderWidth: 1, borderColor: theme.colors.controlBorder }}
    >
      <CoreText style={{ color: theme.colors.foreground }}>{label}</CoreText>
    </Pressable>
  )

  return (
    <View style={{ gap: 6 }}>
      {visible && (
        <PlaceholderText
          {...styles}
          testID="library-placeholder"
          ref={bind}
          disabled={disabled}
          selectable={selection}
          elementType={labelIntent ? "label" : "p"}
          onPress={callback === "absent" ? undefined : onPress}
          onPressIn={
            callback === "absent"
              ? undefined
              : (event) => {
                  observe("pressIn", event, callback)
                  if (takeover === "disabled") setDisabled(true)
                  if (takeover === "removed") setVisible(false)
                }
          }
          onPressOut={callback === "absent" ? undefined : (event) => observe("pressOut", event, callback)}
          onLongPress={
            callback === "absent" || !longPress ? undefined : (event) => observe("longPress", event, callback)
          }
        >
          {content}
        </PlaceholderText>
      )}
      <CoreText
        testID="placeholder-g02-state"
        accessible
        accessibilityLabel={JSON.stringify(state)}
        numberOfLines={1}
        style={{ color: theme.colors.foreground }}
      >
        G02 {contentMode}; actions {state.actions}; long {state.longActions}; attached {String(visible)}; dropped{" "}
        {dropped}
      </CoreText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {control("G02 prepare placeholder", () => {
          setContent("initial")
          setVisible(true)
          setCallback("original")
          setDisabled(undefined)
          setSelection(false)
          setLabelIntent(false)
          setLongPress(false)
          setTakeover("none")
          nextSequence.current = 0
          trace.current = []
          setReceipts([])
          setDropped(0)
        })}
        {control("G02 next placeholder content", () => {
          const index = CONTENT_MODES.indexOf(contentMode as (typeof CONTENT_MODES)[number])
          setContent(CONTENT_MODES[(index + 1) % CONTENT_MODES.length])
        })}
        {control("G02 deferred placeholder content", () => {
          const revision = ++ownerRevision.current
          void Promise.resolve().then(() => {
            if (ownerRevision.current === revision) setContentMode("deferred")
          })
        })}
        {control("G02 scene placeholder content", () => setContent("scene"))}
        {control("G02 original placeholder callback", () => setCallback("original"))}
        {control("G02 replacement placeholder callback", () => setCallback("replacement"))}
        {control("G02 absent placeholder callback", () => setCallback("absent"))}
        {control("G02 toggle placeholder disabled", () => setDisabled((current) => !current))}
        {control("G02 default placeholder disabled", () => setDisabled(undefined))}
        {control("G02 default placeholder selection", () => setSelection(undefined))}
        {control("G02 enable placeholder selection", () => setSelection(true))}
        {control("G02 disable placeholder selection", () => setSelection(false))}
        {control("G02 toggle placeholder label intent", () => setLabelIntent((current) => !current))}
        {control("G02 toggle placeholder long press", () => setLongPress((current) => !current))}
        {control("G02 remove placeholder", () => {
          ownerRevision.current += 1
          setVisible(false)
        })}
        {control("G02 reinsert placeholder", () => setVisible(true))}
        {control("G02 placeholder disable on press in", () => setTakeover("disabled"))}
        {control("G02 placeholder remove on press in", () => setTakeover("removed"))}
        {control("G02 placeholder no press takeover", () => setTakeover("none"))}
      </View>
    </View>
  )
}
