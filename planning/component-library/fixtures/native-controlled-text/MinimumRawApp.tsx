import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { Button, Keyboard, ScrollView, Text, TextInput, View } from "react-native"

const OWNER_LOCATIONS = ["parent", "local"] as const
type TOwner = (typeof OWNER_LOCATIONS)[number]
type TEvent = { sequence: number; time: number; kind: string; field: "raw"; value?: string; detail?: unknown }
type TRecord = (kind: string, value?: string, detail?: unknown) => void

const FieldOwner = ({
  owner,
  parentValue,
  setParentValue,
  events,
  record,
}: {
  owner: TOwner
  parentValue: string
  setParentValue: (value: string) => void
  events: { current: TEvent[] }
  record: TRecord
}) => {
  const [localValue, setLocalValue] = useState("")
  const [snapshot, setSnapshot] = useState("")
  const input = useRef<TextInput>(null)
  const value = owner === "local" ? localValue : parentValue
  useLayoutEffect(() => {
    if (owner === "local") record("owner-commit", localValue, { owner })
  }, [localValue, owner, record])
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        ref={input}
        testID="raw-note"
        accessibilityLabel="raw controlled note"
        value={value}
        style={{ borderWidth: 1, minHeight: 44, padding: 8, fontSize: 16, color: "#171717" }}
        onChange={({ nativeEvent }) =>
          record("native-change", nativeEvent.text, { eventCount: nativeEvent.eventCount })
        }
        onChangeText={(next) => {
          record("callback", next)
          if (owner === "local") setLocalValue(next)
          else setParentValue(next)
        }}
        onKeyPress={({ nativeEvent }) => record("key", nativeEvent.key)}
        onSelectionChange={({ nativeEvent }) => record("selection", undefined, nativeEvent.selection)}
        onFocus={() => record("focus")}
        onBlur={() => record("blur")}
        onEndEditing={({ nativeEvent }) => record("end-editing", nativeEvent.text)}
      />
      <Text testID="raw-owner" style={{ color: "#171717" }}>{`raw owner: ${value}`}</Text>
      <Button
        title="Finish editing"
        onPress={() => {
          record("finish-editing")
          input.current?.blur()
          Keyboard.dismiss()
        }}
      />
      <Button
        title="Capture diagnostic trace"
        onPress={() => {
          record("capture", undefined, { owner, parentValue, localValue, controlledValue: value })
          setSnapshot(JSON.stringify(events.current))
        }}
      />
      {snapshot ? (
        <Text testID="diagnostic-events" accessibilityLabel={snapshot} numberOfLines={1} style={{ color: "#171717" }}>
          Diagnostic trace ready
        </Text>
      ) : null}
    </View>
  )
}

export const App = () => {
  const [owner, setOwner] = useState<TOwner | null>(null)
  const [parentValue, setParentValue] = useState("")
  const events = useRef<TEvent[]>([])
  const record = useCallback<TRecord>((kind, value, detail) => {
    events.current.push({ sequence: events.current.length, time: Date.now(), kind, field: "raw", value, detail })
  }, [])
  useLayoutEffect(() => {
    if (owner === "parent") record("owner-commit", parentValue, { owner })
  }, [parentValue, owner, record])
  return (
    <ScrollView
      testID="trial-root-scroll"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, paddingTop: 96, gap: 12, backgroundColor: "white" }}
    >
      <Text testID="trial-configuration" style={{ color: "#171717" }}>
        {owner ? `${owner}-owner` : "Choose owner"}
      </Text>
      {owner ? (
        <FieldOwner
          owner={owner}
          parentValue={parentValue}
          setParentValue={setParentValue}
          events={events}
          record={record}
        />
      ) : (
        OWNER_LOCATIONS.map((location) => (
          <Button
            key={location}
            testID={`${location}-owner`}
            title={location === "parent" ? "Parent owner" : "Local owner"}
            onPress={() => setOwner(location)}
          />
        ))
      )}
    </ScrollView>
  )
}
