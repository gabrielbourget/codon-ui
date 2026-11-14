import { useState } from "react"
import { StyleSheet, TextInput, View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  Breadcrumbs,
  Button,
  Text,
  type BreadcrumbItemData,
  type BreadcrumbNavigateDetails,
} from "@codon-ui/react-native"

const items: readonly BreadcrumbItemData[] = ["Home", "Projects", "Library", "Components", "Navigation", "Current"].map(
  (content, index) => ({
    id: String(index),
    href: index === 2 ? "" : `https://example.com/${index}`,
    content,
    disabled: index === 3,
  }),
)

const diagnosticCurrentLabel =
  "Current location — keep every line readable, including the ending. Emplacement actuel — gardez chaque ligne lisible, jusqu’à la dernière ligne. End of label / Fin du libellé: gypq."
const diagnosticItems: readonly BreadcrumbItemData[] = Array.from({ length: 22 }, (_, index) => ({
  id: String(index),
  href: index === 2 ? "" : `https://example.com/${index}`,
  content: index === 21 ? diagnosticCurrentLabel : `Level ${index + 1}`,
  disabled: index === 3,
}))

const TRAIL_CUSTOMIZATIONS = [
  ["breadcrumb", "Toggle trail breadcrumb styles"],
  ["popover", "Toggle trail popover styles"],
  ["overflow", "Toggle trail overflow button styles"],
  ["link", "Toggle trail link props"],
] as const
type TTrailCustomization = (typeof TRAIL_CUSTOMIZATIONS)[number][0]

export const BreadcrumbsScene = () => {
  const [disabled, setDisabled] = useState(false)
  const [left, setLeft] = useState(false)
  const [styled, setStyled] = useState(false)
  const [customizations, setCustomizations] = useState<readonly TTrailCustomization[]>([])
  const [order, setOrder] = useState(0)
  const [limit, setLimit] = useState<3 | 4>(4)
  const [held, setHeld] = useState(false)
  const [open, setOpen] = useState(false)
  const [echo, setEcho] = useState(true)
  const [closeRequests, setCloseRequests] = useState(0)
  const [navigations, setNavigations] = useState(0)
  const [last, setLast] = useState<BreadcrumbNavigateDetails | null>(null)
  const [original, setOriginal] = useState(false)
  const [draft, setDraft] = useState("")
  const [diagnostic, setDiagnostic] = useState(false)
  const [diagnosticWidth, setDiagnosticWidth] = useState<230 | 300>(300)
  const trailItems = diagnostic ? diagnosticItems : items
  const reset = () => {
    setDisabled(false)
    setLeft(false)
    setStyled(false)
    setCustomizations([])
    setOrder(0)
    setLimit(4)
    setHeld(false)
    setOpen(false)
    setEcho(true)
    setCloseRequests(0)
    setNavigations(0)
    setLast(null)
    setOriginal(false)
    setDraft("")
    setDiagnostic(false)
    setDiagnosticWidth(300)
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2">Breadcrumb navigation</Text>
      <Text testID="breadcrumbs-scene-state">
        Navigations: {navigations}. Close requests: {closeRequests}. Owner {echo ? "echoes" : "declines"}. Last:{" "}
        {last?.item.content ?? "none"}. Target: {last?.target ?? "none"}. Original: {String(original)}. Draft:{" "}
        {draft || "empty"}.
      </Text>
      <Button onPress={() => setDisabled((value) => !value)}>Toggle trail disabled</Button>
      <Button onPress={() => setLeft((value) => !value)}>Toggle trail consolidation</Button>
      <Button onPress={() => setLimit((value) => (value === 4 ? 3 : 4))}>Toggle trail limit</Button>
      <Button onPress={() => setStyled((value) => !value)}>Toggle trail styles</Button>
      {TRAIL_CUSTOMIZATIONS.map(([key, label]) => (
        <Button
          key={key}
          onPress={() =>
            setCustomizations((values) =>
              values.includes(key) ? values.filter((value) => value !== key) : [...values, key],
            )
          }
        >
          {label}
        </Button>
      ))}
      <Text testID="breadcrumbs-customization-state">Trail customizations: {customizations.join(", ") || "none"}.</Text>
      <Button onPress={() => setOrder((value) => (value + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
        Next trail order
      </Button>
      <Button onPress={() => setEcho((value) => !value)}>Toggle trail popup echo</Button>
      <Button
        onPress={() => {
          setHeld(true)
          setOpen(true)
        }}
      >
        Show controlled trail popup
      </Button>
      <Button
        onPress={() => {
          setHeld(false)
          setOpen(false)
        }}
      >
        Use normal trail popup
      </Button>
      <Button onPress={reset}>Reset trail</Button>
      <Text nativeID="breadcrumbs-scene-description">
        A caller-owned trail with one disabled level and an empty URL.
      </Text>
      <TextInput
        testID="breadcrumbs-scene-draft"
        accessibilityLabel="Trail draft"
        value={draft}
        onChangeText={setDraft}
        style={{ minHeight: 44, borderWidth: 1 }}
      />
      <Breadcrumbs
        items={trailItems}
        isDisabled={disabled}
        maxVisibleItems={limit}
        consolidationPlacement={left ? "left" : "right"}
        order={AVAILABLE_THEMING_ORDER_CODES[order]}
        geometry={styled ? "orthogonal" : "round"}
        aria-describedby="breadcrumbs-scene-description"
        labels={{ navAriaLabel: "Scene breadcrumb trail", overflowButtonAriaLabel: "Show hidden trail levels" }}
        customStyles={styled ? { gap: 0, color: "purple" } : undefined}
        style={
          diagnostic
            ? { ...(styled ? { color: "orange" } : {}), width: diagnosticWidth }
            : styled
              ? { color: "orange" }
              : undefined
        }
        customOptionsListStyles={styled ? { color: "purple", padding: 0 } : undefined}
        customBreadcrumbStyles={customizations.includes("breadcrumb") ? styles.breadcrumb : undefined}
        customPopoverStyles={customizations.includes("popover") ? styles.popover : undefined}
        customOverflowItemsPopoverButtonStyles={customizations.includes("overflow") ? styles.overflow : undefined}
        customBreadcrumbLinkProps={customizations.includes("link") ? { style: styles.link } : undefined}
        customClickPopoverProps={{
          ...(held ? { isOpen: open } : {}),
          onOpenChange: (next) => {
            setCloseRequests((value) => value + 1)
            if (echo) setOpen(next)
          },
          showOverlayArrow: styled,
        }}
        onNavigate={(details) => {
          setNavigations((value) => value + 1)
          setOriginal(trailItems.includes(details.item))
          setLast(details)
        }}
      />
      <Button onPress={() => setDiagnostic((value) => !value)}>Toggle long-label diagnostic</Button>
      {diagnostic && (
        <>
          <Text testID="breadcrumbs-diagnostic-state">
            {trailItems.length} items. Requested width: {diagnosticWidth} points.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            <Button onPress={() => setDiagnosticWidth(230)}>Set trail width 230</Button>
            <Button onPress={() => setDiagnosticWidth(300)}>Set trail width 300</Button>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  breadcrumb: { padding: 6, borderWidth: 2, borderColor: "#087f8c" },
  popover: { backgroundColor: "#fff2cc", borderWidth: 2, borderColor: "#7c3aed" },
  overflow: { backgroundColor: "#ddeeff", borderWidth: 2, borderColor: "#174ea6" },
  link: { color: "#be123c", textDecorationLine: "underline" },
})
