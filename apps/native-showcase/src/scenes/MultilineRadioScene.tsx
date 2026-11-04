import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { findNodeHandle, Keyboard, Pressable, TextInput, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Radio,
  RadioGroup,
  Text,
  TextArea,
  useNativeTheme,
  type TNativeTextAreaRef,
  type TextAreaProps,
} from "@codon-ui/react-native"

const LONG_NOTES = Array.from(
  { length: 16 },
  (_, index) => `Line ${index + 1}: Bonjour Montréal — preserve complete native text and scrolling.`,
).join("\n")

const EDITOR_FIELDS = ["draft", "submit", "long"] as const
type TEditorField = (typeof EDITOR_FIELDS)[number]
type TEditorEvent = { field: TEditorField; generation: number; kind: string; data: unknown; afterUnmount: boolean }
type TEditorObservation = { owner: string; unmounted: boolean; events: TEditorEvent[] }
let retainedEditorObservation: TEditorObservation | null = null
const DEFAULT_NOTES = [LONG_NOTES, "Alternate uncontrolled notes", "", undefined] as const
const EDITOR_SIZES = ["medium", "small", "large"] as const
const EDITOR_HEIGHTS = [96, 144, 0] as const
const EDITOR_WIDTHS = ["100%", 0, undefined] as const
const SUBMIT_MODES = ["blurAndSubmit", "submit", "newline"] as const
const OWNER_NOTES = "Bonjour Montréal\nComplete second line"

export const MultilineRadioScene = () => {
  const theme = useNativeTheme()
  const [draft, setDraft] = useState("")
  const [submitDraft, setSubmitDraft] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [submits, setSubmits] = useState(0)
  const [value, setValue] = useState<string | null>(null)
  const [changes, setChanges] = useState(0)
  const [uncontrolled, setUncontrolled] = useState("first")
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [horizontal, setHorizontal] = useState(false)
  const [hideSelected, setHideSelected] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const inputRef = useRef<TNativeTextAreaRef>(null)
  const owner = useId()
  const [veto, setVeto] = useState(false)
  const [editorsMounted, setEditorsMounted] = useState(true)
  const [editorGeneration, setEditorGeneration] = useState(0)
  const [defaultIndex, setDefaultIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [heightIndex, setHeightIndex] = useState(0)
  const [widthIndex, setWidthIndex] = useState(0)
  const [statusMask, setStatusMask] = useState(0)
  const [focusStyle, setFocusStyle] = useState(true)
  const [focusOffset, setFocusOffset] = useState(true)
  const [defaultRenderer, setDefaultRenderer] = useState(false)
  const [submitModeIndex, setSubmitModeIndex] = useState(0)
  const [events, setEvents] = useState<TEditorEvent[]>([])
  const [frames, setFrames] = useState<
    Partial<Record<TEditorField, { x: number; y: number; width: number; height: number }>>
  >({})
  const [refProof, setRefProof] = useState(
    () =>
      Object.fromEntries(
        EDITOR_FIELDS.map((field) => [
          field,
          { attached: false, attachments: 0, detachments: 0, nativeTag: null as number | null },
        ]),
      ) as Record<
        TEditorField,
        { attached: boolean; attachments: number; detachments: number; nativeTag: number | null }
      >,
  )
  const [retiredProof, setRetiredProof] = useState("null")
  const observation = useRef<TEditorObservation>({ owner, unmounted: false, events: [] })
  const nodes = useRef<Record<TEditorField, TNativeTextAreaRef | null>>({ draft: null, submit: null, long: null })
  const record = useCallback((field: TEditorField, generation: number, kind: string, data: unknown) => {
    const event = { field, generation, kind, data, afterUnmount: observation.current.unmounted }
    observation.current.events.push(event)
    setEvents([...observation.current.events])
  }, [])
  useLayoutEffect(
    () => () => {
      observation.current.unmounted = true
    },
    [],
  )
  const editorRefs = useMemo(
    () =>
      Object.fromEntries(
        EDITOR_FIELDS.map((field) => [
          field,
          (node: TNativeTextAreaRef | null) => {
            if (nodes.current[field] === node) return
            nodes.current[field] = node
            if (field === "draft") inputRef.current = node
            const nativeTag = node ? findNodeHandle(node) : null
            setRefProof((current) => ({
              ...current,
              [field]: {
                attached: node !== null,
                attachments: current[field].attachments + (node ? 1 : 0),
                detachments: current[field].detachments + (node ? 0 : 1),
                nativeTag,
              },
            }))
            record(field, editorGeneration, "ref", { attached: node !== null, nativeTag })
          },
        ]),
      ) as Record<TEditorField, (node: TNativeTextAreaRef | null) => void>,
    [editorGeneration, record],
  )
  const observe = (field: TEditorField): Partial<TextAreaProps> => ({
    onChange: ({ nativeEvent }) =>
      record(field, editorGeneration, "native:change", {
        text: nativeEvent.text,
        eventCount: nativeEvent.eventCount,
        target: nativeEvent.target,
      }),
    onChangeText: (text) => {
      record(field, editorGeneration, "raw", text)
      if (!veto && field === "draft") setDraft(text)
      if (!veto && field === "submit") setSubmitDraft(text)
    },
    onSubmitEditing: ({ nativeEvent }) => record(field, editorGeneration, "native:submit", nativeEvent.text),
    onEndEditing: ({ nativeEvent }) => record(field, editorGeneration, "native:end", nativeEvent.text),
    onFocus: () => record(field, editorGeneration, "native:focus", null),
    onBlur: () => record(field, editorGeneration, "native:blur", null),
    onSelectionChange: ({ nativeEvent }) => record(field, editorGeneration, "native:selection", nativeEvent.selection),
    onContentSizeChange: ({ nativeEvent }) =>
      record(field, editorGeneration, "native:content-size", nativeEvent.contentSize),
    onScroll: ({ nativeEvent }) => record(field, editorGeneration, "native:scroll", nativeEvent.contentOffset),
    onLayout: ({ nativeEvent: { layout } }) =>
      setFrames((current) => {
        const before = current[field]
        return before &&
          before.x === layout.x &&
          before.y === layout.y &&
          before.width === layout.width &&
          before.height === layout.height
          ? current
          : { ...current, [field]: layout }
      }),
  })
  const presentation = {
    textSize: EDITOR_SIZES[sizeIndex],
    height: EDITOR_HEIGHTS[heightIndex],
    width: EDITOR_WIDTHS[widthIndex],
    errorState: !!(statusMask & 1),
    warningState: !!(statusMask & 2),
    successState: !!(statusMask & 4),
    enableFocusStyle: focusStyle,
    offsetFocusRing: focusOffset,
  }
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const guards = { isDisabled: disabled, isReadOnly: readOnly }
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )

  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native multiline and radio controls
      </Text>
      <Text testID="multiline-radio-state">
        Draft: {draft || "empty"}. Submitted: {submitted || "empty"}. Submits: {submits}. Radio: {value ?? "none"}.
        Changes: {changes}. Uncontrolled: {uncontrolled}. State:{" "}
        {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Order: {order}. Geometry: {geometry}. Orientation:{" "}
        {horizontal ? "horizontal" : "vertical"}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Toggle multiline disabled", () => setDisabled((current) => !current))}
        {action("Toggle multiline read-only", () => setReadOnly((current) => !current))}
        {action("Toggle multiline styles", () => setCustom((current) => !current))}
        {action("Toggle radio orientation", () => setHorizontal((current) => !current))}
        {action("Next radio order", () =>
          setOrderIndex((current) => (current + 1) % AVAILABLE_THEMING_ORDER_CODES.length),
        )}
        {action("Next radio geometry", () =>
          setGeometryIndex((current) => (current + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length),
        )}
        {action("Toggle selected radio removal", () => setHideSelected((current) => !current))}
        {action("Clear radio value", () => setValue(null))}
      </View>
      <Text>Default Return inserts a newline. Bonjour Montréal — write complete bilingual notes.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("G02 dismiss multiline keyboard", () => Keyboard.dismiss())}
        {action("G02 remove multiline editors", () => setEditorsMounted(false))}
      </View>
      {editorsMounted && (
        <TextArea
          key={`draft-${editorGeneration}`}
          {...observe("draft")}
          {...presentation}
          ref={editorRefs.draft}
          render={
            defaultRenderer
              ? undefined
              : (props, state) => (
                  <TextInput {...props} nativeID={`multiline-draft-${state.isReadOnly ? "readonly" : "editable"}`} />
                )
          }
          testID="multiline-draft"
          aria-label="Multiline notes"
          value={draft}
          placeholder="Enter several lines"
          autoCorrect={false}
          autoCapitalize="none"
          geometry={geometry}
          {...guards}
          customStyles={custom ? { fontSize: 18, borderColor: theme.colors.focusRing } : undefined}
          style={({ defaultStyle }) => defaultStyle}
        />
      )}

      <Text>Explicit submission reads the final native text event.</Text>
      {editorsMounted && (
        <TextArea
          key={`submit-${editorGeneration}`}
          {...observe("submit")}
          ref={editorRefs.submit}
          testID="multiline-submit"
          aria-label="Submit notes"
          value={submitDraft}
          autoCorrect={false}
          autoCapitalize="none"
          submitBehavior={SUBMIT_MODES[submitModeIndex]}
          returnKeyType="done"
          width="100%"
          geometry={geometry}
          {...guards}
          onSubmitEditing={({ nativeEvent: { text } }) => {
            record("submit", editorGeneration, "native:submit", text)
            if (!veto) setSubmitDraft(text)
            setSubmitted(text)
            setSubmits((count) => count + 1)
            if (SUBMIT_MODES[submitModeIndex] === "blurAndSubmit") Keyboard.dismiss()
          }}
        />
      )}
      <Text>Long uncontrolled notes keep their 96-unit editor and scroll internally.</Text>
      {editorsMounted && (
        <TextArea
          key={`long-${editorGeneration}`}
          {...observe("long")}
          ref={editorRefs.long}
          testID="multiline-long"
          aria-label="Long notes"
          defaultValue={DEFAULT_NOTES[defaultIndex]}
          autoCorrect={false}
          width="100%"
          {...guards}
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Focus multiline notes", () => inputRef.current?.focus())}
        {action("Dismiss multiline keyboard", () => Keyboard.dismiss())}
      </View>
      <Text>Controlled choices</Text>
      <RadioGroup
        render={(props, state) => <View {...props} nativeID={`multiline-radio-${state.value ?? "empty"}`} />}
        testID="multiline-radio-group"
        aria-label="Controlled radio choices"
        value={value}
        onChange={(next) => {
          setValue(next)
          setChanges((count) => count + 1)
        }}
        orientation={horizontal ? "horizontal" : "vertical"}
        {...guards}
        customStyles={custom ? { gap: 16 } : undefined}
        style={({ defaultStyle }) => defaultStyle}
      >
        {[
          { value: "first", name: "Radio first", label: "First choice" },
          {
            value: "second",
            name: "Radio second",
            label:
              "Second choice — sélectionnez les paramètres et continuez lorsque vous êtes prêt à enregistrer les modifications.",
          },
          { value: "unavailable", name: "Radio unavailable", label: "Unavailable choice" },
        ]
          .filter((item) => !hideSelected || item.value !== value)
          .map((item) => (
            <Radio
              key={item.value}
              value={item.value}
              accessibilityLabel={item.name}
              render={(props, state) => (
                <Pressable {...props} nativeID={`multiline-radio-${state.isSelected ? "selected" : "idle"}`} />
              )}
              testID={`multiline-radio-${item.value}`}
              isDisabled={item.value === "unavailable"}
              order={order}
              geometry={geometry}
              customStyles={{ maxWidth: "100%" }}
              customShapeStyles={custom ? { width: 24, height: 24, borderColor: theme.colors.focusRing } : undefined}
            >
              {({ isSelected }) => (
                <>
                  {item.label}
                  {isSelected ? " ✓" : ""}
                </>
              )}
            </Radio>
          ))}
      </RadioGroup>
      <Text>Uncontrolled choices</Text>
      <RadioGroup
        testID="multiline-uncontrolled-group"
        aria-label="Uncontrolled radio choices"
        defaultValue="first"
        onChange={setUncontrolled}
        orientation={horizontal ? "horizontal" : "vertical"}
        {...guards}
      >
        <Radio
          testID="multiline-uncontrolled-first"
          value="first"
          aria-label="Uncontrolled first"
          order={order}
          geometry={geometry}
        >
          First
        </Radio>
        <Radio
          testID="multiline-uncontrolled-second"
          value="second"
          aria-label="Uncontrolled second"
          order={order}
          geometry={geometry}
        >
          Second
        </Radio>
      </RadioGroup>
      <Text testID="multiline-radio-footer">
        Multiline text retains native scrolling, newline and explicit submission. Radio groups own one value and
        preserve separate accessible members. Keyboard, large text, rotation and targets are inspected in the local lab;
        closer visual and physical review accompanies application integration.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("G02 toggle multiline owner veto", () => setVeto((value) => !value))}
        {action("G02 set multiline owner text", () => {
          setDraft(OWNER_NOTES)
          setSubmitDraft(OWNER_NOTES)
        })}
        {action("G02 set multiline owner empty", () => {
          setDraft("")
          setSubmitDraft("")
        })}
        {action("G02 next long default", () => setDefaultIndex((value) => (value + 1) % DEFAULT_NOTES.length))}
        {action("G02 reinsert multiline editors", () => {
          setEditorGeneration((value) => value + 1)
          setEditorsMounted(true)
        })}
        {action("G02 remount multiline editors", () => setEditorGeneration((value) => value + 1))}
        {action("G02 next multiline text size", () => setSizeIndex((value) => (value + 1) % EDITOR_SIZES.length))}
        {action("G02 next multiline height", () => setHeightIndex((value) => (value + 1) % EDITOR_HEIGHTS.length))}
        {action("G02 next multiline width", () => setWidthIndex((value) => (value + 1) % EDITOR_WIDTHS.length))}
        {action("G02 next multiline status", () => setStatusMask((value) => (value + 1) % 8))}
        {action("G02 toggle multiline focus style", () => setFocusStyle((value) => !value))}
        {action("G02 toggle multiline focus offset", () => setFocusOffset((value) => !value))}
        {action("G02 toggle multiline renderer", () => setDefaultRenderer((value) => !value))}
        {action("G02 next multiline submit mode", () =>
          setSubmitModeIndex((value) => (value + 1) % SUBMIT_MODES.length),
        )}
        {action("G02 arm multiline retirement", () => {
          retainedEditorObservation = observation.current
          setRetiredProof(JSON.stringify(observation.current))
        })}
        {action("G02 read multiline retirement", () => setRetiredProof(JSON.stringify(retainedEditorObservation)))}
      </View>
      <Text testID="textarea-g02-owner">
        {JSON.stringify({
          owner,
          draft,
          submitDraft,
          submitted,
          submits,
          veto,
          disabled,
          readOnly,
          generation: editorGeneration,
          mounted: editorsMounted,
        })}
      </Text>
      <Text testID="textarea-g02-config">
        {JSON.stringify({
          ...presentation,
          width: presentation.width ?? "undefined",
          geometry,
          custom,
          defaultRenderer,
          submitMode: SUBMIT_MODES[submitModeIndex],
          defaultValue: DEFAULT_NOTES[defaultIndex] ?? "undefined",
        })}
      </Text>
      <Text testID="textarea-g02-refs">{JSON.stringify(refProof)}</Text>
      <Text testID="textarea-g02-frames">{JSON.stringify(frames)}</Text>
      <Text testID="textarea-g02-events">{JSON.stringify(events)}</Text>
      <Text testID="textarea-g02-retired">{retiredProof}</Text>
    </View>
  )
}
