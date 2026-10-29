import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react"
import { Pressable, Text, View } from "react-native"

import { NativeThemeProvider, ToggleSwitcher } from "../../../.."

type TLabelActions = { grow: () => void; reset: () => void }
const AuthoredLabel = forwardRef<TLabelActions, { original?: Ref<Text> }>(({ original }, actions) => {
  const [text, setText] = useState("Short")
  useImperativeHandle(
    actions,
    () => ({ grow: () => setText("A longer original authored label"), reset: () => setText("Short") }),
    [],
  )
  return (
    <Text ref={original} numberOfLines={1}>
      {text}
    </Text>
  )
})
export const ToggleSwitcherFixture = ({ rootRef, labelRef }: { rootRef?: Ref<View>; labelRef?: Ref<Text> }) => {
  const actions = useRef<TLabelActions>(null)
  const [selected, setSelected] = useState("and"),
    [requests, setRequests] = useState<string[]>([]),
    [dark, setDark] = useState(false)
  const items = useMemo(
    () => [
      { id: "and", label: <AuthoredLabel ref={actions} original={labelRef} />, accessibilityLabel: "First choice" },
      { id: "or", label: "Second", accessibilityLabel: "Second choice" },
    ],
    [labelRef],
  )
  return (
    <NativeThemeProvider mode={dark ? "dark" : "light"}>
      <View>
        <Text>Original authored label and equal-column source fixture</Text>
        <Pressable
          role="button"
          accessibilityLabel="Grow authored switcher label"
          onPress={() => actions.current?.grow()}
        >
          <Text>Grow authored label</Text>
        </Pressable>
        <Pressable role="button" accessibilityLabel="Toggle switcher theme" onPress={() => setDark((value) => !value)}>
          <Text>Toggle theme</Text>
        </Pressable>
        <Pressable
          role="button"
          accessibilityLabel="Reset switcher fixture"
          onPress={() => {
            actions.current?.reset()
            setSelected("and")
            setRequests([])
            setDark(false)
          }}
        >
          <Text>Reset fixture</Text>
        </Pressable>
        <ToggleSwitcher
          ref={rootRef}
          items={items}
          selectedKey={selected}
          onSelectionChange={(next) => {
            setRequests((current) => [...current, next])
            setSelected(next)
          }}
        />
        <Text testID="switcher-fixture-state">{JSON.stringify({ selected, requests, dark })}</Text>
      </View>
    </NativeThemeProvider>
  )
}
