import { View } from "react-native"

import { useNativeTheme } from "../../theme"
import { CircleLoader } from "../CircleLoader/CircleLoader"
import { useNativeContentContext } from "../NativeContentContext"

export const NativeTypeaheadSearchIcon = () => {
  const theme = useNativeTheme()
  const color = useNativeContentContext()?.foregroundColor ?? theme.colors.controlForeground
  return (
    <View
      testID="typeahead-search-default-search-icon"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: 18, height: 18 }}
    >
      <View
        style={{
          position: "absolute",
          top: 1.5,
          left: 1.5,
          width: 10.5,
          height: 10.5,
          borderWidth: 1.5,
          borderRadius: 10.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 12.1,
          left: 9.2,
          width: 8,
          height: 2.25,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  )
}

export const NativeTypeaheadLoadingIndicator = () => (
  <View
    testID="typeahead-search-default-loading-indicator"
    style={{ minWidth: 24, minHeight: 24, alignItems: "center", justifyContent: "center" }}
  >
    <CircleLoader size={18} spinnerTrackWidth={2.5} spinnerTrackIsTransparent duration={850} />
  </View>
)
