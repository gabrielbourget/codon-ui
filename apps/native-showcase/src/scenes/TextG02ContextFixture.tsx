import { useCallback, useRef, useState } from "react"
import { findNodeHandle, Pressable, Text as CoreText, View } from "react-native"

import { Button, Text, useNativeTheme, type TNativeTextRef } from "@codon-ui/react-native"

type TPolicy = "default" | "explicit-true"
type TEvent = { nativeEvent: object }
type TReceipt = {
  sequence: number
  kind: "parentPress"
  policy: TPolicy
  rootTag: number | null
  refIdentity: number | null
  native: Record<string, unknown>
}

export const TEXT_G02_CONTEXT_CONTENT = "Choose a context item"

export const TextG02ContextFixture = ({ increment }: { increment: () => void }) => {
  const theme = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  const [policy, setPolicy] = useState<TPolicy>("default")
  const [receipts, setReceipts] = useState<TReceipt[]>([])
  const root = useRef<TNativeTextRef | null>(null)
  const identities = useRef(new WeakMap<object, number>())
  const nextIdentity = useRef(0)
  const nextSequence = useRef(0)
  const [binding, setBinding] = useState({
    rootTag: null as number | null,
    refIdentity: null as number | null,
    attaches: 0,
    detaches: 0,
  })
  const bind = useCallback((node: TNativeTextRef | null) => {
    root.current = node
    let refIdentity: number | null = null
    if (node !== null) {
      refIdentity = identities.current.get(node) ?? ++nextIdentity.current
      identities.current.set(node, refIdentity)
    }
    setBinding((current) => ({
      rootTag: node === null ? null : findNodeHandle(node),
      refIdentity,
      attaches: current.attaches + (node === null ? 0 : 1),
      detaches: current.detaches + (node === null ? 1 : 0),
    }))
  }, [])
  const observe = (event: TEvent) => {
    const native = event.nativeEvent as Record<string, unknown>
    const receipt: TReceipt = {
      sequence: ++nextSequence.current,
      kind: "parentPress",
      policy,
      rootTag: root.current === null ? null : findNodeHandle(root.current),
      refIdentity: root.current === null ? null : (identities.current.get(root.current) ?? null),
      native: Object.fromEntries(
        ["target", "timestamp", "identifier", "pageX", "pageY", "locationX", "locationY"]
          .filter((key) => key in native)
          .map((key) => [key, native[key]]),
      ),
    }
    setReceipts((current) => [...current, receipt])
    // Every delivered ordinary action remains visible, including an unwanted parent activation.
    increment()
  }
  const state = {
    policy,
    ...binding,
    parentOrdinary: receipts.length,
    receipts,
  }
  const control = (label: string, action: () => void) => (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={action}
      style={{ minHeight: 48, padding: 8, justifyContent: "center" }}
    >
      <CoreText style={{ color: theme.colors.foreground }}>{label}</CoreText>
    </Pressable>
  )

  return (
    <View style={{ gap: 6 }}>
      {control("G02 prepare Text button context", () => {
        setPolicy("default")
        setExpanded(true)
      })}
      {expanded && (
        <>
          <Button testID="text-g02-context-owner" accessibilityLabel="Text G02 context owner" onPress={observe}>
            <Text
              testID="text-g02-context-target"
              ref={bind}
              selectable={policy === "explicit-true" ? true : undefined}
            >
              {TEXT_G02_CONTEXT_CONTENT}
            </Text>
          </Button>
          {control("G02 enable Text context selection", () => setPolicy("explicit-true"))}
          {control("G02 default Text context selection", () => setPolicy("default"))}
          <CoreText
            testID="text-g02-context-state"
            accessible
            accessibilityLabel={JSON.stringify(state)}
            numberOfLines={1}
            style={{ color: theme.colors.foreground }}
          >
            Text context {policy}; parent actions {state.parentOrdinary}
          </CoreText>
        </>
      )}
    </View>
  )
}
