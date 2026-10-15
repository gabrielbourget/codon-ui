import { Text as NativeText, View, type ColorValue } from "react-native"

import { useNativeTheme } from "../../theme"

import type { TNativeAlertDialogType } from "./types"

export const DefaultAlertMark = ({ type, color }: { type: TNativeAlertDialogType; color: ColorValue }) => {
  const theme = useNativeTheme()
  const size = type === "warning" ? 40 : type === "danger" ? 45 : type === "success" ? 65 : 50
  const glyph = (value: string) => (
    <NativeText
      allowFontScaling={false}
      style={{ color, fontWeight: "700", fontSize: size * 0.8, lineHeight: size, textAlign: "center" }}
    >
      {value}
    </NativeText>
  )
  return (
    <View
      testID={`alert-dialog-default-${type}-icon`}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {type === "success" ? (
        <View
          style={{
            width: size * 0.55,
            height: size * 0.28,
            borderLeftWidth: 5,
            borderBottomWidth: 5,
            borderColor: color,
            transform: [{ rotate: "-45deg" }],
            marginBottom: 9,
          }}
        />
      ) : type === "delete" ? (
        <>
          <View style={{ width: 18, height: 5, borderWidth: 2, borderColor: color }} />
          <View style={{ width: 34, height: 3, backgroundColor: color }} />
          <View
            style={{
              width: 28,
              height: 30,
              borderWidth: 3,
              borderColor: color,
              flexDirection: "row",
              justifyContent: "space-evenly",
              padding: 4,
            }}
          >
            <View style={{ width: 2, backgroundColor: color }} />
            <View style={{ width: 2, backgroundColor: color }} />
          </View>
        </>
      ) : type === "warning" ? (
        <>
          <View
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              borderLeftWidth: 20,
              borderRightWidth: 20,
              borderBottomWidth: 36,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: color,
            }}
          />
          <NativeText
            allowFontScaling={false}
            style={{ fontWeight: "700", fontSize: 24, color: theme.colors.controlSelectedForeground, marginTop: 7 }}
          >
            !
          </NativeText>
        </>
      ) : type === "danger" ? (
        <>
          <View
            style={{
              position: "absolute",
              width: 32,
              height: 32,
              borderWidth: 3,
              borderColor: color,
              borderRadius: 7,
              transform: [{ rotate: "45deg" }],
            }}
          />
          {glyph("!")}
        </>
      ) : (
        glyph(type === "error" ? "×" : "i")
      )}
    </View>
  )
}
