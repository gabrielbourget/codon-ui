import { createContext, useContext, useRef, useState } from "react"
import type { View } from "react-native"

import { Button, Input, Modal, Select, Text } from "@codon-ui/react-native"

const DraftContext = createContext("missing")
const ContextProbe = () => <Text testID="overlay-context">Context: {useContext(DraftContext)}</Text>

export const OverlayScene = () => {
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [draft, setDraft] = useState("retained draft")
  const [selected, setSelected] = useState<string | number | null>("north")
  const [requests, setRequests] = useState(0)
  const [echo, setEcho] = useState(true)
  const [mounted, setMounted] = useState(true)
  const trigger = useRef<View>(null)
  const childTrigger = useRef<View>(null)
  const closeParent = () => {
    setParent(false)
    setChild(false)
  }
  return (
    <DraftContext.Provider value="local caller context">
      <Text elementType="h2">Native overlay chain gate</Text>
      <Text testID="overlay-state">
        Parent: {String(parent)}. Child: {String(child)}. Draft: {draft}. Selected: {selected}. Close requests:{" "}
        {requests}. Parent {echo ? "echoes" : "declines"}.
      </Text>
      <Button
        ref={trigger}
        onPress={() => {
          setMounted(true)
          setParent(true)
        }}
      >
        Open parent dialog
      </Button>
      <Button onPress={() => setEcho((value) => !value)}>Toggle overlay parent echo</Button>
      <Button onPress={() => setMounted((value) => !value)}>Toggle overlay owner</Button>
      {mounted && (
        <Modal
          testID="overlay-parent"
          accessibilityLabel="Parent editing dialog"
          isOpen={parent}
          onOpenChange={(next) => {
            setRequests((count) => count + 1)
            if (echo) setParent(next)
          }}
          restoreFocusRef={trigger}
        >
          <Text elementType="h2">Parent editing dialog</Text>
          <ContextProbe />
          <Input testID="overlay-draft" accessibilityLabel="Overlay draft" value={draft} onChangeText={setDraft} />
          <Button ref={childTrigger} onPress={() => setChild(true)}>
            Open nested dialog
          </Button>
          <Select
            testID="overlay-select"
            accessibilityLabel="Nested direction"
            closeLabel="Close nested choices"
            items={[
              { id: "north", name: "North" },
              { id: "south", name: "South" },
            ]}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            value={selected}
            onChange={setSelected}
          />
          <Button onPress={closeParent}>Close entire chain</Button>
          <Modal
            testID="overlay-child"
            accessibilityLabel="Child confirmation dialog"
            isOpen={child}
            onOpenChange={setChild}
            restoreFocusRef={childTrigger}
          >
            <Text elementType="h2">Child confirmation dialog</Text>
            <ContextProbe />
            <Text>Parent draft remains mounted underneath.</Text>
            <Button onPress={() => setChild(false)}>Close nested dialog</Button>
            <Button onPress={closeParent}>Close chain from child</Button>
            <Button onPress={() => setMounted(false)}>Unmount chain from child</Button>
          </Modal>
        </Modal>
      )}
      <Text testID="overlay-footer">Only the active leaf owns dismissal. iPhone signing remains deferred.</Text>
    </DraftContext.Provider>
  )
}
