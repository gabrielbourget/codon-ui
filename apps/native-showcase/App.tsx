import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import { NativeFloatingLayerHost } from "@codon-ui/react-native"

import { NativeShowcase } from "./src/scenes/NativeShowcase"

const App = () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NativeFloatingLayerHost testID="showcase-floating-host">
      <NativeShowcase />
    </NativeFloatingLayerHost>
  </SafeAreaProvider>
)

export default App
