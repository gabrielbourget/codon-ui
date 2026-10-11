import type { PropsWithChildren } from "react"
import { StyleSheet, Text, View } from "react-native"

import { useNativeTheme } from "@codon-ui/react-native"

import { LAYOUT_FIXTURE_LABELS, type TLayoutFixture } from "../fixtures/layout"

type TSceneShellProps = PropsWithChildren<{ fixture: TLayoutFixture }>

export const SceneShell = ({ fixture, children }: TSceneShellProps) => {
  const theme = useNativeTheme()
  const isVerticalBlock = fixture === "vertical-block"
  const isHorizontalBlock = fixture === "horizontal-block"
  const maximumWidth = fixture === "compact" ? 320 : fixture === "expanded" ? 900 : undefined

  return (
    <View style={[styles.scene, { maxWidth: maximumWidth, borderColor: theme.colors.controlBorder }]}>
      <Text style={[styles.caption, { color: theme.colors.foreground }]}>{LAYOUT_FIXTURE_LABELS[fixture]}</Text>
      {(isVerticalBlock || isHorizontalBlock) && (
        <Text style={{ color: theme.colors.foreground }}>Simulated geometry; no hardware posture events.</Text>
      )}
      <View style={isVerticalBlock ? styles.verticalLayout : undefined}>
        <View style={styles.content}>{children}</View>
        {isVerticalBlock && <View accessible={false} style={styles.verticalBlock} />}
        {isHorizontalBlock && <View accessible={false} style={styles.horizontalBlock} />}
        {(isVerticalBlock || isHorizontalBlock) && (
          <View style={styles.content}>
            <Text style={{ color: theme.colors.foreground }}>
              Complementary region stays reachable; fixture changes preserve scene state.
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { alignSelf: "center", width: "100%", borderWidth: 1, borderRadius: 5, padding: 10, gap: 10 },
  caption: { fontWeight: "600", fontSize: 16 },
  content: { flex: 1, minWidth: 0 },
  verticalLayout: { flexDirection: "row", gap: 10 },
  verticalBlock: { width: 20, backgroundColor: "#878787" },
  horizontalBlock: { height: 20, marginVertical: 10, backgroundColor: "#878787" },
})
