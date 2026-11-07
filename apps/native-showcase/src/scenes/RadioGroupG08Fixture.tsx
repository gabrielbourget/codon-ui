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

import { Button, Radio, RadioGroup, Text, useNativeTheme } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "reselected",
  "disabled",
  "readonly",
  "renderer",
  "nested",
  "replacement",
  "retired",
  "fresh",
  "local",
  "default-changed",
  "empty-value",
] as const
const STYLES = [
  "style-baseline",
  "horizontal",
  "wrap",
  "custom",
  "final-style",
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

export const RadioGroupG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [owned, setOwned] = useState<string | null>(null),
    [localValue, setLocalValue] = useState<string | null>("beta")
  const [nestedValue, setNestedValue] = useState<string | null>("nested")
  const [requests, setRequests] = useState<string[]>([]),
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
    custom = name === "custom" || name === "final-style"
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
          backgroundColor: name === "final-style" ? "#117733" : "#bb3322",
        }
      : {}),
    ...(name === "registered" ? StyleSheet.flatten(registered) : {}),
    ...(name === "fractional" ? { padding: 3.25, gap: 7.75 } : {}),
    ...(name === "final-style" ? { alignItems: "flex-end" } : {}),
  }
  const bind = useCallback((node: View | null) => setRootTag(tag(node)), [])
  const bindMember = useCallback((member: string, node: View | null) => {
    const next = tag(node)
    setMemberTags((old) => (old[member] === next ? old : { ...old, [member]: next }))
  }, [])
  const alphaRef = useCallback((node: View | null) => bindMember("alpha", node), [bindMember])
  const betaRef = useCallback((node: View | null) => bindMember("beta", node), [bindMember])
  const nestedRef = useCallback((node: View | null) => bindMember("nested", node), [bindMember])
  const otherRef = useCallback((node: View | null) => bindMember("other", node), [bindMember])
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
    setOwned(null)
    setLocalValue("beta")
    setNestedValue("nested")
    setRequests([])
    setPhases([])
    setEvents([])
    setReferenceAtOrigin(false)
  }
  const labels = { alpha: narrow ? LONG_LABEL : "Alpha", beta: "Beta", nested: "Nested", other: "Other" }
  const values = { alpha: name === "empty-value" ? "" : "alpha", beta: "beta", nested: "nested", other: "other" }
  const member = (id: keyof typeof labels) => (
    <Radio
      key={id}
      ref={id === "alpha" ? alphaRef : id === "beta" ? betaRef : id === "nested" ? nestedRef : otherRef}
      testID={"rgroup-native-" + id}
      accessibilityLabel={labels[id]}
      value={values[id]}
      isDisabled={false}
      customStyles={{ width: memberWidth }}
      onPress={(event) => record("press", id, event)}
    >
      {labels[id]}
    </Radio>
  )
  const contents = (
    <>
      {member("alpha")}
      {nested ? (
        <RadioGroup
          accessibilityLabel="Inner choices"
          value={nestedValue}
          onChange={(next) => {
            record("nested", next)
            setNestedValue(next)
          }}
          style={{ width: "100%", alignItems: "flex-start" }}
        >
          {member("nested")}
          {member("other")}
        </RadioGroup>
      ) : (
        member("beta")
      )}
    </>
  )
  const component = visible ? (
    <RadioGroup
      key={local ? "local" : name === "replacement" ? "replacement" : name === "fresh" ? "fresh" : "original"}
      ref={bind}
      testID="rgroup-native-root"
      accessibilityLabel="Notification options"
      onLayout={layout}
      value={local ? undefined : owned}
      defaultValue={local ? (name === "default-changed" ? null : "beta") : undefined}
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
        name === "final-style"
          ? ({ defaultStyle }) => ({
              alignItems: "flex-end",
              backgroundColor:
                defaultStyle.backgroundColor === "#bb3322" && defaultStyle.padding === 4 ? "#117733" : "#ff00ff",
            })
          : undefined
      }
      render={
        name === "renderer"
          ? (props, state) => <View {...props} nativeID={"rgroup-rendered-" + (state.value ?? "none")} />
          : undefined
      }
    >
      {contents}
    </RadioGroup>
  ) : null
  const rawMember = (id: keyof typeof labels, selected: boolean, dimmed = disabled) => (
    <View
      key={id}
      testID={"rgroup-reference-" + id}
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
        testID={"rgroup-reference-" + id + "-shape"}
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          opacity: 1,
          backgroundColor: selected ? theme.colors.controlSelectedBackground : theme.colors.controlBackground,
          borderWidth: 2,
          borderColor: theme.colors.controlBorder,
          borderRadius: theme.radius.rounded,
        }}
      />
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
  const reference = visible ? (
    <View testID="rgroup-native-reference" collapsable={false} style={rootStyle}>
      {rawMember("alpha", value === values.alpha)}
      {nested ? (
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: theme.spacing.unit * 2,
            width: "100%",
          }}
        >
          {rawMember("nested", nestedValue === "nested", false)}
          {rawMember("other", nestedValue === "other", false)}
        </View>
      ) : (
        rawMember("beta", value === "beta")
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
    values,
    referenceAtOrigin,
    themeMode: theme.mode,
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles"] as const).map((next) => (
          <Button key={next} raised={false} onPress={() => changeMode(next)}>
            RadioGroup {next} checks
          </Button>
        ))}
      </View>
      <Text testID="rgroup-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        RadioGroup check: {name}
      </Text>
      <Button
        raised={false}
        onPress={() => {
          setIndex((old) => (old + 1) % cases.length)
          setReferenceAtOrigin(false)
        }}
      >
        Next RadioGroup check
      </Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Show RadioGroup reference
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
          Show RadioGroup component
        </Button>
      </View>
      <View
        testID="rgroup-native-pair"
        collapsable={false}
        style={{ width: "100%", maxWidth: 280, height: 456, position: "relative" }}
      >
        <View
          testID="rgroup-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <View style={{ width: "100%", opacity: referenceAtOrigin ? 0 : 1 }}>{component}</View>
        </View>
        <View
          testID="rgroup-native-reference-parent"
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
