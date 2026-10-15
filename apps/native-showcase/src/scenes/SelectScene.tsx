import { useState } from "react"
import { View } from "react-native"

import { Button, Select, Text, useNativeTheme, type TNativeSelectKey } from "@codon-ui/react-native"

const SHORT_ITEMS = [
  { id: 0, label: "Numeric zero" },
  { id: "0", label: "String zero" },
  { id: "unavailable", label: "Unavailable choice" },
  {
    id: "long",
    label: "Sélectionnez les paramètres et continuez lorsque vous êtes prêt à enregistrer les modifications.",
  },
]
const LONG_ITEMS = Array.from({ length: 200 }, (_, index) => ({
  id: `choice-${index}`,
  label: `Choice ${index + 1}${index % 11 === 0 ? " — sélectionnez les paramètres et continuez lorsque vous êtes prêt." : ""}`,
}))
const COLLECTIONS = ["short", "long", "empty"] as const
const keyLabel = (key: TNativeSelectKey | null) => (key === null ? "none" : `${typeof key}:${key}`)

export const SelectScene = () => {
  const theme = useNativeTheme()
  const [value, setValue] = useState<TNativeSelectKey | null>(null)
  const [changes, setChanges] = useState(0)
  const [open, setOpen] = useState(false)
  const [openEvents, setOpenEvents] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [hideSelected, setHideSelected] = useState(false)
  const [collectionIndex, setCollectionIndex] = useState(0)
  const [uncontrolled, setUncontrolled] = useState<TNativeSelectKey | null>(0)
  const collection = COLLECTIONS[collectionIndex]
  const items = collection === "short" ? SHORT_ITEMS : collection === "long" ? LONG_ITEMS : []
  const action = (label: string, press: () => void) => (
    <Button accessibilityLabel={label} onPress={press} raised={false} order="primary">
      {label}
    </Button>
  )
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native Select
      </Text>
      <Text testID="select-state">
        Value: {keyLabel(value)}. Changes: {changes}. Open: {open ? "yes" : "no"}. Open events: {openEvents}.
        Collection: {collection}. State: {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Uncontrolled:{" "}
        {keyLabel(uncontrolled)}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {action("Toggle Select disabled", () => setDisabled((current) => !current))}
        {action("Toggle Select read-only", () => setReadOnly((current) => !current))}
        {action("Next Select collection", () => setCollectionIndex((current) => (current + 1) % COLLECTIONS.length))}
        {action("Choose near-end value", () => {
          setCollectionIndex(1)
          setValue("choice-198")
          setHideSelected(false)
        })}
        {action("Clear Select value", () => setValue(null))}
        {action("Toggle Select custom content", () => setCustom((current) => !current))}
        {action("Toggle selected item removal", () => setHideSelected((current) => !current))}
      </View>
      <Select
        testID="showcase-select"
        accessibilityLabel="Showcase choice"
        closeLabel="Close choices"
        placeholder="Choose a value"
        items={hideSelected ? items.filter((item) => item.id !== value) : items}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        value={value}
        onChange={(next) => {
          setValue(next)
          setChanges((count) => count + 1)
        }}
        isOpen={open}
        onOpenChange={(next) => {
          setOpen(next)
          setOpenEvents((count) => count + 1)
        }}
        isDisabled={disabled}
        isReadOnly={readOnly}
        disabledKeys={["unavailable"]}
        width="100%"
        geometry={custom ? "orthogonal" : "rounded"}
        customSelectedItemStyles={custom ? { paddingHorizontal: 10, borderColor: theme.colors.focusRing } : undefined}
        customSelectedItemTextStyles={custom ? { fontWeight: "700" } : undefined}
        renderItem={
          custom
            ? (item, state) => (
                <>
                  {item.label}
                  {state.isSelected ? " ✓" : ""}
                </>
              )
            : undefined
        }
        renderSelectedValue={
          custom ? ({ selectedText, isPlaceholder }) => <>Picked {isPlaceholder ? "none" : selectedText}</> : undefined
        }
        style={({ defaultStyle }) => defaultStyle}
      />
      <Select
        testID="uncontrolled-select"
        accessibilityLabel="Uncontrolled choice"
        closeLabel="Close uncontrolled choices"
        items={SHORT_ITEMS}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        defaultValue={0}
        onChange={setUncontrolled}
        isDisabled={disabled}
        isReadOnly={readOnly}
        disabledKeys={["unavailable"]}
        width="100%"
      />
      <Text testID="select-footer">
        Select preserves native text scaling and explicit item labels. Selection, dismissal, long-list reachability and
        safe areas are inspected in the local lab; closer visual and physical review accompanies application
        integration.
      </Text>
    </View>
  )
}
