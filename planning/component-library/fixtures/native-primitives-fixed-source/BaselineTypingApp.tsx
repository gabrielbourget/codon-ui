import { useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import {
  AlertDialog,
  Button,
  Input,
  Modal,
  NativeOverlayProvider,
  NativeThemeProvider,
  Select,
  Text,
  useNativeTheme,
} from "@codon-ui/react-native"

const OPTIONS = Array.from({ length: 48 }, (_, index) => ({
  key: index === 0 ? 0 : index === 1 ? "0" : index,
  label: index === 0 ? "Numeric zero" : index === 1 ? "String zero" : `Direction ${index}`,
}))

const LocalProbe = () => {
  const [count, setCount] = useState(0)
  return (
    <>
      <Text testID="local-counter">Local count: {count}</Text>
      <Button onPress={() => setCount((value) => value + 1)}>Increment local counter</Button>
      <Input testID="local-input" accessibilityLabel="Local uncontrolled note" defaultValue="Local draft" />
    </>
  )
}

const BaselineAlert = ({ confirm }: { confirm: () => void }) => {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const trigger = useRef<View>(null)
  return (
    <>
      <Button ref={trigger} onPress={() => setOpen(true)}>
        Open trial alert
      </Button>
      <AlertDialog
        testID="baseline-alert"
        accessibilityLabel="Trial confirmation"
        isOpen={open}
        onOpenChange={setOpen}
        titleText="Confirm trial change"
        bodyText="Review this isolated change."
        confirmAction={confirm}
        restoreFocusRef={trigger}
        labels={{
          cancelActionButtonAriaLabel: "Cancel trial confirmation",
          confirmActionButtonAriaLabel: "Confirm trial confirmation",
        }}
      >
        <Input testID="alert-note" accessibilityLabel="Alert note" value={note} onChangeText={setNote} />
        <Text testID="alert-note-state">Controlled note: {note}</Text>
      </AlertDialog>
    </>
  )
}

const Scene = ({ toggleTheme }: { toggleTheme: () => void }) => {
  const theme = useNativeTheme()
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [selected, setSelected] = useState<string | number | null>(0)
  const [confirms, setConfirms] = useState(0)
  const parentTrigger = useRef<View>(null)
  const parentHeading = useRef<View>(null)
  const childTrigger = useRef<View>(null)
  const childHeading = useRef<View>(null)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        testID="trial-root-scroll"
        contentContainerStyle={{ padding: theme.spacing.unit * 4, gap: theme.spacing.unit * 4 }}
      >
        <Text testID="trial-configuration">Host: baseline; theme: {theme.mode}</Text>
        <Button ref={parentTrigger} onPress={() => setParent(true)}>
          Open trial parent
        </Button>
        <Modal
          testID="trial-parent-core"
          accessibilityLabel="Trial parent dialog"
          isOpen={parent}
          onOpenChange={setParent}
          isScrollable={false}
          initialFocusRef={parentHeading}
          restoreFocusRef={parentTrigger}
          customDialogStyles={{ padding: 0 }}
        >
          <ScrollView
            testID="trial-parent"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: theme.spacing.unit * 4, gap: theme.spacing.unit * 4 }}
          >
            <Text ref={parentHeading} elementType="h2" variant="h3">
              Trial parent dialog
            </Text>
            <Text testID="trial-parent-context">Baseline native components; theme: {theme.mode}</Text>
            <Text testID="parent-state">Confirms: {confirms}</Text>
            <LocalProbe />
            <Button onPress={toggleTheme}>Toggle overlay theme</Button>
            <Text testID="selected-value">
              Selection: {typeof selected}:{selected}
            </Text>
            <Select
              testID="baseline-select"
              accessibilityLabel="Open trial selection"
              closeLabel="Close trial selection"
              items={OPTIONS}
              getKey={(option) => option.key}
              getTextValue={(option) => option.label}
              value={selected}
              onChange={setSelected}
            />
            <BaselineAlert confirm={() => setConfirms((value) => value + 1)} />
            <Button ref={childTrigger} onPress={() => setChild(true)}>
              Open trial child
            </Button>
            <Modal
              testID="trial-child-core"
              accessibilityLabel="Trial child dialog"
              isOpen={child}
              onOpenChange={setChild}
              initialFocusRef={childHeading}
              restoreFocusRef={childTrigger}
            >
              <View testID="trial-child" style={{ gap: theme.spacing.unit * 4 }}>
                <Text ref={childHeading} elementType="h2" variant="h3">
                  Trial child dialog
                </Text>
                <Button onPress={() => setChild(false)}>Close trial-child</Button>
              </View>
            </Modal>
            <Button onPress={() => setParent(false)}>Close trial-parent</Button>
          </ScrollView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  )
}

export const App = () => {
  const [dark, setDark] = useState(false)
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <NativeOverlayProvider>
          <Scene toggleTheme={() => setDark((value) => !value)} />
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
