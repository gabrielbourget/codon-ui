import { useCallback, useState } from "react"
import {
  findNodeHandle,
  StyleSheet,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native"

import { Button, Checkbox, CheckboxGroup, Text, useNativeTheme } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "disabled",
  "readonly",
  "renderer",
  "nested",
  "replacement",
  "retired",
  "fresh",
  "local",
  "default-changed",
] as const
const STYLES = [
  "style-baseline",
  "horizontal",
  "wrap",
  "custom",
  "final",
  "registered",
  "fractional",
  "percentage",
  "long-narrow",
  "zero",
  "dark",
  "light-restored",
] as const
const LONG_LABEL = "Conserver les paramètres puis continuer pour enregistrer les modifications."
const registered = StyleSheet.create({
  root: { padding: 3, borderWidth: 1, borderColor: "#265b99", backgroundColor: "#ddf2e7" },
}).root
type TMode = "behavior" | "styles"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}
type TEvent = { phase: string; member: string; target: number | null; currentTarget: number | null }
const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))

export const CheckboxGroupG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [owned, setOwned] = useState<string[]>([]),
    [localValue, setLocalValue] = useState<string[]>(["beta"])
  const [nestedValue, setNestedValue] = useState<string[]>(["nested"]),
    [looseValue, setLooseValue] = useState(true)
  const [requests, setRequests] = useState<string[][]>([]),
    [phases, setPhases] = useState<string[]>([]),
    [events, setEvents] = useState<TEvent[]>([])
  const [rootTag, setRootTag] = useState<number | null>(null),
    [memberTags, setMemberTags] = useState<Record<string, number | null>>({})
  const [layouts, setLayouts] = useState<TLayout[]>([]),
    [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const cases = mode === "styles" ? STYLES : BEHAVIOR,
    name = cases[index]
  const local = name === "local" || name === "default-changed",
    visible = name !== "retired",
    nested = name === "nested"
  const disabled = name === "disabled",
    readonly = name === "readonly",
    narrow = name === "long-narrow",
    zero = name === "zero"
  const horizontal = name === "horizontal" || name === "wrap",
    custom = name === "custom" || name === "final"
  const value = local ? localValue : owned
  const width = zero
    ? 0
    : name === "horizontal"
      ? 256
      : narrow
        ? 140
        : name === "percentage"
          ? "50%"
          : name === "fractional"
            ? 199.75
            : 200
  const memberWidth = narrow ? "100%" : 106
  const rootStyle: ViewStyle = {
    flexDirection: horizontal ? "row" : "column",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.unit * 2,
    width,
    ...(zero ? { height: 0, overflow: "hidden" } : {}),
    ...(custom
      ? {
          padding: 4,
          borderWidth: 2,
          borderColor: "#265b99",
          backgroundColor: name === "final" ? "#117733" : "#bb3322",
        }
      : {}),
    ...(name === "registered" ? StyleSheet.flatten(registered) : {}),
    ...(name === "fractional" ? { padding: 3.25, gap: 7.75 } : {}),
    ...(name === "final" ? { alignItems: "flex-end" } : {}),
  }
  const bind = useCallback((node: View | null) => setRootTag(tag(node)), [])
  const bindMember = useCallback((member: string, node: View | null) => {
    const next = tag(node)
    setMemberTags((old) => (old[member] === next ? old : { ...old, [member]: next }))
  }, [])
  const alphaRef = useCallback((node: View | null) => bindMember("alpha", node), [bindMember])
  const betaRef = useCallback((node: View | null) => bindMember("beta", node), [bindMember])
  const nestedRef = useCallback((node: View | null) => bindMember("nested", node), [bindMember])
  const looseRef = useCallback((node: View | null) => bindMember("loose", node), [bindMember])
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) =>
      old.at(-1)?.currentTarget === row.currentTarget &&
      JSON.stringify(old.at(-1)?.layout) === JSON.stringify(row.layout)
        ? old
        : [...old, row],
    )
  }
  const record = (phase: string, member: string, event?: { target: unknown; currentTarget: unknown }) => {
    const row = { phase, member, target: tag(event?.target), currentTarget: tag(event?.currentTarget) }
    setPhases((old) => [...old, phase + ":" + member])
    setEvents((old) => [...old, row])
  }
  const changeMode = (next: TMode) => {
    setMode(next)
    setIndex(0)
    setOwned([])
    setLocalValue(["beta"])
    setNestedValue(["nested"])
    setLooseValue(true)
    setRequests([])
    setPhases([])
    setEvents([])
    setReferenceAtOrigin(false)
  }
  const labels = { alpha: narrow ? LONG_LABEL : "Alpha", beta: "Beta", nested: "Nested", loose: "Loose" }
  const member = (id: keyof typeof labels) => (
    <Checkbox
      key={id}
      ref={id === "alpha" ? alphaRef : id === "beta" ? betaRef : id === "nested" ? nestedRef : looseRef}
      testID={"cgroup-native-" + id}
      accessibilityLabel={labels[id]}
      value={id === "loose" ? undefined : id}
      isSelected={id === "loose" ? undefined : true}
      defaultSelected={id === "loose" ? true : undefined}
      isDisabled={false}
      isReadOnly={false}
      customStyles={{ width: memberWidth }}
      onChange={(next) => {
        record("member", id)
        if (id === "loose") setLooseValue(next)
      }}
      onPress={(event) => record("press", id, event)}
    >
      {labels[id]}
    </Checkbox>
  )
  const contents = (
    <>
      {member("alpha")}
      {nested ? (
        <>
          <CheckboxGroup
            value={nestedValue}
            onChange={(next) => {
              record("nested", "nested")
              setNestedValue(next)
            }}
            style={{ width: "100%", alignItems: "flex-start" }}
          >
            {member("nested")}
          </CheckboxGroup>
          {member("loose")}
        </>
      ) : (
        member("beta")
      )}
    </>
  )
  const component = visible ? (
    <CheckboxGroup
      key={local ? "local" : name === "replacement" ? "replacement" : name === "fresh" ? "fresh" : "original"}
      ref={bind}
      testID="cgroup-native-root"
      accessibilityLabel="Notification options"
      onLayout={layout}
      value={local ? undefined : owned}
      defaultValue={local ? (name === "default-changed" ? ["alpha", "beta"] : ["beta"]) : undefined}
      isDisabled={disabled}
      isReadOnly={readonly}
      orientation={horizontal ? "horizontal" : "vertical"}
      onChange={(next) => {
        setRequests((old) => [...old, next])
        record("group", "root")
        if (local) setLocalValue(next)
        else if (name !== "baseline") setOwned(next)
      }}
      customStyles={[
        { width, ...(zero ? { height: 0, overflow: "hidden" } : {}) },
        custom ? { padding: 4, borderWidth: 2, borderColor: "#265b99", backgroundColor: "#bb3322" } : undefined,
        name === "registered" ? registered : undefined,
        name === "fractional" ? { padding: 3.25, gap: 7.75 } : undefined,
      ]}
      style={
        name === "final"
          ? ({ defaultStyle }) => ({
              alignItems: "flex-end",
              backgroundColor:
                defaultStyle.backgroundColor === "#bb3322" && defaultStyle.padding === 4 ? "#117733" : "#ff00ff",
            })
          : undefined
      }
      render={
        name === "renderer"
          ? (props, state) => <View {...props} nativeID={"cgroup-rendered-" + state.value.join("-")} />
          : undefined
      }
    >
      {name === "renderer"
        ? ({ value: current, defaultChildren }) => (
            <>
              {current.join("|") === value.join("|") && defaultChildren === undefined ? contents : "WRONG CHILD STATE"}
            </>
          )
        : contents}
    </CheckboxGroup>
  ) : null
  const rawMember = (id: keyof typeof labels, selected: boolean, dimmed = disabled) => {
    const markWidth = 20,
      markHeight = 20,
      checkWidth = markWidth * 0.3,
      checkHeight = markHeight * 0.55
    const checkBounds = (checkWidth + checkHeight) * Math.SQRT1_2,
      checkInset = (markWidth - checkBounds) / 2
    return (
      <View
        key={id}
        testID={"cgroup-reference-" + id}
        collapsable={false}
        style={{
          width: memberWidth,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.unit,
          opacity: dimmed ? theme.opacity.disabled : 1,
        }}
      >
        <View
          testID={"cgroup-reference-" + id + "-shape"}
          style={{
            width: 20,
            height: 20,
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? theme.colors.controlSelectedBackground : theme.colors.controlBackground,
            borderWidth: 2,
            borderColor: selected ? theme.colors.controlSelectedBackground : theme.colors.controlBorder,
            borderRadius: theme.radius.rounded,
            shadowColor: "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
          }}
        >
          {selected ? (
            <View pointerEvents="none" style={{ width: markWidth, height: markHeight }}>
              <View
                style={{
                  position: "absolute",
                  left: checkInset,
                  width: checkBounds,
                  height: markHeight,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: -checkInset,
                    width: markWidth,
                    height: markHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    testID={"cgroup-reference-" + id + "-check"}
                    style={{
                      width: checkWidth,
                      height: checkHeight,
                      borderRightWidth: 2,
                      borderBottomWidth: 2,
                      borderColor: theme.colors.controlSelectedForeground,
                      transform: [{ rotate: "45deg" }],
                      marginTop: -markHeight * 0.15,
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </View>
        <RawText
          accessible={false}
          selectable={false}
          style={{
            flexShrink: 1,
            color: theme.colors.foreground,
            fontSize: theme.typography.fontSizes.b10,
            fontFamily: theme.typography.fontFamilies.body,
            fontWeight: theme.typography.fontWeights.regular,
            fontStyle: "normal",
            lineHeight: theme.typography.lineHeight,
          }}
        >
          {labels[id]}
        </RawText>
      </View>
    )
  }
  const reference = visible ? (
    <View testID="cgroup-native-reference" collapsable={false} style={rootStyle}>
      {rawMember("alpha", value.includes("alpha"))}
      {nested ? (
        <>
          <View
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: theme.spacing.unit * 2,
              width: "100%",
            }}
          >
            {rawMember("nested", nestedValue.includes("nested"), false)}
          </View>
          {rawMember("loose", looseValue)}
        </>
      ) : (
        rawMember("beta", value.includes("beta"))
      )}
    </View>
  ) : null
  const snapshot = {
    case: name,
    mode,
    scale,
    rootTag,
    memberTags,
    layouts,
    value,
    nestedValue,
    looseValue,
    requests,
    phases,
    events,
    disabled,
    readonly,
    visible,
    nested,
    local,
    zero,
    narrow,
    horizontal,
    width,
    rootStyle,
    memberWidth,
    labels,
    referenceAtOrigin,
    themeMode: theme.mode,
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles"] as const).map((next) => (
          <Button key={next} raised={false} onPress={() => changeMode(next)}>
            CheckboxGroup {next} checks
          </Button>
        ))}
      </View>
      <Text testID="cgroup-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        CheckboxGroup check: {name}
      </Text>
      <Button
        raised={false}
        onPress={() => {
          setIndex((old) => (old + 1) % cases.length)
          setReferenceAtOrigin(false)
        }}
      >
        Next CheckboxGroup check
      </Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Show CheckboxGroup reference
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
          Show CheckboxGroup component
        </Button>
      </View>
      <View
        testID="cgroup-native-pair"
        collapsable={false}
        style={{ width: "100%", maxWidth: 280, height: 456, position: "relative" }}
      >
        <View
          testID="cgroup-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <View style={{ width: "100%", opacity: referenceAtOrigin ? 0 : 1 }}>{component}</View>
        </View>
        <View
          testID="cgroup-native-reference-parent"
          collapsable={false}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: referenceAtOrigin ? 0 : 232,
            left: 0,
            width: "100%",
            height: 224,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {reference}
        </View>
      </View>
    </View>
  )
}
