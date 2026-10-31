import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import { ToasterInteractionFixture } from "../../../../packages/react-native/src/components/Toaster/__tests__/fixtures/ToasterInteractionFixture"

export default () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ToasterInteractionFixture />
  </SafeAreaProvider>
)
