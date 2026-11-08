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
  type ViewStyle,
} from "react-native"

import {
  AVAILABLE_INDICATOR_SHAPES,
  Button,
  Indicator,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type TNativeIndicatorProps,
  type TNativeIndicatorRef,
} from "@codon-ui/react-native"

const registered = StyleSheet.create({
  indicator: { width: 17, backgroundColor: "purple", opacity: 0.5, borderRadius: 3 },
})
const nativeColor =
  Platform.OS === "ios" ? PlatformColor("systemBlueColor") : PlatformColor("?android:attr/colorAccent")

type TStyleCase = Readonly<{
  name: string
  props: TNativeIndicatorProps
  reference: ViewStyle
}>

export const INDICATOR_G04_CASES: readonly TStyleCase[] = [
  { name: "default", props: {}, reference: { width: 10, height: 10 } },
  {
    name: "activity-border",
    props: { size: 20, color: "lime", inactiveColor: "gray", borderWidth: 2 },
    reference: { width: 20, height: 20, borderWidth: 2, borderColor: "lime" },
  },
  {
    name: "shape-fractional",
    props: {
      size: 14.5,
      shape: "rounded",
      color: "tomato",
      inactiveColor: "gray",
      borderColor: "black",
      borderWidth: 2,
    },
    reference: { width: 14.5, height: 14.5, borderWidth: 2, borderColor: "black" },
  },
  { name: "zero", props: { size: 0, borderWidth: 0 }, reference: { width: 0, height: 0 } },
  { name: "percent", props: { size: "50%", borderWidth: 0 }, reference: { width: 60, height: 60 } },
  { name: "auto", props: { size: "auto", borderWidth: 0 }, reference: { width: 0, height: 0 } },
  {
    name: "registered-callback",
    props: { color: nativeColor, customStyles: [false, registered.indicator] },
    reference: {
      width: 24,
      height: 10,
      borderRadius: 3,
      borderColor: nativeColor,
      backgroundColor: nativeColor,
      opacity: 0.75,
      marginTop: 5,
    },
  },
  {
    name: "native-color",
    props: { size: 20, color: nativeColor, inactiveColor: "gray", borderWidth: 2 },
    reference: { width: 20, height: 20, borderWidth: 2, borderColor: nativeColor },
  },
]

const sameLayout = (current: LayoutRectangle | null, next: LayoutRectangle) =>
  current &&
  current.x === next.x &&
  current.y === next.y &&
  current.width === next.width &&
  current.height === next.height

type TLayoutOwner =
  | "target"
  | "parent"
  | "reference"
  | "referenceParent"
  | "ownedRow"
  | "ownedTarget"
  | "ownedReference"
type TNativeLayoutReceipt = Readonly<{
  layout: LayoutRectangle
  nativeTarget: number | null
  currentTarget: number | null
}>
const tag = (value: unknown) =>
  typeof value === "number"
    ? value
    : value && typeof value === "object"
      ? findNodeHandle(value as TNativeIndicatorRef)
      : null

export const IndicatorG04Fixture = () => {
  const outerTheme = useNativeTheme()
  const window = useWindowDimensions()
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(true)
  const [shapeIndex, setShapeIndex] = useState(1)
  const [borderOverride, setBorderOverride] = useState(false)
  const [zeroOpacity, setZeroOpacity] = useState(false)
  const [named, setNamed] = useState(false)
  const [override, setOverride] = useState(false)
  const [actions, setActions] = useState(0)
  const root = useRef<TNativeIndicatorRef | null>(null)
  const ownedRoot = useRef<TNativeIndicatorRef | null>(null)
  const [ownedBinding, setOwnedBinding] = useState({
    rootTag: null as number | null,
    refIdentity: null as number | null,
    attaches: 0,
    detaches: 0,
  })
  const identities = useRef(new WeakMap<object, number>())
  const nextIdentity = useRef(0)
  const [binding, setBinding] = useState({
    rootTag: null as number | null,
    refIdentity: null as number | null,
    attaches: 0,
    detaches: 0,
  })
  const [layouts, setLayouts] = useState<Partial<Record<TLayoutOwner, TNativeLayoutReceipt>>>({})
  const bind = useCallback((node: TNativeIndicatorRef | null) => {
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
  const bindOwned = useCallback((node: TNativeIndicatorRef | null) => {
    if (ownedRoot.current === node) return
    ownedRoot.current = node
    if (node !== null && !identities.current.has(node)) identities.current.set(node, ++nextIdentity.current)
    setOwnedBinding((previous) => ({
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
  const current = INDICATOR_G04_CASES[index]
  return (
    <View style={{ gap: 6 }}>
      <Button
        accessibilityLabel="G04 prepare Indicator"
        onPress={() => {
          setExpanded(true)
          setIndex(0)
          setActive(true)
          setShapeIndex(1)
          setBorderOverride(false)
          setZeroOpacity(false)
          setNamed(false)
          setOverride(false)
          setActions(0)
        }}
      >
        G04 prepare Indicator
      </Button>
      {expanded && (
        <NativeThemeProvider
          mode={outerTheme.mode}
          overrides={
            override
              ? {
                  colors: { foreground: "#ff8800" },
                  radius: { round: 99, rounded: 8 },
                  actions: { primary: { foreground: "#087f8c" } },
                }
              : undefined
          }
        >
          <IndicatorG04Preview
            current={current}
            named={named}
            active={active}
            shape={AVAILABLE_INDICATOR_SHAPES[shapeIndex]}
            borderOverride={borderOverride}
            zeroOpacity={zeroOpacity}
            bind={bind}
            bindOwned={bindOwned}
            onLayout={receiveLayout}
          />
          <View
            testID="indicator-g04-state"
            accessible
            accessibilityLabel={JSON.stringify({
              case: current.name,
              index,
              named,
              active,
              shape: current.name === "shape-fractional" ? AVAILABLE_INDICATOR_SHAPES[shapeIndex] : "circle",
              borderOverride,
              zeroOpacity,
              ownedBinding,
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
            <Button accessibilityLabel="G04 IND activity" onPress={() => setActive((value) => !value)}>
              Toggle activity
            </Button>
            <Button
              accessibilityLabel="G04 IND shape"
              onPress={() => setShapeIndex((value) => (value + 1) % AVAILABLE_INDICATOR_SHAPES.length)}
            >
              Next shape
            </Button>
            <Button accessibilityLabel="G04 IND explicit border" onPress={() => setBorderOverride((value) => !value)}>
              Toggle explicit border
            </Button>
            <Button accessibilityLabel="G04 IND zero opacity" onPress={() => setZeroOpacity((value) => !value)}>
              Toggle zero opacity
            </Button>
            <Button
              accessibilityLabel="G04 IND next case"
              onPress={() => setIndex((value) => (value + 1) % INDICATOR_G04_CASES.length)}
            >
              Next indicator case
            </Button>
            <Button accessibilityLabel="G04 IND named target" onPress={() => setNamed((value) => !value)}>
              Toggle named target
            </Button>
            <Button accessibilityLabel="G04 IND provider context" onPress={() => setOverride((value) => !value)}>
              Toggle provider context
            </Button>
          </View>
          <Text testID="indicator-g04-long-copy">
            A long English indicator description remains readable and its final action stays reachable. Une longue
            description française de l’indicateur reste lisible; les dimensions et les couleurs suivent les paramètres
            choisis.
          </Text>
          <Button accessibilityLabel="G04 IND final action" onPress={() => setActions((value) => value + 1)}>
            Continue after the complete indicator description — Continuer après la description complète
          </Button>
          <Text testID="indicator-g04-end">Indicator G04 end. Actions: {actions}.</Text>
        </NativeThemeProvider>
      )}
    </View>
  )
}

type TPreviewProps = Readonly<{
  current: TStyleCase
  named: boolean
  active: boolean
  shape: TNativeIndicatorProps["shape"]
  borderOverride: boolean
  zeroOpacity: boolean
  bind: (node: TNativeIndicatorRef | null) => void
  bindOwned: (node: TNativeIndicatorRef | null) => void
  onLayout: (owner: TLayoutOwner, event: LayoutChangeEvent) => void
}>

const IndicatorG04Preview = ({
  current,
  named,
  active,
  shape,
  borderOverride,
  zeroOpacity,
  bind,
  bindOwned,
  onLayout,
}: TPreviewProps) => {
  const theme = useNativeTheme()
  const reference: ViewStyle = {
    flexShrink: 0,
    borderWidth: 0,
    borderRadius: theme.radius.round,
    borderColor: theme.colors.foreground,
    backgroundColor: active ? theme.colors.foreground : "transparent",
    ...current.reference,
  }
  if (current.name === "activity-border") {
    reference.backgroundColor = active ? "lime" : "gray"
    reference.borderColor = borderOverride ? "#174ea6" : "lime"
  }
  if (current.name === "shape-fractional") {
    reference.backgroundColor = active ? "tomato" : "gray"
    reference.borderRadius = shape === "circle" ? theme.radius.round : shape === "rounded" ? theme.radius.rounded : 0
  }
  if (current.name === "registered-callback") {
    reference.width = active ? 24 : 28
    reference.opacity = zeroOpacity ? 0 : 0.75
  }
  if (current.name === "native-color") reference.backgroundColor = active ? nativeColor : "gray"
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View
          testID="indicator-g04-parent"
          onLayout={(event) => onLayout("parent", event)}
          collapsable={false}
          style={{ width: 120, height: 120, alignItems: "flex-start", backgroundColor: theme.colors.background }}
        >
          <Indicator
            {...current.props}
            ref={bind}
            testID="indicator-g04-target"
            isActive={active}
            shape={current.name === "shape-fractional" ? shape : current.props.shape}
            borderColor={current.name === "activity-border" && borderOverride ? "#174ea6" : current.props.borderColor}
            style={
              current.name === "registered-callback"
                ? ({ isActive, defaultStyle }) => ({
                    width:
                      defaultStyle.width === 17 &&
                      defaultStyle.backgroundColor === "purple" &&
                      defaultStyle.opacity === 0.5
                        ? isActive
                          ? 24
                          : 28
                        : 32,
                    backgroundColor: nativeColor,
                    opacity: zeroOpacity ? 0 : 0.75,
                    marginTop: 5,
                  })
                : current.props.style
            }
            accessible={named}
            accessibilityLabel={named ? "G04 indicator" : undefined}
            onLayout={(event) => onLayout("target", event)}
          />
        </View>
        <View
          testID="indicator-g04-reference-parent"
          onLayout={(event) => onLayout("referenceParent", event)}
          collapsable={false}
          style={{ width: 120, height: 120, alignItems: "flex-start", backgroundColor: theme.colors.background }}
        >
          <View
            testID="indicator-g04-reference"
            onLayout={(event) => onLayout("reference", event)}
            collapsable={false}
            accessible={false}
            style={reference}
          />
        </View>
      </View>
      <Button order="primary" raised={false} accessibilityLabel="G04 IND owned foreground" onPress={() => {}}>
        <View
          testID="indicator-g04-owned-row"
          collapsable={false}
          onLayout={(event) => onLayout("ownedRow", event)}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
        >
          <Indicator
            testID="indicator-g04-owned-target"
            ref={bindOwned}
            isActive={active}
            onLayout={(event) => onLayout("ownedTarget", event)}
          />
          <View
            testID="indicator-g04-owned-reference"
            collapsable={false}
            accessible={false}
            onLayout={(event) => onLayout("ownedReference", event)}
            style={{
              flexShrink: 0,
              width: 10,
              height: 10,
              borderWidth: 0,
              borderRadius: theme.radius.round,
              borderColor: theme.actions.primary.foreground,
              backgroundColor: active ? theme.actions.primary.foreground : "transparent",
            }}
          />
        </View>
      </Button>
    </>
  )
}
