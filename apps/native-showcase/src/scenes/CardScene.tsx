import { useRef, useState } from "react"
import { View, type TextInput } from "react-native"

import { Button, Card, Input, Text } from "@codon-ui/react-native"

export const CardScene = () => {
  const original = useRef<View>(null)
  const editor = useRef<TextInput>(null)
  const [expanded, setExpanded] = useState(false)
  const [raised, setRaised] = useState(true)
  const [position, setPosition] = useState(false)
  const [continuous, setContinuous] = useState(true)
  const [draft, setDraft] = useState("Original Card editor")
  const [reports, setReports] = useState(0)
  const [dragged, setDragged] = useState(false)
  return (
    <View style={{ gap: 10 }}>
      <Text elementType="h2">Card</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        <Button onPress={() => setExpanded((value) => !value)}>Toggle Card geometry</Button>
        <Button onPress={() => setRaised((value) => !value)}>Toggle Card shadow</Button>
        <Button onPress={() => setPosition((value) => !value)}>Toggle Card layout mode</Button>
        <Button onPress={() => setContinuous((value) => !value)}>Toggle Card corner curve</Button>
      </View>
      <Card
        ref={original}
        testID="card-scene-original"
        width={expanded ? "100%" : 260}
        raised={raised}
        layoutMode={position ? "position" : "size"}
        borderRadius={expanded ? "20%" : 12}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, rotate: expanded ? 2 : 0 }}
        transition={{ duration: 0.35 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        drag="x"
        dragConstraints={{ left: 0, right: 40 }}
        onDragStart={() => setDragged(true)}
        onDragEnd={() => setDragged(false)}
        onAnimationComplete={() => setReports((value) => value + 1)}
        customStyles={{
          padding: expanded ? 20 : 10,
          gap: 10,
          borderCurve: continuous ? "continuous" : "circular",
          borderTopLeftRadius: expanded ? "35%" : 12,
          borderBottomRightRadius: expanded ? 8 : "15%",
          borderWidth: 1,
          borderColor: "teal",
        }}
      >
        <Text elementType="h3">Original content</Text>
        <Text>Mixed text, controls and an editor keep their own refs through layout and motion.</Text>
        <Input ref={editor} accessibilityLabel="Original Card editor" value={draft} onChangeText={setDraft} />
        <Card raised={false} customStyles={{ padding: 10 }}>
          <Text>Nested Card</Text>
          <Button onPress={() => setExpanded((value) => !value)}>Change parent from child</Button>
        </Card>
      </Card>
      <Text testID="card-scene-owner">
        Draft: {draft}. Dragging: {String(dragged)}. Completed animations: {reports}.
      </Text>
    </View>
  )
}
