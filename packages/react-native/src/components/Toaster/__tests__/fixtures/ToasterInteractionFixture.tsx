import { useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
import { ToasterObserver, toast } from "../../stateManagement"
import { Toaster } from "../../Toaster"
import { AVAILABLE_TOAST_POSITIONS, type TNativeToast, type TNativeToastID } from "../../types"

const IDS = [0, "0", ""] as const
const LIMITS = [5, 1, 0] as const
const describeID = (id: TNativeToastID) => `${typeof id}:${JSON.stringify(id)}`

export const ToasterInteractionFixture = () => {
  const [dark, setDark] = useState(false)
  const [idIndex, setIDIndex] = useState(0)
  const [positionIndex, setPositionIndex] = useState(2)
  const [limitIndex, setLimitIndex] = useState(0)
  const [zeroGap, setZeroGap] = useState(false)
  const [zeroDuration, setZeroDuration] = useState(false)
  const [important, setImportant] = useState(false)
  const [localized, setLocalized] = useState(false)
  const [custom, setCustom] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [events, setEvents] = useState<string[]>([])
  const [frame, setFrame] = useState("unmeasured")
  const sequence = useRef(0)
  const id = IDS[idIndex]
  const position = AVAILABLE_TOAST_POSITIONS[positionIndex]
  const record = (message: string) => setEvents((current) => [...current.slice(-11), message])
  const publish = (update = false) => {
    const count = ++sequence.current
    const payload: TNativeToast = {
      id,
      type: "error",
      important,
      duration: zeroDuration ? 0 : "persistent",
      titleText: empty ? "" : `${update ? "Updated" : "Notice"} ${describeID(id)} ${count}`,
      bodyText: `Owned payload ${count}. Drag this content outward to dismiss.`,
      labels: localized ? { confirmActionButton: "Valider" } : undefined,
      customStyles: custom ? [styles.toast, { color: "#a66b00" }] : undefined,
      customTitleStyles: custom ? { color: "#ffffff" } : undefined,
      customBodyTextProps: { testID: `fixture-toast-body-${describeID(id)}` },
      customConfirmButtonStyles: custom ? { marginLeft: 3 } : undefined,
      cancelAction: () => record(`cancel:${describeID(id)}`),
      confirmAction: () => record(`confirm:${describeID(id)}`),
      onDismiss: (current) => record(`dismiss:${describeID(current.id)}:${current.bodyText}`),
      onAutoClose: (current) => record(`auto:${describeID(current.id)}`),
    }
    toast(payload)
    record(`${update ? "update" : "publish"}:${describeID(id)}`)
  }
  return (
    <NativeThemeProvider mode={dark ? "dark" : "light"}>
      <NativeFloatingLayerHost
        testID="toaster-fixture-host"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setFrame(`${width}x${height}`)
        }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text elementType="h1" nativeID="toaster-fixture-heading">
            Private Toaster interaction fixture
          </Text>
          <Text nativeID="toaster-fixture-description">
            Publish and update typed IDs, change presentation, then exercise native actions and outward swipes.
          </Text>
          <Text testID="toaster-fixture-state">
            ID {describeID(id)}. Position {position}. Limit {LIMITS[limitIndex]}. Gap {zeroGap ? 0 : 15}. Duration{" "}
            {zeroDuration ? 0 : "persistent"}. Important {String(important)}. Theme {dark ? "dark" : "light"}. Frame{" "}
            {frame}.
          </Text>
          <View style={styles.controls}>
            <Button onPress={() => publish()}>Publish notification</Button>
            <Button onPress={() => publish(true)}>Update current ID</Button>
            <Button
              onPress={() => {
                ToasterObserver.dismiss(id)
                record(`programmatic:${describeID(id)}`)
              }}
            >
              Dismiss current ID
            </Button>
            <Button
              onPress={() => {
                ToasterObserver.dismiss()
                record("programmatic:all")
              }}
            >
              Dismiss all notifications
            </Button>
            <Button onPress={() => setIDIndex((current) => (current + 1) % IDS.length)}>Cycle typed ID</Button>
            <Button onPress={() => setPositionIndex((current) => (current + 1) % AVAILABLE_TOAST_POSITIONS.length)}>
              Cycle position
            </Button>
            <Button onPress={() => setLimitIndex((current) => (current + 1) % LIMITS.length)}>
              Cycle visible limit
            </Button>
            <Button onPress={() => setZeroGap((current) => !current)}>Toggle zero gap</Button>
            <Button onPress={() => setZeroDuration((current) => !current)}>Toggle zero duration</Button>
            <Button onPress={() => setImportant((current) => !current)}>Toggle importance</Button>
            <Button onPress={() => setDark((current) => !current)}>Toggle theme</Button>
            <Button onPress={() => setLocalized((current) => !current)}>Toggle localized labels</Button>
            <Button onPress={() => setCustom((current) => !current)}>Toggle custom slots</Button>
            <Button onPress={() => setEmpty((current) => !current)}>Toggle empty title</Button>
          </View>
          <Text testID="toaster-fixture-events">{events.join("\n") || "No requests"}</Text>
        </ScrollView>
        <Toaster
          position={position}
          maxVisibleToasts={LIMITS[limitIndex]}
          toastGap={zeroGap ? 0 : 15}
          accessibilityLabel={localized ? "Notifications localisées" : "Notifications"}
          ariaLabelledBy="toaster-fixture-heading"
          ariaDescribedBy="toaster-fixture-description"
          labels={{ descriptionLabel: localized ? "Description localisée" : "Description" }}
          toastLabels={
            localized
              ? {
                  closeButtonAriaLabel: "Fermer",
                  cancelActionButton: "Annuler",
                  cancelActionButtonAriaLabel: "Annuler action",
                  confirmActionButton: "Confirmer",
                  confirmActionButtonAriaLabel: "Confirmer action",
                }
              : undefined
          }
          customStackStyles={custom ? { borderWidth: 1, borderColor: "#a66b00" } : undefined}
          customToastBridgeStyles={custom ? { backgroundColor: "transparent" } : undefined}
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}

const styles = StyleSheet.create({
  content: { padding: 15, gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  toast: { borderWidth: 1, borderColor: "#a66b00" },
})
