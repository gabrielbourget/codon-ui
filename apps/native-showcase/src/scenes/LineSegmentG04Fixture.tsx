import { useCallback, useRef, useState } from "react"
import {
  findNodeHandle,
  Platform,
  PlatformColor,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutRectangle,
  type LayoutChangeEvent,
} from "react-native"

import {
  Button,
  LineSegment,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type TNativeLineSegmentProps,
  type TNativeLineSegmentRef,
} from "@codon-ui/react-native"

const registered = StyleSheet.create({ line: { borderRadius: 3, backgroundColor: "purple" } })
const nativeColor =
  Platform.OS === "ios" ? PlatformColor("systemBlueColor") : PlatformColor("?android:attr/colorAccent")

type TStyleCase = Readonly<{
  name: string
  props: TNativeLineSegmentProps
  reference: TNativeLineSegmentProps["customStyles"]
}>

export const LINE_SEGMENT_G04_CASES: readonly TStyleCase[] = [
  { name: "default-horizontal", props: {}, reference: { width: 2.5, height: 50 } },
  {
    name: "horizontal-red",
    props: { direction: "horizontal", height: 80, size: 4, color: "red" },
    reference: { width: 4, height: 80, backgroundColor: "red" },
  },
  { name: "default-vertical", props: { direction: "vertical" }, reference: { width: 50, height: 2.5 } },
  {
    name: "vertical-blue",
    props: { direction: "vertical", width: 100, size: 5, color: "blue" },
    reference: { width: 100, height: 5, backgroundColor: "blue" },
  },
  {
    name: "custom-class-equivalent",
    props: { customStyles: { opacity: 0.7, borderRadius: 2 } },
    reference: { width: 2.5, height: 50, opacity: 0.7, borderRadius: 2 },
  },
  {
    name: "computed-custom-final",
    props: {
      color: "green",
      customStyles: { backgroundColor: "purple", opacity: 0.5 },
      style: { backgroundColor: "tomato", marginTop: 5 },
    },
    reference: { width: 2.5, height: 50, backgroundColor: "tomato", opacity: 0.5, marginTop: 5 },
  },
  {
    name: "custom-opacity-radius",
    props: { customStyles: { opacity: 0.5, borderRadius: 4 } },
    reference: { width: 2.5, height: 50, opacity: 0.5, borderRadius: 4 },
  },
  {
    name: "custom-color",
    props: { color: "green", customStyles: { backgroundColor: "purple" } },
    reference: { width: 2.5, height: 50, backgroundColor: "purple" },
  },
  { name: "native-numeric", props: { height: 100, size: 3 }, reference: { width: 3, height: 100 } },
  { name: "zero", props: { direction: "vertical", width: 0, height: 0, size: 0 }, reference: { width: 0, height: 0 } },
  { name: "zero-height", props: { height: 0, size: 3 }, reference: { width: 3, height: 0 } },
  { name: "zero-width", props: { direction: "vertical", width: 0, size: 5 }, reference: { width: 0, height: 5 } },
  { name: "percent-height-zero-thickness", props: { height: "50%", size: 0 }, reference: { width: 0, height: 60 } },
  { name: "percent-height", props: { height: "50%", size: 3 }, reference: { width: 3, height: 60 } },
  {
    name: "percent-width",
    props: { direction: "vertical", width: "80%", size: 5 },
    reference: { width: 96, height: 5 },
  },
  { name: "percent-thickness", props: { height: 50, size: "50%" }, reference: { width: 60, height: 50 } },
  {
    name: "percent-thickness-vertical",
    props: { direction: "vertical", width: 50, size: "50%" },
    reference: { width: 50, height: 60 },
  },
  { name: "auto-height", props: { height: "auto", size: 2.5 }, reference: { width: 2.5, height: 0 } },
  {
    name: "auto-width",
    props: { direction: "vertical", width: "auto", size: 2.5 },
    reference: { width: 0, height: 2.5 },
  },
  { name: "auto-thickness-horizontal", props: { height: 50, size: "auto" }, reference: { width: 0, height: 50 } },
  {
    name: "auto-thickness-vertical",
    props: { direction: "vertical", width: 50, size: "auto" },
    reference: { width: 50, height: 0 },
  },
  {
    name: "registered-array",
    props: { customStyles: [false, registered.line], style: [undefined, { width: 8, height: 60 }] },
    reference: { width: 8, height: 60, borderRadius: 3, backgroundColor: "purple" },
  },
  {
    name: "array-zero-opacity",
    props: { customStyles: [undefined, registered.line], style: [false, { opacity: 0 }] },
    reference: { width: 2.5, height: 50, borderRadius: 3, backgroundColor: "purple", opacity: 0 },
  },
  {
    name: "post-custom-callback-horizontal",
    props: {
      customStyles: { width: 17, backgroundColor: "purple" },
      style: ({ direction, defaultStyle }) => [
        defaultStyle,
        {
          width:
            direction === "horizontal" && defaultStyle.width === 17 && defaultStyle.backgroundColor === "purple"
              ? 24
              : 28,
        },
      ],
    },
    reference: { width: 24, height: 50, backgroundColor: "purple" },
  },
  {
    name: "post-custom-callback-vertical",
    props: {
      direction: "vertical",
      customStyles: { width: 17, backgroundColor: "purple" },
      style: ({ direction, defaultStyle }) => [
        defaultStyle,
        {
          width:
            direction === "vertical" && defaultStyle.width === 17 && defaultStyle.backgroundColor === "purple"
              ? 24
              : 28,
        },
      ],
    },
    reference: { width: 24, height: 2.5, backgroundColor: "purple" },
  },
  {
    name: "native-color",
    props: { color: nativeColor, size: 8 },
    reference: { width: 8, height: 50, backgroundColor: nativeColor },
  },
]

const sameLayout = (current: LayoutRectangle | null, next: LayoutRectangle) =>
  current &&
  current.x === next.x &&
  current.y === next.y &&
  current.width === next.width &&
  current.height === next.height

type TLayoutOwner = "target" | "parent" | "reference" | "referenceParent"
type TNativeLayoutReceipt = Readonly<{
  layout: LayoutRectangle
  nativeTarget: number | null
  currentTarget: number | null
}>
const tag = (value: unknown) =>
  typeof value === "number"
    ? value
    : value && typeof value === "object"
      ? findNodeHandle(value as TNativeLineSegmentRef)
      : null

export const LineSegmentG04Fixture = () => {
  const outerTheme = useNativeTheme()
  const window = useWindowDimensions()
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)
  const [named, setNamed] = useState(false)
  const [override, setOverride] = useState(false)
  const [actions, setActions] = useState(0)
  const root = useRef<TNativeLineSegmentRef | null>(null)
  const identities = useRef(new WeakMap<object, number>())
  const nextIdentity = useRef(0)
  const [binding, setBinding] = useState({
    rootTag: null as number | null,
    refIdentity: null as number | null,
    attaches: 0,
    detaches: 0,
  })
  const [layouts, setLayouts] = useState<Partial<Record<TLayoutOwner, TNativeLayoutReceipt>>>({})
  const bind = useCallback((node: TNativeLineSegmentRef | null) => {
    if (root.current === node) return
    root.current = node
    if (node !== null && !identities.current.has(node)) identities.current.set(node, ++nextIdentity.current)
    setBinding((previous) => ({
      rootTag: node === null ? null : findNodeHandle(node),
      refIdentity: node === null ? null : (identities.current.get(node) ?? null),
      attaches: previous.attaches + (node === null ? 0 : 1),
      detaches: previous.detaches + (node === null ? 1 : 0),
    }))
  }, [])
  const receiveLayout = useCallback((owner: TLayoutOwner, event: LayoutChangeEvent) => {
    const native = event.nativeEvent as unknown as Record<string, unknown>
    const next = {
      layout: { ...event.nativeEvent.layout },
      nativeTarget: tag(native.target),
      currentTarget: tag(event.currentTarget),
    }
    setLayouts((previous) =>
      sameLayout(previous[owner]?.layout ?? null, next.layout) &&
      previous[owner]?.nativeTarget === next.nativeTarget &&
      previous[owner]?.currentTarget === next.currentTarget
        ? previous
        : { ...previous, [owner]: next },
    )
  }, [])
  const current = LINE_SEGMENT_G04_CASES[index]
  return (
    <View style={{ gap: 6 }}>
      <Button
        accessibilityLabel="G04 prepare LineSegment"
        onPress={() => {
          setExpanded(true)
          setIndex(0)
          setNamed(false)
          setOverride(false)
          setActions(0)
        }}
      >
        G04 prepare LineSegment
      </Button>
      {expanded && (
        <NativeThemeProvider
          mode={outerTheme.mode}
          overrides={override ? { colors: { controlBorder: "#ff8800" } } : undefined}
        >
          <LineSegmentG04Preview current={current} named={named} bind={bind} onLayout={receiveLayout} />
          <View
            testID="line-segment-g04-state"
            accessible
            accessibilityLabel={JSON.stringify({
              case: current.name,
              index,
              named,
              override,
              actions,
              layout: layouts.target?.layout ?? null,
              layouts,
              ...binding,
              mode: outerTheme.mode,
              window: { width: window.width, height: window.height, fontScale: window.fontScale, scale: window.scale },
            })}
            style={{ width: 1, height: 1 }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Button
              accessibilityLabel="G04 LS next case"
              onPress={() => setIndex((value) => (value + 1) % LINE_SEGMENT_G04_CASES.length)}
            >
              Next segment case
            </Button>
            <Button accessibilityLabel="G04 LS named boundary" onPress={() => setNamed((value) => !value)}>
              Toggle named boundary
            </Button>
            <Button accessibilityLabel="G04 LS provider border" onPress={() => setOverride((value) => !value)}>
              Toggle provider border
            </Button>
          </View>
          <Text testID="line-segment-g04-long-copy">
            A long English boundary description remains readable and its final action stays reachable. Une longue
            description française de la limite reste lisible; les dimensions et les couleurs suivent les paramètres
            choisis.
          </Text>
          <Button accessibilityLabel="G04 LS final action" onPress={() => setActions((value) => value + 1)}>
            Continue after the complete boundary description — Continuer après la description complète
          </Button>
          <Text testID="line-segment-g04-end">LineSegment G04 end. Actions: {actions}.</Text>
        </NativeThemeProvider>
      )}
    </View>
  )
}

type TPreviewProps = Readonly<{
  current: TStyleCase
  named: boolean
  bind: (node: TNativeLineSegmentRef | null) => void
  onLayout: (owner: TLayoutOwner, event: LayoutChangeEvent) => void
}>

const LineSegmentG04Preview = ({ current, named, bind, onLayout }: TPreviewProps) => {
  const theme = useNativeTheme()
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <View
        testID="line-segment-g04-parent"
        onLayout={(event) => onLayout("parent", event)}
        collapsable={false}
        style={{ width: 120, height: 120, alignItems: "flex-start", backgroundColor: theme.colors.background }}
      >
        <LineSegment
          {...current.props}
          ref={bind}
          testID="line-segment-g04-target"
          accessible={named}
          accessibilityLabel={named ? "G04 boundary" : undefined}
          onLayout={(event) => onLayout("target", event)}
        />
      </View>
      <View
        testID="line-segment-g04-reference-parent"
        onLayout={(event) => onLayout("referenceParent", event)}
        collapsable={false}
        style={{ width: 120, height: 120, alignItems: "flex-start", backgroundColor: theme.colors.background }}
      >
        <View
          testID="line-segment-g04-reference"
          onLayout={(event) => onLayout("reference", event)}
          collapsable={false}
          accessible={false}
          style={[{ backgroundColor: theme.colors.controlBorder }, current.reference]}
        />
      </View>
    </View>
  )
}
