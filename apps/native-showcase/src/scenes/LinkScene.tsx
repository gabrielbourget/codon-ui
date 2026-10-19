import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AVAILABLE_THEMING_ORDER_CODES, Button, Link, Text } from "@codon-ui/react-native"

const DESTINATIONS = ["codon-lab-unhandled://destination?value=0&empty=", "", "#section", "/relative"] as const
const RELATIONSHIP_MODES = ["none", "aliases", "attributes", "empty"] as const

export const LinkScene = () => {
  const [destinationIndex, setDestinationIndex] = useState(0)
  const [visited, setVisited] = useState(false)
  const [echo, setEcho] = useState(false)
  const [handoff, setHandoff] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [armed, setArmed] = useState(false)
  const [requests, setRequests] = useState(0)
  const [last, setLast] = useState("none")
  const [errors, setErrors] = useState(0)
  const [lastError, setLastError] = useState("none")
  const [orderIndex, setOrderIndex] = useState(0)
  const [custom, setCustom] = useState(false)
  const [colors, setColors] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [focusStyle, setFocusStyle] = useState(true)
  const [zero, setZero] = useState(false)
  const [constrained, setConstrained] = useState(false)
  const [longLabel, setLongLabel] = useState(false)
  const [relationshipIndex, setRelationshipIndex] = useState(0)
  const [longRelationshipText, setLongRelationshipText] = useState(false)
  const [descriptionTarget, setDescriptionTarget] = useState(true)
  const [frame, setFrame] = useState<{ width: number; height: number }>()
  const href = DESTINATIONS[destinationIndex]
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const relationships = RELATIONSHIP_MODES[relationshipIndex]
  const related = relationships !== "none"
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Native link ownership and URL handoff
      </Text>
      <Text testID="link-state">
        Visited: {String(visited)}. Echo: {String(echo)}. Handoff: {String(handoff)}. Disabled: {String(disabled)}.
        Requests: {requests}. Last: {last}. Errors: {errors}. Last error: {lastError}. Target: {JSON.stringify(href)}.
        Relationships: {relationships}. Description target: {String(descriptionTarget)}. Order: {order}. Frame:{" "}
        {frame ? `${frame.width} x ${frame.height}` : "unmeasured"}. Armed guard: {String(armed)}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setVisited((value) => !value)}>Toggle link owner visited</Button>
        <Button onPress={() => setEcho((value) => !value)}>Toggle link visited echo</Button>
        <Button onPress={() => setHandoff((value) => !value)}>Toggle native URL handoff</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle link disabled</Button>
        <Button onPress={() => setArmed(true)}>Arm link disable during press</Button>
        <Button onPress={() => setDestinationIndex((index) => (index + 1) % DESTINATIONS.length)}>
          Next link destination
        </Button>
        <Button onPress={() => setOrderIndex((index) => (index + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
          Next link order
        </Button>
        <Button onPress={() => setColors((value) => !value)}>Toggle link colors</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle link styles</Button>
        <Button onPress={() => setUnderline((value) => !value)}>Toggle link underline</Button>
        <Button onPress={() => setFocusStyle((value) => !value)}>Toggle link focus ring</Button>
        <Button onPress={() => setZero((value) => !value)}>Toggle link zero dimensions</Button>
        <Button onPress={() => setConstrained((value) => !value)}>Toggle link width constraint</Button>
        <Button onPress={() => setLongLabel((value) => !value)}>Toggle long link label</Button>
        <Button onPress={() => setRelationshipIndex((value) => (value + 1) % RELATIONSHIP_MODES.length)}>
          Next link relationships
        </Button>
        <Button onPress={() => setLongRelationshipText((value) => !value)}>Toggle link relationship text</Button>
        <Button onPress={() => setDescriptionTarget((value) => !value)}>Toggle link description target</Button>
      </View>
      <Link
        testID="link-example"
        ariaLabelledBy={related ? "link-related-name" : undefined}
        ariaDescribedBy={related ? "link-related-description" : undefined}
        ariaDetails={related ? "link-related-details" : undefined}
        aria-labelledby={
          relationships === "attributes" ? "link-native-name" : relationships === "empty" ? "" : undefined
        }
        aria-describedby={
          relationships === "attributes" ? "link-native-description" : relationships === "empty" ? "" : undefined
        }
        aria-details={
          relationships === "attributes" ? "link-native-details" : relationships === "empty" ? "" : undefined
        }
        labels={{ descriptionLabel: "Description du lien", detailsLabel: "Renseignements" }}
        accessibilityLabel="Controlled native link"
        accessibilityHint="The owner intercepts navigation until URL handoff is enabled."
        href={href}
        isVisited={visited}
        isDisabled={disabled}
        order={order}
        color={colors ? "#b73434" : undefined}
        visitedColor={colors ? "#2f7d18" : undefined}
        textDecoration={underline ? "underline" : undefined}
        enableFocusStyle={focusStyle}
        offsetFocusRing={focusStyle}
        customStyles={custom ? { fontSize: 18, color: "#a66b00", padding: 0 } : undefined}
        style={{
          ...(custom ? { color: "#2f7d18", fontSize: 20, borderWidth: 1, borderColor: "#b73434" } : {}),
          width: zero ? 0 : constrained ? 140 : undefined,
          height: zero ? 0 : undefined,
        }}
        onPressIn={() => {
          if (!armed) return
          setArmed(false)
          setDisabled(true)
        }}
        onPress={(event) => {
          setRequests((count) => count + 1)
          setLast(JSON.stringify(href))
          if (!handoff) event.preventDefault()
          if (echo) setVisited(true)
        }}
        onNavigationError={(error, destination) => {
          setErrors((count) => count + 1)
          setLastError(`${JSON.stringify(destination)}: ${String(error)}`)
        }}
        onLayout={({ nativeEvent: { layout } }) => {
          const width = Math.round(layout.width * 1000) / 1000
          const height = Math.round(layout.height * 1000) / 1000
          setFrame((current) => (current?.width === width && current.height === height ? current : { width, height }))
        }}
      >
        {longLabel
          ? "Lien long : les destinations, les couleurs et les valeurs restent sous le contrôle de la personne."
          : "Request destination / ouvrir"}
      </Link>
      <Text nativeID="link-related-name">
        {longRelationshipText ? "Destination liée : renseignements détaillés" : "Related destination"}
      </Text>
      <Text nativeID="link-native-name">Native attribute destination</Text>
      {descriptionTarget ? (
        <>
          <Text nativeID="link-related-description">
            {longRelationshipText
              ? "Description française longue pour vérifier la mise à jour du texte natif."
              : "Related guidance"}
          </Text>
          <Text nativeID="link-native-description">Native attribute guidance</Text>
        </>
      ) : null}
      <Text nativeID="link-related-details">Related URL: {JSON.stringify(href)}</Text>
      <Text nativeID="link-native-details">Native attribute details</Text>
      <Text>
        Visited state belongs to this scene. URL handoff uses the installed OS handler; browser history and routing
        remain separate contracts.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
