import type { PropsWithChildren } from "react"
import { View } from "react-native"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import {
  DefaultNativeBackdropAdapter,
  NativeBackdropHost,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  type NativeThemeMode,
  type NativeThemeOverrides,
} from "../src"

// App-owned composition; consumers import the public exports from @codon-ui/react-native.
export const ConsumerRoot = ({
  children,
  mode = "light",
  overrides,
  enableBackdropBlur = true,
}: PropsWithChildren<{
  mode?: NativeThemeMode
  overrides?: NativeThemeOverrides
  enableBackdropBlur?: boolean
}>) => {
  const Window = enableBackdropBlur ? NativeBackdropHost : View
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <NativeThemeProvider mode={mode} overrides={overrides}>
        <NativeOverlayProvider backdropAdapter={enableBackdropBlur ? DefaultNativeBackdropAdapter : null}>
          <Window style={{ flex: 1 }}>
            <NativeFloatingLayerHost>
              <View style={{ flex: 1 }}>{children}</View>
            </NativeFloatingLayerHost>
          </Window>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
