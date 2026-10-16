import type { ScaledSize, ViewStyle } from "react-native"
import type { EdgeInsets } from "react-native-safe-area-context"

import type { NativeTheme, TNativeAlertDialogType } from "@codon-ui/react-native"

export const getTrialWindowPageStyle = (
  viewport: Pick<ScaledSize, "width" | "height">,
  insets: EdgeInsets,
): ViewStyle => {
  const width = Math.max(0, viewport.width - insets.left - insets.right)
  const height = Math.max(0, viewport.height - insets.top - insets.bottom)
  return { position: "absolute", top: 0, left: 0, borderRadius: 0, width, maxWidth: width, height, maxHeight: height }
}

export const getTrialStyles = (theme: NativeTheme) => {
  const page: ViewStyle = { flex: 1, backgroundColor: theme.colors.background }
  const body: ViewStyle = { padding: theme.spacing.unit * 3, gap: theme.spacing.unit * 3 }
  const row: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.unit * 2 }
  const panel: ViewStyle = {
    width: 400,
    maxWidth: "100%",
    maxHeight: "100%",
    flexShrink: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.rounded,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 2,
  }
  const frame: ViewStyle = {
    flex: 1,
    padding: theme.spacing.unit * 3,
    alignItems: "center",
    justifyContent: "center",
  }
  const backdrop: ViewStyle = {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.overlayBackdrop,
  }
  const full: ViewStyle = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }
  const actions: ViewStyle = { ...row, justifyContent: "flex-end", flexShrink: 0 }
  return { page, body, row, panel, frame, backdrop, full, actions }
}

export const getTrialAlertStyles = (theme: NativeTheme, type: TNativeAlertDialogType) => {
  const color =
    type === "info"
      ? theme.colors.controlSelectedBackground
      : type === "warning"
        ? theme.colors.statusWarning
        : type === "success"
          ? theme.colors.statusSuccess
          : theme.colors.statusDanger
  const ribbon: ViewStyle = { height: theme.spacing.unit * 5, backgroundColor: color }
  const icon: ViewStyle = {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.unit * 2,
    marginBottom: theme.spacing.unit,
    borderWidth: 3,
    borderColor: color,
    borderRadius: theme.radius.round,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 2,
  }
  return { color, ribbon, icon }
}
