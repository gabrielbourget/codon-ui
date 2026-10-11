import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import { NativeShowcase } from "./src/scenes/NativeShowcase"

const App = () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NativeShowcase />
  </SafeAreaProvider>
)

export default App
